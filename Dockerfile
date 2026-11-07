FROM oven/bun:1.4.2 AS web
WORKDIR /repo
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --ignore-scripts
COPY apps/web apps/web
RUN bun run --filter web build

FROM python:3.14-slim AS api
COPY --from=ghcr.io/astral-sh/uv:0.12.13 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY apps/api/pyproject.toml apps/api/uv.lock apps/api/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY apps/api/corkathon_api corkathon_api
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.14-slim
RUN useradd --create-home app && mkdir /data && chown app /data
WORKDIR /app
COPY --from=api /app/.venv .venv
COPY --from=web /repo/apps/web/dist web
ENV PATH=/app/.venv/bin:$PATH \
    APP_ENV=production \
    HOST=0.0.0.0 \
    PORT=5001 \
    WEB_DIST=/app/web \
    DATABASE_URL=sqlite:////data/corkathon.db \
    FILINGS_DATA_DIR=/data/filings
USER app
VOLUME /data
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=3s CMD ["python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:5001/api/health')"]
CMD ["python", "-m", "corkathon_api.serve"]
