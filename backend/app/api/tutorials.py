import logging
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import UserRole
from app.models.tutorial import Tutorial
from app.services import tutorial_storage as storage

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
        raise HTTPException(413, "El video debe pesar como máximo 50 MB.")
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
    path = f'{user.id}/{uuid4().hex}{extension}'
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
