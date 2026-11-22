"""HTTP-first scientific discovery helpers for LV LEDA.

The production origin defaults to an explicitly known LV LEDA hostname.
No request or forwarding headers may determine a new canonical origin.
"""

from __future__ import annotations

import html
import math
import os
import re
from dataclasses import dataclass
from urllib.parse import urlsplit
from xml.sax.saxutils import escape as xml_escape

_PRODUCTION_ORIGIN = "https://lv.leda.sao.ru"


@dataclass(frozen=True)
class PageInfo:
    title: str
    description: str
    canonical_path: str | None
    indexable: bool = True


def public_origin() -> str | None:
    """Validate the optional, explicitly configured HTTPS origin override."""
    raw = os.environ.get("LV_PUBLIC_ORIGIN", "").strip()
    if not raw:
        return None
    try:
        parsed = urlsplit(raw)
        port = parsed.port
    except ValueError:
        return None
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
        or port not in (None, 443)
        or re.search(r"[^a-zA-Z0-9.\-]", parsed.hostname)
    ):
        return None
    return f"https://{parsed.hostname.lower()}"


def public_origin_for_host(request_host: str | None) -> str | None:
    """Enable the official production host; keep preview and local hosts noindex."""
    # An explicit setting overrides the built-in production domain, including
    # an empty/invalid setting that deliberately disables public indexing.
    origin = public_origin() if "LV_PUBLIC_ORIGIN" in os.environ else _PRODUCTION_ORIGIN
    if origin is None or not request_host:
        return None
    expected_host = urlsplit(origin).hostname
    received_host = request_host.strip().lower().rstrip(".")
    if received_host not in (expected_host, f"{expected_host}:443"):
        return None
    return origin


def _safe_text(text: object, maximum: int = 240) -> str:
    clean = re.sub(r"[\x00-\x1f\x7f]", " ", str(text or ""))
    return " ".join(clean.split())[:maximum]


def static_page(path: str, *, definition: str = "physical") -> PageInfo | None:
    if path == "":
        return PageInfo(
            "LV LEDA | Galaxies of the Nearby Universe",
            "Scientific atlas of nearby galaxies: celestial positions, observed parameters, "
            "physical properties and environments.",
            "/",
        )
    if path == "groups":
        if definition not in ("physical", "suite"):
            return None
        label = "MD suites" if definition == "suite" else "Physical galaxy groups"
        canonical = "/groups?definition=suite" if definition == "suite" else "/groups"
        return PageInfo(
            f"{label} | LV LEDA",
            f"{label} in the LV LEDA catalogue, including member galaxies, sky maps and available group diagnostics.",
            canonical,
        )
    pages: dict[str, tuple[str, str]] = {
        "documents": ("Scientific documents", "Documentation of the LV LEDA catalogue and scientific tools."),
        "publications": ("Publications", "Publications related to the LV LEDA scientific catalogue."),
        "acknowledgements": ("Acknowledgements", "Acknowledgements and project information for LV LEDA."),
        "groups/preview-builder": ("Group preview builder", "Internal group preview management tool."),
    }
    if path not in pages:
        return None
    title, description = pages[path]
    if path == "groups/preview-builder":
        return PageInfo(f"{title} | LV LEDA", description, None, indexable=False)
    return PageInfo(f"{title} | LV LEDA", description, "/" + path)


def object_page(data: object, pgc: int) -> PageInfo:
    name = _safe_text(getattr(data, "name", ""), maximum=100) or f"PGC {pgc}"
    detail = f"Galaxy {name} (PGC {pgc}) in the LV LEDA Local Volume catalogue."
    distance = getattr(data, "dist", None)
    if (
        isinstance(distance, (int, float))
        and not isinstance(distance, bool)
        and math.isfinite(distance)
        and distance > 0
    ):
        detail += f" Adopted distance: {distance:.3g} Mpc."
    detail += " Celestial coordinates and available observational and derived parameters."
    return PageInfo(f"{name} — PGC {pgc} | LV LEDA", detail, f"/object/{pgc}")


