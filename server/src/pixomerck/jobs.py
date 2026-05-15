from __future__ import annotations

import asyncio
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile
from PIL import Image

from .backend import GenerationBackend
from .config import Settings
from .masking import create_person_mask, prepare_inpaint_pair
from .models import GenerationInput, JobState, JobView


@dataclass
class JobRecord:
    id: str
    status: JobState
    progress: float
    prompt: str
    negative_prompt: str
    seed: int | None
    strength: float
    size: int
    image_path: Path
    mask_path: Path
    output_path: Path
    error: str | None = None

    def view(self) -> JobView:
        return JobView(
            id=self.id,
            status=self.status,
            progress=self.progress,
            error=self.error,
            result_path=str(self.output_path) if self.status == JobState.completed else None,
        )


class JobManager:
    def __init__(self, settings: Settings, backend: GenerationBackend):
        self.settings = settings
        self.backend = backend
        self.jobs: dict[str, JobRecord] = {}
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self.worker_task: asyncio.Task | None = None

    def start(self) -> None:
        if self.worker_task is None or self.worker_task.done():
            self.worker_task = asyncio.create_task(self._worker())

    async def stop(self) -> None:
        if self.worker_task:
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass

    async def submit(
        self,
        image: UploadFile,
        person_mask: UploadFile,
        prompt: str,
        negative_prompt: str,
        seed: int | None,
        strength: float,
        size: int,
    ) -> JobView:
        _validate_prompt(prompt)
        _validate_size(size)
        job_id = uuid.uuid4().hex
        job_dir = self.settings.inputs_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        original_image_path = job_dir / "source-original.png"
        uploaded_mask_path = job_dir / "client-mask.png"
        raw_mask_path = job_dir / "person-mask-raw.png"
        image_path = job_dir / "source.png"
        mask_path = job_dir / "person_mask.png"
        output_path = self.settings.outputs_dir / f"{job_id}.png"

        await _save_upload(image, original_image_path)
        await _save_upload(person_mask, uploaded_mask_path)
        _validate_image(original_image_path, "image")
        _validate_image(uploaded_mask_path, "person_mask")
        create_person_mask(
            original_image_path,
            uploaded_mask_path,
            raw_mask_path,
            required=self.settings.backend != "demo",
        )
        prepare_inpaint_pair(original_image_path, raw_mask_path, image_path, mask_path, size)
        _validate_image(image_path, "image")
        _validate_image(mask_path, "person_mask")

        record = JobRecord(
            id=job_id,
            status=JobState.queued,
            progress=0.0,
            prompt=prompt.strip(),
            negative_prompt=negative_prompt.strip(),
            seed=seed,
            strength=strength,
            size=size,
            image_path=image_path,
            mask_path=mask_path,
            output_path=output_path,
        )
        self.jobs[job_id] = record
        await self.queue.put(job_id)
        return record.view()

    def get(self, job_id: str) -> JobView | None:
        record = self.jobs.get(job_id)
        return record.view() if record else None

    def output_path(self, job_id: str) -> Path | None:
        record = self.jobs.get(job_id)
        if record and record.status == JobState.completed and record.output_path.exists():
            return record.output_path
        return None

    async def _worker(self) -> None:
        while True:
            job_id = await self.queue.get()
            record = self.jobs[job_id]
            try:
                record.status = JobState.running
                record.progress = 0.15
                await self.backend.generate(
                    GenerationInput(
                        job_id=record.id,
                        image_path=record.image_path,
                        mask_path=record.mask_path,
                        output_path=record.output_path,
                        prompt=record.prompt,
                        negative_prompt=record.negative_prompt,
                        seed=record.seed,
                        strength=record.strength,
                        size=record.size,
                    )
                )
                record.status = JobState.completed
                record.progress = 1.0
            except Exception as exc:
                record.status = JobState.failed
                record.progress = 1.0
                record.error = str(exc)
            finally:
                self.queue.task_done()


async def _save_upload(upload: UploadFile, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        shutil.copyfileobj(upload.file, handle)


def _validate_prompt(prompt: str) -> None:
    if len(prompt.strip()) < 8:
        raise ValueError("Prompt must be at least 8 characters.")
    if len(prompt) > 800:
        raise ValueError("Prompt must be 800 characters or fewer.")


def _validate_size(size: int) -> None:
    if size not in {512, 768}:
        raise ValueError("Size must be 512 or 768.")


def _validate_image(path: Path, field: str) -> None:
    try:
        with Image.open(path) as image:
            image.verify()
    except Exception as exc:
        raise ValueError(f"{field} must be a valid image.") from exc
