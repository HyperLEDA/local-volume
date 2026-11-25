export type SpatialExportLine = { text: string; color?: string };
export type SpatialExportRenderer = {
  getPixelRatio: () => number;
  setPixelRatio: (ratio: number) => void;
};

/** CSS-pixel framing is unchanged; only drawing-buffer sampling increases. */
export function spatialExportRatio(
  width: number,
  height: number,
  limit: number,
): number {
  if (
    ![width, height, limit].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    throw new Error("Invalid spatial export dimensions");
  }
  return Math.min(
    3,
    4096 / width,
    4096 / height,
    limit / width,
    limit / height,
  );
}

export function withSpatialExportRatio<T>(
  renderer: SpatialExportRenderer,
  ratio: number,
  capture: () => T,
): T {
  const previous = renderer.getPixelRatio();
  try {
    renderer.setPixelRatio(ratio);
    return capture();
  } finally {
    renderer.setPixelRatio(previous);
  }
}

export function wrapSpatialExportLine(
  text: string,
  available: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > available) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Copy the WebGL drawing buffer synchronously, before it can be discarded. */
export function composeSpatialImage(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  theme: "dark" | "light",
  legend: readonly SpatialExportLine[],
  annotate: (context: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const context = output.getContext("2d");
  if (
    !context ||
    source.width < 1 ||
    source.height < 1 ||
    width < 1 ||
    height < 1
  )
    throw new Error("Spatial image unavailable");
  const sx = source.width / width;
  const sy = source.height / height;
  const font = "12px sans-serif";
  context.font = font;
  const lines = legend.flatMap((entry) =>
    wrapSpatialExportLine(
      entry.text,
      Math.max(1, width - 42),
      (text) => context.measureText(text).width,
    ).map((text, index) => ({
      text,
      color: index === 0 ? entry.color : undefined,
    })),
  );
  const footer = lines.length ? 16 + 17 * lines.length : 0;
  output.height = source.height + Math.ceil(footer * sy);
  if (output.height > 6144 || output.width * output.height > 24_000_000)
    throw new Error("Spatial export is too large");
  context.fillStyle = theme === "dark" ? "#101820" : "#f3f5f7";
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(source, 0, 0);
  context.save();
  context.scale(sx, sy);
  context.fillStyle = theme === "dark" ? "#e7edf2" : "#273341";
  context.font = font;
  context.textBaseline = "top";
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  annotate(context);
  context.restore();
  const ink = theme === "dark" ? "#e7edf2" : "#273341";
  if (lines.length) {
    context.strokeStyle = theme === "dark" ? "#405362" : "#b8c6d2";
    context.beginPath();
    context.moveTo(0, height);
    context.lineTo(width, height);
    context.stroke();
  }
  lines.forEach((entry, index) => {
    const y = height + 8 + index * 17;
    if (entry.color) {
      context.fillStyle = entry.color;
      context.fillRect(12, y + 2, 9, 9);
    }
    context.fillStyle = ink;
    context.fillText(entry.text, 27, y);
  });
  context.restore();
  return output;
}

export async function downloadSpatialPng(
  image: HTMLCanvasElement,
): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    image.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("PNG encoding failed"));
    }, "image/png");
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "LV-LEDA-3D-Atlas.png";
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
