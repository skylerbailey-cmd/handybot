import { useEffect, useState } from "react";
import { resolvePhotoUri } from "@/lib/cloud/photosRemote";

/**
 * Hook that resolves a stored photo reference (storage path, file:// URI,
 * or legacy https:// URL) into a renderable URL via signed URLs.
 *
 * Re-resolves when the stored value changes and auto-refreshes before
 * the signed URL expires.
 */
export function usePhotoUri(stored: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!stored) {
      setResolved(undefined);
      return;
    }

    // file:// and http(s):// pass through immediately
    if (
      stored.startsWith("file://") ||
      stored.startsWith("http://") ||
      stored.startsWith("https://")
    ) {
      setResolved(stored);
      return;
    }

    // Storage path — resolve to signed URL
    let cancelled = false;

    function resolve() {
      resolvePhotoUri(stored).then((url) => {
        if (!cancelled) setResolved(url);
      });
    }

    resolve();

    // Auto-refresh every 45s (before the 60s TTL expires)
    const interval = setInterval(resolve, 45_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [stored]);

  return resolved;
}
