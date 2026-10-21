from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional
from app.models.user import UserRole


def valid_username(value: str) -> str:
    import re
    if not isinstance(value, str):
        raise ValueError("Escribe un nombre de usuario válido.")
    value = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{2,99}", value):
        raise ValueError("Usa de 3 a 100 letras, números, puntos, guiones o guiones bajos. No uses un correo.")
    return value


class UserCreate(BaseModel):
    _username = field_validator('username', mode='before')(valid_username)
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = None
    role: UserRole = UserRole.PROMOTOR


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=100)

    @field_validator('username', mode='before')
    @classmethod
    def validate_username(cls, value):
        if value is None:
            raise ValueError("El nombre de usuario no puede quedar vacío.")
        return valid_username(value)

    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)

    @field_validator('full_name', mode='before')
    @classmethod
    def validate_name(cls, value):
        if not isinstance(value, str) or not value.strip():
            raise ValueError("Escribe tu nombre completo.")
        return value.strip()

    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    is_superuser: bool
    totp_enabled: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    totp_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class Setup2FAResponse(BaseModel):
    secret: str
    uri: str
    qr_code: str  # base64 encoded PNG


class Verify2FARequest(BaseModel):
    code: str
