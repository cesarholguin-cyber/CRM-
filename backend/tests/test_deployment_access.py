import asyncio

from sqlalchemy import func, select

from test_web_requests import setup
from app.api import auth
from app.core.security import get_password_hash, verify_password
from app.models import User, UserRole, Lot
from app.services.deployment_access import provision_deployment_access


def account():
    return {"email": "new-user@example.com", "full_name": "New User",
            "password_hash": get_password_hash("Test-access-123")}


async def test_existing_database_creates_account_and_real_login_works(setup, monkeypatch):
    http, sessions, app = setup
    app.include_router(auth.router, prefix="/api/v1")
    monkeypatch.setattr(auth, "write_audit_log", lambda *a, **kw: None)
    async with sessions() as db:
        db.add(User(email="admin@example.com", username="admin", full_name="Admin",
                    hashed_password="unchanged", role=UserRole.ADMIN))
        await db.commit()
    data = account()
    assert await provision_deployment_access(sessions, "embedded", data)
    login = await http.post("/api/v1/auth/login", json={
        "email": data["email"], "password": "Test-access-123"})
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "PROMOTOR"
    me = await http.get("/api/v1/auth/me", headers={
        "Authorization": "Bearer " + login.json()["access_token"]})
    assert me.status_code == 200
    assert me.json()["email"] == data["email"]
    async with sessions() as db:
        assert await db.scalar(select(func.count(Lot.id))) == 3
        admin = await db.scalar(select(User).where(User.email == "admin@example.com"))
        assert admin.hashed_password == "unchanged"


async def test_redeploy_preserves_changed_password_and_disabled_account(setup):
    _, sessions, _ = setup
    data = account()
    await provision_deployment_access(sessions, "embedded", data)
    async with sessions() as db:
        user = await db.scalar(select(User).where(User.email == data["email"]))
        user.hashed_password = get_password_hash("Changed-password-123")
        user.is_active = False
        user.totp_enabled = True
        await db.commit()
    assert not await provision_deployment_access(sessions, "embedded", data)
    async with sessions() as db:
        user = await db.scalar(select(User).where(User.email == data["email"]))
        assert verify_password("Changed-password-123", user.hashed_password)
        assert user.is_active is False and user.totp_enabled is True
        assert await db.scalar(select(func.count(User.id))) == 1


async def test_simultaneous_starts_create_only_one_account(setup):
    _, sessions, _ = setup
    data = account()
    results = await asyncio.gather(*[
        provision_deployment_access(sessions, "embedded", data) for _ in range(2)])
    assert sorted(results) == [False, True]


async def test_external_databases_are_not_provisioned(setup):
    _, sessions, _ = setup
    for mode in ("external", "oracle"):
        assert not await provision_deployment_access(sessions, mode)
    async with sessions() as db:
        assert await db.scalar(select(func.count(User.id))) == 0
