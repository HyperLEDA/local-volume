# Milestone 02 — Groups: membership, provenance and observational geometry

**Scope:** issues #41, #64, #42, #43, #46, #44, #47, #67. One integrated PR, with separately testable commits and a final science/release gate. This document records a **repository-source audit**, not a live-production database audit or a science approval.

## Current canonical model (audited against `main`, 2026-11-23)

`postgres/migrations/0011.lv_groups.sql` defines the persistent, versioned membership tables:

- `lv.groups.group_id` is the stable primary key of a stored catalogue group; `(root_pgc, definition, source_catalog, source_version)` is a unique alternate key. A root PGC alone is not a unique group identifier. `definition` is `physical`, `suite` or `published`; `data_status` in this stored table is `pilot` or `validated`.
- `lv.group_members` has a composite primary key `(group_id, member_pgc)`. It records `parent_md_pgc`, `hierarchy_depth`, `membership_status` (`root`, `supported`, `unconfirmed`), source-specific `source_status`, and `theta1_source`. The parent foreign key points back into the **same group** and permits deferred insertion. Hierarchy claims must use this versioned relation, not angular proximity.
- The live `physical` and `suite` modes are derived from `lv.physical` by `lv_backend/domain/groups.py`; their `data_status` is `computed`, not `validated`. These modes use computed MD chains, a physical threshold (`theta1 >= 0`) only for `physical`, and reject ambiguous MD cycles. The legacy computed `group_id=-root_pgc` is not unique across definitions and cannot replace a composite scientific identity.
- `published` groups are read from the stored tables. `get_group(root_pgc, definition='published')` currently requires a **unique root match** and otherwise returns no group; a stable `group_id` selector is needed for colliding published roots, with preservation of existing URLs where unambiguous.
- The existing `/api/v1/groups` and `/api/v1/group/{root_pgc}` APIs are read-only for group queries. The existing `GroupPage` accepts only `physical` and `suite`, and the existing Group map draws hierarchical member-parent relations. Do not introduce a second competing group catalogue or replace the 2D page.

### Provenance and distance contract

`lv.objects` provides the canonical PGC and ICRS RA/Dec. `lv.observed` supplies adopted distance (`dist`), `distance_method`, `distance_reference` and, where present, modulus (`mu`, `e_mu`) and its source. `lv.physical` stores derived distances and asymmetric distance errors when the physical refresh is current; its revision/formula provenance is checked through `lv.physical_refresh_state`.

**Current gap:** `lv_backend/data/groups.py` selects `COALESCE(p.distance_mpc, obs.dist)` as `dist_mpc` with `obs.distance_method` and the physical error bounds, but does not provide `obs.distance_reference`, independent-measurement quality classification, or an explicit indication of which distance value was adopted. Consequently, a 3D scene must not yet treat every positive `dist_mpc` as an independently measured depth. The group root's distance is likewise not automatically a validated group distance.

Use four **distinct origin statuses** for the distance **adoption**:

| Status | Source evidence required | Physical 3D location? |
| --- | --- | --- |
| `DIRECT_MEASURED` | Positive finite individual distance, explicit independent method, source/provenance checked | Yes, after source validation |
| `GROUP_ASSIGNED` | Explicit member/group/host-assignment provenance | No; optional plane marker is a labelled schematic |
| `MODEL_INFERRED` | Explicit redshift, kinematic or model origin | No independent depth; show separately |
| `UNKNOWN` | Missing/invalid distance, absent/contradictory method, or unresolved origin | No |

The initial `distance_origin()` helpers in the Python and TypeScript geometry modules only **classify method strings conservatively**; they do not assert that an underlying reference has been verified. The API should later expose separate `distance_reference`, source revision, `distance_value_source`, missingness and any original method code; QA must reconcile that metadata before enabling a real scene.

`e_distance_minus_mpc` / `e_distance_plus_mpc` may already be an asymmetric transform of a distance-modulus error. They must not be treated as an independent Gaussian standard deviation. In pair comparisons, the first geometry module reports the extrema over the supplied marginal distance intervals, without assigning a joint confidence level or assuming uncorrelated measurements. Correlated measurements need an explicit joint treatment if a probabilistic interval is later requested.

### Centre and units

The scene origin is the individual MD/root with a verified ICRS direction and direct distance, if available. A genuinely defined, provenance-bearing catalogue centre is an alternative; do not invent an arithmetic centroid or attach a distance to a centre without evidence. A failed centre gate disables physical depth with a clear reason, while preserving the member list and 2D map.

`r = D (cos δ cos α, cos δ sin α, sin δ)` in equatorial Cartesian Mpc. The scene uses `r_member − r_centre`, projected on the centre's orthonormal **east, north, outward line-of-sight** basis; show positions and scale bars in kpc. Positive LOS points away from the observer. Rotating the viewer changes only the camera, never `r` or the science dataset.

