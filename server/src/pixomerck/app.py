from __future__ import annotations

from contextlib import asynccontextmanager
import socket
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .accounts import authenticate_user, create_user
from .auth import SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, auth_credentials, create_session_token, require_invite_key
from .backend import DemoBackend, GenerationBackend
from .comfyui import ComfyUiBackend
from .config import Settings, invite_key, load_settings
from .jobs import JobManager
from .models import HealthView, JobView, PairingView


class SessionLogin(BaseModel):
    email: str | None = None
    password: str | None = None
    invite_key: str | None = None


class AccountCreate(BaseModel):
    email: str
    password: str


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
    web_dir = _web_dir()

    if web_dir.exists():
        app.mount("/assets", StaticFiles(directory=web_dir / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        async def web_app() -> FileResponse:
            return FileResponse(web_dir / "index.html", media_type="text/html")

        @app.get("/app", include_in_schema=False)
        async def web_app_alias() -> FileResponse:
            return FileResponse(web_dir / "index.html", media_type="text/html")

    def auth(credentials=Depends(auth_credentials)) -> None:
        require_invite_key(settings, credentials)

    @app.get("/health", response_model=HealthView)
    async def health() -> HealthView:
        backend_health = await backend.health()
        return backend_health

    @app.get("/web-config", include_in_schema=False)
    async def web_config() -> dict[str, str]:
        return {
            "public_hostname": settings.public_hostname,
            "public_url": f"https://{settings.public_hostname}",
        }

    @app.post("/v1/session", include_in_schema=False)
    async def login(payload: SessionLogin, response: Response) -> dict[str, bool]:
        if payload.invite_key:
            require_invite_key(settings, payload.invite_key)
        elif payload.email and payload.password:
            if not authenticate_user(settings, payload.email, payload.password):
                raise HTTPException(status_code=401, detail="Invalid email or password.")
        else:
            raise HTTPException(status_code=400, detail="Email and password are required.")

        response.set_cookie(
            key=SESSION_COOKIE,
            value=create_session_token(settings),
            max_age=SESSION_MAX_AGE_SECONDS,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/",
        )
        return {"ok": True}

    @app.post("/v1/accounts", include_in_schema=False)
    async def create_account(payload: AccountCreate, response: Response) -> dict[str, bool | str]:
        try:
            user = create_user(settings, payload.email, payload.password)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        response.set_cookie(
            key=SESSION_COOKIE,
            value=create_session_token(settings),
            max_age=SESSION_MAX_AGE_SECONDS,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/",
        )
        return {"ok": True, "email": user["email"]}

    @app.get("/v1/session", include_in_schema=False, dependencies=[Depends(auth)])
    async def session() -> dict[str, bool]:
        return {"authenticated": True}

    @app.delete("/v1/session", include_in_schema=False)
    async def logout(response: Response) -> dict[str, bool]:
        response.delete_cookie(SESSION_COOKIE, path="/")
        return {"ok": True}

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
        strength: float = Form(0.48),
        size: int = Form(512),
        edit_target: str = Form("subject"),
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
                edit_target=edit_target,
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


def _web_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "web"


settings = load_settings()
app = create_app(settings=settings)


def main() -> None:
    import uvicorn

    uvicorn.run("pixomerck.app:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    main()
