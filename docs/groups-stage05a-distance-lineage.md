# Stage 05a — adopted distance lineage (issues #41, #43, #46, #67)

Baseline: PR #102, dcfe8db. This is a source-contract repair and catalogue audit,
not an approval of any individual spatial coordinate.

## Adopted source

Migration 0004 identifies `dist` and `distance_method` as Table 1 values;
`mu`, `e_mu`, `modulus_method`, `distance_reference` belong to Table 6.
`lv.physical.distance_method` is the calculation basis (`observed_mu`,
`observed_dist`), not the observational method. The existing mu-first adopted
value is unchanged. A reference for Table 6 is never borrowed for Table 1.
The same read-only fields are supplied for live and published group detail;
existing revision guards on physical values are preserved.

`distance_adoption_basis`, `distance_method_for_value`,
`distance_reference_for_value`, `distance_lineage_status`,
`distance_lineage_reason`, `distance_interval_traceable` describe the matched
source. Method codes use Karachentsev, Makarov & Kaisina 2013,
AJ 145, 101, doi:10.1088/0004-6256/145/4/101 (Table 6). NAM is treated as a
model (Karachentsev & Popova 2024, arXiv:2412.03988), and
unrecognized/qualitative values including txt remain UNKNOWN.
Independent empirical indicators are candidates, not direct geometric distances
or verified measurements. `mem` is group assigned; h/h-prime/NAM model-based.
A missing or conflicting source is HOLD. REVIEW_READY means the adopted
modulus matches the calculation and has an individual-method code and recorded
reference; it is NOT evidence of successful source-paper review. NON_INDEPENDENT
means a group-assigned or model-based value. An interval matches only if the
stored lower/upper errors agree with the exact transformation of the same e_mu.
No joint confidence or independence assumption is made.

All `distance_provenance_verified`, `distance_3d_eligible` and
`physical_3d_eligible` flags stay false, including the centre, pending review of
individual PGC, source row, bibliographic reference, method and calibration.
Do not infer spatial positions from group-assigned distances. No migration,
new physical formula version, or existing measurement changes are required.

## QA

Audit the isolated test snapshot with the installer --audit; export all rows
and status/method counts. Compare source rows and references before defining a
reviewed evidence registry. Never treat that report as independent source
verification. Production, original source records and a real 3D scene remain
separate acceptance gates.