For galaxy pairs, the physical separation is `|r1 − r2|`, equivalent to `sqrt(D1² + D2² − 2 D1 D2 cos ψ)`, with a numerically stable vector implementation. If one adopted distance is not independently measured, the comparison may show `ψ` but must suppress physical separation.

### Tidal edges and subgroups (#64)

Each displayed edge must retain its **actual member PGC and actual parent PGC**. Attach a numeric current `Theta1` **only when the parent PGC equals the member's current computed individual MD**, with the computed field's provenance. A group hierarchy edge whose endpoint differs from the computed individual MD is `hierarchy_only` and shows an unavailable pair-specific `Theta`; do not assign the member's `Theta1` to it. `theta1_source` is a distinct source-frozen value: do not quietly replace or mix it with a live computed value. Likewise `Theta5` is not a sum of measured values for arbitrary shown neighbours.

Use the agreed sign palette: positive `#69C8B8`, negative `#B6A0D9`, unknown `#A9B9C4`. Keep zero distinct from missing (`#D5DCE0` as a proposed neutral), with no physical boundness inference from the sign. The edge tooltip contains **exactly two lines**, the two galaxy names and `Θ = ...` for the actual pair. Membership footprints are dashed **sky-projected visual groupings**, never halo boundaries. Do not invent a subgroup when no versioned parent link exists.

### Halo radii

Migration `0011` has no group `R_200c`, `R_vir` or `R_0` columns and provides no provenance for those measurements. Do not draw physical spheres from `extent_kpc`, sky footprints, or orbital-mass estimates. Halo-radius overlays remain a separate validation gate in issue #45, outside Milestone 02.

## One-PR integration order and acceptance gates

1. **#41 audit:** run the read-only schema inspection, compare current production columns to committed migrations and pilot memberships, freeze group keys and distance/edge statuses; HOLD ambiguous source labels.
2. **#42 API:** extend existing group detail DTO without deleting 2D fields; introduce explicit stored `group_id` selection only when root-PGC ambiguous; add member-PGC lookup for #64 with collision/definition tests.
3. **#64 UX:** add Group View from a non-root galaxy; preserve explicit definition chooser; group/suite labels and per-edge true-pair provenance. Add projected subgroup footprints on actual sky coordinates and Atlas selected-group context without resetting the camera.
4. **#43/#46 geometry:** independently verify east/north/LOS transforms and finite-distance gates, `D` source/origin; missing distance remains visible in the member list and as nonphysical auxiliary markers.
5. **#44 viewer:** lazily mount an explicitly group-local observational 3D scene with orbit/zoom/pan/reset, accessible member controls, resource cleanup and WebGL fallback. Keep 2D as default; avoid global 3D explorer or unvalidated halo spheres.
6. **#67 compare:** compare two selectable PGCs, including validated individual MD shortcut; display native observations, upper limits and provenance, angular separation, and physical separation only when both distances meet the independent-source gate. Persist PGC pair in compact URL state.
7. **#47 release QA:** compare real source PGCs, membership counts and group origins in selected pilots; verify independent spherical calculations, sparse groups, selection changes, 3D performance and fallback, accessibility, memory cleanup, and no regression to Atlas or Group diagnostic plots.

No Issue in this milestone should be marked closed simply because a unit test passed. The final single PR must contain both code and traceable scientific QA evidence, including the statuses of any HOLD cases. This document is the contract freeze for the first integration commit, not a claim of complete implementation.


## Stage 02 — member lookup and distance-evidence API (2026-11-23)

The read-only `GET /api/v1/group-memberships/{member_pgc}` returns all resolved
membership choices from the current computed physical/suite MD graphs and every
versioned published source entry. Published membership is discovered using the
actual `(group_id, member_pgc)` relation, never by guessing a group's root from
its Main Disturber. The result is a source-distinct list, not a unique assignment.
The endpoint checks the physical catalogue freshness before reporting computed
results; stale computations are an error, not an empty membership claim.

Existing group detail URLs remain valid when unambiguous. A stored published
group with a colliding root is selected by `/api/v1/group/{root_pgc}?definition=published&group_id={id}`.
The old published root-only selector returns HTTP 409 for an ambiguous root.
`/api/v1/groups` remains unchanged.

Group detail additionally reports member `distance_reference`, source labels,
observed-versus-physical adopted distance provenance, `distance_origin`
(classified from method strings), and a `scene_center` using the root MD's actual
coordinates when present. Every `distance_provenance_verified` and
`distance_3d_eligible` is **false** pending independent validation of the
underlying sources. `radius_measurements` is deliberately empty: no physical
halo-radius measurement has been established by the existing migration. This
stage does not turn `distance_origin="DIRECT_MEASURED"` into a validated
three-dimensional location.
