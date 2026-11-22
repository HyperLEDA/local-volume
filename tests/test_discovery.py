"""Independent HTTP and metadata regression tests for LV LEDA #72."""

import xml.etree.ElementTree as ET
from types import SimpleNamespace

import fastapi
import pytest
from fastapi import HTTPException, Request
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from lv_backend.presentation import app as web_app
from lv_backend.presentation import discovery

HTML = (
    '<!doctype html><html lang="en"><head><meta charset="UTF-8" />'
    "<title>LV LEDA | Galaxies of the Nearby Universe</title></head>"
    '<body><div id="root"></div><script src="/assets/app.js"></script></body></html>'
)
NAMESPACE = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def test_object_titles_and_unavailable_measurements():
    m31 = discovery.object_page(SimpleNamespace(name="M 31", dist=0.77), 2557)
    ngc147 = discovery.object_page(SimpleNamespace(name="NGC 147", dist=None), 2004)
    assert m31.title != ngc147.title
    assert "0.77 Mpc" in m31.description
    assert "distance" not in ngc147.description.lower()
    assert m31.canonical_path == "/object/2557"


def test_html_canonical_opengraph_and_escaping():
    m31 = discovery.object_page(SimpleNamespace(name="M 31", dist=0.77), 2557)
    html = discovery.html_document(HTML, m31, "https://example.org")
    assert html.count('<link rel="canonical"') == 1
    assert 'href="https://example.org/object/2557"' in html
    assert 'property="og:url" content="https://example.org/object/2557"' in html
    assert 'property="og:site_name" content="LV LEDA"' in html
    assert 'name="twitter:card" content="summary"' in html
    assert html.count("<title>") == 1
    unsafe = discovery.object_page(SimpleNamespace(name='<script>"&</script>', dist=None), 123)
    rendered = discovery.html_document(HTML, unsafe, "https://example.org")
    assert "<script>" not in rendered
    assert "&lt;script&gt;" in rendered
    with pytest.raises(ValueError, match="closing head"):
        discovery.html_document("<html></html>", m31, None)


@pytest.mark.parametrize(
    "invalid",
    [
        "",
        "http://example.org",
        "https://example.org/abc",
        "https://u@example.org",
        "https://example.org?q=x",
        "https://example.org/#frag",
        "https://example.org:8443",
        "https://example.org:invalid",
        "https://example.org/path/../",
    ],
)
def test_origin_requires_explicit_clean_https(monkeypatch, invalid):
    monkeypatch.setenv("LV_PUBLIC_ORIGIN", invalid)
    assert discovery.public_origin() is None


def test_public_origin_host_gating(monkeypatch):
    monkeypatch.setenv("LV_PUBLIC_ORIGIN", "https://LV.Example.org/")
    assert discovery.public_origin() == "https://lv.example.org"
    assert discovery.public_origin_for_host("lv.example.org") == "https://lv.example.org"
    assert discovery.public_origin_for_host("lv.example.org:443") == "https://lv.example.org"
    assert discovery.public_origin_for_host("preview.example.org") is None
    assert discovery.public_origin_for_host(None) is None
    assert discovery.public_origin_for_host("lv.example.org:9999") is None


def test_group_definitions_are_scientifically_distinct():
    group = {"name": "M 31", "member_count": 62}
    physical = discovery.group_page(group, 2557, "physical")
    suite = discovery.group_page(group, 2557, "suite")
    assert physical.canonical_path == "/groups/2557?definition=physical"
    assert suite.canonical_path == "/groups/2557?definition=suite"
    assert physical.title != suite.title
    assert "62 member galaxies" in physical.description
    assert discovery.static_page("groups/preview-builder").indexable is False
    assert discovery.static_page("groups", definition="published") is None
    assert discovery.static_page("unknown") is None


def test_sitemap_deduplicates_entities_excludes_internal_and_uses_xml():
    paths = discovery.sitemap_paths(
        [2557, 2004, 2557, -1, 0, True],
        {"physical": [2557, 2557, True], "suite": [2004], "published": [1]},
    )
    assert paths.count("/object/2557") == 1
    assert "/object/True" not in paths
    assert "/groups/True?definition=physical" not in paths
    assert "/groups/2557?definition=physical" in paths
    assert "/groups/2004?definition=suite" in paths
    assert not any("published" in path or "preview-builder" in path for path in paths)
    assert not any("atlas=" in path or "browse=" in path for path in paths)
    xml = discovery.sitemap_xml("https://example.org", paths)
    parsed = ET.fromstring(xml)
    urls = [e.text for e in parsed.findall(f"{NAMESPACE}url/{NAMESPACE}loc")]
    assert "https://example.org/groups/2557?definition=physical" in urls
    assert "https://example.org/groups/2004?definition=suite" in urls
    assert "&amp;" not in urls[0]  # parsed XML is unescaped
    assert "lastmod" not in xml


