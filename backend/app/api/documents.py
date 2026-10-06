from datetime import timezone
from enum import Enum
from hashlib import sha256
from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import quote
from zipfile import ZipFile, BadZipFile
import re
import asyncio
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from app.api.deps import get_current_user, get_request_info
from app.core.audit import AuditLog
from app.core.config import settings
from app.core.database import get_db
from app.models.document import SaleDocument, DocumentObject
from app.services.object_storage import get_object_storage
from app.models.sale import Sale
from app.models.client import Client
from app.models.lot import Lot
from app.models.project import Project
from app.schemas.sale import SaleResponse
from app.schemas.client import ClientResponse

router = APIRouter(tags=["Expedientes"])


class DocumentCategory(str, Enum):
    OWNERSHIP = "ownership"
    CLIENT = "client"
    CONTRACT = "contract"
    PAYMENT = "payment"
    OTHER = "other"


def metadata(doc):
    return {"id": doc.id, "sale_id": doc.sale_id, "category": doc.category,
            "filename": doc.filename, "content_type": doc.content_type,
            "size_bytes": doc.size_bytes, "description": doc.description,
            "uploaded_by": doc.uploaded_by,
            "created_at": doc.created_at.replace(tzinfo=timezone.utc) if doc.created_at.tzinfo is None else doc.created_at}


def client_info(client):
    result = ClientResponse.model_validate(client).model_dump()
    result["full_name"] = result["full_name"].removeprefix("dec::")
    return result


async def sale_info(db, sale):
    lot = await db.get(Lot, sale.lot_id)
    project = await db.get(Project, lot.project_id) if lot else None
    documents = (await db.scalars(select(SaleDocument).where(SaleDocument.sale_id == sale.id)
                                 .order_by(SaleDocument.created_at.desc(), SaleDocument.id.desc()))).all()
    return {"sale": SaleResponse.model_validate(sale),
            "lot": {"id": lot.id, "number": lot.lot_number, "block": lot.block,
                    "area_sqm": lot.area_sqm, "project": project.name if project else None} if lot else None,
            "documents": [metadata(doc) for doc in documents]}


