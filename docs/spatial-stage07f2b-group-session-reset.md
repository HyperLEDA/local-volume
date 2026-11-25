# Stage 07f.2b — Group session and Atlas reset

Group preferences are isolated by definition, group ID and root PGC. Camera snapshots are separated by frame and checked against exact display geometry. Session storage is tab-local with an in-memory fallback. Closing and manually reopening Group 3D restores its last state. This stage does not automatically reopen the group dialog on return from a member page.

Atlas Reset uses first-launch preferences, clears selection and the saved camera, and recreates the renderer. Previous-generation cleanup must not re-save the old camera. Existing 2D filters and catalogue data remain untouched.

Browser acceptance: reset from an altered perspective/colour/volume, reset again with default preferences but a moved camera, close/reopen; reopen two groups with different cameras and layer settings, change coordinate frame, inspect a member and return manually. Verify no unexpected WebGL cleanup or selection regressions.
