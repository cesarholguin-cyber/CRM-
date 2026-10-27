# ==================== STAGE 1: Build Frontend ====================
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==================== STAGE 2: Production ====================
FROM python:3.12.16-slim@sha256:962f801b08c870ac2a51b72bf02dae38c9a4162319e5e882ec244e198188d54e

WORKDIR /app

# Production must never silently start a new SQLite demo database.
ENV DATABASE_MODE=supabase

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    gcc \
    libpq-dev \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.lock ./
RUN python -m pip install --no-cache-dir pip==26.2.2 \
    && python -m pip install --no-cache-dir --require-hashes -r requirements.lock \
    && python -m pip check

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser && mkdir -p /app/backend/data && chown appuser:appuser /app/backend/data
USER appuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:80/health', timeout=3)" || exit 1

CMD ["sh", "-c", "cd backend && uvicorn app.main:app --host 0.0.0.0 --port 80"]
