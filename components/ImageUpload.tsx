"use client";

import { useRef, useState } from "react";
import { fileToResizedDataUrl } from "@/lib/image";

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  /** Pass true to use camera-first input (for mobile). */
  preferCamera?: boolean;
}

export default function ImageUpload({
  value,
  onChange,
  label = "Add a photo",
  preferCamera = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setError("Please pick an image file.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to read image";
      setError(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (value) {
    return (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Uploaded"
          className="w-full rounded-xl border border-stone-200 object-cover"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80"
          aria-label="Remove image"
        >
          <XIcon />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-8 text-stone-600 transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
          <CameraIcon />
        </div>
        <span className="font-medium">{busy ? "Loading..." : label}</span>
        <span className="text-xs text-stone-500">
          Tap to take a photo or pick one from your library
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(preferCamera ? { capture: "environment" as const } : {})}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
