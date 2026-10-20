"""Provision the requested embedded-CRM account without resetting existing users."""

import json
from pathlib import Path

from sqlalchemy import func, select, text

from app.models.user import User, UserRole


async def provision_deployment_access(session_factory, database_mode, account=None):
    # External production databases use their own account administration.
    if database_mode != "embedded":
        return False
    if account is None:
        path = Path(__file__).resolve().parents[1] / "data/deployment-access.json"
        account = json.loads(path.read_text())
    email = account["email"].strip().lower()
    async with session_factory() as db:
        # Serialize simultaneous starts against the same persistent SQLite volume.
        await db.execute(text("BEGIN IMMEDIATE"))
        existing = await db.scalar(select(User.id).where(func.lower(User.email) == email))
        if existing is not None:
            await db.rollback()
            return False
        db.add(User(
            email=email,
            username=email,
            full_name=account["full_name"],
            hashed_password=account["password_hash"],
            role=UserRole.PROMOTOR,
            is_active=True,
            is_superuser=False,
            must_change_password=False,
        ))
        await db.commit()
    return True
