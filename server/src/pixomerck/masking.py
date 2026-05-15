from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path
import shutil

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


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


def prepare_inpaint_pair(
    source_path: Path,
    mask_path: Path,
    output_image_path: Path,
    output_mask_path: Path,
    size: int,
    edit_target: str = "subject",
) -> None:
    image = ImageOps.exif_transpose(Image.open(source_path)).convert("RGB")
    mask = Image.open(mask_path).convert("L").resize(image.size, Image.Resampling.LANCZOS)
    target_size = _target_dimensions(image.size, size)
    output_image = image.resize(target_size, Image.Resampling.LANCZOS)
    output_mask = mask.resize(target_size, Image.Resampling.LANCZOS)
    output_mask = _edit_mask_for_target(output_image, output_mask, edit_target)

    output_image_path.parent.mkdir(parents=True, exist_ok=True)
    output_mask_path.parent.mkdir(parents=True, exist_ok=True)
    output_image.save(output_image_path)
    output_mask.save(output_mask_path)


def _edit_mask_for_target(image: Image.Image, person_mask: Image.Image, edit_target: str) -> Image.Image:
    target = (edit_target or "subject").strip().lower()
    if target == "background":
        return ImageOps.invert(person_mask)

    subject_mask = _protect_identity_region(person_mask)
    subject_mask = _protect_hands_and_held_objects(image, subject_mask)
    if target == "scene":
        return ImageChops.lighter(subject_mask, ImageOps.invert(person_mask))
    return subject_mask


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


def _target_dimensions(source_size: tuple[int, int], long_edge: int) -> tuple[int, int]:
    width, height = source_size
    scale = long_edge / max(width, height)
    return (
        _round_to_multiple(width * scale, 8),
        _round_to_multiple(height * scale, 8),
    )


def _round_to_multiple(value: float, multiple: int) -> int:
    return max(multiple, round(value / multiple) * multiple)


def _protect_identity_region(mask: Image.Image) -> Image.Image:
    protected = mask.copy()
    bbox = protected.point(lambda value: 255 if value > 32 else 0).getbbox()
    if bbox is None:
        return protected

    left, top, right, bottom = bbox
    person_height = bottom - top
    fade_start = top + round(person_height * 0.22)
    protect_bottom = top + round(person_height * 0.38)
    if protect_bottom <= top:
        return protected

    identity_mask = Image.new("L", protected.size, 0)
    draw = ImageDraw.Draw(identity_mask)
    draw.rectangle((left, top, right, fade_start), fill=255)
    fade_height = max(1, protect_bottom - fade_start)
    for y in range(fade_start, protect_bottom):
        alpha = round(255 * (1 - ((y - fade_start) / fade_height)))
        draw.line((left, y, right, y), fill=alpha)
    identity_mask = identity_mask.filter(ImageFilter.GaussianBlur(radius=max(2.0, protected.width / 128)))
    return Image.composite(Image.new("L", protected.size, 0), protected, identity_mask)


def _protect_hands_and_held_objects(image: Image.Image, mask: Image.Image) -> Image.Image:
    bbox = mask.point(lambda value: 255 if value > 32 else 0).getbbox()
    if bbox is None:
        return mask

    left, top, right, bottom = bbox
    person_width = right - left
    person_height = bottom - top
    detect_top = top + round(person_height * 0.58)
    detect_bottom = top + round(person_height * 0.88)
    if detect_bottom <= detect_top:
        return mask

    skin_mask = Image.new("L", mask.size, 0)
    hsv_image = image.convert("HSV")
    rgb_image = image.convert("RGB")
    image_pixels = hsv_image.load()
    rgb_pixels = rgb_image.load()
    mask_pixels = mask.load()
    skin_pixels = skin_mask.load()

    for y in range(max(0, detect_top), min(mask.height, detect_bottom)):
        for x in range(max(0, left), min(mask.width, right)):
            if mask_pixels[x, y] <= 64:
                continue
            hue, saturation, value = image_pixels[x, y]
            red, green, blue = rgb_pixels[x, y]
            if _is_skin_like(red, green, blue, hue, saturation, value):
                skin_pixels[x, y] = 255

    skin_mask = skin_mask.filter(ImageFilter.MaxFilter(size=9)).filter(ImageFilter.GaussianBlur(radius=2.2))
    hand_bbox = skin_mask.point(lambda value: 255 if value > 80 else 0).getbbox()
    if hand_bbox is None:
        return mask

    hand_left, hand_top, hand_right, hand_bottom = hand_bbox
    expand_x = round(person_width * 0.08)
    expand_bottom = round(person_height * 0.12)
    hand_height = hand_bottom - hand_top
    held_object_mask = Image.new("L", mask.size, 0)
    draw = ImageDraw.Draw(held_object_mask)
    if hand_right - hand_left > person_width * 0.35:
        draw.rectangle(
            (
                max(left, hand_left - expand_x),
                max(top, hand_top + round(hand_height * 0.35)),
                min(right, hand_right + expand_x),
                min(bottom, hand_bottom + expand_bottom),
            ),
            fill=255,
        )

    protect_mask = ImageChops.lighter(skin_mask, held_object_mask)
    protect_mask = protect_mask.filter(ImageFilter.GaussianBlur(radius=max(1.5, mask.width / 220)))
    return Image.composite(Image.new("L", mask.size, 0), mask, protect_mask)


def _is_skin_like(red: int, green: int, blue: int, hue: int, saturation: int, value: int) -> bool:
    return (
        value > 55
        and saturation > 35
        and (hue <= 38 or hue >= 235)
        and red > blue + 12
        and red >= green - 18
    )
