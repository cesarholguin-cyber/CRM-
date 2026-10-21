"""Verify the existing private Backblaze bucket without creating or modifying it.
Run from the repository root: python backend/scripts/setup_tutorial_storage.py
"""
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend))
load_dotenv(backend / '.env', override=False)
from app.services.backblaze_storage import verify_bucket


if __name__ == '__main__':
    asyncio.run(verify_bucket())
    print('Backblaze configurado: bucket privado verificado.')
