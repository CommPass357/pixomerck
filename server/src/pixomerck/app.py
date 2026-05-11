from __future__ import annotations

from contextlib import asynccontextmanager
import socket
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .auth import invite_header, require_invite_key
from .backend import DemoBackend, GenerationBackend
from .comfyui import ComfyUiBackend
from .config import Settings, invite_key, load_settings
from .jobs import JobManager
from .models import HealthView, JobView, PairingView


def create_app(settings: Settings | None = None, backend: GenerationBackend | None = None) -> FastAPI:
    settings = settings or load_settings()
    backend = backend or _backend_for(settings)
    manager = JobManager(settings, backend)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        manager.start()
        try:
            yield
        finally:
            await manager.stop()

    app = FastAPI(title="Pixomerck Server", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.manager = manager

    def auth(header_value: str | None = Depends(invite_header)) -> None:
        require_invite_key(settings, header_value)

    @app.get("/health", response_model=HealthView)
    async def health() -> HealthView:
        backend_health = await backend.health()
        return backend_health

    @app.get("/v1/pairing", response_model=PairingView, dependencies=[Depends(auth)])
    async def pairing() -> PairingView:
        return PairingView(
            lan_url=f"http://{_local_ip()}:{settings.port}",
            tunnel_url=settings.tunnel_url or None,
        )

    @app.post("/v1/jobs", response_model=JobView, dependencies=[Depends(auth)])
    async def create_job(
        image: UploadFile = File(...),
        person_mask: UploadFile = File(...),
        prompt: str = Form(...),
        negative_prompt: str = Form(""),
        seed: int | None = Form(None),
        strength: float = Form(0.62),
        size: int = Form(512),
    ) -> JobView:
        try:
            return await manager.submit(
                image=image,
                person_mask=person_mask,
                prompt=prompt,
                negative_prompt=negative_prompt,
                seed=seed,
                strength=strength,
                size=size,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/v1/jobs/{job_id}", response_model=JobView, dependencies=[Depends(auth)])
    async def get_job(job_id: str) -> JobView:
        job = manager.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found.")
        return job

    @app.get("/v1/jobs/{job_id}/image", dependencies=[Depends(auth)])
    async def get_job_image(job_id: str) -> FileResponse:
        output_path = manager.output_path(job_id)
        if output_path is None:
            raise HTTPException(status_code=404, detail="Result image not found.")
        return FileResponse(output_path, media_type="image/png", filename=Path(output_path).name)

    return app


def _backend_for(settings: Settings) -> GenerationBackend:
    if settings.backend == "demo":
        return DemoBackend()
    return ComfyUiBackend(settings)


def _local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


settings = load_settings()
app = create_app(settings=settings)


def main() -> None:
    import uvicorn

    uvicorn.run("pixomerck.app:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    main()
