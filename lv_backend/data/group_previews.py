import hashlib

from lv_backend.data.storage import Storage
from lv_backend.domain.physical_calculations import FORMULA_VERSION

RENDER_VERSION = "sin-dss2-atlas-markers-v16-tight-fit"
PORTRAIT_RENDER_VERSION = "sin-dss2-md-closeup-a26-x1.4-v18"

# Temporary exception: LMC (PGC 17223) should be handled within the Milky Way group.
NO_HIERARCHY_PREVIEW_ROOTS = frozenset({17223})

_STATE_SQL = """
SELECT source_revision, applied_revision, formula_version
FROM lv.physical_refresh_state WHERE singleton = TRUE
"""

_READ_SQL = """
SELECT image_webp, image_sha256
FROM lv.group_previews
WHERE root_pgc = %s AND definition = %s AND variant = %s
 AND source_revision = %s AND formula_version = %s AND render_version = %s
"""

_UPSERT_SQL = """
INSERT INTO lv.group_previews (
 root_pgc, definition, variant, source_revision, formula_version, render_version,
 image_webp, image_sha256, image_width, image_height, survey, projection
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 512, 512, 'DSS2 Color', 'SIN')
ON CONFLICT (root_pgc, definition, variant) DO UPDATE SET
 source_revision = EXCLUDED.source_revision,
 formula_version = EXCLUDED.formula_version,
 render_version = EXCLUDED.render_version,
 image_webp = EXCLUDED.image_webp,
 image_sha256 = EXCLUDED.image_sha256,
 created_at = now()
RETURNING image_sha256
"""


def current_revision(storage: Storage) -> int:
    rows = storage.query(_STATE_SQL)
    if len(rows) != 1:
        raise RuntimeError("Missing physical refresh state")
    row = rows[0]
    if row["source_revision"] != row["applied_revision"] or row["formula_version"] != FORMULA_VERSION:
        raise RuntimeError("Physical catalogue refresh is not current")
    return int(row["applied_revision"])


def preview_render_version(variant: str) -> str:
    if variant == "hierarchy":
        return RENDER_VERSION
    if variant == "portrait":
        return PORTRAIT_RENDER_VERSION
    raise ValueError(f"Unsupported preview variant: {variant}")


def select_preview(
    storage: Storage,
    root_pgc: int,
    definition: str,
    variant: str = "hierarchy",
) -> dict[str, object] | None:
    if variant == "hierarchy" and root_pgc in NO_HIERARCHY_PREVIEW_ROOTS:
        return None
    render_version = preview_render_version(variant)
    rev = current_revision(storage)
    rows = storage.query(_READ_SQL, [root_pgc, definition, variant, rev, FORMULA_VERSION, render_version])
    return rows[0] if rows else None


def validate_webp(blob: bytes) -> None:
    # A valid, well-compressed 512px WebP can be smaller than 4 KiB.
    # Every supported WebP header needs at least 30 bytes for dimensions.
    if len(blob) < 30 or len(blob) > 5 * 1024 * 1024:
        raise ValueError("WebP preview must have a complete header and be at most 5 MiB")
    if blob[:4] != b"RIFF" or blob[8:12] != b"WEBP":
        raise ValueError("Image body is not a WebP RIFF stream")
    if int.from_bytes(blob[4:8], "little") + 8 != len(blob):
        raise ValueError("WebP RIFF length does not match request body")
    chunk = blob[12:16]
    if chunk == b"VP8X" and len(blob) >= 30:
        width = 1 + int.from_bytes(blob[24:27], "little")
        height = 1 + int.from_bytes(blob[27:30], "little")
    elif chunk == b"VP8L" and len(blob) >= 25 and blob[20] == 0x2F:
        dimensions = int.from_bytes(blob[21:25], "little")
        width = 1 + (dimensions & 0x3FFF)
        height = 1 + ((dimensions >> 14) & 0x3FFF)
    elif chunk == b"VP8 " and len(blob) >= 30 and blob[23:26] == b"\x9d\x01\x2a":
        width = int.from_bytes(blob[26:28], "little") & 0x3FFF
        height = int.from_bytes(blob[28:30], "little") & 0x3FFF
    else:
        raise ValueError("Unsupported WebP encoding or truncated header")
    if (width, height) != (512, 512):
        raise ValueError(f"Preview must be 512x512 pixels, got {width}x{height}")


def save_preview(
    storage: Storage,
    root_pgc: int,
    definition: str,
    blob: bytes,
    expected_revision: int,
    variant: str = "hierarchy",
) -> str:
    if variant == "hierarchy" and root_pgc in NO_HIERARCHY_PREVIEW_ROOTS:
        raise ValueError("Hierarchy preview is disabled for PGC 17223 (LMC)")
    render_version = preview_render_version(variant)
    validate_webp(blob)
    rev = current_revision(storage)
    if rev != expected_revision:
        raise RuntimeError("Physical catalogue changed during preview rendering; discard and retry")
    digest = hashlib.sha256(blob).hexdigest()
    result = storage.query(
        _UPSERT_SQL,
        [root_pgc, definition, variant, rev, FORMULA_VERSION, render_version, blob, digest],
    )
    if not result:
        raise RuntimeError("Preview insert was not confirmed")
    return digest


_CACHE_INDEX_SQL = """
SELECT root_pgc, variant, source_revision, formula_version, render_version,
       octet_length(image_webp) AS size_bytes
FROM lv.group_previews
WHERE definition = %s
ORDER BY root_pgc, variant
"""


def cache_manifest(storage: Storage, definition: str) -> dict[str, object]:
    """Read-only snapshot of stored variants, including stale entries.

    A stale entry is never served by select_preview(). Missing entries are
    determined against the live group list by the client, not fabricated here.
    """
    if definition not in ("physical", "suite"):
        raise ValueError("Unsupported group preview definition")
    revision = current_revision(storage)
    rows = storage.query(_CACHE_INDEX_SQL, [definition])
    entries = [
        {
            "root_pgc": int(row["root_pgc"]),
            "variant": row["variant"],
            "current": (
                not (row["root_pgc"] in NO_HIERARCHY_PREVIEW_ROOTS and row["variant"] == "hierarchy")
                and row["source_revision"] == revision
                and row["formula_version"] == FORMULA_VERSION
                and row["render_version"] == preview_render_version(str(row["variant"]))
            ),
            "bytes": int(row["size_bytes"]),
        }
        for row in rows
    ]
    return {"revision": revision, "entries": entries}
