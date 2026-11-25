"""Current, read-only bulk photometry for the Spatial Atlas."""

import math

from lv_backend.data.storage import Storage
from lv_backend.domain.physical_calculations import FORMULA_VERSION

_SQL = """
SELECT o.pgc, s.applied_revision AS revision, s.formula_version,
       p.pgc AS computed_pgc, p.log_lks_lsun, p.ks_estimated, p.ks_method,
       p.log_mhi_msun, p.derived_hi_limit_flag
FROM lv.objects o
JOIN lv.physical_refresh_state s
  ON s.singleton = TRUE AND s.source_revision = s.applied_revision
 AND s.formula_version = %s
LEFT JOIN lv.physical p ON p.pgc = o.pgc AND p.computed_revision = s.applied_revision
ORDER BY o.pgc
"""


def _finite(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(str(value))
    except (ValueError, TypeError, OverflowError):
        return None
    return result if math.isfinite(result) else None


def spatial_photometry(storage: Storage) -> dict[str, object]:
    rows = storage.query(_SQL, [FORMULA_VERSION])
    if not rows:
        raise RuntimeError("Current physical photometry unavailable")
    revision = rows[0]["revision"]
    if not isinstance(revision, int) or isinstance(revision, bool) or revision < 0:
        raise RuntimeError("Invalid physical revision")
    data: list[dict[str, object]] = []
    seen: set[int] = set()
    for row in rows:
        pgc = row["pgc"]
        if (
            not isinstance(pgc, int)
            or isinstance(pgc, bool)
            or pgc <= 0
            or pgc in seen
            or row["computed_pgc"] != pgc
            or row["revision"] != revision
            or row["formula_version"] != FORMULA_VERSION
        ):
            raise RuntimeError("Incomplete or inconsistent current photometry snapshot")
        seen.add(pgc)
        lk = _finite(row["log_lks_lsun"])
        estimated = row["ks_estimated"]
        method = row["ks_method"]
        k_status = "unavailable"
        if (
            lk is not None
            and isinstance(estimated, bool)
            and isinstance(method, str)
            and method.strip()
            and method != "unavailable"
        ):
            k_status = "estimated" if estimated else "measured"
        else:
            lk = None
        hi = _finite(row["log_mhi_msun"])
        flag = row["derived_hi_limit_flag"]
        hi_status = "unavailable"
        if hi is not None and flag in (None, "", "<") and pgc != 5064336:
            hi_status = "upper_limit" if flag == "<" else "detection"
        else:
            hi = None
        data.append(
            {
                "pgc": pgc,
                "log_lks_lsun": lk,
                "ks_status": k_status,
                "ks_method": method if isinstance(method, str) else None,
                "log_mhi_msun": hi,
                "hi_status": hi_status,
            }
        )
    return {"contract": "spatial_photometry_v1", "revision": revision, "formula_version": FORMULA_VERSION, "rows": data}
