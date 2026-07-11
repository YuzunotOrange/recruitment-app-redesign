from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


LOCAL_JWT_SECRET_KEY = "local-development-secret-change-before-production"
LOCAL_ENVIRONMENTS = {"development", "dev", "local", "test", "testing"}


class Settings(BaseSettings):
    app_name: str = "Recruitment App API"
    environment: str = "development"
    database_url: str = "sqlite:///./app.db"
    frontend_origin: str | None = None
    jwt_secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14
    auth_cookie_secure: bool | None = None
    auth_cookie_samesite: str | None = None
    login_max_failures: int = 5
    login_lockout_minutes: int = 15
    password_reset_token_expire_minutes: int = 30
    backend_cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_use_tls: bool = True
    reminder_email_interval_minutes: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql://", 1)
        return value

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_environment_settings(self) -> "Settings":
        is_local = self.environment.lower() in LOCAL_ENVIRONMENTS
        if self.auth_cookie_secure is None:
            self.auth_cookie_secure = not is_local
        if self.auth_cookie_samesite is None:
            self.auth_cookie_samesite = "lax" if is_local else "none"
        self.auth_cookie_samesite = self.auth_cookie_samesite.lower()
        if self.auth_cookie_samesite == "none":
            self.auth_cookie_secure = True

        if is_local:
            local_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
            self.backend_cors_origins = list(dict.fromkeys([*local_origins, *self.backend_cors_origins]))
            if self.frontend_origin and self.frontend_origin not in self.backend_cors_origins:
                self.backend_cors_origins.append(self.frontend_origin)
            if self.jwt_secret_key:
                return self
            self.jwt_secret_key = LOCAL_JWT_SECRET_KEY
            return self

        if not self.jwt_secret_key:
            raise ValueError("JWT_SECRET_KEY is required outside local development.")
        if not self.frontend_origin:
            raise ValueError("FRONTEND_ORIGIN is required outside local development.")

        allowed_origins = [self.frontend_origin, *self.backend_cors_origins]
        self.backend_cors_origins = [origin for origin in dict.fromkeys(allowed_origins) if origin != "*"]
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
