from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from app.models.user import User


async def save_profile(db, user, changes):
    username = changes.get('username')
    if username is not None:
        existing = await db.scalar(select(User.id).where(
            func.lower(User.username) == username.lower(), User.id != user.id))
        if existing is not None:
            raise HTTPException(409, "Ese nombre de usuario ya está en uso.")
    for field, value in changes.items():
        setattr(user, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "No se pudo guardar. Revisa que el nombre de usuario esté disponible.")
    await db.refresh(user)
