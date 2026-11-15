import re

from lv_backend.data.storage import Storage
from lv_backend.domain.star_formation import derived_sfr_values

PHYSICAL_COLUMNS = (
    "pgc",
    "a26_kpc_published",
    "inclination_deg_published",
    "vrot_kms_published",
    "a_b_internal_mag_published",
    "abs_b_mag_published",
    "mean_sb_b_mag_arcsec2_published",
    "log_lks_lsun_published",
    "log_m26_msun_published",
    "log_mhi_msun_published",
    "log_mhi_limit_flag",
    "v_lg_kms_published",
    "theta1_published",
    "md_published",
    "theta5_published",
    "thetaj_published",
    "calc_a26_kpc",
    "calc_a26_qa_status",
    "calc_inclination_deg",
    "calc_inclination_qa_status",
    "calc_vm_pr5_kms",
    "calc_mb_mag",
    "calc_mb_qa_status",
    "calc_mean_sb_conditional_mag_arcsec2",
    "calc_mean_sb_qa_status",
    "calc_log_lks_lsun",
    "calc_log_lks_qa_status",
    "calc_log_m26_full_candidate_msun",
    "calc_log_m26_full_qa_status",
    "calc_log_mhi_msun",
    "calc_hi_limit_flag",
    "calc_mhi_qa_status",
)

_SFR_OBSERVED_QUERY = """
SELECT dist, ha_mag, ha_limit, fuv_mag, fuv_limit, a_b_galactic_mag
FROM lv.observed WHERE pgc = %s
"""

# Native Table 2 designations are an identity bridge to the canonical PGC.
# The target might have a different name in lv.objects (e.g. MESSIER081 vs M81).
_SOURCE_DISTURBER_QUERY = """
SELECT DISTINCT o.pgc, o.name
FROM lv.physical AS p
JOIN lv.objects AS o ON o.pgc = p.pgc
WHERE regexp_replace(upper(p.source_name), '[^[:alnum:]]', '', 'g') = ANY(%s)
ORDER BY o.pgc
LIMIT 2
"""

# Secondary identity bridge for canonically adopted LVGDB names not represented
# in lv.physical (for example, a record held from physical-property ingestion).
_OBSERVED_DISTURBER_QUERY = """
SELECT DISTINCT o.pgc, o.name
FROM lv.observed AS obs
JOIN lv.objects AS o ON o.pgc = obs.pgc
WHERE regexp_replace(upper(obs.lvg_source_name), '[^[:alnum:]]', '', 'g') = ANY(%s)
   OR regexp_replace(upper(obs.source_name), '[^[:alnum:]]', '', 'g') = ANY(%s)
ORDER BY o.pgc
LIMIT 2
"""

_ALIAS_DISTURBER_QUERY = """
SELECT DISTINCT o.pgc, o.name
FROM lv.objects AS o
LEFT JOIN lv.names AS n ON n.pgc = o.pgc
WHERE regexp_replace(upper(o.name), '[^[:alnum:]]', '', 'g') = ANY(%s)
   OR regexp_replace(upper(n.name), '[^[:alnum:]]', '', 'g') = ANY(%s)
ORDER BY o.pgc
LIMIT 2
"""


def _name_variants(source_name: str) -> list[str]:
    cleaned = re.sub(r"[^A-Z0-9]", "", source_name.upper())
    if not cleaned:
        return []
    variants = {cleaned}
    # Match both the raw LVGDB designation and common catalog spelling variants,
    # but never perform approximate/fuzzy cross-identification.
    if match := re.fullmatch(r"(?:MESSIER|M)0*(\d+)", cleaned):
        n = int(match.group(1))
        variants.update({f"M{n}", f"M{n:03d}", f"MESSIER{n}", f"MESSIER{n:03d}"})
    elif match := re.fullmatch(r"(NGC|IC|UGC|UGCA|PGC|DDO)0*(\d+)", cleaned):
        prefix, number = match.groups()
        n = int(number)
        variants.update({f"{prefix}{n}", f"{prefix}{n:04d}", f"{prefix}{n:05d}"})
    return sorted(variants)


def _resolve_disturber(storage: Storage, source_name: str) -> tuple[dict[str, object] | None, str]:
    variants = _name_variants(source_name)
    if not variants:
        return None, "empty"

    # Start with the strongest provenance: frozen LVGDB Table 2 designation.
    matches = storage.query(_SOURCE_DISTURBER_QUERY, (variants,))
    if len(matches) > 1:
        return None, "ambiguous-source"
    if len(matches) == 1:
        return matches[0], "table2"

    # Fall back to accepted lv.observed source designations, then canonical
    # galaxy names and their aliases. All queries return actual lv.objects names.
    matches = storage.query(_OBSERVED_DISTURBER_QUERY, (variants, variants))
    if len(matches) > 1:
        return None, "ambiguous-observed"
    if len(matches) == 1:
        return matches[0], "observed"

    matches = storage.query(_ALIAS_DISTURBER_QUERY, (variants, variants))
    if len(matches) > 1:
        return None, "ambiguous-alias"
    if len(matches) == 1:
        return matches[0], "alias"
    return None, "unmatched"


def select_physical(storage: Storage, pgc: int) -> dict[str, object] | None:
    fields = ", ".join(PHYSICAL_COLUMNS)
    rows = storage.query(f"SELECT {fields} FROM lv.physical WHERE pgc = %s", (pgc,))
    if not rows:
        return None

    row = dict(rows[0])
    observed = storage.query(_SFR_OBSERVED_QUERY, (pgc,))
    if observed:
        row.update(derived_sfr_values(observed[0], row))

    md = row.get("md_published")
    if isinstance(md, str) and md.strip():
        match, origin = _resolve_disturber(storage, md.strip())
        row["md_resolution"] = origin
        if match is not None:
            row.update(md_pgc=match["pgc"], md_name=match["name"])
    return row
