from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    app_env: Literal["development", "production"] = "development"
    jwt_secret_key: SecretStr = Field(min_length=32)
    # a relative sqlite path lands in apps/api/instance
    database_url: str = "sqlite:///corkathon.db"
    # browsers drop secure cookies on plain http, so an http only deploy sets this false
    cookie_secure: bool | None = None
    session_hours: int = Field(default=12, ge=1, le=720)
    auth_rate_limit_per_minute: int = Field(default=10, ge=1)
    # number of reverse proxies in front of the app, coolify is 1
    trusted_proxies: int = Field(default=0, ge=0, le=5)
    host: str = "127.0.0.1"
    port: int = Field(default=5001, ge=1, le=65535)
    web_dist: Path = REPO_ROOT / "apps" / "web" / "dist"
    # cro snapshot, my_companies.csv and the cached report, /data/filings in the container
    filings_data_dir: Path = REPO_ROOT / "apps" / "api" / "instance" / "filings"
    filings_window_days: int = Field(default=30, ge=1, le=365)
    # a fixed date for a reproducible demo, today when unset
    filings_as_of: date | None = None
    # comma separated, when set only these accounts can read the shared client report
    filings_allowed_emails: str = ""
