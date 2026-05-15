from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

import httpx
from PIL import Image, ImageFilter, ImageOps, ImageStat

from .backend import GenerationBackend
from .config import Settings
from .models import GenerationInput, HealthView


class ComfyUiBackend(GenerationBackend):
    def __init__(self, settings: Settings):
        self.settings = settings

    async def health(self) -> HealthView:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                response = await client.get(f"{self.settings.comfyui_url}/system_stats")
                response.raise_for_status()
                data = response.json()
            gpu = _gpu_name(data)
            return HealthView(ok=True, backend_ready=True, gpu=gpu, message="ComfyUI ready")
        except Exception as exc:
            return HealthView(
                ok=True,
                backend_ready=False,
                gpu=None,
                message=f"ComfyUI unavailable at {self.settings.comfyui_url}: {exc}",
            )

    async def generate(self, request: GenerationInput) -> Path:
        async with httpx.AsyncClient(timeout=60.0) as client:
            image_name = await self._upload(client, request.image_path)
            mask_name = await self._upload(client, request.mask_path)
            prompt_id = await self._queue_prompt(client, request, image_name, mask_name)
            filename = await self._wait_for_output(client, prompt_id)
            await self._download_output(client, filename, request.output_path)
            _repair_flat_masked_region(request.image_path, request.mask_path, request.output_path)
            if request.edit_target in {"background", "scene"}:
                _restore_protected_source_regions(request.image_path, request.mask_path, request.output_path)
        return request.output_path

    async def _upload(self, client: httpx.AsyncClient, path: Path) -> str:
        with path.open("rb") as handle:
            files = {"image": (path.name, handle, "image/png")}
            data = {"overwrite": "true"}
            response = await client.post(f"{self.settings.comfyui_url}/upload/image", files=files, data=data)
        response.raise_for_status()
        return response.json()["name"]

    async def _queue_prompt(
        self,
        client: httpx.AsyncClient,
        request: GenerationInput,
        image_name: str,
        mask_name: str,
    ) -> str:
        with Image.open(request.image_path) as image:
            width, height = image.size
        workflow = _default_inpaint_workflow(
            model=self.settings.default_model,
            image_name=image_name,
            mask_name=mask_name,
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            seed=request.seed if request.seed is not None else int(uuid.uuid4().int % 2_000_000_000),
            strength=request.strength,
            width=width,
            height=height,
            edit_target=request.edit_target,
        )
        response = await client.post(
            f"{self.settings.comfyui_url}/prompt",
            json={"prompt": workflow, "client_id": f"pixomerck-{request.job_id}"},
        )
        response.raise_for_status()
        return response.json()["prompt_id"]

    async def _wait_for_output(self, client: httpx.AsyncClient, prompt_id: str) -> str:
        for _ in range(360):
            response = await client.get(f"{self.settings.comfyui_url}/history/{prompt_id}")
            response.raise_for_status()
            history = response.json()
            if prompt_id in history:
                outputs = history[prompt_id].get("outputs", {})
                for node in outputs.values():
                    for image in node.get("images", []):
                        filename = image.get("filename")
                        if filename:
                            return filename
                raise RuntimeError("ComfyUI finished without an image output.")
            await asyncio.sleep(1)
        raise TimeoutError("Timed out waiting for ComfyUI output.")

    async def _download_output(self, client: httpx.AsyncClient, filename: str, destination: Path) -> None:
        response = await client.get(
            f"{self.settings.comfyui_url}/view",
            params={"filename": filename, "type": "output"},
        )
        response.raise_for_status()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(response.content)


def _gpu_name(system_stats: dict) -> str | None:
    devices = system_stats.get("devices") or []
    if not devices:
        return None
    return devices[0].get("name")


def _default_inpaint_workflow(
    model: str,
    image_name: str,
    mask_name: str,
    prompt: str,
    negative_prompt: str,
    seed: int,
    strength: float,
    width: int,
    height: int,
    edit_target: str = "subject",
) -> dict:
    positive = _positive_prompt_text(prompt, edit_target)
    negative = _negative_prompt_text(negative_prompt, edit_target)
    workflow_json = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": model},
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["1", 1], "text": positive},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["1", 1], "text": negative},
        },
        "4": {
            "class_type": "LoadImage",
            "inputs": {"image": image_name},
        },
        "5": {
            "class_type": "LoadImage",
            "inputs": {"image": mask_name},
        },
        "6": {
            "class_type": "ImageScale",
            "inputs": {
                "image": ["4", 0],
                "width": width,
                "height": height,
                "upscale_method": "lanczos",
                "crop": "center",
            },
        },
        "7": {
            "class_type": "ImageScale",
            "inputs": {
                "image": ["5", 0],
                "width": width,
                "height": height,
                "upscale_method": "nearest-exact",
                "crop": "center",
            },
        },
        "8": {
            "class_type": "ImageToMask",
            "inputs": {
                "image": ["7", 0],
                "channel": "red",
            },
        },
        "9": {
            "class_type": "InpaintModelConditioning",
            "inputs": {
                "positive": ["2", 0],
                "negative": ["3", 0],
                "pixels": ["6", 0],
                "vae": ["1", 2],
                "mask": ["8", 0],
                "noise_mask": True,
            },
        },
        "10": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["9", 0],
                "negative": ["9", 1],
                "latent_image": ["9", 2],
                "seed": seed,
                "steps": 28,
                "cfg": 6.5,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": strength,
            },
        },
        "11": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["10", 0], "vae": ["1", 2]},
        },
        "12": {
            "class_type": "SaveImage",
            "inputs": {"images": ["11", 0], "filename_prefix": "pixomerck"},
        },
    }
    return json.loads(json.dumps(workflow_json))


