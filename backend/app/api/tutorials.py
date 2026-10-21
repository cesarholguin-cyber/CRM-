import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Response, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_request_info
from app.core.audit import AuditLog
from app.core.database import get_db
from app.models.user import UserRole
from app.models.tutorial import Tutorial, TutorialUpload
from app.services import tutorial_storage as storage
from app.services import backblaze_storage as b2

logger = logging.getLogger(__name__)


async def tutorial_viewer(user=Depends(get_current_user)):
    if user.role not in (UserRole.ADMIN, UserRole.SISTEMAS):
        raise HTTPException(403, "Los tutoriales están disponibles para Administración y Sistemas.")
    return user


async def tutorial_uploader(user=Depends(get_current_user)):
    if user.role != UserRole.SISTEMAS:
        raise HTTPException(403, "Solo Sistemas puede subir tutoriales.")
    return user


router = APIRouter(prefix='/tutorials', tags=['Tutoriales'])


class TutorialResponse(BaseModel):
    id: int
    title: str
    description: str
    content_type: str
    size_bytes: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class UploadRequest(BaseModel):
    id: UUID
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default='', max_length=2000)
    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0, le=storage.MAX_VIDEO_BYTES)


async def owned_upload(db, upload_id, user):
    record = await db.scalar(select(TutorialUpload).where(
        TutorialUpload.id == str(upload_id), TutorialUpload.uploaded_by == user.id).with_for_update().execution_options(populate_existing=True))
    if record is None:
        raise HTTPException(404, 'No se encontró esta carga.')
    if record.state == 'aborted':
        raise HTTPException(410, 'Esta carga fue descartada. Selecciona de nuevo el video.')
    created = record.created_at.replace(tzinfo=timezone.utc) if record.created_at.tzinfo is None else record.created_at
    if record.state == 'pending' and created < datetime.now(timezone.utc) - timedelta(hours=24):
        raise HTTPException(410, 'Esta carga venció. Selecciona de nuevo el video.')
    return record


