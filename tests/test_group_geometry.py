import math

from lv_backend.domain.group_geometry import (
    angular_separation_deg,
    distance_origin,
    local_position_kpc,
    separation_range_mpc,
    spatial_separation_mpc,
)


def test_angular_separation_across_ra_wrap_and_near_pole() -> None:
    assert math.isclose(angular_separation_deg(359, 0, 1, 0), 2)
    assert math.isclose(angular_separation_deg(0, 90, 180, 90), 0, abs_tol=1e-12)
    assert angular_separation_deg(12, 91, 15, 2) is None


def test_east_north_los_orientation_and_scale() -> None:
    kwargs = {"center_origin": "DIRECT_MEASURED", "member_origin": "DIRECT_MEASURED"}
    x = local_position_kpc(0, 0, 1, 0, 0, 1.1, **kwargs)
    assert x is not None
    assert math.isclose(x[0], 0, abs_tol=1e-9)
    assert math.isclose(x[1], 0, abs_tol=1e-9)
    assert math.isclose(x[2], 100, abs_tol=1e-9)
    east = local_position_kpc(0, 0, 1, 90, 0, 1, **kwargs)
    assert east is not None and east[0] > 999 and east[2] < -999
    north = local_position_kpc(0, 0, 1, 0, 90, 1, **kwargs)
    assert north is not None and north[1] > 999


def test_3d_separation_agrees_with_spherical_identity() -> None:
    d1, d2, angle = 3.1, 4.7, 43.0
    result = spatial_separation_mpc(0, 0, d1, angle, 0, d2, origin1="DIRECT_MEASURED", origin2="DIRECT_MEASURED")
    expected = math.sqrt(d1**2 + d2**2 - 2 * d1 * d2 * math.cos(math.radians(angle)))
    assert result is not None and math.isclose(result, expected, abs_tol=1e-12)


def test_independent_measurement_gate_rejects_assigned_or_unknown_depth() -> None:
    assert distance_origin(4.2, "TRGB") == "DIRECT_MEASURED"
    assert distance_origin(4.2, "group assigned TRGB") == "UNKNOWN"
    assert distance_origin(4.2, "group membership") == "GROUP_ASSIGNED"
    assert distance_origin(4.2, "Hubble flow model") == "MODEL_INFERRED"
    assert distance_origin(4.2, None) == "UNKNOWN"
    assert distance_origin(0, "TRGB") == "UNKNOWN"
    kwargs = {"center_origin": "DIRECT_MEASURED", "member_origin": "GROUP_ASSIGNED"}
    assert local_position_kpc(0, 0, 3, 0, 3, 3, **kwargs) is None
    assert spatial_separation_mpc(0, 0, 3, 0, 3, 3, origin1="DIRECT_MEASURED", origin2="UNKNOWN") is None


def test_interval_geometry_not_gaussian_and_respects_asymmetry() -> None:
    bounds = separation_range_mpc(
        0,
        0,
        3,
        0.2,
        0.3,
        0,
        0,
        4,
        0.1,
        0.4,
        origin1="DIRECT_MEASURED",
        origin2="DIRECT_MEASURED",
    )
    assert bounds is not None
    assert math.isclose(bounds[0], 3.9 - 3.3)
    assert math.isclose(bounds[1], 4.4 - 2.8)
    same = separation_range_mpc(
        0,
        0,
        3,
        0.1,
        0.1,
        0,
        0,
        3,
        0.1,
        0.1,
        origin1="DIRECT_MEASURED",
        origin2="DIRECT_MEASURED",
    )
    assert same is not None and math.isclose(same[0], 0)
    assert same[1] > 0


def test_invalid_errors_do_not_become_false_precision() -> None:
    assert (
        separation_range_mpc(
            0,
            0,
            3,
            None,
            0.1,
            0,
            0,
            4,
            0.1,
            0.2,
            origin1="DIRECT_MEASURED",
            origin2="DIRECT_MEASURED",
        )
        is None
    )
