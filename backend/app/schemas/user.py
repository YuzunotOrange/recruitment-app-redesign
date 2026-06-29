from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRead(BaseModel):
    id: int
    email: EmailStr
    name: str
    graduation_year: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    graduation_year: int | None = Field(default=None, ge=1900, le=2100)