@router.post('/uploads')
async def start_upload(data: UploadRequest, response: Response,
                       user=Depends(tutorial_uploader), db: AsyncSession = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    title = data.title.strip()
    extension = Path(data.filename).suffix.lower()
    if not title or extension not in ('.mp4', '.webm'):
        raise HTTPException(422, 'Escribe un título y selecciona un video MP4 o WebM.')
    mime = 'video/mp4' if extension == '.mp4' else 'video/webm'
    record = await db.get(TutorialUpload, str(data.id))
    if record is None:
        record = TutorialUpload(id=str(data.id), uploaded_by=user.id,
            object_path=storage.new_video_path(user.id, extension), title=title,
            description=data.description.strip(), size_bytes=data.size_bytes, content_type=mime)
        db.add(record)
        try:
            await db.commit()
        except IntegrityError:
            # Concurrent retries share the browser's idempotency key.
            await db.rollback()
    record = await owned_upload(db, data.id, user)
    if (record.title, record.description, record.size_bytes, record.content_type) != (
            title, data.description.strip(), data.size_bytes, mime):
        raise HTTPException(409, 'Esta carga pertenece a otro archivo. Selecciona de nuevo el video.')
    if record.state == 'complete':
        video = await db.get(Tutorial, record.tutorial_id)
        return {'id': record.id, 'tutorial': TutorialResponse.model_validate(video), 'parts': []}
    if not record.storage_upload_id:
        record.storage_upload_id = await b2.begin_multipart(record.object_path, record.content_type)
        await db.commit()
        record = await owned_upload(db, data.id, user)
    plan = await b2.multipart_plan(record.object_path, record.storage_upload_id, record.size_bytes)
    await db.commit()
    return {'id': record.id, **plan}


@router.post('/uploads/{upload_id}/complete', response_model=TutorialResponse)
async def finish_upload(upload_id: UUID, user=Depends(tutorial_uploader), db: AsyncSession = Depends(get_db)):
    # Serialize completion/abort across workers, including retries after a lost response.
    record = await owned_upload(db, upload_id, user)
    if record.state == 'complete':
        return await db.get(Tutorial, record.tutorial_id)
    if not record.storage_upload_id:
        raise HTTPException(409, 'Inicia la carga del video antes de publicarlo.')
    await b2.complete_multipart(record.object_path, record.storage_upload_id, record.size_bytes, record.content_type)
    video = Tutorial(title=record.title, description=record.description, object_path=record.object_path,
                     content_type=record.content_type, size_bytes=record.size_bytes, uploaded_by=user.id)
    db.add(video)
    await db.flush()
    record.state, record.tutorial_id = 'complete', video.id
    result = TutorialResponse.model_validate(video)
    await db.commit()
    return result


@router.delete('/uploads/{upload_id}', status_code=204)
async def cancel_upload(upload_id: UUID, user=Depends(tutorial_uploader), db: AsyncSession = Depends(get_db)):
    record = await db.scalar(select(TutorialUpload).where(
        TutorialUpload.id == str(upload_id), TutorialUpload.uploaded_by == user.id).with_for_update().execution_options(populate_existing=True))
    if record is None:
        raise HTTPException(404, 'No se encontró esta carga.')
    if record.state != 'complete':
        if record.storage_upload_id:
            await b2.abort_multipart(record.object_path, record.storage_upload_id)
        await b2.remove(record.object_path)
        record.state = 'aborted'
        await db.commit()


@router.get('', response_model=list[TutorialResponse])
async def list_tutorials(user=Depends(tutorial_viewer), db: AsyncSession = Depends(get_db)):
    result = await db.scalars(select(Tutorial).order_by(Tutorial.created_at.desc(), Tutorial.id.desc()))
    return result.all()


@router.post('', response_model=TutorialResponse, status_code=201)
async def create_tutorial(title: str = Form(..., min_length=1, max_length=160),
                          description: str = Form('', max_length=2000), file: UploadFile = File(...),
                          user=Depends(tutorial_uploader), db: AsyncSession = Depends(get_db)):
    title = title.strip()
    if not title:
        raise HTTPException(422, "Escribe un título para el tutorial.")
    size = file.size or 0
    if size > storage.MAX_VIDEO_BYTES:
        raise HTTPException(413, "El video debe pesar como máximo 200 MB.")
    if not size:
        raise HTTPException(422, "El archivo está vacío.")
    extension = Path(file.filename or '').suffix.lower()
    header = await file.read(64)
    await file.seek(0)
    is_mp4 = extension == '.mp4' and header[4:8] == b'ftyp'
    is_webm = extension == '.webm' and header.startswith(b'\x1aE\xdf\xa3') and b'webm' in header
    if not (is_mp4 or is_webm):
        raise HTTPException(422, "Selecciona un video MP4 o WebM válido.")
    mime = 'video/mp4' if is_mp4 else 'video/webm'
    path = storage.new_video_path(user.id, extension)
    try:
        await storage.upload_video(path, file, mime, size)
        video = Tutorial(title=title, description=description.strip(), object_path=path,
                         content_type=mime, size_bytes=size, uploaded_by=user.id)
        db.add(video)
        await db.flush()
        result = TutorialResponse.model_validate(video)
        await db.commit()
        return result
    except Exception:
        await db.rollback()
        # UUID paths belong to this attempt only, including a timed-out upload.
        try:
            await storage.remove_video(path)
        except Exception:
            logger.error('Could not clean up tutorial object %s', path)
        raise
    finally:
        await file.close()


@router.get('/{tutorial_id}/play')
async def play_tutorial(tutorial_id: int, response: Response,
                        user=Depends(tutorial_viewer), db: AsyncSession = Depends(get_db)):
    video = await db.get(Tutorial, tutorial_id)
    if video is None:
        raise HTTPException(404, "No se encontró este tutorial.")
    response.headers['Cache-Control'] = 'no-store'
    return {'url': await storage.signed_video_url(video.object_path), 'expires_in': storage.SIGNED_URL_SECONDS}


@router.delete('/{tutorial_id}', status_code=204)
async def delete_tutorial(tutorial_id: int, request: Request, confirmed: bool = Query(False),
                          user=Depends(tutorial_viewer), db: AsyncSession = Depends(get_db)):
    if not confirmed:
        raise HTTPException(422, 'Marca la casilla de confirmación para eliminar el video.')
    # Match completion's lock order. Retire its idempotency key so retries cannot
    # recreate a deleted video or try to serialize a missing tutorial.
    uploads = (await db.scalars(select(TutorialUpload).where(
        TutorialUpload.tutorial_id == tutorial_id).order_by(TutorialUpload.id)
        .with_for_update())).all()
    video = await db.scalar(select(Tutorial).where(Tutorial.id == tutorial_id).with_for_update())
    if video is None:
        return  # A lost DELETE response is safe to retry.
    # Delete storage first; on provider failure keep the metadata for retry.
    # B2 removal includes all versions of this exact key, legacy storage is routed.
    await storage.remove_video(video.object_path)
    for upload in uploads:
        upload.state = 'aborted'
        upload.tutorial_id = None
        upload.storage_upload_id = None
    await db.flush()
    await db.delete(video)
    db.add(AuditLog(user_id=user.id, username=user.email, action='TUTORIAL_DELETED',
                    entity_type='tutorial', entity_id=tutorial_id,
                    details={'confirmed': True, 'title': video.title}, **get_request_info(request)))
    await db.commit()
