import csv
import os
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path
from typing import TypedDict

import fastapi.testclient
import pytest
import testcontainers.core.container

import lv_backend.presentation.app as app_module

_ROOT = Path(__file__).resolve().parents[1]
_SAMPLE_CSV = _ROOT / "tests" / "fixtures" / "lv_objects.csv"
_NAMES_CSV = _ROOT / "tests" / "fixtures" / "lv_names.csv"
_READY_MESSAGE = "database system is ready to accept connections"
_STORAGE_ENV = {
    "STORAGE_DBNAME": "lv",
    "STORAGE_USER": "lv",
    "STORAGE_PASSWORD": "password",
}


class _SampleRow(TypedDict):
    pgc: int
    name: str
    ra: float
    dec: float
    cz: float | None


@pytest.fixture(scope="module")
def client() -> Iterator[fastapi.testclient.TestClient]:
    container = (
        testcontainers.core.container.DockerContainer("postgis/postgis:17-3.5")
        .with_env("POSTGRES_USER", "lv")
        .with_env("POSTGRES_PASSWORD", "password")
        .with_env("POSTGRES_DB", "lv")
        .with_exposed_ports(5432)
    )
    previous = {key: os.environ.get(key) for key in ("STORAGE_ENDPOINT", "STORAGE_PORT", *_STORAGE_ENV)}
    container.start()
    try:
        # The image logs readiness once during init and again for the server that stays up.
        _wait_until_ready(container)
        os.environ["STORAGE_ENDPOINT"] = container.get_container_host_ip()
        os.environ["STORAGE_PORT"] = str(container.get_exposed_port(5432))
        os.environ.update(_STORAGE_ENV)
        container_id = container.get_container_id()
        with fastapi.testclient.TestClient(app_module.app) as test_client:
            _load_sample(container_id)
            yield test_client
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        container.stop()


def test_list_objects(client: fastapi.testclient.TestClient) -> None:
    response = client.get("/api/v1/objects")

    assert response.status_code == 200
    body = response.json()
    rows = _sample_rows()
    assert len(body["data"]["pgc"]) == 25
    assert body["data"]["pgc"] == [row["pgc"] for row in rows]
    assert body["data"]["name"] == [row["name"] for row in rows]
    assert body["data"]["ra"] == pytest.approx([row["ra"] for row in rows])
    assert body["data"]["dec"] == pytest.approx([row["dec"] for row in rows])
    names = _sample_names()
    assert body["data"]["names"] == [names.get(row["pgc"], []) for row in rows]
    assert body["schema"]["pgc"]["description"] == "PGC identifier"
    assert body["schema"]["ra"]["unit"] == "deg"
    assert body["schema"]["names"]["description"] == "Additional name"


def test_get_object_with_redshift(client: fastapi.testclient.TestClient) -> None:
    response = client.get("/api/v1/object/29146")

    assert response.status_code == 200
    data = response.json()["data"]
    cz = _row(29146)["cz"]
    assert data["name"] == "NGC 3077"
    assert data["names"] == _sample_names()[29146]
    assert cz is not None
    assert data["cz"] == pytest.approx(cz)


def test_get_object_without_redshift_omits_nulls(client: fastapi.testclient.TestClient) -> None:
    response = client.get("/api/v1/object/12676")

    assert response.status_code == 200
    body = response.json()
    assert "cz" not in body["data"]
    assert "e_cz" not in body["data"]
    assert body["data"]["names"] == []
    assert "cz" in body["schema"]
    assert "e_cz" in body["schema"]
    assert "names" in body["schema"]


def test_get_missing_object(client: fastapi.testclient.TestClient) -> None:
    response = client.get("/api/v1/object/999999999")

    assert response.status_code == 404


def _wait_until_ready(container: testcontainers.core.container.DockerContainer) -> None:
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        stdout, stderr = container.get_logs()
        text = stdout.decode(errors="replace") + stderr.decode(errors="replace")
        if text.count(_READY_MESSAGE) >= 2:
            return
        time.sleep(0.5)
    raise RuntimeError("postgres did not become ready")


def _load_sample(container_id: str) -> None:
    _copy_csv(
        container_id,
        "COPY lv.objects (pgc, name, ra, e_ra, dec, e_dec, cz, e_cz, type_name) "
        "FROM STDIN WITH (FORMAT csv, HEADER true);\n",
        _SAMPLE_CSV,
    )
    _copy_csv(
        container_id,
        "COPY lv.names (pgc, name) FROM STDIN WITH (FORMAT csv, HEADER true);\n",
        _NAMES_CSV,
    )


def _copy_csv(container_id: str, statement: str, path: Path) -> None:
    csv_bytes = path.read_bytes()
    if not csv_bytes.endswith(b"\n"):
        csv_bytes += b"\n"
    _psql(container_id, statement.encode() + csv_bytes + b"\\.\n")


def _psql(container_id: str, script: bytes) -> None:
    result = subprocess.run(
        ["docker", "exec", "-i", container_id, "psql", "-U", "lv", "-d", "lv", "-v", "ON_ERROR_STOP=1"],
        input=script,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode())


def _sample_rows() -> list[_SampleRow]:
    with _SAMPLE_CSV.open(newline="") as handle:
        raw_rows = list(csv.DictReader(handle))
    rows = [
        _SampleRow(
            pgc=int(row["pgc"]),
            name=row["name"],
            ra=float(row["ra"]),
            dec=float(row["dec"]),
            cz=float(row["cz"]) if row["cz"] else None,
        )
        for row in raw_rows
    ]
    rows.sort(key=lambda row: row["pgc"])
    return rows


def _sample_names() -> dict[int, list[str]]:
    with _NAMES_CSV.open(newline="") as handle:
        raw_rows = list(csv.DictReader(handle))
    grouped: dict[int, list[str]] = {}
    for row in raw_rows:
        grouped.setdefault(int(row["pgc"]), []).append(row["name"])
    for names in grouped.values():
        names.sort()
    return grouped


def _row(pgc: int) -> _SampleRow:
    return next(row for row in _sample_rows() if row["pgc"] == pgc)
