from decimal import Decimal

import pytest

from lv_backend.data.groups import _LIVE_SQL, _PUBLISHED_MEMBERS_SELECT_SQL
from lv_backend.data.objects import _OBJECTS_QUERY
from lv_backend.domain.distance_evidence import apply_distance_evidence
from lv_backend.domain.spatial_distances import spatial_distance


def _row() -> dict[str, object]:
    d = 10 ** ((28.0 - 25.0) / 5.0)
    factor = 10 ** (0.15 / 5)
    return {
        "pgc": 123,
        "ra": 120.0,
        "dec": -40.0,
        "dist": 3.98,
        "dist_mpc": d,
        "derived_distance_mpc": d,
        "observed_distance_mpc": 3.98,
        "observed_mu": Decimal("28.0000"),
        "observed_e_mu": Decimal("0.1500"),
        "distance_method": "TRGB",
        "modulus_method": "TRGB",
        "distance_reference": "test-reference",
        "distance_source_catalog": "test-catalogue",
        "distance_source_name": "test-object",
        "derived_distance_method": "observed_mu",
        "distance_formula_version": "test-v1",
        "distance_computed_revision": 7,
        "distance_error_basis": "observed_mu_e_mu_exact",
        "e_distance_minus_mpc": d * (1 - 1 / factor),
        "e_distance_plus_mpc": d * (factor - 1),
    }


def test_global_and_group_evidence_match_without_mutating_source() -> None:
    row = _row()
    before = dict(row)
    result = spatial_distance(row)
    group = apply_distance_evidence(row)
    for key, value in group.items():
        assert getattr(result, key) == value
    assert row == before
    assert result.dist_mpc != row["dist"]
    assert result.observed_mu == "28.0000"
    assert result.distance_interval_traceable is True
    assert result.distance_3d_eligible is False
    assert result.distance_value_review_status == "NOT_REVIEWED"
    assert result.distance_interval_verified is False


@pytest.mark.parametrize("method,origin", [("mem", "GROUP_ASSIGNED"), ("NAM", "MODEL_INFERRED"), ("txt", "UNKNOWN")])
def test_non_independent_distance_never_becomes_strict(method: str, origin: str) -> None:
    result = spatial_distance({**_row(), "modulus_method": method})
    assert result.distance_origin == origin
    assert result.distance_3d_eligible is False


def test_observed_fallback_cannot_borrow_reference_or_error() -> None:
    row = {
        **_row(),
        "dist_mpc": 3.98,
        "derived_distance_mpc": None,
        "derived_distance_method": None,
        "distance_formula_version": None,
        "distance_computed_revision": None,
        "e_distance_minus_mpc": None,
        "e_distance_plus_mpc": None,
    }
    result = spatial_distance(row)
    assert result.dist_mpc == 3.98
    assert result.distance_value_source == "lv.observed"
    assert result.distance_reference_for_value is None
    assert not result.distance_interval_traceable
    assert not result.distance_3d_eligible


def test_nonfinite_and_missing_distance_do_not_break_json() -> None:
    for distance in (None, float("nan"), float("inf")):
        result = spatial_distance({**_row(), "dist_mpc": distance})
        assert result.dist_mpc is None
        assert not result.distance_3d_eligible
        assert '"dist_mpc":null' in result.model_dump_json()


def test_sql_projects_the_same_distance_evidence_and_current_revision() -> None:
    fields = (
        "COALESCE(p.distance_mpc, obs.dist) AS dist_mpc",
        "obs.dist AS observed_distance_mpc",
        "p.distance_mpc AS derived_distance_mpc",
        "obs.mu AS observed_mu",
        "obs.e_mu AS observed_e_mu",
        "obs.source_catalog AS distance_source_catalog",
        "obs.source_name AS distance_source_name",
        "p.distance_method AS derived_distance_method",
        "p.computed_revision AS distance_computed_revision",
        "CASE WHEN p.pgc IS NOT NULL THEN s.formula_version END AS distance_formula_version",
        "p.e_distance_minus_mpc",
        "p.e_distance_plus_mpc",
        "p.distance_error_basis",
        "obs.distance_reference",
        "obs.distance_method",
        "obs.modulus_method",
        "s.source_revision = s.applied_revision",
        "p.computed_revision = s.applied_revision",
        "s.formula_version = %s",
    )
    for query in (_OBJECTS_QUERY, _LIVE_SQL, _PUBLISHED_MEMBERS_SELECT_SQL):
        assert all(field in query for field in fields)
    assert "LEFT JOIN lv.physical" in _OBJECTS_QUERY
    assert "ORDER BY o.pgc" in _OBJECTS_QUERY
