import * as FileSystem from "expo-file-system/legacy";
import { getSupabase } from "../supabase";

/**
 * Extract a storage path from a legacy Supabase signed/public URL.
 * URLs look like:
 *   https://xxx.supabase.co/storage/v1/object/public/photos/userId/file.jpg
 *   https://xxx.supabase.co/storage/v1/object/sign/photos/userId/file.jpg?token=...
 * We want to extract "userId/file.jpg".
 */
function extractPathFromUrl(url: string): string | null {
  // Match /photos/ followed by the path
  const match = url.match(/\/photos\/(.+?)(?:\?|$)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

/**
 * Upload a local image file to Supabase Storage and return the storage
 * path (e.g. "userId/123_abc.jpg").
 *
 * Returns the input unchanged if:
 *   - It's already a storage path (not file:// and not http(s)://)
 *   - Supabase isn't configured
 *   - The file can't be read
 *
 * For legacy https:// URLs (from before the path-storage change), extracts
 * and returns the storage path so old rows migrate on next sync.
 */
export async function uploadLocalImageIfNeeded(
  localUri: string | undefined,
  userId: string
): Promise<string | undefined> {
  if (!localUri) return undefined;

  // Legacy https:// URL — extract the storage path
  if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
    const extracted = extractPathFromUrl(localUri);
    return extracted ?? localUri; // fallback to URL if extraction fails
  }

  // Already a storage path (not file://, not http) — pass through
  if (!localUri.startsWith("file://")) {
    return localUri;
  }

  const supabase = getSupabase();
  if (!supabase) return localUri;

  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = decodeBase64(base64);

    // Detect file type from extension
    const lowerUri = localUri.toLowerCase();
    const EXT_MAP: Record<string, { ext: string; contentType: string }> = {
      ".pdf": { ext: "pdf", contentType: "application/pdf" },
      ".png": { ext: "png", contentType: "image/png" },
      ".doc": { ext: "doc", contentType: "application/msword" },
      ".docx": {
        ext: "docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    };
    const match = Object.entries(EXT_MAP).find(([suffix]) =>
      lowerUri.endsWith(suffix)
    );
    const ext = match ? match[1].ext : "jpg";
    const contentType = match ? match[1].contentType : "image/jpeg";

    const path = `${userId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from("photos")
      .upload(path, bytes, {
        contentType,
        upsert: false,
      });
    if (error) {
      console.warn("photo upload failed", error.message);
      return localUri;
    }

    // Return the storage path — callers persist this, not a URL
    return path;
  } catch (err) {
    console.warn("photo upload threw", err);
    return localUri;
  }
}

// ---------------------------------------------------------------------------
// Signed URL resolution for rendering
// ---------------------------------------------------------------------------

// In-memory cache: path → { url, expiresAt }
const _signedCache = new Map<string, { url: string; expiresAt: number }>();
const SIGN_TTL_SECONDS = 60;
const CACHE_TTL_MS = 45_000; // refresh before the 60s URL expires

/**
 * Resolve a stored photo reference to a renderable URL.
 * - undefined → undefined
 * - file:// → passed through (local image)
 * - http(s):// → passed through (legacy URL or external)
 * - Otherwise treated as a storage path → signed URL (60s TTL, cached 45s)
 */
export async function resolvePhotoUri(
  stored: string | undefined
): Promise<string | undefined> {
  if (!stored) return undefined;
  if (stored.startsWith("file://")) return stored;
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    return stored;
  }

  // It's a storage path — check cache
  const cached = _signedCache.get(stored);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const supabase = getSupabase();
  if (!supabase) return undefined;

  const { data, error } = await supabase.storage
    .from("photos")
    .createSignedUrl(stored, SIGN_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn("resolvePhotoUri sign failed", error?.message);
    return undefined;
  }

  _signedCache.set(stored, {
    url: data.signedUrl,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return data.signedUrl;
}

/**
 * Decode a base64 string to a Uint8Array. React Native's global `atob` is
 * not always available, so we do it manually.
 */
function decodeBase64(b64: string): Uint8Array {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  let bufferLength = b64.length * 0.75;
  if (b64[b64.length - 1] === "=") bufferLength--;
  if (b64[b64.length - 2] === "=") bufferLength--;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < b64.length; i += 4) {
    const e1 = lookup[b64.charCodeAt(i)];
    const e2 = lookup[b64.charCodeAt(i + 1)];
    const e3 = lookup[b64.charCodeAt(i + 2)];
    const e4 = lookup[b64.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < bufferLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < bufferLength) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
}
