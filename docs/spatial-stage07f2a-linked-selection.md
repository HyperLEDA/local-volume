# Stage 07f.2a — explicit linked Atlas selection

Read-only UI bridge, no change to catalogue or scientific eligibility. Explicit marker/empty clicks on the sky are handed to the next opening of the spatial viewer. A requested PGC in the current selection is inspected in individual galaxy mode; no group-centre substitution, no filter changes, no fabricated depth. A missing position remains inspectable, not rendered. An empty request clears selection. No new sky action preserves the saved session.

Closing the spatial viewer sends the currently inspected galaxy or group root back to the sky's existing selected-object context without recentering. Show on sky still explicitly recentres. Automatic reticle popups are not selection events. A loading group snapshot does not overwrite the sky selection. Existing sky popup is cleared on a returned selection. Group Explorer persistence and more extensive brushing/sample linkage remain separate work.
