from __future__ import annotations

import time
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from pixomerck.app import create_app
from pixomerck.config import Settings
from pixomerck.models import GenerationInput, HealthView


class FakeBackend:
    async def health(self) -> HealthView:
        return HealthView(ok=True, backend_ready=True, gpu="fake-gpu", message="ready")

    async def generate(self, request: GenerationInput) -> Path:
        image = Image.open(request.image_path).convert("RGB")
        image.thumbnail((request.size, request.size), Image.Resampling.LANCZOS)
        request.output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(request.output_path)
        return request.output_path


def test_rejects_missing_invite_key(tmp_path: Path) -> None:
    app = create_app(_settings(tmp_path), FakeBackend())

    with TestClient(app) as client:
        response = client.get("/v1/pairing")

    assert response.status_code == 401


def test_health_is_public_and_reports_backend(tmp_path: Path) -> None:
    app = create_app(_settings(tmp_path), FakeBackend())

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["backend_ready"] is True
    assert response.json()["gpu"] == "fake-gpu"


def test_web_app_is_served_from_root(tmp_path: Path) -> None:
    app = create_app(_settings(tmp_path), FakeBackend())

    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert "Pixomerck" in response.text


def test_web_config_exposes_public_hostname(tmp_path: Path) -> None:
    app = create_app(_settings(tmp_path), FakeBackend())

    with TestClient(app) as client:
        response = client.get("/web-config")

    assert response.status_code == 200
    assert response.json()["public_hostname"] == "pix.hoesonly.fans"


def test_web_account_create_and_login_cookie_authenticates_session(tmp_path: Path) -> None:
    app = create_app(_settings(tmp_path), FakeBackend())

    with TestClient(app, base_url="https://testserver") as client:
        create = client.post("/v1/accounts", json={"email": "user@example.com", "password": "password123"})
        assert create.status_code == 200
        assert "pixomerck_session" in create.headers["set-cookie"]

        second_create = client.post("/v1/accounts", json={"email": "second@example.com", "password": "password123"})
        assert second_create.status_code == 200

        client.delete("/v1/session")

        login = client.post("/v1/session", json={"email": "user@example.com", "password": "password123"})
        assert login.status_code == 200
        assert "pixomerck_session" in login.headers["set-cookie"]

        session = client.get("/v1/session")
        assert session.status_code == 200
        assert session.json()["authenticated"] is True

        pairing = client.get("/v1/pairing")
        assert pairing.status_code == 200


def test_invite_key_session_still_supports_script_login(tmp_path: Path) -> None:
    app = create_app(_settings(tmp_path), FakeBackend())

    with TestClient(app, base_url="https://testserver") as client:
        login = client.post("/v1/session", json={"invite_key": "test-key"})
        assert login.status_code == 200

        session = client.get("/v1/session")
        assert session.status_code == 200


def test_job_lifecycle_and_result_download(tmp_path: Path) -> None:
    app = create_app(_settings(tmp_path), FakeBackend())
    headers = {"X-Pixomerck-Key": "test-key"}

    with TestClient(app) as client:
        create = client.post(
            "/v1/jobs",
            headers=headers,
            data={
                "prompt": "turn the jacket silver",
                "negative_prompt": "low quality",
                "strength": "0.6",
                "size": "512",
            },
            files={
                "image": ("source.png", _png_bytes((40, 80, 120)), "image/png"),
                "person_mask": ("mask.png", _png_bytes((255, 255, 255)), "image/png"),
            },
        )
        assert create.status_code == 200
        job_id = create.json()["id"]

        status = None
        for _ in range(30):
            status = client.get(f"/v1/jobs/{job_id}", headers=headers)
            assert status.status_code == 200
            if status.json()["status"] == "completed":
                break
            time.sleep(0.1)

        assert status is not None
        assert status.json()["status"] == "completed"

        image = client.get(f"/v1/jobs/{job_id}/image", headers=headers)
        assert image.status_code == 200
        assert image.headers["content-type"].startswith("image/png")


def test_rejects_invalid_size(tmp_path: Path) -> None:
    app = create_app(_settings(tmp_path), FakeBackend())

    with TestClient(app) as client:
        response = client.post(
            "/v1/jobs",
            headers={"X-Pixomerck-Key": "test-key"},
            data={
                "prompt": "turn the jacket silver",
                "strength": "0.6",
                "size": "640",
            },
            files={
                "image": ("source.png", _png_bytes((40, 80, 120)), "image/png"),
                "person_mask": ("mask.png", _png_bytes((255, 255, 255)), "image/png"),
            },
        )

    assert response.status_code == 400


def _settings(tmp_path: Path) -> Settings:
    return Settings(data_dir=tmp_path, invite_key="test-key", backend="demo")


def _png_bytes(color: tuple[int, int, int]) -> BytesIO:
    buffer = BytesIO()
    Image.new("RGB", (64, 64), color).save(buffer, format="PNG")
    buffer.seek(0)
    return buffer
