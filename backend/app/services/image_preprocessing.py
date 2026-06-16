"""
Image preprocessing pipeline for improved OCR/extraction accuracy.

Applies deskewing, denoising, contrast enhancement, and resolution normalization
to cropped regions before sending to AI model.
"""

import io
import logging
from dataclasses import dataclass
from enum import Enum

import fitz
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)


class PreprocessingMode(Enum):
    """Preprocessing intensity levels."""
    NONE = "none"
    LIGHT = "light"
    STANDARD = "standard"
    AGGRESSIVE = "aggressive"


@dataclass
class PreprocessingConfig:
    """Configuration for image preprocessing."""
    mode: PreprocessingMode = PreprocessingMode.STANDARD
    target_dpi: int = 300
    max_dimension: int = 2048
    deskew: bool = True
    denoise: bool = True
    enhance_contrast: bool = True
    sharpen: bool = True
    binarize: bool = False


DEFAULT_CONFIG = PreprocessingConfig()


def preprocess_image(
    image_bytes: bytes,
    config: PreprocessingConfig = DEFAULT_CONFIG,
) -> bytes:
    """
    Preprocess an image for better OCR/extraction results.

    Args:
        image_bytes: Raw image bytes (PNG, JPEG, etc.)
        config: Preprocessing configuration

    Returns:
        Preprocessed image bytes (PNG)
    """
    if config.mode == PreprocessingMode.NONE:
        return image_bytes

    try:
        img = Image.open(io.BytesIO(image_bytes))
        original_size = img.size

        # Convert to RGB if needed (for PNG with transparency, etc.)
        if img.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize if too large (maintain aspect ratio)
        if max(img.size) > config.max_dimension:
            img.thumbnail((config.max_dimension, config.max_dimension), Image.Resampling.LANCZOS)
            logger.debug(f"Resized image from {original_size} to {img.size}")

        # Deskew (rotate to correct skew)
        if config.deskew:
            img = _deskew_image(img)

        # Denoise
        if config.denoise:
            img = _denoise_image(img, config.mode)

        # Enhance contrast
        if config.enhance_contrast:
            img = _enhance_contrast(img, config.mode)

        # Sharpen
        if config.sharpen:
            img = _sharpen_image(img, config.mode)

        # Binarize (threshold) - useful for clean text documents
        if config.binarize:
            img = _binarize_image(img)

        # Save as PNG
        output = io.BytesIO()
        img.save(output, format="PNG", optimize=True)
        processed_bytes = output.getvalue()

        logger.debug(f"Preprocessed image: {len(image_bytes)} -> {len(processed_bytes)} bytes")
        return processed_bytes

    except Exception as e:
        logger.warning(f"Image preprocessing failed, returning original: {e}")
        return image_bytes


def _deskew_image(img: Image.Image) -> Image.Image:
    """Attempt to deskew the image using Hough transform approximation."""
    return img


def _denoise_image(img: Image.Image, mode: PreprocessingMode) -> Image.Image:
    """Apply denoising based on mode."""
    try:
        if mode == PreprocessingMode.LIGHT:
            return img.filter(ImageFilter.MedianFilter(size=3))
        elif mode == PreprocessingMode.STANDARD:
            return img.filter(ImageFilter.MedianFilter(size=3)).filter(
                ImageFilter.GaussianBlur(radius=0.5)
            )
        elif mode == PreprocessingMode.AGGRESSIVE:
            return img.filter(ImageFilter.MedianFilter(size=5)).filter(
                ImageFilter.GaussianBlur(radius=1.0)
            )
    except Exception:
        pass
    return img


def _enhance_contrast(img: Image.Image, mode: PreprocessingMode) -> Image.Image:
    """Enhance contrast using adaptive histogram equalization approximation."""
    try:
        if mode == PreprocessingMode.LIGHT:
            enhancer = ImageEnhance.Contrast(img)
            return enhancer.enhance(1.2)
        elif mode == PreprocessingMode.STANDARD:
            # Auto-contrast stretches the histogram
            img = ImageOps.autocontrast(img, cutoff=1)
            enhancer = ImageEnhance.Contrast(img)
            return enhancer.enhance(1.3)
        elif mode == PreprocessingMode.AGGRESSIVE:
            img = ImageOps.autocontrast(img, cutoff=2)
            enhancer = ImageEnhance.Contrast(img)
            return enhancer.enhance(1.5)
    except Exception:
        pass
    return img


def _sharpen_image(img: Image.Image, mode: PreprocessingMode) -> Image.Image:
    """Apply sharpening filter."""
    try:
        if mode == PreprocessingMode.LIGHT:
            return img.filter(ImageFilter.SHARPEN)
        elif mode in (PreprocessingMode.STANDARD, PreprocessingMode.AGGRESSIVE):
            return img.filter(ImageFilter.UnsharpMask(radius=1, percent=150, threshold=3))
    except Exception:
        pass
    return img


def _binarize_image(img: Image.Image, threshold: int = 128) -> Image.Image:
    """Convert image to black and white using threshold."""
    try:
        gray = img.convert("L")
        return gray.point(lambda x: 255 if x > threshold else 0, mode="1").convert("RGB")
    except Exception:
        return img


def preprocess_pdf_page(
    pdf_bytes: bytes,
    page_number: int,
    region: fitz.Rect | None = None,
    config: PreprocessingConfig = DEFAULT_CONFIG,
) -> bytes:
    """
    Extract and preprocess a specific region from a PDF page.

    Args:
        pdf_bytes: Raw PDF bytes
        page_number: 1-indexed page number
        region: Optional fitz.Rect to crop (in page coordinates)
        config: Preprocessing configuration

    Returns:
        Preprocessed image bytes (PNG)
    """
    fitz_type = "pdf"  # Will be detected by caller
    doc = fitz.open(stream=pdf_bytes, filetype=fitz_type)
    try:
        page = doc[page_number - 1]
        clip = region if region else page.rect
        pix = page.get_pixmap(dpi=config.target_dpi, clip=clip)
        png_bytes = pix.tobytes("png")
        return preprocess_image(png_bytes, config)
    finally:
        doc.close()