def test_sitemap_limits_and_index():
    with pytest.raises(ValueError, match="index"):
        discovery.sitemap_xml("https://example.org", ["/object/1"] * 50_001)
    chunks = discovery.sitemap_chunks([f"/object/{i}" for i in range(40_001)])
    assert len(chunks) == 2
    assert len(chunks[0]) == 40_000
    assert len(chunks[1]) == 1
    index = ET.fromstring(discovery.sitemap_index_xml("https://example.org", 2))
    urls = [e.text for e in index.findall(f"{NAMESPACE}sitemap/{NAMESPACE}loc")]
    assert urls == [
        "https://example.org/sitemap-part/1.xml",
        "https://example.org/sitemap-part/2.xml",
    ]
    with pytest.raises(ValueError, match="size"):
        discovery.sitemap_chunks([], chunk_size=50_001)


def test_robots_fail_closed():
    assert discovery.robots_text(None) == "User-agent: *\nDisallow: /\n"
    public = discovery.robots_text("https://example.org")
    assert "Disallow: /api/" in public
    assert "Disallow: /groups/preview-builder" in public
    assert "Sitemap: https://example.org/sitemap.xml" in public


def test_direct_request_page_builder_404_and_staging(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text(HTML, encoding="utf-8")
    monkeypatch.setattr(web_app, "_DIST_DIR", tmp_path)
    monkeypatch.setenv("LV_PUBLIC_ORIGIN", "https://example.org")
    monkeypatch.setattr(
        web_app.objects,
        "get_object",
        lambda _storage, pgc: SimpleNamespace(data=SimpleNamespace(name="M 31", dist=0.77)) if pgc == 2557 else None,
    )
    monkeypatch.setattr(
        web_app.domain_groups,
        "get_group",
        lambda _storage, pgc, definition: (
            {"name": "M 31", "member_count": 62} if pgc == 2557 and definition in ("physical", "suite") else None
        ),
    )
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/object/2557",
        "query_string": b"",
        "headers": [(b"host", b"example.org")],
        "app": web_app.app,
    }
    web_app.app.state.storage = object()
    response = web_app._frontend_page("object/2557", Request(scope))  # noqa: SLF001
    assert response.status_code == 200
    assert "M 31 — PGC 2557" in response.body.decode()
    assert "https://example.org/object/2557" in response.body.decode()
    assert "x-robots-tag" not in response.headers

    staging = Request({**scope, "headers": [(b"host", b"staging.example.org")]})
    response = web_app._frontend_page("object/2557", staging)  # noqa: SLF001
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
    assert 'rel="canonical"' not in response.body.decode()

    with pytest.raises(HTTPException) as error:
        web_app._frontend_page("object/999999999", Request(scope))  # noqa: SLF001
    assert error.value.status_code == 404
    for path in ("groups/999999999", "object/0002557", "some-unknown-route", "index.html"):
        with pytest.raises(HTTPException) as error:
            web_app._frontend_page(path, Request(scope))  # noqa: SLF001
        assert error.value.status_code == 404


