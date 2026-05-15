from __future__ import annotations

import time
from io import BytesIO
import json
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageFilter

from pixomerck.app import create_app
from pixomerck.comfyui import (
    _apply_pro_finish,
    _default_inpaint_workflow,
    _repair_flat_masked_region,
    _restore_protected_source_regions,
)
from pixomerck.config import Settings
from pixomerck.jobs import _effective_strength, _resolve_edit_target
from pixomerck.masking import prepare_inpaint_pair
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

    games_db = json.loads((tmp_path / "games-db.json").read_text(encoding="utf-8"))
    emails = {user["normalizedEmail"] for user in games_db["users"]}
    assert emails == {"user@example.com", "second@example.com"}
    assert not (tmp_path / "users.json").exists()


def test_web_login_accepts_existing_bored_games_account(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    app = create_app(settings, FakeBackend())

    with TestClient(app, base_url="https://testserver") as client:
        create = client.post("/v1/accounts", json={"email": "games@example.com", "password": "password123"})
        assert create.status_code == 200
        client.delete("/v1/session")

        login = client.post("/v1/session", json={"email": "games@example.com", "password": "password123"})
        assert login.status_code == 200

        bad_login = client.post("/v1/session", json={"email": "games@example.com", "password": "wrong-password"})
        assert bad_login.status_code == 401


def test_web_login_verifies_bored_games_salt_format(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    settings.bored_games_db_path.write_text(
        json.dumps(
            {
                "users": [
                    {
                        "uid": "games-user-1",
                        "emailHash": "email-hash",
                        "normalizedEmail": "games-user@example.com",
                        "displayName": "Games User",
                        "passwordHash": (
                            "210000:00112233445566778899aabbccddeeff:"
                            "f9a7a1720e465309fc201c60655615b6bac784878982b9e8764b60e815d57b2c"
                        ),
                        "createdAt": "2026-05-15T00:00:00.000Z",
                    }
                ],
                "games": [],
                "stats": {},
                "bugReports": [],
                "challenges": [],
            }
        ),
        encoding="utf-8",
    )
    app = create_app(settings, FakeBackend())

    with TestClient(app, base_url="https://testserver") as client:
        login = client.post("/v1/session", json={"email": "games-user@example.com", "password": "password123"})
        assert login.status_code == 200


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


def test_background_intent_is_detected_and_strength_is_boosted() -> None:
    prompt = "replace the background with a luxury hotel lobby"

    assert _resolve_edit_target(prompt, "subject") == "background"
    assert _effective_strength(0.48, "background", prompt) == 0.82
    assert _effective_strength(0.9, "background", prompt) == 0.9
    assert _effective_strength(0.48, "background", "keep the original background but improve lighting") == 0.48
    assert _effective_strength(0.48, "scene", "replace the outfit and background") == 0.72


def test_prepare_inpaint_pair_preserves_aspect_ratio(tmp_path: Path) -> None:
    source_path = tmp_path / "source.png"
    mask_path = tmp_path / "mask.png"
    output_image_path = tmp_path / "prepared-source.png"
    output_mask_path = tmp_path / "prepared-mask.png"

    Image.new("RGB", (40, 80), (40, 80, 120)).save(source_path)
    Image.new("L", (40, 80), 255).save(mask_path)

    prepare_inpaint_pair(source_path, mask_path, output_image_path, output_mask_path, 64)

    with Image.open(output_image_path) as prepared_image:
        assert prepared_image.size == (32, 64)
    with Image.open(output_mask_path) as prepared_mask:
        assert prepared_mask.size == (32, 64)
        assert prepared_mask.getpixel((16, 4)) < 16
        assert prepared_mask.getpixel((16, 30)) > 240


def test_prepare_inpaint_pair_protects_hands_and_held_object_band(tmp_path: Path) -> None:
    source_path = tmp_path / "source.png"
    mask_path = tmp_path / "mask.png"
    output_image_path = tmp_path / "prepared-source.png"
    output_mask_path = tmp_path / "prepared-mask.png"

    source = Image.new("RGB", (64, 64), (10, 20, 30))
    source.paste((60, 100, 160), (16, 4, 48, 60))
    source.paste((214, 155, 112), (16, 38, 25, 45))
    source.paste((214, 155, 112), (39, 38, 48, 45))
    source.paste((20, 22, 24), (23, 39, 41, 47))
    source.save(source_path)
    mask = Image.new("L", (64, 64), 0)
    mask.paste(255, (16, 4, 48, 60))
    mask.save(mask_path)

    prepare_inpaint_pair(source_path, mask_path, output_image_path, output_mask_path, 64)

    with Image.open(output_mask_path).convert("L") as prepared_mask:
        assert prepared_mask.getpixel((32, 32)) > 220
        assert prepared_mask.getpixel((20, 42)) < 16
        assert prepared_mask.getpixel((32, 42)) < 16


def test_prepare_inpaint_pair_can_target_background(tmp_path: Path) -> None:
    source_path = tmp_path / "source.png"
    mask_path = tmp_path / "mask.png"
    output_image_path = tmp_path / "prepared-source.png"
    output_mask_path = tmp_path / "prepared-mask.png"

    Image.new("RGB", (64, 64), (40, 80, 120)).save(source_path)
    mask = Image.new("L", (64, 64), 0)
    mask.paste(255, (20, 8, 44, 60))
    mask.save(mask_path)

    prepare_inpaint_pair(source_path, mask_path, output_image_path, output_mask_path, 64, "background")

    with Image.open(output_mask_path).convert("L") as prepared_mask:
        assert prepared_mask.getpixel((10, 10)) > 240
        assert prepared_mask.getpixel((32, 32)) < 16


def test_prepare_inpaint_pair_tightens_background_mask_edge_halo(tmp_path: Path) -> None:
    source_path = tmp_path / "source.png"
    mask_path = tmp_path / "mask.png"
    output_image_path = tmp_path / "prepared-source.png"
    output_mask_path = tmp_path / "prepared-mask.png"

    Image.new("RGB", (64, 64), (40, 80, 120)).save(source_path)
    mask = Image.new("L", (64, 64), 0)
    mask.paste(255, (20, 8, 44, 60))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=2.0))
    mask.save(mask_path)

    prepare_inpaint_pair(source_path, mask_path, output_image_path, output_mask_path, 64, "background")

    with Image.open(output_mask_path).convert("L") as prepared_mask:
        assert prepared_mask.getpixel((18, 32)) > 220
        assert prepared_mask.getpixel((32, 32)) < 16


