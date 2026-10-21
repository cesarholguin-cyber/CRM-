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
PART_BYTES = 8 * 1024 * 1024


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


async def begin_multipart(path, content_type):
    def perform(s3):
        require_private(s3)
        return s3.create_multipart_upload(Bucket=settings.B2_BUCKET, Key=path,
            ContentType=content_type, ContentDisposition='inline',
            CacheControl='private, max-age=3600')['UploadId']
    return await _run(perform)


def _parts(s3, path, upload_id):
    pages = s3.get_paginator('list_parts').paginate(Bucket=settings.B2_BUCKET, Key=path, UploadId=upload_id)
    return sorted((part for page in pages for part in page.get('Parts', [])), key=lambda p: p['PartNumber'])


def _head(s3, path):
    try:
        return s3.head_object(Bucket=settings.B2_BUCKET, Key=path)
    except ClientError as error:
        if error.response.get('Error', {}).get('Code') in ('404', 'NoSuchKey', 'NotFound'):
            return None
        raise


async def multipart_plan(path, upload_id, size):
    def perform(s3):
        # A lost completion response must not trigger another upload of the file.
        if _head(s3, path) is not None:
            return {'uploaded': True, 'parts': []}
        received = {p['PartNumber']: p['Size'] for p in _parts(s3, path, upload_id)}
        parts = []
        for number, start in enumerate(range(0, size, PART_BYTES), 1):
            length = min(PART_BYTES, size - start)
            parts.append({'number': number, 'start': start, 'size': length,
                'received': received.get(number) == length,
                'url': s3.generate_presigned_url('upload_part', Params={
                    'Bucket': settings.B2_BUCKET, 'Key': path, 'UploadId': upload_id,
                    'PartNumber': number, 'ContentLength': length}, ExpiresIn=3600, HttpMethod='PUT')})
        return {'uploaded': False, 'parts': parts}
    return await _run(perform)


async def complete_multipart(path, upload_id, size, content_type):
    def perform(s3):
        head = _head(s3, path)
        if head is None:
            parts = _parts(s3, path, upload_id)
            expected = [(n, min(PART_BYTES, size - start)) for n, start in enumerate(range(0, size, PART_BYTES), 1)]
            if [(p['PartNumber'], p['Size']) for p in parts] != expected:
                raise HTTPException(409, 'La carga está incompleta. Reintenta para continuar con las partes pendientes.')
            s3.complete_multipart_upload(Bucket=settings.B2_BUCKET, Key=path, UploadId=upload_id,
                MultipartUpload={'Parts': [{'PartNumber': p['PartNumber'], 'ETag': p['ETag']} for p in parts]})
            head = s3.head_object(Bucket=settings.B2_BUCKET, Key=path)
        if head['ContentLength'] != size or head['ContentType'] != content_type:
            raise HTTPException(422, 'El tamaño o formato recibido no coincide con el video seleccionado.')
        body = s3.get_object(Bucket=settings.B2_BUCKET, Key=path, Range='bytes=0-63')['Body']
        try:
            header = body.read(64)
        finally:
            body.close()
        valid = ((content_type == 'video/mp4' and header[4:8] == b'ftyp') or
                 (content_type == 'video/webm' and header.startswith(b'\x1aE\xdf\xa3') and b'webm' in header))
        if not valid:
            raise HTTPException(422, 'El archivo recibido no es un video MP4 o WebM válido.')
    await _run(perform)


async def abort_multipart(path, upload_id):
    def perform(s3):
        try:
            s3.abort_multipart_upload(Bucket=settings.B2_BUCKET, Key=path, UploadId=upload_id)
        except ClientError as error:
            if error.response.get('Error', {}).get('Code') != 'NoSuchUpload':
                raise
    await _run(perform)


async def configure_upload_cors(origins):
    """Explicit deployment step. Preserve unrelated rules and keep the bucket private."""
    def perform(s3):
        require_private(s3)
        try:
            rules = s3.get_bucket_cors(Bucket=settings.B2_BUCKET).get('CORSRules', [])
        except ClientError as error:
            if error.response.get('Error', {}).get('Code') not in ('NoSuchCORSConfiguration', 'NoSuchCorsConfiguration'):
                raise
            rules = []
        rules = [r for r in rules if r.get('ID') != 'crm-tutorial-direct-upload']
        rules.append({'ID': 'crm-tutorial-direct-upload', 'AllowedOrigins': origins,
                      'AllowedMethods': ['PUT'], 'AllowedHeaders': ['content-type'],
                      'ExposeHeaders': ['ETag'], 'MaxAgeSeconds': 3600})
        s3.put_bucket_cors(Bucket=settings.B2_BUCKET, CORSConfiguration={'CORSRules': rules})
    await _run(perform)
