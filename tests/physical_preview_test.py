from collections.abc import Sequence
from typing import Any

from lv_backend.data import physical


class FakeStorage:
    def __init__(
        self,
        physical_row: dict[str, object] | None,
        observed_row: dict[str, object] | None = None,
        source_matches: list[dict[str, object]] | None = None,
        alias_matches: list[dict[str, object]] | None = None,
        observed_matches: list[dict[str, object]] | None = None,
    ) -> None:
        self.physical_row = physical_row
        self.observed_row = observed_row
        self.source_matches = source_matches or []
        self.alias_matches = alias_matches or []
        self.observed_matches = observed_matches or []
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    def query(self, sql: str, params: Sequence[object] | None = None) -> list[dict[str, object]]:
        values = tuple(params or ())
        self.calls.append((sql, values))
        if " FROM lv.physical WHERE pgc = %s" in sql:
            return [self.physical_row] if self.physical_row is not None else []
        if "FROM lv.observed WHERE pgc = %s" in sql:
            return [self.observed_row] if self.observed_row is not None else []
        if "JOIN lv.objects AS o ON o.pgc = p.pgc" in sql:
            return self.source_matches
        if "FROM lv.observed AS obs" in sql:
            return self.observed_matches
        if "LEFT JOIN lv.names" in sql:
            return self.alias_matches
        raise AssertionError(f"Unexpected SQL: {sql}")


def test_select_physical_queries_one_pgc() -> None:
    store = FakeStorage({"pgc": 29146, "a26_kpc_published": 8.0})
    row = physical.select_physical(store, 29146)
    assert row == {"pgc": 29146, "a26_kpc_published": 8.0}
    assert [call[1] for call in store.calls] == [(29146,), (29146,)]


def test_select_physical_allows_missing_row() -> None:
    store = FakeStorage(None)
    assert physical.select_physical(store, 2807149) is None
    assert len(store.calls) == 1


def test_disturber_resolves_source_name_to_canonical_name_and_pgc() -> None:
    store = FakeStorage(
        {"pgc": 29146, "md_published": "MESSIER081"},
        source_matches=[{"pgc": 28630, "name": "M81"}],
    )
    row = physical.select_physical(store, 29146)
    assert row is not None and row["md_pgc"] == 28630 and row["md_name"] == "M81"
    assert "M81" in store.calls[-1][1][0]
    assert "MESSIER081" in store.calls[-1][1][0]


def test_disturber_uses_unambiguous_alias_if_source_missing() -> None:
    store = FakeStorage(
        {"pgc": 29146, "md_published": "Messier 81"},
        alias_matches=[{"pgc": 28630, "name": "M81"}],
    )
    row = physical.select_physical(store, 29146)
    assert row is not None and row["md_pgc"] == 28630
    assert len(store.calls) == 5


def test_ambiguous_disturber_is_not_hyperlinked() -> None:
    duplicates = [{"pgc": 10, "name": "A"}, {"pgc": 20, "name": "B"}]
    for source, aliases in ((duplicates, None), (None, duplicates)):
        store = FakeStorage(
            {"pgc": 29146, "md_published": "MESSIER081"},
            source_matches=source,
            alias_matches=aliases,
        )
        row = physical.select_physical(store, 29146)
        assert row is not None and "md_pgc" not in row


def test_sfr_is_computed_for_both_bands_without_db_writes() -> None:
    store = FakeStorage(
        {"pgc": 29146, "a_b_internal_mag_published": "0.0200"},
        observed_row={
            "dist": "3.85",
            "ha_mag": "14.60",
            "ha_limit": None,
            "fuv_mag": "14.20",
            "fuv_limit": None,
            "a_b_galactic_mag": "0.29",
        },
    )
    row = physical.select_physical(store, 29146)
    assert row is not None
    assert -1.1 < row["log_sfr_halpha_msun_yr"] < -1.0
    assert -1.6 < row["log_sfr_fuv_msun_yr"] < -1.4
    assert row["log_sfr_halpha_upper_limit"] is False
    assert row["log_sfr_fuv_upper_limit"] is False
    assert all(call[0].lstrip().startswith("SELECT") for call in store.calls)


def test_physical_preview_columns_exclude_provenance_hashes() -> None:
    assert "calc_log_m26_full_candidate_msun" in physical.PHYSICAL_COLUMNS
    assert "log_mhi_limit_flag" in physical.PHYSICAL_COLUMNS
    assert "source_sha256" not in physical.PHYSICAL_COLUMNS
    assert len(physical.PHYSICAL_COLUMNS) == len(set(physical.PHYSICAL_COLUMNS))


def test_disturber_resolves_legacy_messier_zeros_and_returns_canonical_name() -> None:
    store = FakeStorage(
        {"pgc": 29146, "md_published": "M 081"},
        source_matches=[{"pgc": 28630, "name": "NGC 3031"}],
    )
    row = physical.select_physical(store, 29146)
    assert row is not None
    assert row["md_name"] == "NGC 3031"
    assert row["md_pgc"] == 28630
    assert row["md_resolution"] == "table2"
    assert "MESSIER081" in store.calls[-1][1][0]


def test_disturber_uses_adopted_observed_name_if_physical_identity_missing() -> None:
    store = FakeStorage(
        {"pgc": 123, "md_published": "NGC03031"},
        observed_matches=[{"pgc": 28630, "name": "M81"}],
    )
    row = physical.select_physical(store, 123)
    assert row is not None and row["md_name"] == "M81"
    assert row["md_resolution"] == "observed"


def test_disturber_unresolved_stays_plaintext_with_status() -> None:
    store = FakeStorage({"pgc": 123, "md_published": "UNKNOWN-GALAXY"})
    row = physical.select_physical(store, 123)
    assert row is not None
    assert row["md_resolution"] == "unmatched"
    assert "md_pgc" not in row and "md_name" not in row
