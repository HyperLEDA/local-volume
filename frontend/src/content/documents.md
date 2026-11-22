# Documents

LV LEDA is a scientific catalogue and interactive atlas of galaxies in the Local Volume. It brings together observational measurements, derived physical parameters and information about galaxy groups and their environments. The PGC identifier connects an object across the Atlas, its individual galaxy page and group membership tables.

## The galaxy catalogue

Each galaxy has a catalogue record with an adopted name, PGC number and available measurements. The principal data include ICRS coordinates, distances, heliocentric and Local Group-frame radial velocities, morphological types, optical and near-infrared photometry, and H I measurements. The interface displays distances in Mpc, velocities in km/s and sky coordinates in degrees or sexagesimal notation.

Individual measurements retain their reported precision and uncertainties. Distance indicators, including the tip of the red giant branch (TRGB), are identified where available. H I measurements distinguish detections from upper limits, so a limit remains a censored measurement in tables and exported selections.

## Scientific Atlas

The [Atlas](/) combines an interactive celestial map with catalogue searches and scientific sample selection. Galaxies can be located by name, PGC identifier or coordinates. Spatial selections use a circular search region or a drawn sky region; filters refine the sample by distance, radial velocity, morphology, magnitude, H I measurements and tidal environment.

The map, object list and numerical summary represent the same active selection. The list is ordered by right ascension. The summary reports sample size and available distance and velocity statistics. Selected galaxies can be exported in **CSV**, **TSV** or **JSON** format, and the associated **Metadata** download records selection settings and the available catalogue-refresh information. A shared Atlas URL preserves its search and filter settings.

## Individual galaxy pages

A galaxy page presents its sky position in Aladin Lite, its equatorial, Galactic and supergalactic coordinates, observed quantities and derived physical properties. The available physical parameters include linear diameter, inclination, absolute magnitude, luminosity, H I mass and star-formation indicators.

The environment block identifies the **Main Disturber (MD)** and displays the tidal indices Θ₁, Θ₅ and Θⱼ. These calculations use the neighbouring galaxies represented in the current LV LEDA donor census; their coverage is determined by the available catalogue data.

Links below the map provide access to LEDA and object-identifier searches in NED and SIMBAD.

## Galaxy groups and environment

[Groups](/groups) offers two complementary ways to examine the Local Volume population: **physical groups** and **Main-Disturber suites**. Each group has a defined membership, a central galaxy, an on-sky representation and a table of its members and hierarchical relations. The selected group definition is retained when browsing its members.

Group diagnostics include the number of measured velocities and independent distances, mean distance and radial velocity, velocity dispersion, projected satellite radii, crossing-time estimates, an orbital-mass estimator, summed luminosity and detected H I mass, and selected morphological statistics. The displayed values are calculated from the available members according to the definitions given alongside each parameter.

## Navigating and reproducing a selection

**Back to**, **Previous** and **Next** connect consecutive galaxies in the displayed Atlas selection or in a particular group. They also support browsing the selected group catalogue in its displayed order. The navigation context is retained within the browser session.

For a reproducible sample, record the selection URL, active criteria, observation or catalogue generation details provided in the Metadata file, and the date of access. Include the primary references for measurements used in the scientific analysis.

## How to cite LV LEDA

Cite the online resource as _LV LEDA: Galaxies of the Nearby Universe_, with its service URL and the date on which the data were accessed. The following **BibTeX** entry can be used in a manuscript; update the access date to match your research session.

```bibtex
@misc{LVLEDAOnline2026,
  author       = {{LV LEDA}},
  title        = {{LV LEDA: Galaxies of the Nearby Universe}},
  year         = {2026},
  howpublished = {Online galaxy catalogue and sky atlas},
  url          = {https://lv.leda.sao.ru/},
  note         = {Accessed 2026-11-20 (UTC)}
}
```

For an analysis based on specific published measurements, also cite the relevant original studies. A principal historical catalogue is [Karachentsev, Makarov & Kaisina (2013), _Updated Nearby Galaxy Catalog_, _The Astronomical Journal_, 145, 101](https://doi.org/10.1088/0004-6256/145/4/101).

See [Publications](/publications) for research using LV LEDA and [Acknowledgements](/acknowledgements) for institutional and scientific credits.
