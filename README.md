# LV LEDA — Galaxies of the Nearby Universe

LV LEDA is a scientific catalogue and interactive sky atlas for exploring galaxies in the Local Volume, developed within the HyperLEDA project.

The platform brings together observational measurements, derived physical properties, galaxy groups, and information about their environments. It provides tools for inspecting individual galaxies, constructing catalogue selections, and examining nearby galactic systems.

**[Open LV LEDA](https://lv.leda.sao.ru/)** · **[Scientific documentation](https://lv.leda.sao.ru/documents)** · **[Development and issues](https://github.com/HyperLEDA/local-volume/issues)**

## Scientific capabilities

### Scientific Atlas

The Atlas provides an interactive all-sky view of the Local Volume galaxy catalogue using Aladin Lite.

Galaxies can be located by name, PGC identifier, or sky coordinates. Catalogue selections can be refined through spatial regions and filters on distance, radial velocity, morphological type, photometry, H I measurements, and tidal environment.

Selected objects can be exported in CSV, TSV, or JSON format. Additional metadata record the selection criteria and available catalogue-refresh information, while shareable URLs preserve the active Atlas filters.

### Individual galaxies

Galaxy pages combine interactive sky images with observational and derived physical parameters.

The available information includes celestial coordinates, distance measurements, radial velocities, morphology, optical and near-infrared photometry, H I properties, luminosities, and selected structural and star-formation parameters.

Where available, uncertainties and distance indicators are displayed alongside the corresponding measurements.

The surrounding environment is characterized using Main Disturber relationships and tidal indices calculated from the available catalogue data.

### Galaxy groups

The Groups section provides complementary representations of physical galaxy groups and Main Disturber suites.

Group pages contain sky maps, membership tables, hierarchical relationships, and scientific diagnostics derived from the available member galaxies.

These include distance and velocity statistics, projected separations, crossing-time and orbital-mass estimates, luminosity, and H I properties where the necessary measurements exist.

## Scientific interpretation and limitations

LV LEDA combines observational quantities with calculated parameters. Their interpretation depends on the adopted measurements, catalogue completeness, and definitions of the corresponding methods.

In particular, calculated tidal indices and Main Disturber assignments use the current LV LEDA donor census, which does not necessarily reproduce the full neighbourhood considered in published tidal-index catalogues.

Missing measurements are not treated as numerical zeros. H I upper limits are distinguished from detections in the catalogue and supported exports.

The online catalogue is subject to updates. Reproducible scientific use therefore requires recording the selection criteria, available catalogue-generation metadata, and date of access.

## Documentation and citation

Scientific documentation, descriptions of catalogue parameters, selection tools, and citation guidance are available in the [LV LEDA Documents](https://lv.leda.sao.ru/documents) section.

When using LV LEDA in published research, cite the online service with its URL and access date, together with the original publications underlying the measurements used in the analysis.

An important historical reference for the Local Volume catalogue is:

Karachentsev, I. D., Makarov, D. I., & Kaisina, E. I. (2013). *Updated Nearby Galaxy Catalog*. The Astronomical Journal, 145, 101. [DOI: 10.1088/0004-6256/145/4/101](https://doi.org/10.1088/0004-6256/145/4/101).

## Development

The application consists of a Python/FastAPI backend, a React/TypeScript frontend, and PostgreSQL/PostGIS database migrations.

### Local setup

Requirements: Python 3.12+, [uv](https://docs.astral.sh/uv/), [Bun](https://bun.sh/), Docker with Compose, and GNU Make.

The following commands assume a Unix-like shell and a disposable local database.

```sh
make install-dev
make start-db
uv run lv-backend migrate
bun run --cwd frontend build
uv run lv-backend webserver
```

The application is served at `http://localhost:8000`. The local Compose database is exposed on port `6433`. Connection defaults are documented in `.env.example`.

Example credentials must not be used in production.

### Testing and validation

Run the repository checks with:

```sh
make check
make test-js
```

The checks cover Python compilation, formatting, linting, type checking, migration naming, Python tests, and frontend validation.

GitHub Actions additionally builds the application and validates database migrations against an isolated PostgreSQL/PostGIS instance. The `tests`, `build`, and `check-migrations` checks are required for pull requests to the default branch.

### Database safety

`make check-schema` performs schema linting against an existing database. It does not create, migrate, recreate, or delete that database.

Connection settings can be supplied through `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`.

The `Check migrations` GitHub Actions workflow independently creates a temporary database, applies the migrations, and checks the resulting schema.

The optional `make check-template` command checks for upstream template changes when `copier` is installed. It does not modify project files.

## Project development

Development tasks, scientific requirements, and planned improvements are tracked through [GitHub Issues](https://github.com/HyperLEDA/local-volume/issues) and repository Milestones.
