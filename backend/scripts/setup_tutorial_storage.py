"""Verify the existing private Backblaze bucket without creating or modifying it.
Run from the repository root: python backend/scripts/setup_tutorial_storage.py
"""
import asyncio
import argparse
import sys
from pathlib import Path
from dotenv import load_dotenv

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend))
load_dotenv(backend / '.env', override=False)
from app.services.backblaze_storage import verify_bucket, configure_upload_cors


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Verifica Backblaze y configura opcionalmente los dominios de carga.')
    parser.add_argument('--upload-origin', action='append', default=[], help='Origen HTTPS exacto del CRM (repetible).')
    args = parser.parse_args()
    asyncio.run(verify_bucket())
    if args.upload_origin:
        from urllib.parse import urlparse
        for origin in args.upload_origin:
            parsed = urlparse(origin)
            if parsed.scheme != 'https' or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username or '*' in origin:
                parser.error('Cada origen debe ser HTTPS, sin ruta, credenciales ni comodines.')
        asyncio.run(configure_upload_cors(args.upload_origin))
    print('Backblaze configurado: bucket privado verificado.')
