"""Create a private OCI bucket or copy existing documents. Read-only without --apply."""
import argparse
import hashlib
from pathlib import Path
import sys


def ensure_bucket(storage, config, apply=False):
    import oci
    if not all((config.OCI_NAMESPACE, config.OCI_BUCKET, config.OCI_COMPARTMENT_ID)):
        raise RuntimeError('Configura OCI_NAMESPACE, OCI_BUCKET y OCI_COMPARTMENT_ID.')
    try:
        info = storage.require_private(config.OCI_NAMESPACE, config.OCI_BUCKET)
        if info.compartment_id != config.OCI_COMPARTMENT_ID:
            raise RuntimeError('El bucket existente pertenece a otro compartimento.')
        print('Bucket privado existente; no se modificó.')
    except oci.exceptions.ServiceError as exc:
        if exc.status != 404:
            raise
        if not apply:
            print('Bucket no encontrado o sin acceso. --apply intentará crearlo privado y con versiones.')
            return
        storage.client.create_bucket(config.OCI_NAMESPACE, oci.object_storage.models.CreateBucketDetails(
            name=config.OCI_BUCKET, compartment_id=config.OCI_COMPARTMENT_ID,
            public_access_type='NoPublicAccess', storage_tier='Standard', versioning='Enabled'))
        storage.require_private(config.OCI_NAMESPACE, config.OCI_BUCKET)
        print('Bucket privado creado con versiones habilitadas.')


def migrate_documents(session, storage, apply=False):
    from sqlalchemy import select
    from sqlalchemy.orm import undefer
    from app.models.document import SaleDocument, DocumentObject
    count = 0
    ids = session.scalars(select(SaleDocument.id).order_by(SaleDocument.id)).all()
    for doc_id in ids:
        doc = session.scalar(select(SaleDocument).options(undefer(SaleDocument.content)).where(SaleDocument.id == doc_id))
        location = session.get(DocumentObject, doc_id)
        if location:
            if apply:
                storage.get(location.namespace, location.bucket, location.object_key, doc.size_bytes, doc.sha256)
            continue
        if len(doc.content) != doc.size_bytes or hashlib.sha256(doc.content).hexdigest() != doc.sha256:
            raise RuntimeError(f'El documento {doc_id} no pasó la verificación; no se copió.')
        count += 1
        if apply:
            location = storage.put(doc.sale_id, doc.content, doc.content_type)
            session.add(DocumentObject(document_id=doc_id, **location))
            # Keep the original DB bytes as a recovery copy. No destructive purge.
            session.commit()
    print(f'Documentos {"copiados y verificados" if apply else "pendientes de copiar"}: {count}. Originales conservados.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['bucket', 'documents'])
    parser.add_argument('--env-file', type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.env_file:
        from dotenv import load_dotenv
        if not args.env_file.is_file():
            parser.error('No existe el archivo de configuración.')
        load_dotenv(args.env_file, override=True)
    from app.core.config import settings
    from app.services.object_storage import get_object_storage
    if args.action == 'bucket':
        ensure_bucket(get_object_storage(), settings, args.apply)
    else:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import Session
        from app.models.document import DocumentObject
        engine = create_engine(settings.DATABASE_URL_SYNC, hide_parameters=True,
            connect_args=settings.database_connect_args if settings.DATABASE_MODE == 'oracle' else {})
        from app.core.oracle_session import configure_oracle_session
        configure_oracle_session(engine)
        try:
            if args.apply:
                DocumentObject.__table__.create(engine, checkfirst=True)
            with Session(engine) as session:
                migrate_documents(session, get_object_storage() if args.apply else None, args.apply)
        finally:
            engine.dispose()


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Operación detenida:', str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__, file=sys.stderr)
        sys.exit(1)
