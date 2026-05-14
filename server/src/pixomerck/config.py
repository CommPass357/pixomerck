from __future__ import annotations

import secrets
from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class Settings:
    host: str = "0.0.0.0"
    port: int = 8765
    data_dir: Path = Path("data")
    invite_key: str = ""
    backend: str = "comfyui"
    comfyui_url: str = "http://127.0.0.1:8188"
    tunnel_url: str = ""
    public_hostname: str = "pix.hoesonly.fans"
    default_model: str = "v1-5-pruned-emaonly.safetensors"

    @property
    def inputs_dir(self) -> Path:
        return self.data_dir / "inputs"

    @property
    def outputs_dir(self) -> Path:
        return self.data_dir / "outputs"

    @property
    def invite_key_path(self) -> Path:
        return self.data_dir / "invite-key.txt"


def load_settings() -> Settings:
    data_dir = Path(os.getenv("PIXOMERCK_DATA_DIR", "data")).resolve()
    settings = Settings(
        host=os.getenv("PIXOMERCK_HOST", "0.0.0.0"),
        port=int(os.getenv("PIXOMERCK_PORT", "8765")),
        data_dir=data_dir,
        invite_key=os.getenv("PIXOMERCK_INVITE_KEY", ""),
        backend=os.getenv("PIXOMERCK_BACKEND", "comfyui").lower(),
        comfyui_url=os.getenv("PIXOMERCK_COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/"),
        tunnel_url=os.getenv("PIXOMERCK_TUNNEL_URL", "").rstrip("/"),
        public_hostname=os.getenv("PIXOMERCK_PUBLIC_HOSTNAME", "pix.hoesonly.fans"),
        default_model=os.getenv("PIXOMERCK_MODEL", "v1-5-pruned-emaonly.safetensors"),
    )
    ensure_runtime(settings)
    return settings


def ensure_runtime(settings: Settings) -> None:
    settings.inputs_dir.mkdir(parents=True, exist_ok=True)
    settings.outputs_dir.mkdir(parents=True, exist_ok=True)
    if settings.invite_key:
        settings.invite_key_path.write_text(settings.invite_key, encoding="utf-8")
    elif not settings.invite_key_path.exists():
        settings.invite_key_path.write_text(secrets.token_urlsafe(24), encoding="utf-8")


def invite_key(settings: Settings) -> str:
    if settings.invite_key:
        return settings.invite_key.strip().lstrip("\ufeff")
    return settings.invite_key_path.read_text(encoding="utf-8-sig").strip()