def _positive_prompt_text(prompt: str, edit_target: str) -> str:
    parts = [
        prompt,
        "preserve the same person",
        "realistic photo",
        "detailed face",
        "natural skin texture",
    ]
    if edit_target in {"background", "scene"}:
        parts.extend(
            [
                "replace the entire background behind the subject",
                "fully transform every visible background surface",
                "do not preserve the original venue details",
                "clean continuous walls, furniture, lighting, and architectural surfaces",
                "avoid screens, monitors, framed pictures, posters, wall art, and display panels",
                "plain undecorated walls where possible",
                "clean architectural background details",
                "avoid readable signs, posters, labels, logos, and brand marks",
                "empty background without extra people or portraits",
            ]
        )
    return _join_prompt_parts(parts)


def _negative_prompt_text(negative_prompt: str, edit_target: str) -> str:
    parts = [
        negative_prompt,
        "watermark",
        "signature",
        "fake text",
        "gibberish text",
        "misspelled words",
        "random letters",
        "distorted signage",
        "brand logos",
        "extra people",
        "background faces",
        "portraits of people",
        "paintings of faces",
        "television screens",
        "monitors",
        "framed pictures",
        "picture frames",
        "wall art",
        "display panels",
        "wall mounted displays",
        "rectangular displays",
        "black rectangles",
        "framed artwork",
        "decorative frames",
        "landscape posters",
        "fake windows",
        "duplicated scenery",
    ]
    if edit_target in {"background", "scene"}:
        parts.extend(
            [
                "text-heavy background",
                "readable sign",
                "poster text",
                "billboard text",
                "menu text",
                "label text",
            ]
        )
    return _join_prompt_parts(parts)


def _join_prompt_parts(parts: list[str]) -> str:
    clean_parts: list[str] = []
    seen: set[str] = set()
    for part in parts:
        clean = " ".join(part.strip().split())
        if not clean:
            continue
        key = clean.lower()
        if key in seen:
            continue
        seen.add(key)
        clean_parts.append(clean)
    return ", ".join(clean_parts)


def _repair_flat_masked_region(source_path: Path, mask_path: Path, output_path: Path) -> None:
    result = Image.open(output_path).convert("RGB")
    source = Image.open(source_path).convert("RGB").resize(result.size, Image.Resampling.LANCZOS)
    mask = Image.open(mask_path).convert("L").resize(result.size, Image.Resampling.LANCZOS)
    solid_mask = mask.point(lambda value: 255 if value >= 192 else 0)
    if solid_mask.getbbox() is None:
        return

    stats = ImageStat.Stat(result, solid_mask)
    average_stddev = sum(stats.stddev) / len(stats.stddev)
    average_color = sum(stats.mean) / len(stats.mean)
    if average_stddev > 7.5 or average_color < 55 or average_color > 220:
        return

    feathered_mask = mask.filter(ImageFilter.GaussianBlur(radius=1.4))
    repaired = Image.composite(source, result, feathered_mask)
    repaired.save(output_path)


def _restore_protected_source_regions(source_path: Path, mask_path: Path, output_path: Path) -> None:
    result = Image.open(output_path).convert("RGB")
    source = Image.open(source_path).convert("RGB").resize(result.size, Image.Resampling.LANCZOS)
    edit_mask = Image.open(mask_path).convert("L").resize(result.size, Image.Resampling.LANCZOS)
    protected_mask = ImageOps.invert(edit_mask)
    if protected_mask.point(lambda value: 255 if value > 32 else 0).getbbox() is None:
        return

    protected_mask = protected_mask.filter(ImageFilter.MinFilter(size=3))
    protected_mask = protected_mask.filter(ImageFilter.GaussianBlur(radius=0.9))
    restored = Image.composite(source, result, protected_mask)
    restored.save(output_path)
