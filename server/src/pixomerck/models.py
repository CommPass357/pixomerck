from __future__ import annotations

from enum import Enum
from pathlib import Path
from pydantic import BaseModel, Field


class JobState(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobView(BaseModel):
    id: str
    status: JobState
    progress: float = Field(ge=0.0, le=1.0)
    error: str | None = None
    result_path: str | None = None


class PairingView(BaseModel):
    lan_url: str
    tunnel_url: str | None = None


class HealthView(BaseModel):
    ok: bool
    backend_ready: bool
    gpu: str | None = None
    message: str | None = None


class GenerationInput(BaseModel):
    job_id: str
    image_path: Path
    mask_path: Path
    output_path: Path
    prompt: str
    negative_prompt: str
    seed: int | None
    strength: float = Field(ge=0.15, le=0.95)
    size: int = Field(ge=256, le=768)
    edit_target: str = "subject"
