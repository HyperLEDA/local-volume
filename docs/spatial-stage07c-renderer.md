# Stage 07c — Shared rendering primitives

Refactors the existing group renderer on the PR #103 base after Stage 07a/07b.
No SQL, distance-evidence, catalogue selection or membership changes.

- `spatialRenderPolicy.ts`: coordinate-unit-agnostic view presets, scale bars,
  picking, framing, guide vertices, interval projection and frame scheduler.
  Fit has an explicit minimum half-extent (legacy default 1 in scene units).
- `spatialThreePrimitives.ts`: renderer creation with configurable background,
  existing marker glyphs, OrbitControls configuration, camera projection,
  orthographic fit and pixel scale. No DOM access at module import.
- `groupSceneWebGLPolicy.ts`: preserves the legacy named exports and all group
  science policies. GroupSceneThree calls the shared helpers; its appearance,
  scene data, selection, disposal and control defaults remain unchanged.
- Tests verify unit equivalence, real Three.js camera projections and frame
  scheduling. The new code does not yet implement a standalone full renderer.

Stage 07d can reuse the primitives with observer-centred Mpc coordinates. A
perspective camera requires depth-dependent screen scale, clipping and fitting;
never apply the orthographic pixel ruler to a perspective scene. Theme palette,
full shared resource lifecycle (including initialization failure and context
loss), large-catalogue marker batching and browser performance remain open.
Group-specific overlays, guide policy and scientific eligibility stay separate.
