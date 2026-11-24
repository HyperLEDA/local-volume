import math

import pytest

from lv_backend.domain.distance_lineage import audit_distance_lineage, classify_method


def _row() -> dict[str, object]:
    d = 4.0
    factor = 10.0 ** (0.15 / 5.0)
    return {
        "dist_mpc": d,
        "derived_distance_mpc": d,
        "derived_distance_method": "observed_mu",
        "observed_distance_mpc": 4.0,
        "observed_mu": 5 * math.log10(d) + 25,
        "observed_e_mu": 0.15,
        "distance_method": "TRGB",
        "modulus_method": "TRGB",
        "distance_reference": "2019ApJ...872...80C",
        "distance_error_basis": "observed_mu_e_mu_exact",
        "e_distance_minus_mpc": d * (1 - 1 / factor),
        "e_distance_plus_mpc": d * (factor - 1),
    }


@pytest.mark.parametrize("method", ["TRGB", "Cep", "SN", "SBF", "TF", "FP", "BS", "CMD", "HB", "RR", "PNLF"])
def test_individual_indicator_codes(method: str) -> None:
    assert classify_method(method) == "DIRECT_MEASURED"


@pytest.mark.parametrize("method", ["h", "h'", "h′", "NAM"])
def test_model_codes(method: str) -> None:
    assert classify_method(method) == "MODEL_INFERRED"


def test_group_and_unknown_codes() -> None:
    assert classify_method("mem") == "GROUP_ASSIGNED"
    assert classify_method("txt") == "UNKNOWN"
    assert classify_method("TRGB?") == "UNKNOWN"
    assert classify_method("observed_mu") == "UNKNOWN"


def test_modulus_uses_its_own_method_and_reference() -> None:
    result = audit_distance_lineage({**_row(), "distance_method": "TF"})
    assert result["distance_method_for_value"] == "TRGB"
    assert result["distance_reference_for_value"] == "2019ApJ...872...80C"
    assert result["distance_origin"] == "DIRECT_MEASURED"
    assert result["distance_lineage_status"] == "REVIEW_READY"
    assert result["distance_interval_traceable"] is True
    assert result["distance_provenance_verified"] is False
    assert result["distance_3d_eligible"] is False


def test_table1_fallback_cannot_borrow_modulus_reference_or_error() -> None:
    result = audit_distance_lineage({**_row(), "derived_distance_mpc": None})
    assert result["distance_value_source"] == "lv.observed"
    assert result["distance_adoption_basis"] == "observed_dist"
    assert result["distance_reference_for_value"] is None
    assert result["distance_interval_traceable"] is False
    assert result["distance_lineage_status"] == "HOLD"


def test_group_assigned_modulus_not_independent_even_if_table1_trgb() -> None:
    result = audit_distance_lineage({**_row(), "modulus_method": "mem"})
    assert result["distance_origin"] == "GROUP_ASSIGNED"
    assert result["distance_lineage_status"] == "NON_INDEPENDENT"
    assert result["distance_3d_eligible"] is False


def test_unknown_modulus_method_never_borrows_table1_method() -> None:
    result = audit_distance_lineage({**_row(), "modulus_method": None})
    assert result["distance_origin"] == "UNKNOWN"
    assert result["distance_method_for_value"] is None
    assert result["distance_lineage_status"] == "HOLD"


def test_table1_group_and_individual_table6_require_review() -> None:
    result = audit_distance_lineage({**_row(), "distance_method": "mem"})
    assert result["distance_lineage_reason"] == "table1_table6_origin_disagreement"
    assert result["distance_3d_eligible"] is False


def test_value_error_and_policy_mismatches_hold() -> None:
    result = audit_distance_lineage({**_row(), "observed_mu": 30.0})
    assert result["distance_origin"] == "UNKNOWN"
    assert result["distance_lineage_reason"] == "adopted_source_value_mismatch"
    assert audit_distance_lineage({**_row(), "e_distance_minus_mpc": 0.0})["distance_interval_traceable"] is False
    result = audit_distance_lineage({**_row(), "derived_distance_method": "observed_dist"})
    assert result["distance_lineage_reason"] == "mu_first_policy_mismatch"


def test_missing_reference_and_invalid_value_cannot_be_verified() -> None:
    result = audit_distance_lineage({**_row(), "distance_reference": None})
    assert result["distance_lineage_reason"] == "missing_modulus_reference"
    assert audit_distance_lineage({**_row(), "dist_mpc": float("nan")})["distance_origin"] == "UNKNOWN"
