from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = None
    role: UserRole = UserRole.PROMOTOR


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
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
