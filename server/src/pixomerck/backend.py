from __future__ import annotations

from pathlib import Path
from typing import Protocol

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from .models import GenerationInput, HealthView


class GenerationBackend(Protocol):
    async def health(self) -> HealthView:
        ...

    async def generate(self, request: GenerationInput) -> Path:
        ...


class DemoBackend:
    async def health(self) -> HealthView:
        return HealthView(ok=True, backend_ready=True, gpu="demo", message="Demo backend ready")

    async def generate(self, request: GenerationInput) -> Path:
        image = ImageOps.exif_transpose(Image.open(request.image_path)).convert("RGB")
        mask = Image.open(request.mask_path).convert("L").resize(image.size)
        image.thumbnail((request.size, request.size), Image.Resampling.LANCZOS)
        mask = mask.resize(image.size, Image.Resampling.LANCZOS)

        background = Image.new("RGB", image.size, _color_from_prompt(request.prompt))
        background = background.filter(ImageFilter.GaussianBlur(radius=18))
        foreground = ImageEnhance.Color(image).enhance(1.0 + request.strength)
        result = Image.composite(foreground, background, mask)

        draw = ImageDraw.Draw(result)
        draw.rectangle((0, result.height - 36, result.width, result.height), fill=(0, 0, 0))
        draw.text((12, result.height - 27), request.prompt[:80], fill=(255, 255, 255))

        request.output_path.parent.mkdir(parents=True, exist_ok=True)
        result.save(request.output_path)
        return request.output_path


def _color_from_prompt(prompt: str) -> tuple[int, int, int]:
    digest = sum(ord(char) for char in prompt)
    return (
        60 + digest % 150,
        60 + (digest // 3) % 150,
        60 + (digest // 7) % 150,
    )
