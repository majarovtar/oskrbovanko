from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    admin_api_key: str
    service_api_key: str
    jwt_secret: str

    azure_voicelive_endpoint: str = ""
    azure_voicelive_api_key: str = ""
    voicelive_model: str = "gpt-4.1-mini"
    voicelive_voice: str = "sl-SI-PetraNeural"
    voicelive_api_version: str = "2026-04-10"

    cors_origins: str = "http://localhost:5173"

    resend_api_key: str = ""
    critical_call_email_to: str = ""
    critical_call_email_from: str = "onboarding@resend.dev"

    spo2_min: int = 92
    pulse_min: int = 50
    pulse_max: int = 120

    answer_wait_ms: int = 1000

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def critical_call_email_to_list(self) -> list[str]:
        return [addr.strip() for addr in self.critical_call_email_to.split(",") if addr.strip()]


def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
