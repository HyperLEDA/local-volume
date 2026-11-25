# Stage 07a — Shared spatial foundation

Base: merged PR #103 (`d5d9713`); refs #43, #46, #44, #87, #104.

## Delivered

One Cartesian ICRS/Galactic/Supergalactic rotation implementation (`spatialFrames.ts`),
used by angular coordinate cards and existing relative Group Explorer offsets.
Forward/inverse transforms preserve length, handedness and units. Global
observer-centred coordinates use Mpc and no translation; relative group
coordinates remain kpc. `observerCartesianMpc` is a mathematical primitive,
not a distance-eligibility assertion. No UI, dependencies, SQL or data changes.

## Main audit findings

- `groupGeometry3d.ts` provides unit directions, angular/pair separations and
  interval extrema. Its legacy method-name hint is not the authoritative audit.
- `groupScene3d.ts` contains the stricter group-specific display/provenance
  contract, including schematic assigned projection and interval review gates.
  Do not use group projection coordinates for global depth or pair measurements.
- `GroupSceneThree.tsx` has a group-bound renderer and orthographic camera.
  Camera, picking, marker textures, guide geometry and disposal are reuse
  candidates; its hard-coded dark theme and kpc labels need review before
  extracting an engine. Existing dispose paths do not establish measured GPU
  resource stability or performance.
- `/api/v1/objects` currently returns `obs.dist` and `obs.distance_method`;
  Group API uses `COALESCE(p.distance_mpc, obs.dist)` and the backend
  `apply_distance_evidence` pipeline. Do not silently reinterpret `dist` or
  classify global distance provenance from a method string. Next data contract
  should add explicit adopted-distance and lineage fields without changing
  current Atlas filters or legacy fields, and reuse the backend audit.
- Global centre is the observer, not a group root. The Milky Way may be shown
  as an explicitly labelled origin reference, not as a measured extragalactic
  point. Unknown D remains direction/list only. Group-assigned distances have
  no independent depth; optional catalogue/model placements need explicit
  visual qualification. No default physical halo or binding inference.
- Global MVP should retain existing filtered ordered PGCs and selection, avoid
  per-galaxy requests, use equal-size markers by default and keep Sky mode
  intact. Perspective scale needs a depth/reference-plane qualification.

## Verification and next gates

Run root Bun tests, frontend formatting, lint and production build. New tests
cover reference orientations, inverse rotations, scale/offset equivalence,
angular/Cartesian consistency and missing inputs. Independent Astropy and
real-catalogue validation remain acceptance tasks (#43/#46); no claim that
this patch alone closes any issue. Next: explicit global read-only distance
contract and shared renderer adapter, then browser prototype (#87).
