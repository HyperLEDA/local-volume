# Stage 07b — Global distance data contract

Base PR #103 (`d5d9713`), after Stage 07a. Refs #43, #46, #87, #104, #107.

- `/api/v1/objects`: retain all existing column arrays and schema unchanged.
  Add top-level `distance_contract` and `spatial_distances`, one record per PGC
  in the same order, obtained in the same SELECT as the legacy list.
- Adopted `dist_mpc` matches the group member SQL expression. A stale physical
  snapshot falls back to observed distance, not stale physical data. No SQL writes.
- Audit raw source fields with `apply_distance_evidence` before JSON conversion.
  `observed_mu` and `observed_e_mu` preserve their database decimal text.
  The adopted value, source identity, fingerprints and separate review statuses
  remain available. Optional null fields may be omitted by FastAPI serialization.
- No new approval, new uncertainty, or replacement of legacy `dist`.
  An independent method is not a verified distance. A traceable interval is not
  necessarily a verified interval. Group-assigned distances are not independent depth.
- Frontend retains legacy behavior if the spatial block is absent or mismatched;
  no positional crossmatch or fallback to legacy `dist` for spatial eligibility.
  Nested records are copied for each caller of the single-flight API.
- Stage 07d must check finite positive D, valid sky direction and origin/review
  policy; never render the Milky Way as an extragalactic point or map absent D to zero.
  Verified geometry must additionally require all strict review flags. No group
  membership or physical binding is inferred from this contract.

QA: run backend unit tests, Docker E2E (isolated test DB), full frontend tests,
format/lint/build. Real-catalogue cross-endpoint comparison remains mandatory:
match PGC and physical revision, compare adopted D, fingerprints and all review
states; compare only group members, not group summary/root fallback fields.
Verify counts, missing data, payload size, response latency and stale fallback.
Independent Astropy and browser acceptance remain open. No issue is closed here.
