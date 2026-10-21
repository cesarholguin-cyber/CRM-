"""Discard only expired, unpublished uploads recorded by the CRM.
Run from the repository root. Published tutorials and legacy objects are untouched.
"""
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend))
load_dotenv(backend / '.env', override=False)
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.tutorial import TutorialUpload
from app.services import backblaze_storage as b2


async def cleanup():
    count = 0
    while True:
        async with async_session_factory() as db:
            item = await db.scalar(select(TutorialUpload).where(
                TutorialUpload.state == 'pending', TutorialUpload.tutorial_id.is_(None),
                TutorialUpload.created_at < datetime.now(timezone.utc) - timedelta(hours=24)
            ).order_by(TutorialUpload.created_at).limit(1).with_for_update(skip_locked=True))
            if item is None:
                break
            if item.storage_upload_id:
                await b2.abort_multipart(item.object_path, item.storage_upload_id)
            await b2.remove(item.object_path)
            item.state = 'aborted'
            await db.commit()
            count += 1
    print(f'Cargas vencidas descartadas: {count}')


if __name__ == '__main__':
    asyncio.run(cleanup())
