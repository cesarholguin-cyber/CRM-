"""Private tutorial objects; service credentials never leave this backend."""
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings

BUCKET = 'crm-tutoriales'
MAX_VIDEO_BYTES = 50 * 1024 * 1024
SIGNED_URL_SECONDS = 3600
logger = logging.getLogger(__name__)


async def storage_request(method, path, **kwargs):
    key = settings.SUPABASE_SECRET_KEY
    if not settings.SUPABASE_URL or not key:
        raise HTTPException(503, "Falta configurar el almacenamiento privado de videos.")
    headers = {'apikey': key, **kwargs.pop('headers', {})}
    if key.startswith('eyJ'):
        headers['Authorization'] = 'Bearer ' + key
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=15)) as client:
            response = await client.request(method, settings.SUPABASE_URL.rstrip('/') + '/storage/v1' + path,
                                            headers=headers, **kwargs)
    except httpx.HTTPError:
        raise HTTPException(503, "No se pudo conectar con los videos. Intenta de nuevo.")
    if response.is_error:
        if response.status_code == 413:
            raise HTTPException(413, "El video supera el tamaño permitido. Máximo 50 MB.")
        logger.warning('Tutorial storage failed: HTTP %s', response.status_code)
        raise HTTPException(503, "No se pudo guardar o abrir el video. Intenta de nuevo.")
    return response.json()


def new_video_path(user_id, extension):
    from uuid import uuid4
    return f'b2/tutorials/{user_id}/{uuid4().hex}{extension}'


async def upload_video(path, file, content_type, size):
    # All new uploads go to Backblaze. Never fall back to Supabase on failure.
    if not path.startswith('b2/tutorials/'):
        raise HTTPException(422, "Destino de video inválido.")
    from app.services import backblaze_storage
    await backblaze_storage.upload(path, file, content_type, size)


async def remove_video(path):
    if path.startswith('b2/tutorials/'):
        from app.services import backblaze_storage
        return await backblaze_storage.remove(path)
    await storage_request('DELETE', f'/object/{BUCKET}', json={'prefixes': [path]})


async def signed_video_url(path):
    if path.startswith('b2/tutorials/'):
        from app.services import backblaze_storage
        return await backblaze_storage.signed_url(path, SIGNED_URL_SECONDS)
    # Previously uploaded tutorials retain access to their original provider.
    result = await storage_request('POST', f'/object/sign/{BUCKET}/{path}', json={'expiresIn': SIGNED_URL_SECONDS})
    return settings.SUPABASE_URL.rstrip('/') + '/storage/v1' + result['signedURL']
