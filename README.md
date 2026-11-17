# Local Volume (LV LEDA)

Local Volume galaxy catalogue and group explorer developed within LEDA.
The application provides an object catalogue, galaxy detail pages, sky maps,
physical parameters, group information, and scientific diagnostics.

The codebase contains a Python/FastAPI backend, a React/TypeScript frontend,
and PostgreSQL/PostGIS migrations.

## Local development

Requirements: Python 3.12+, [uv](https://docs.astral.sh/uv/),
[Bun](https://bun.sh/), Docker with Compose, and GNU Make for the `make` targets.
The commands below assume a Unix-like shell and a disposable local database.

```sh
make install-dev
make start-db
uv run lv-backend migrate
bun run --cwd frontend build
uv run lv-backend webserver
```

The web server listens at `http://localhost:8000`. The local Compose database
is exposed on port `6433`; connection defaults are documented in `.env.example`.
Do not reuse the example credentials in a production deployment.

## Checks

```sh
make check       # Python checks, migrations naming, frontend lint, and tests
make test-js     # All JavaScript/TypeScript tests (Bun)
```

The CI workflow runs `make check` and builds a Docker image for every pull
request. Its `tests` and `build` jobs are required before merging into `main`.

Vite-generated fingerprinted assets under `/assets/` use immutable one-year
browser caching. Unfingerprinted assets and the app's HTML are not given this
long-lived caching policy.

## Database safety

`make check-schema` lints the schema of an **already running** database. It
does not start, migrate, stop, recreate, or delete the database. The connection
can be configured with `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and
`PGDATABASE`; defaults are in `.schemalintrc.js`. Only use it with a database
you are authorized to inspect.

For a fresh schema check, the `Check migrations` GitHub Actions workflow starts
an isolated PostGIS container, applies all migrations, and runs the linter.