def test_repair_flat_masked_region_restores_source_when_output_is_gray(tmp_path: Path) -> None:
    source_path = tmp_path / "source.png"
    mask_path = tmp_path / "mask.png"
    output_path = tmp_path / "output.png"

    source = Image.new("RGB", (64, 64), (20, 40, 80))
    source.paste((220, 170, 110), (24, 12, 40, 52))
    source.save(source_path)
    Image.new("L", (64, 64), 0).save(mask_path)
    mask = Image.open(mask_path).convert("L")
    mask.paste(255, (24, 12, 40, 52))
    mask.save(mask_path)
    Image.new("RGB", (64, 64), (130, 130, 130)).save(output_path)

    _repair_flat_masked_region(source_path, mask_path, output_path)

    with Image.open(output_path).convert("RGB") as repaired:
        assert repaired.getpixel((32, 24)) == (220, 170, 110)


def test_restore_protected_source_regions_keeps_subject_after_background_edit(tmp_path: Path) -> None:
    source_path = tmp_path / "source.png"
    mask_path = tmp_path / "mask.png"
    output_path = tmp_path / "output.png"

    source = Image.new("RGB", (64, 64), (20, 40, 80))
    source.paste((220, 170, 110), (20, 12, 44, 56))
    source.save(source_path)
    mask = Image.new("L", (64, 64), 255)
    mask.paste(0, (20, 12, 44, 56))
    mask.save(mask_path)
    Image.new("RGB", (64, 64), (60, 180, 90)).save(output_path)

    _restore_protected_source_regions(source_path, mask_path, output_path)

    with Image.open(output_path).convert("RGB") as restored:
        assert restored.getpixel((32, 32)) == (220, 170, 110)
        assert restored.getpixel((8, 8)) == (60, 180, 90)


