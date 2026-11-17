import hashlib
import struct

import pytest

from lv_backend.data.group_previews import RENDER_VERSION, validate_webp


def sample_webp(width: int = 512, height: int = 512, padding: int = 5000) -> bytes:
    vp8x = b"\x00" * 4 + (width - 1).to_bytes(3, "little") + (height - 1).to_bytes(3, "little")
    content = b"WEBP" + b"VP8X" + struct.pack("<I", len(vp8x)) + vp8x + b"x" * padding
    return b"RIFF" + struct.pack("<I", len(content)) + content


def test_preview_requires_actual_webp_riff() -> None:
    with pytest.raises(ValueError):
        validate_webp(b"not a WebP image")
    with pytest.raises(ValueError):
        validate_webp(b"RIFF" + struct.pack("<I", 5012) + b"WEBP" + b"x" * 5000)
    with pytest.raises(ValueError, match="512x512"):
        validate_webp(sample_webp(width=400))


def test_preview_accepts_square_512px_webp_header() -> None:
    blob = sample_webp()
    validate_webp(blob)
    assert len(hashlib.sha256(blob).hexdigest()) == 64
    assert RENDER_VERSION.startswith("sin-dss2-")


def test_compact_webp_is_not_rejected_by_a_size_floor() -> None:
    small = sample_webp(padding=128)
    assert len(small) < 4096
    validate_webp(small)
