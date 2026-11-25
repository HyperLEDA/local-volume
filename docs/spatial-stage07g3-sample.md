# Stage 07g.3 — frozen spatial sample handoff

Issue #107 (partial). With a valid applied Slice, Sphere or Box, Send to Sky Atlas copies the exact currently selected PGCs, the physical region, distance mode and radial scope. Empty selections remain empty. The snapshot is nominal, not a posterior probability or a catalogue revision lock. It stores no fabricated distances or memberships.

The Sky Atlas intersects the fixed IDs with its ordinary filters, and uses its existing list, count, map and catalogue export pipeline. The independent sample criterion can be cleared; Clear all clears it too. The JSON manifest exports the original snapshot (not the intersection after additional filtering). The existing catalogue export uses the current intersection. Reopening 3D uses the current filtered catalogue, so clear the frozen sample to expand the parent sample. Reset in 3D resets its controls, not the separate frozen Sky Atlas criterion.

Snapshots are tab-session-local and referenced by an opaque URL token. Missing, malformed or inaccessible snapshots fail closed until cleared; blocked storage prevents transfer. The URL is not a portable shared sample. JSON records the geometry and IDs but not individual distance evidence, catalogue revision or measurement uncertainties. Import, durable saved samples and Analysis integration remain open (#63, #78). No database writes.
