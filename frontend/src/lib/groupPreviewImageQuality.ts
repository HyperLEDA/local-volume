/** Minimal container signature check. Small (< 4 KiB) WebP images may be valid. */
export function hasWebpSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  return (
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 && // RIFF
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80 // WEBP
  );
}

/**
 * Reject an empty/unpainted capture without conflating content with compression
 * size. Inspect the central sky area rather than the Aladin logo in a corner.
 * This is deliberately permissive for faint, sparse astronomical fields.
 */
export function hasSkySignal(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): boolean {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 32 ||
    height < 32 ||
    rgba.length < width * height * 4
  )
    return false;
  const x0 = Math.floor(width * 0.12);
  const x1 = Math.ceil(width * 0.88);
  const y0 = Math.floor(height * 0.12);
  const y1 = Math.ceil(height * 0.88);
  const step = Math.max(1, Math.floor(Math.min(width, height) / 256));
  let minimum = 255;
  let maximum = 0;
  let brighter = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const index = (y * width + x) * 4;
      const luma =
        (54 * rgba[index] + 183 * rgba[index + 1] + 19 * rgba[index + 2]) / 256;
      minimum = Math.min(minimum, luma);
      maximum = Math.max(maximum, luma);
      if (luma >= 20) brighter++;
    }
  }
  return maximum - minimum >= 12 && maximum >= 24 && brighter >= 2;
}
