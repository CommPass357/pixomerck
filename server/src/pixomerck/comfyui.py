from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

import httpx

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
        workflow = _default_inpaint_workflow(
            model=self.settings.default_model,
            image_name=image_name,
            mask_name=mask_name,
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            seed=request.seed if request.seed is not None else int(uuid.uuid4().int % 2_000_000_000),
            strength=request.strength,
            size=request.size,
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
    size: int,
) -> dict:
    positive = (
        f"{prompt}, preserve the same person, realistic photo, detailed face, natural skin texture"
    )
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
            "inputs": {"clip": ["1", 1], "text": negative_prompt},
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
                "width": size,
                "height": size,
                "upscale_method": "lanczos",
                "crop": "center",
            },
        },
        "7": {
            "class_type": "ImageScale",
            "inputs": {
                "image": ["5", 0],
                "width": size,
                "height": size,
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
            "class_type": "VAEEncodeForInpaint",
            "inputs": {
                "pixels": ["6", 0],
                "vae": ["1", 2],
                "mask": ["8", 0],
                "grow_mask_by": 8,
            },
        },
        "10": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["9", 0],
                "seed": seed,
                "steps": 24,
                "cfg": 7.0,
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
