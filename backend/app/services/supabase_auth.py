"""Supabase verifies identity; the private CRM profile grants application roles.

No password hashes are copied out of auth.users. User-editable metadata is never
used for authorization. Only explicitly linked profiles can enter the CRM.
"""
from uuid import UUID
import httpx
from fastapi import HTTPException
import jwt
from jwt import InvalidTokenError
from sqlalchemy import select, text, func

from app.core.config import settings
from app.models.user import User


async def auth_request(method, path, *, data=None, token=None, admin=False):
    key = settings.SUPABASE_SECRET_KEY if admin else settings.SUPABASE_PUBLISHABLE_KEY
    if not key:
        raise HTTPException(503, 'Falta configurar la conexión de autenticación de Supabase.')
    headers = {'apikey': key}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    elif admin and not key.startswith('sb_secret_'):
        headers['Authorization'] = 'Bearer ' + key
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            response = await client.request(method, settings.SUPABASE_URL.rstrip('/') + '/auth/v1' + path,
                                            headers=headers, json=data)
    except httpx.RequestError:
        raise HTTPException(503, 'No se pudo conectar con Supabase. Intenta de nuevo.') from None
    if response.status_code == 429:
        raise HTTPException(429, 'Demasiados intentos. Espera un momento antes de volver a intentar.')
    if response.status_code >= 500:
        raise HTTPException(503, 'Supabase no está disponible temporalmente.')
    if response.is_error:
        if method == 'PUT' and path == '/user':
            raise HTTPException(400, 'Supabase rechazó el cambio. Revisa los requisitos de contraseña y vuelve a iniciar sesión.')
        if admin:
            raise HTTPException(400, 'No se pudo crear el usuario en Supabase; revisa si ya existe y la configuración de acceso.')
        raise HTTPException(401, 'Correo, contraseña o sesión incorrectos. Verifica también que el correo esté confirmado.')
    if not response.content:
        return {}
    return response.json()


async def sign_in(email, password, code=None):
    tokens = await auth_request('POST', '/token?grant_type=password',
                                data={'email': email.strip().lower(), 'password': password})
    factors = [f for f in tokens.get('user', {}).get('factors', [])
               if f.get('status') == 'verified']
    if factors:
        factor = next((f for f in factors if f.get('factor_type') == 'totp'), None)
        if not code or not factor:
            raise HTTPException(428, '2FA code required')
        factor_id = str(UUID(factor['id']))
        challenge = await auth_request('POST', f'/factors/{factor_id}/challenge', token=tokens['access_token'], data={})
        tokens = await auth_request('POST', f'/factors/{factor_id}/verify', token=tokens['access_token'],
                                    data={'challenge_id': challenge['id'], 'code': code})
    return tokens


async def session_exists(db, subject, session_id):
    # Check revocation immediately, including a user deleted/banned in the panel.
    return bool(await db.scalar(text('''
        SELECT EXISTS (
            SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
            WHERE s.id=CAST(:sid AS uuid) AND u.id=CAST(:uid AS uuid)
              AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL
              AND (u.banned_until IS NULL OR u.banned_until <= now())
              AND (s.not_after IS NULL OR s.not_after > now())
        )
    '''), {'sid': session_id, 'uid': subject}))


async def authenticated_user(db, access_token):
    identity = await auth_request('GET', '/user', token=access_token)
    # /user above validates the token with Supabase, including its signature and
    # expiry. Only then read the signed session ID; never trust decoded-only JWTs.
    try:
        subject = str(UUID(identity['id']))
        claims = jwt.decode(access_token, options={"verify_signature": False})
        session_id = str(UUID(claims['session_id']))
        if claims['sub'] != subject:
            raise ValueError('Subject mismatch')
    except (KeyError, TypeError, ValueError, InvalidTokenError):
        raise HTTPException(401, 'Sesión inválida.') from None
    if not await session_exists(db, subject, session_id):
        raise HTTPException(401, 'La sesión terminó o el usuario fue desactivado.')
    if any(f.get('status') == 'verified' for f in identity.get('factors', [])) and claims.get('aal') != 'aal2':
        raise HTTPException(428, '2FA code required')
    user = await db.scalar(select(User).where(User.supabase_auth_id == subject))
    if user is None or not user.is_active:
        raise HTTPException(403, 'Esta cuenta no tiene acceso activo al CRM. Contacta al administrador.')
    return user


async def create_user(db, data):
    email = str(data.email).strip().lower()
    existing = await db.scalar(select(User.id).where(
        (func.lower(User.email) == email) | (func.lower(User.username) == data.username.lower())))
    if existing is not None:
        raise HTTPException(409, 'El correo o nombre de usuario ya está registrado.')
    identity = await auth_request('POST', '/admin/users', admin=True, data={
        'email': email, 'password': data.password, 'email_confirm': True,
        'user_metadata': {'full_name': data.full_name}})
    auth_id = str(UUID(identity['id']))
    user = User(email=email, username=data.username, full_name=data.full_name,
                phone=data.phone, role=data.role, is_active=True,
                supabase_auth_id=auth_id, hashed_password='!supabase-auth')
    db.add(user)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        # Compensate only the identity this request created, never existing users.
        await auth_request('DELETE', '/admin/users/' + auth_id, admin=True)
        raise
    await db.refresh(user)
    return user
