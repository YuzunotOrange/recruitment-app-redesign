from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


LOCAL_JWT_SECRET_KEY = "local-development-secret-change-before-production"
LOCAL_ENVIRONMENTS = {"development", "dev", "local", "test", "testing"}


class Settings(BaseSettings):
    app_name: str = "Recruitment App API"
    environment: str = "development"
    database_url: str = "sqlite:///./app.db"
    frontend_origin: str | None = None
    jwt_secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    backend_cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_environment_settings(self) -> "Settings":
        if self.environment.lower() in LOCAL_ENVIRONMENTS:
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

        self.backend_cors_origins = [self.frontend_origin]
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
