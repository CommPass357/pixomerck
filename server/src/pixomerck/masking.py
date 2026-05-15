from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path
import shutil

from PIL import Image, ImageFilter, ImageOps


MAX_SEGMENTATION_SIDE = 1536


class PersonMaskUnavailable(RuntimeError):
    pass


def create_person_mask(source_path: Path, uploaded_mask_path: Path, destination: Path, *, required: bool) -> None:
    if not required:
        shutil.copyfile(uploaded_mask_path, destination)
        return

    try:
        _create_rembg_mask(source_path, destination)
    except PersonMaskUnavailable:
        raise ValueError("Person segmentation is not installed. Run server/scripts/install.ps1, then restart Pixomerck.")
    except Exception as exc:
        raise ValueError(f"Could not create a person mask: {exc}") from exc


def prepare_inpaint_pair(source_path: Path, mask_path: Path, output_image_path: Path, output_mask_path: Path, size: int) -> None:
    image = ImageOps.exif_transpose(Image.open(source_path)).convert("RGB")
    mask = Image.open(mask_path).convert("L").resize(image.size, Image.Resampling.LANCZOS)

    canvas = _blurred_square_background(image, size)
    mask_canvas = Image.new("L", (size, size), 0)
    contained_image, contained_mask, offset = _contain_pair(image, mask, size)

    canvas.paste(contained_image, offset)
    mask_canvas.paste(contained_mask, offset)

    output_image_path.parent.mkdir(parents=True, exist_ok=True)
    output_mask_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_image_path)
    mask_canvas.save(output_mask_path)


def _create_rembg_mask(source_path: Path, destination: Path) -> None:
    try:
        from rembg import new_session, remove
    except ImportError as exc:
        raise PersonMaskUnavailable from exc

    image = ImageOps.exif_transpose(Image.open(source_path)).convert("RGB")
    working = image.copy()
    working.thumbnail((MAX_SEGMENTATION_SIDE, MAX_SEGMENTATION_SIDE), Image.Resampling.LANCZOS)

    mask_result = remove(
        working,
        only_mask=True,
        post_process_mask=True,
        session=_rembg_session(new_session),
    )
    mask = _mask_result_to_image(mask_result)
    mask = ImageOps.grayscale(mask)
    mask = ImageOps.autocontrast(mask)
    mask = mask.filter(ImageFilter.MedianFilter(size=5))
    mask = mask.filter(ImageFilter.MaxFilter(size=9))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=1.6))
    mask = mask.resize(image.size, Image.Resampling.LANCZOS)
    _validate_mask(mask)

    destination.parent.mkdir(parents=True, exist_ok=True)
    mask.save(destination)


@lru_cache(maxsize=1)
def _rembg_session(new_session):
    return new_session("u2net_human_seg")


def _mask_result_to_image(mask_result) -> Image.Image:
    if isinstance(mask_result, Image.Image):
        return mask_result
    if isinstance(mask_result, bytes):
        return Image.open(BytesIO(mask_result))
    if isinstance(mask_result, bytearray):
        return Image.open(BytesIO(bytes(mask_result)))
    if hasattr(mask_result, "__array__"):
        return Image.fromarray(mask_result)
    raise ValueError("The segmentation model returned an unsupported mask format.")


def _validate_mask(mask: Image.Image) -> None:
    binary = mask.point(lambda value: 255 if value > 24 else 0)
    foreground = sum(1 for value in binary.getdata() if value)
    coverage = foreground / float(binary.width * binary.height)
    if coverage < 0.02:
        raise ValueError("No person was detected in the image.")
    if coverage > 0.9:
        raise ValueError("The person mask covered almost the entire image.")


def _blurred_square_background(image: Image.Image, size: int) -> Image.Image:
    width, height = image.size
    scale = max(size / width, size / height)
    cover_size = (max(size, round(width * scale)), max(size, round(height * scale)))
    cover = image.resize(cover_size, Image.Resampling.LANCZOS)
    left = max(0, (cover.width - size) // 2)
    top = max(0, (cover.height - size) // 2)
    cover = cover.crop((left, top, left + size, top + size))
    return cover.filter(ImageFilter.GaussianBlur(radius=max(12, size // 18)))


def _contain_pair(image: Image.Image, mask: Image.Image, size: int) -> tuple[Image.Image, Image.Image, tuple[int, int]]:
    width, height = image.size
    scale = min(size / width, size / height)
    contained_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    contained_image = image.resize(contained_size, Image.Resampling.LANCZOS)
    contained_mask = mask.resize(contained_size, Image.Resampling.LANCZOS)
    offset = ((size - contained_size[0]) // 2, (size - contained_size[1]) // 2)
    return contained_image, contained_mask, offset
