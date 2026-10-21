"""Private Backblaze S3 tutorial storage, with blocking SDK work off the event loop."""
import logging
from urllib.parse import urlparse
import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from app.core.config import settings

logger = logging.getLogger(__name__)


def client():
    if not all((settings.B2_ENDPOINT_URL, settings.B2_REGION, settings.B2_BUCKET,
                settings.B2_APPLICATION_KEY_ID, settings.B2_APPLICATION_KEY)):
        raise HTTPException(503, 'Falta configurar Backblaze para subir y reproducir videos.')
    endpoint = urlparse(settings.B2_ENDPOINT_URL)
    if (endpoint.scheme != 'https' or not endpoint.hostname or
            not endpoint.hostname.endswith('.backblazeb2.com') or endpoint.username or
            endpoint.password or endpoint.query or endpoint.fragment or endpoint.path not in ('', '/')):
        raise HTTPException(503, 'Revisa el endpoint HTTPS de Backblaze en la configuración del servidor.')
    return boto3.client('s3', endpoint_url=settings.B2_ENDPOINT_URL.rstrip('/'),
        region_name=settings.B2_REGION, aws_access_key_id=settings.B2_APPLICATION_KEY_ID,
        aws_secret_access_key=settings.B2_APPLICATION_KEY,
        config=Config(signature_version='s3v4', s3={'addressing_style': 'path'},
                      connect_timeout=15, read_timeout=120, retries={'mode': 'standard', 'max_attempts': 2},
                      request_checksum_calculation='when_required', response_checksum_validation='when_required'))


def require_private(s3):
    acl = s3.get_bucket_acl(Bucket=settings.B2_BUCKET)
    if any(grant.get('Grantee', {}).get('Type') == 'Group' for grant in acl.get('Grants', [])):
        raise HTTPException(503, 'El bucket de videos debe ser privado antes de continuar.')


async def _run(operation):
    def perform():
        s3 = client()
        try:
            return operation(s3)
        except (BotoCoreError, ClientError) as error:
            code = error.response.get('Error', {}).get('Code', 'unknown') if isinstance(error, ClientError) else type(error).__name__
            logger.warning('Backblaze tutorial operation failed (%s)', code)
            raise HTTPException(503, 'No se pudo acceder a los videos. Revisa la conexión y la configuración de Backblaze.') from None
        finally:
            s3.close()
    return await run_in_threadpool(perform)


async def verify_bucket():
    await _run(require_private)


async def upload(path, file, content_type, size):
    def perform(s3):
        require_private(s3)
        # UploadFile is spooled to disk; do not load an entire video into RAM.
        file.file.seek(0)
        s3.put_object(Bucket=settings.B2_BUCKET, Key=path, Body=file.file, ContentLength=size,
                      ContentType=content_type, ContentDisposition='inline', CacheControl='private, max-age=3600')
    await _run(perform)


async def remove(path):
    def perform(s3):
        # B2 keeps versions. Deleting only the key would leave bytes behind.
        # Clean only the exact UUID key allocated to this failed upload attempt.
        pages = s3.get_paginator('list_object_versions').paginate(Bucket=settings.B2_BUCKET, Prefix=path)
        for page in pages:
            for item in page.get('Versions', []) + page.get('DeleteMarkers', []):
                if item['Key'] == path:
                    s3.delete_object(Bucket=settings.B2_BUCKET, Key=path, VersionId=item['VersionId'])
    await _run(perform)


async def signed_url(path, expires_in):
    return await _run(lambda s3: s3.generate_presigned_url('get_object',
        Params={'Bucket': settings.B2_BUCKET, 'Key': path, 'ResponseContentDisposition': 'inline'},
        ExpiresIn=expires_in, HttpMethod='GET'))
