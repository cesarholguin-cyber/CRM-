"""The original landing slug remains an alias after the inventory move."""
import re

from sqlalchemy import select
from app.models.project import Project

LEGACY_SLUG = 'floresta-campestre'
TARGET_SLUG = 'campestre-el-triunfo'
TARGET_NAME = 'Campestre del Triunfo'
PLAN_SLUGS = (LEGACY_SLUG, TARGET_SLUG)


def normalize_block(value):
    value = str(value or '').strip().upper()
    return 'M' + str(int(re.sub(r'^M(?:Z)?\s*', '', value))) if re.fullmatch(r'(?:M(?:Z)?\s*)?\d+', value) else value


async def resolve_public_project(db, slug):
    if slug == LEGACY_SLUG:
        target = await db.scalar(select(Project).where(Project.slug == TARGET_SLUG))
        if target is not None:
            return target
    return await db.scalar(select(Project).where(Project.slug == slug))
