from pydantic import BaseModel, Field
from typing import Optional, List


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=4)
    avatar: Optional[str] = "aegis"


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    username: str
    avatar: str
    is_root: bool = False


class UserProfile(BaseModel):
    username: str
    avatar: str
    is_root: bool = False


class UpdateProfileRequest(BaseModel):
    avatar: Optional[str] = None


class FriendActionRequest(BaseModel):
    target_username: str


class ReportRequest(BaseModel):
    target_username: str
    reason: str
