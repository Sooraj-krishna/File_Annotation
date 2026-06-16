MIME_TO_FITZ_TYPE = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/tiff": "tiff",
    "image/bmp": "bmp",
}

IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/tiff", "image/bmp"}

FITZ_MIME_TYPES = set(MIME_TO_FITZ_TYPE.keys())


def detect_mime_type(data: bytes) -> str:
    if data[:4] == b"%PDF":
        return "application/pdf"
    if data[:4] == b"\x89PNG":
        return "image/png"
    if data[:2] == b"\xff\xd8":
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:2] in (b"II", b"MM"):
        return "image/tiff"
    if data[:2] == b"BM":
        return "image/bmp"
    return "application/pdf"


def mime_to_fitz_filetype(mime_type: str) -> str:
    return MIME_TO_FITZ_TYPE.get(mime_type, "pdf")


def is_image_mime(mime_type: str) -> bool:
    return mime_type in IMAGE_MIME_TYPES
