from collections.abc import Sequence
from typing import Any

import psycopg.rows
import psycopg_pool
import pydantic_settings


class StorageConfig(pydantic_settings.BaseSettings):
    model_config = pydantic_settings.SettingsConfigDict(env_prefix="STORAGE_")

    endpoint: str = "localhost"
    port: int = 6433
    dbname: str = "lv"
    user: str = "lv"
    password: str = "password"

    def get_dsn(self) -> str:
        return f"postgresql://{self.endpoint}:{self.port}/{self.dbname}?user={self.user}&password={self.password}"


class Storage:
    def __init__(self, config: StorageConfig) -> None:
        self._config = config
        self._pool: psycopg_pool.ConnectionPool | None = None

    def connect(self) -> None:
        self._pool = psycopg_pool.ConnectionPool(
            self._config.get_dsn(),
            min_size=1,
            max_size=10,
            open=True,
            kwargs={"row_factory": psycopg.rows.dict_row, "autocommit": True},
        )

    def close(self) -> None:
        if self._pool is not None:
            self._pool.close()
            self._pool = None

    def query(self, sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
        if self._pool is None:
            raise RuntimeError("connection pool is not initialized")
        with self._pool.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, params)
                return list(cursor.fetchall())