def test_restore_protected_source_regions_avoids_soft_source_halo(tmp_path: Path) -> None:
    source_path = tmp_path / "source.png"
    mask_path = tmp_path / "mask.png"
    output_path = tmp_path / "output.png"

    source = Image.new("RGB", (64, 64), (20, 40, 80))
    source.paste((40, 220, 80), (18, 10, 46, 58))
    source.paste((220, 170, 110), (22, 14, 42, 54))
    source.save(source_path)
    mask = Image.new("L", (64, 64), 255)
    mask.paste(96, (18, 10, 46, 58))
    mask.paste(0, (22, 14, 42, 54))
    mask.save(mask_path)
    Image.new("RGB", (64, 64), (60, 180, 90)).save(output_path)

    _restore_protected_source_regions(source_path, mask_path, output_path)

    with Image.open(output_path).convert("RGB") as restored:
        assert restored.getpixel((32, 32)) == (220, 170, 110)
        assert restored.getpixel((18, 32)) == (60, 180, 90)


def test_apply_pro_finish_boosts_low_contrast_output(tmp_path: Path) -> None:
    output_path = tmp_path / "output.png"
    image = Image.new("RGB", (64, 64), (112, 118, 124))
    image.paste((144, 148, 150), (16, 16, 48, 48))
    image.save(output_path)

    _apply_pro_finish(output_path, "scene")

    with Image.open(output_path).convert("RGB") as finished:
        assert finished.size == (64, 64)
        assert finished.getpixel((32, 32)) != (144, 148, 150)


def test_comfyui_workflow_converts_mask_image_to_mask() -> None:
    workflow = _default_inpaint_workflow(
        model="sd-v1-5-inpainting.safetensors",
        image_name="source.png",
        mask_name="person_mask.png",
        prompt="make a realistic edit",
        negative_prompt="low quality",
        seed=123,
        strength=0.62,
        width=384,
        height=512,
        edit_target="background",
    )

    assert "replace the entire background" in workflow["2"]["inputs"]["text"]
    assert "cinematic key art" in workflow["2"]["inputs"]["text"]
    assert "high-end professional composite" in workflow["2"]["inputs"]["text"]
    assert "vivid but realistic color grade" in workflow["2"]["inputs"]["text"]
    assert "subject naturally embedded" in workflow["2"]["inputs"]["text"]
    assert "avoid readable signs" in workflow["2"]["inputs"]["text"]
    assert "avoid screens" in workflow["2"]["inputs"]["text"]
    assert "plain undecorated walls" in workflow["2"]["inputs"]["text"]
    assert "empty background without extra people" in workflow["2"]["inputs"]["text"]
    assert "gibberish text" in workflow["3"]["inputs"]["text"]
    assert "billboard text" in workflow["3"]["inputs"]["text"]
    assert "background faces" in workflow["3"]["inputs"]["text"]
    assert "television screens" in workflow["3"]["inputs"]["text"]
    assert "black rectangles" in workflow["3"]["inputs"]["text"]
    assert "flat lighting" in workflow["3"]["inputs"]["text"]
    assert "pasted cutout" in workflow["3"]["inputs"]["text"]
    assert workflow["7"]["class_type"] == "ImageScale"
    assert workflow["6"]["inputs"]["width"] == 384
    assert workflow["6"]["inputs"]["height"] == 512
    assert workflow["7"]["inputs"]["width"] == 384
    assert workflow["7"]["inputs"]["height"] == 512
    assert workflow["8"]["class_type"] == "ImageToMask"
    assert workflow["8"]["inputs"]["image"] == ["7", 0]
    assert workflow["9"]["class_type"] == "InpaintModelConditioning"
    assert workflow["9"]["inputs"]["positive"] == ["2", 0]
    assert workflow["9"]["inputs"]["negative"] == ["3", 0]
    assert workflow["9"]["inputs"]["mask"] == ["8", 0]
    assert workflow["10"]["inputs"]["positive"] == ["9", 0]
    assert workflow["10"]["inputs"]["negative"] == ["9", 1]
    assert workflow["10"]["inputs"]["latent_image"] == ["9", 2]


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        data_dir=tmp_path / "pixomerck-data",
        bored_games_db_path=tmp_path / "games-db.json",
        invite_key="test-key",
        backend="demo",
    )


def _png_bytes(color: tuple[int, int, int]) -> BytesIO:
    buffer = BytesIO()
    Image.new("RGB", (64, 64), color).save(buffer, format="PNG")
    buffer.seek(0)
    return buffer