def test_http_routes_sitemap_status_agrees_with_entity_pages(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text(HTML, encoding="utf-8")
    (tmp_path / "favicon.svg").write_text("<svg></svg>", encoding="utf-8")
    monkeypatch.setattr(web_app, "_DIST_DIR", tmp_path)
    monkeypatch.setenv("LV_PUBLIC_ORIGIN", "https://example.org")

    def get_object(_storage, pgc):
        names = {2557: "M 31", 2004: "NGC 147"}
        if pgc not in names:
            return None
        return SimpleNamespace(data=SimpleNamespace(name=names[pgc], dist=None))

    def get_group(_storage, pgc, definition):
        if (pgc, definition) == (2557, "physical"):
            return {"name": "M 31", "member_count": 62}
        if (pgc, definition) == (2004, "suite"):
            return {"name": "NGC 147", "member_count": 6}
        return None

    monkeypatch.setattr(web_app.objects, "get_object", get_object)
    monkeypatch.setattr(
        web_app.objects,
        "list_objects",
        lambda _storage: SimpleNamespace(data=SimpleNamespace(pgc=[2557, 2004])),
    )
    monkeypatch.setattr(web_app.domain_groups, "get_group", get_group)
    monkeypatch.setattr(
        web_app.domain_groups,
        "list_groups",
        lambda _storage, definition: [{"root_pgc": 2557}] if definition == "physical" else [{"root_pgc": 2004}],
    )

    app = fastapi.FastAPI()
    app.state.storage = object()
    for path in ("/robots.txt", "/sitemap.xml", "/sitemap-part/{number}.xml"):
        actual = [r for r in web_app.app.routes if isinstance(r, APIRoute) and r.path == path]
        assert len(actual) == 1, f"Missing actual HTTP route: {path}"
        assert actual[0].methods == {"GET", "HEAD"}, f"HEAD not supported by {path}"
        app.router.routes.append(actual[0])
    web_app._mount_frontend(app, tmp_path)  # noqa: SLF001

    with TestClient(app, base_url="https://example.org") as client:
        assert client.get("/object/2557").status_code == 200
        first = client.get("/object/2557").text
        second = client.get("/object/2004").text
        assert first != second
        assert "M 31" in first and "NGC 147" in second
        assert client.get("/object/999999999").status_code == 404
        assert client.get("/object/0002557").status_code == 404
        assert client.get("/groups/2557?definition=published").status_code == 404
        assert client.get("/unknown-path").status_code == 404
        assert client.get("/index.html").status_code == 404
        assert client.get("/favicon.svg").status_code == 200
        assert client.head("/object/2557").status_code == 200

        result = client.get("/robots.txt")
        assert result.status_code == 200
        assert result.headers["content-type"].startswith("text/plain")
        assert "Sitemap: https://example.org/sitemap.xml" in result.text
        assert client.head("/robots.txt").status_code == 200

        result = client.get("/sitemap.xml")
        assert result.status_code == 200
        assert result.headers["content-type"].startswith("application/xml")
        paths = [e.text for e in ET.fromstring(result.text).findall(f"{NAMESPACE}url/{NAMESPACE}loc")]
        for url in paths:
            assert url.startswith("https://example.org/")
            relative = url.removeprefix("https://example.org")
            response = client.get(relative)
            assert response.status_code == 200, (url, response.status_code)
        assert "https://example.org/groups/2557?definition=physical" in paths
        assert "https://example.org/groups/2004?definition=suite" in paths
        assert client.get("/sitemap-part/1.xml").status_code == 404
        assert client.head("/sitemap.xml").status_code == 200

    with TestClient(app, base_url="https://preview.example.org") as staging:
        assert staging.get("/sitemap.xml").status_code == 404
        assert staging.get("/robots.txt").text == "User-agent: *\nDisallow: /\n"
        assert staging.get("/object/2557").headers["x-robots-tag"] == "noindex, nofollow"
        assert 'rel="canonical"' not in staging.get("/object/2557").text


def test_sitemap_index_part_responses(tmp_path, monkeypatch):
    monkeypatch.setenv("LV_PUBLIC_ORIGIN", "https://example.org")
    monkeypatch.setattr(
        web_app,
        "_catalogue_sitemap_paths",
        lambda _storage: ["/object/2557", "/object/2004", "/groups/2557?definition=physical"],
    )
    monkeypatch.setattr(
        web_app.discovery,
        "sitemap_chunks",
        lambda paths: [paths[:2], paths[2:]],
    )
    app = fastapi.FastAPI()
    app.state.storage = object()
    for path in ("/sitemap.xml", "/sitemap-part/{number}.xml"):
        real = next(r for r in web_app.app.routes if isinstance(r, APIRoute) and r.path == path)
        app.router.routes.append(real)
    with TestClient(app, base_url="https://example.org") as client:
        index = client.get("/sitemap.xml")
        assert index.status_code == 200
        assert ET.fromstring(index.text).tag.endswith("sitemapindex")
        first = client.get("/sitemap-part/1.xml")
        last = client.get("/sitemap-part/2.xml")
        assert first.status_code == 200 and last.status_code == 200
        assert "2557" in first.text and "definition=physical" in last.text
        assert client.get("/sitemap-part/3.xml").status_code == 404
