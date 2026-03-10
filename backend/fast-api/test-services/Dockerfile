# Test runner image — includes dev dependencies (pytest, httpx, etc.)
FROM python:3.13-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency manifest from the fast-api root (build context is fast-api/)
COPY pyproject.toml ./
COPY uv.lock* ./

# Install all dependencies including the dev group
RUN uv sync

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH=/app

COPY . /app

RUN chmod +x /app/start.sh

CMD ["uv", "run", "pytest", "-v", "--cov=..", "--cov-report=term-missing", "tests"]
