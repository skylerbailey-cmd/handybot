"use client";

/**
 * Resize and compress an image file to keep localStorage usage manageable.
 * Returns a JPEG data URL.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxDimension = 1024,
  quality = 0.82
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const { width, height } = img;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return canvas.toDataURL("image/jpeg", quality);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Split a data URL into a media type and raw base64 body.
 * Throws if the input isn't a base64 data URL.
 */
export function splitDataUrl(dataUrl: string): {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
} {
  const match = /^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Unsupported image format");
  }
  return {
    mediaType: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
    data: match[3],
  };
}
