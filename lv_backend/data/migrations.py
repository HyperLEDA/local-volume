import pathlib

import yoyo

from lv_backend.data import storage

_MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parents[2] / "postgres" / "migrations"


def apply(config: storage.StorageConfig) -> None:
    with yoyo.get_backend(_dsn(config)) as backend:
        migrations = yoyo.read_migrations(str(_MIGRATIONS_DIR))
        with backend.lock():
            backend.apply_migrations(backend.to_apply(migrations))


def _dsn(config: storage.StorageConfig) -> str:
    return (
        f"postgresql+psycopg://{config.endpoint}:{config.port}/{config.dbname}"
        f"?user={config.user}&password={config.password}&schema=public"
    )
