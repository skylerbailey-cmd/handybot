import * as FileSystem from "expo-file-system/legacy";
import { getSupabase } from "../supabase";

/**
 * Upload a local image file to Supabase Storage and return the public URL.
 *
 * Does nothing and returns the same URI unchanged if:
 *   - The URI is already an https URL (already uploaded)
 *   - Supabase isn't configured
 *   - The file can't be read
 *
 * This function is safe to call on every sync; re-uploads of the same
 * `file://` path would be wasteful, so the caller should keep a mapping
 * of local URI → remote URL (we persist that mapping as part of the row
 * itself by overwriting `coverImageUri` / `photoUri` with the returned URL
 * before pushing the row to the DB).
 */
export async function uploadLocalImageIfNeeded(
  localUri: string | undefined,
  userId: string
): Promise<string | undefined> {
  if (!localUri) return undefined;
  if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
    return localUri; // already remote
  }
  const supabase = getSupabase();
  if (!supabase) return localUri;

  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = decodeBase64(base64);

    const path = `${userId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.jpg`;

    const { error } = await supabase.storage
      .from("photos")
      .upload(path, bytes, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (error) {
      console.warn("photo upload failed", error.message);
      return localUri;
    }

    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    return data.publicUrl ?? localUri;
  } catch (err) {
    console.warn("photo upload threw", err);
    return localUri;
  }
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
