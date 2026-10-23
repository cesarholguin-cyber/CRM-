"""Import the approved Maculí inventory; preview by default, never reset existing lots."""
import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.models import *
from app.core.database import async_session_factory, engine
from app.services.maculi import seed_maculi
from app.api.web_requests import lock_key


async def main(apply):
    async with async_session_factory() as db:
        await lock_key(db, 'catalog:maculi-sur')
        result = await seed_maculi(db)
        if apply:
            await db.commit()
        else:
            await db.rollback()
        print(json.dumps(dict(result, applied=apply)))
    await engine.dispose()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    asyncio.run(main(parser.parse_args().apply))