@router.get("/sales/{sale_id}/dossier")
async def sale_dossier(sale_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    sale = await db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(404, "Venta no encontrada")
    result = await sale_info(db, sale)
    client = await db.get(Client, sale.client_id)
    result["client"] = client_info(client) if client else None
    return result


@router.get("/clients/{client_id}/dossier")
async def client_dossier(client_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(404, "Cliente no encontrado")
    sales = (await db.scalars(select(Sale).where(Sale.client_id == client_id).order_by(Sale.created_at.desc()))).all()
    return {"client": client_info(client), "sales": [await sale_info(db, sale) for sale in sales]}


def validate_content(filename, content):
    ext = PurePosixPath(filename).suffix.lower()
    signatures = {".pdf": (b"%PDF-", "application/pdf"),
                  ".png": (b"\x89PNG\r\n\x1a\n", "image/png"),
                  ".jpg": (b"\xff\xd8\xff", "image/jpeg"),
                  ".jpeg": (b"\xff\xd8\xff", "image/jpeg")}
    if ext in signatures:
        signature, mime = signatures[ext]
        if content.startswith(signature):
            return mime
    elif ext == ".webp" and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    elif ext == ".txt":
        try:
            content.decode("utf-8")
            if b"\0" not in content:
                return "text/plain"
        except UnicodeDecodeError:
            pass
    elif ext in (".docx", ".xlsx"):
        try:
            with ZipFile(BytesIO(content)) as archive:
                names = set(archive.namelist())
                required = "word/document.xml" if ext == ".docx" else "xl/workbook.xml"
                if len(names) <= 2000 and "[Content_Types].xml" in names and required in names and not any("vbaproject" in n.lower() for n in names):
                    suffix = "wordprocessingml.document" if ext == ".docx" else "spreadsheetml.sheet"
                    return "application/vnd.openxmlformats-officedocument." + suffix
        except (BadZipFile, ValueError):
            pass
    raise HTTPException(422, f"{filename}: usa PDF, JPG, PNG, WebP, DOCX, XLSX o TXT con contenido válido.")


@router.post("/sales/{sale_id}/documents", status_code=201)
async def upload_documents(
    sale_id: int, request: Request,
    files: list[UploadFile] = File(...), category: DocumentCategory = Form(...),
    description: str = Form(default="", max_length=2000),
    db: AsyncSession = Depends(get_db), user=Depends(get_current_user),
):
    try:
        sale = await db.get(Sale, sale_id)
        if not sale:
            raise HTTPException(404, "Venta no encontrada")
        if not 1 <= len(files) <= 10:
            raise HTTPException(422, "Selecciona entre 1 y 10 archivos por carga.")
        rows, total = [], 0
        limit = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        for file in files:
            filename = re.sub(r"[\x00-\x1f\x7f]", "", (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]).strip()
            if not filename or len(filename) > 255:
                raise HTTPException(422, "El nombre del archivo debe tener entre 1 y 255 caracteres.")
            chunks, size = [], 0
            while chunk := await file.read(64 * 1024):
                size += len(chunk)
                total += len(chunk)
                if size > limit or total > 50 * 1024 * 1024:
                    raise HTTPException(413, f"Máximo {settings.MAX_UPLOAD_SIZE_MB} MB por archivo y 50 MB por carga.")
                chunks.append(chunk)
            if not size:
                raise HTTPException(422, f"{filename}: el archivo está vacío.")
            content = b"".join(chunks)
            mime = validate_content(filename, content)
            rows.append(SaleDocument(sale_id=sale.id, category=category.value, filename=filename,
                                    content_type=mime, size_bytes=size, sha256=sha256(content).hexdigest(),
                                    description=description.strip() or None, uploaded_by=user.id, content=content))
        # Validate the whole batch before writing; documents and audit commit atomically.
        db.add_all(rows)
        await db.flush()
        if settings.DOCUMENT_STORAGE == "oci":
            try:
                storage = get_object_storage()
                for doc in rows:
                    location = await asyncio.to_thread(storage.put, sale.id, doc.content, doc.content_type)
                    db.add(DocumentObject(document_id=doc.id, **location))
                    doc.content = b""  # BLOB placeholder; the authenticated API resolves the location.
                await db.flush()
            except Exception:
                await db.rollback()
                logging.getLogger(__name__).error("OCI upload failed; no document metadata committed")
                raise HTTPException(503, "No se pudieron archivar los documentos. Intenta nuevamente.")
        db.add(AuditLog(user_id=user.id, username=user.email, action="SALE_DOCUMENTS_UPLOADED",
                        entity_type="sale", entity_id=sale.id,
                        details={"document_ids": [doc.id for doc in rows], "category": category.value},
                        **get_request_info(request)))
        await db.commit()
        return [metadata(doc) for doc in rows]
    finally:
        for file in files:
            await file.close()


@router.get("/sales/{sale_id}/documents/{document_id}/download")
async def download_document(sale_id: int, document_id: int, request: Request,
                            db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    doc = await db.scalar(select(SaleDocument).options(undefer(SaleDocument.content))
                          .where(SaleDocument.id == document_id, SaleDocument.sale_id == sale_id))
    if not doc:
        raise HTTPException(404, "Documento no encontrado en esta venta")
    location = await db.get(DocumentObject, doc.id)
    content = doc.content
    if location:
        try:
            content = await asyncio.to_thread(get_object_storage().get, location.namespace, location.bucket,
                                             location.object_key, doc.size_bytes, doc.sha256)
        except Exception:
            logging.getLogger(__name__).error("OCI download failed for document %s", doc.id)
            raise HTTPException(503, "El documento no está disponible en este momento. Intenta nuevamente.")
    if len(content) != doc.size_bytes or sha256(content).hexdigest() != doc.sha256:
        raise HTTPException(503, "No se pudo verificar el documento archivado.")
    db.add(AuditLog(user_id=user.id, username=user.email, action="SALE_DOCUMENT_DOWNLOADED",
                    entity_type="sale_document", entity_id=doc.id, **get_request_info(request)))
    await db.commit()
    return Response(content=content, media_type=doc.content_type, headers={
        "Content-Disposition": "attachment; filename*=UTF-8''" + quote(doc.filename, safe=""),
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
    })
