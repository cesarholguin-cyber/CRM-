"""Private OCI objects. The API remains the only download entry point."""
import base64
import hashlib
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from app.core.config import settings


class StorageError(Exception):
    pass


class OracleObjectStorage:
    def __init__(self):
        import oci
        config = oci.config.from_file(str(Path(settings.OCI_CONFIG_FILE).expanduser()), settings.OCI_CONFIG_PROFILE)
        self.client = oci.object_storage.ObjectStorageClient(config, timeout=(10, 60))

    def require_private(self, namespace, bucket):
        info = self.client.get_bucket(namespace, bucket).data
        if info.public_access_type != 'NoPublicAccess':
            raise StorageError('El bucket debe ser privado.')
        return info

    def put(self, sale_id, content, mime):
        namespace, bucket = settings.OCI_NAMESPACE, settings.OCI_BUCKET
        self.require_private(namespace, bucket)
        key = f'crm/sales/{sale_id}/{uuid4().hex}'
        digest = hashlib.sha256(content).hexdigest()
        self.client.put_object(namespace, bucket, key, content, content_type=mime,
            content_length=len(content), content_md5=base64.b64encode(hashlib.md5(content).digest()).decode(),
            opc_meta={'sha256': digest}, if_none_match='*')
        # Verify the stored bytes before saving the pointer in the database.
        self.get(namespace, bucket, key, len(content), digest)
        return {'namespace': namespace, 'bucket': bucket, 'object_key': key}

    def get(self, namespace, bucket, key, expected_size, expected_sha):
        self.require_private(namespace, bucket)
        response = self.client.get_object(namespace, bucket, key)
        chunks, size = [], 0
        try:
            for chunk in response.data.raw.stream(64 * 1024, decode_content=False):
                size += len(chunk)
                if size > expected_size:
                    raise StorageError('El tamaño del documento no coincide.')
                chunks.append(chunk)
        finally:
            response.data.close()
        content = b''.join(chunks)
        if size != expected_size or hashlib.sha256(content).hexdigest() != expected_sha:
            raise StorageError('La verificación del documento falló.')
        return content


@lru_cache(maxsize=1)
def get_object_storage():
    return OracleObjectStorage()
