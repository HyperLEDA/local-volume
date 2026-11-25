# Stage 07e.3 — physical colour encodings

Adds `GET /api/v1/spatial/photometry`, a read-only current-revision projection of `lv.physical`, with explicit PGC, formula version and revision. No migrations, refresh, new numerical mass model or source changes. The query uses a single snapshot and refuses missing/duplicate computed rows. The client validates the contract and matches each object's spatial evidence revision/formula before colouring.

- `log L_Ks`: base-ten luminosity in solar luminosities, based on the current adopted photometry and existing physical calculation. Distinguish estimated Ks from measured-input Ks in the legend and inspector. This is not stellar mass.
- `log M_HI`: base-ten solar masses, from the existing derived HI mass. `<` mass qualifiers are upper limits and receive a separate colour, never entering the detection scale.
- `log(M_HI/L_Ks)`: difference of the two logarithmic values, in solar mass / solar luminosity units; not a gas mass fraction. Requires both inputs and carries both the HI limit and estimated Ks qualifiers.
- Missing/nonfinite/unsupported values remain unknown. No substitution using apparent magnitudes or published fallback values. Colours for group spheres use the root galaxy as before. All other size, navigation, selection and scientific eligibility contracts unchanged.

The numeric colour domain is defined over positioned objects in the Atlas selection, before view-only volume/depth/display filters, excluding upper limits. It is not a claim of independent distance verification. A stale/missing photometry snapshot cannot enable a numerical colour. No log stellar mass is added: a separate validated mass-to-light prescription is required.

Acceptance: targeted backend and frontend tests, real read-only API count/qualifier parity, both group and galaxy modes, both themes, and previous QA. The full scientific and browser release gates remain open.