def group_page(data: dict[str, object], root_pgc: int, definition: str) -> PageInfo:
    name = _safe_text(data.get("name"), maximum=100) or f"PGC {root_pgc}"
    label = "MD suite" if definition == "suite" else "physical group"
    count = data.get("member_count")
    count_text = f"{count} member galaxies" if isinstance(count, int) and count >= 0 else "member galaxies"
    return PageInfo(
        f"{name} — {label} (PGC {root_pgc}) | LV LEDA",
        f"{name} {label} in LV LEDA: {count_text}, sky positions and available scientific diagnostics.",
        f"/groups/{root_pgc}?definition={definition}",
    )


def html_document(template: str, page: PageInfo, origin: str | None) -> str:
    """Entity-specific HTML sent as the first HTTP response, without SSR."""
    if "</head>" not in template:
        raise ValueError("Frontend HTML has no closing head element")
    title = html.escape(_safe_text(page.title), quote=True)
    description = html.escape(_safe_text(page.description), quote=True)
    if re.search(r"<title(?:\s[^>]*)?>.*?</title>", template, flags=re.I | re.S):
        template = re.sub(
            r"<title(?:\s[^>]*)?>.*?</title>",
            lambda _: f"<title>{title}</title>",
            template,
            count=1,
            flags=re.I | re.S,
        )
    else:
        template = template.replace("</head>", f"<title>{title}</title>\n  </head>", 1)
    tags = [
        f'<meta name="description" content="{description}" />',
        f'<meta property="og:title" content="{title}" />',
        f'<meta property="og:description" content="{description}" />',
        '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="LV LEDA" />',
        '<meta name="twitter:card" content="summary" />',
    ]
    if origin and page.canonical_path and page.indexable:
        absolute = html.escape(origin + page.canonical_path, quote=True)
        tags.extend(
            [
                f'<link rel="canonical" href="{absolute}" />',
                f'<meta property="og:url" content="{absolute}" />',
            ]
        )
    else:
        tags.append('<meta name="robots" content="noindex,nofollow" />')
    return template.replace("</head>", "  " + "\n    ".join(tags) + "\n  </head>", 1)


def robots_text(origin: str | None) -> str:
    if origin is None:
        return "User-agent: *\nDisallow: /\n"
    return (
        "User-agent: *\n"
        "Allow: /\n"
        # Longest-match Allow wins over Disallow: /api/ for public read-only
        # scientific data required by client-rendered object and group pages.
        "Allow: /api/v1/object/\n"
        "Allow: /api/v1/objects\n"
        "Allow: /api/v1/group/\n"
        "Allow: /api/v1/groups\n"
        "Disallow: /api/\n"
        "Disallow: /groups/preview-builder\n"
        f"Sitemap: {origin}/sitemap.xml\n"
    )


def sitemap_paths(object_pgcs: list[int], groups: dict[str, list[int]]) -> list[str]:
    """Only concrete catalogue records; no filtered or user-specific URLs."""
    paths = ["/", "/groups", "/documents", "/publications", "/acknowledgements"]
    valid_pgcs = sorted({pgc for pgc in object_pgcs if type(pgc) is int and pgc > 0})
    paths.extend(f"/object/{pgc}" for pgc in valid_pgcs)
    for definition in ("physical", "suite"):
        valid_roots = sorted({root for root in groups.get(definition, []) if type(root) is int and root > 0})
        paths.extend(f"/groups/{root}?definition={definition}" for root in valid_roots)
    return paths


def sitemap_xml(origin: str, paths: list[str]) -> str:
    if len(paths) > 50_000:
        raise ValueError("Sitemap requires a sitemap index above 50,000 URLs")
    urls = "".join(f"<url><loc>{xml_escape(origin + path)}</loc></url>" for path in paths)
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>"
    if len(xml.encode("utf-8")) > 50_000_000:
        raise ValueError("Sitemap exceeds the uncompressed 50 MB limit")
    return xml


def sitemap_chunks(paths: list[str], chunk_size: int = 40000) -> list[list[str]]:
    if chunk_size < 1 or chunk_size > 50_000:
        raise ValueError("Invalid sitemap chunk size")
    return [paths[i : i + chunk_size] for i in range(0, len(paths), chunk_size)]


def sitemap_index_xml(origin: str, count: int) -> str:
    if count < 1:
        raise ValueError("Sitemap index must contain at least one part")
    urls = "".join(
        f"<sitemap><loc>{xml_escape(origin)}/sitemap-part/{part}.xml</loc></sitemap>" for part in range(1, count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</sitemapindex>"
    )
