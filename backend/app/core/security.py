from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import pyotp
import base64
import hashlib
import os

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str | Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return {}


# Fernet encryption for sensitive field-level data (e.g., phone numbers, addresses)
def get_fernet() -> Fernet:
    key_bytes = settings.ENCRYPTION_KEY.encode() if isinstance(settings.ENCRYPTION_KEY, str) else settings.ENCRYPTION_KEY
    if len(key_bytes) < 32:
        key_bytes = hashlib.sha256(key_bytes).digest()
    key = base64.urlsafe_b64encode(key_bytes[:32])
    return Fernet(key)


def encrypt_field(value: str) -> str:
    f = get_fernet()
    return f.encrypt(value.encode()).decode()


def decrypt_field(encrypted_value: str) -> str:
    f = get_fernet()
    return f.decrypt(encrypted_value.encode()).decode()


# 2FA / TOTP
def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name="R&F CRM")


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code)


# Generate a secure random key for encryption (run once to create)
def generate_encryption_key() -> str:
    return base64.urlsafe_b64encode(os.urandom(32)).decode()
