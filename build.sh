#!/usr/bin/env bash
set -e

echo "=== Installing Python dependencies ==="
python -m pip install pip==26.2.2
python -m pip install --require-hashes -r backend/requirements.lock

echo "=== Building frontend ==="
cd frontend
npm ci
npm run build
cd ..

echo "=== Build complete ==="
