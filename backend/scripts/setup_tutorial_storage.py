"""Provision the private tutorial bucket using the existing backend credentials.
Run from the repository root: python backend/scripts/setup_tutorial_storage.py
"""
import asyncio
import sys
from pathlib import Path
import httpx
from dotenv import load_dotenv

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend))
load_dotenv(backend / '.env', override=False)
from app.core.config import settings
from app.services.tutorial_storage import BUCKET, MAX_VIDEO_BYTES, storage_request


async def main():
    headers = {'apikey': settings.SUPABASE_SECRET_KEY}
    if settings.SUPABASE_SECRET_KEY.startswith('eyJ'):
        headers['Authorization'] = 'Bearer ' + settings.SUPABASE_SECRET_KEY
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(settings.SUPABASE_URL.rstrip('/') + '/storage/v1/bucket/' + BUCKET, headers=headers)
    if response.status_code in (400, 404) and response.json().get('message') == 'Bucket not found':
        await storage_request('POST', '/bucket', json={'id': BUCKET, 'name': BUCKET, 'public': False,
            'file_size_limit': MAX_VIDEO_BYTES, 'allowed_mime_types': ['video/mp4', 'video/webm']})
    elif response.is_error:
        raise RuntimeError(f'No se pudo verificar el bucket (HTTP {response.status_code}).')
    bucket = await storage_request('GET', '/bucket/' + BUCKET)
    if bucket.get('public') or bucket.get('file_size_limit') != MAX_VIDEO_BYTES or set(bucket.get('allowed_mime_types') or []) != {'video/mp4', 'video/webm'}:
        raise RuntimeError('Revisa la privacidad, los formatos y el límite del bucket antes de continuar.')
    print('Bucket privado crm-tutoriales listo: MP4/WebM, máximo 50 MB por archivo.')


if __name__ == '__main__':
    asyncio.run(main())
