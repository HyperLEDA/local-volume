FROM oven/bun:1@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18 AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
ARG SOURCE_DATE_EPOCH=0
ENV SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH
RUN bun run build \
    && find dist -exec touch -t 197001010000.00 {} +

FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project
COPY lv_backend ./lv_backend
RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS runtime
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
COPY lv_backend ./lv_backend
COPY pyproject.toml README.md ./
# --link + fixed dist mtimes keep this layer digest stable across backend-only rebuilds
COPY --link --from=frontend /app/frontend/dist ./frontend/dist
CMD ["uvicorn", "lv_backend.presentation.app:app", "--host", "0.0.0.0", "--port", "8000"]
