# ─── Build stage ─────────────────────────────────────────────────────────────
FROM python:3.13-slim AS builder

# Install uv from the official image (fast Rust-based installer)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency manifest first — Docker layer cache means this layer only
# rebuilds when pyproject.toml or uv.lock changes, not on every code change.
COPY pyproject.toml ./
# uv.lock is optional on first build; uv will create/update it automatically.
COPY uv.lock* ./

# Install production dependencies only (no dev/test tools in the runtime image)
RUN uv sync --no-dev

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# Carry over the installed virtual environment from the builder
COPY --from=builder /app/.venv /app/.venv

# Ensure the venv's bin directory is on PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH=/app

# Copy application source
COPY . /app

RUN chmod +x /app/start.sh

EXPOSE 8000

CMD ["/app/start.sh"]
