"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import { upsertIssue } from "@/lib/storage";
import type {
  ChatMessage,
  ChatRequestMessage,
  Issue,
} from "@/lib/types";

export default function NewIssuePage() {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!image || submitting) return;
    setSubmitting(true);
    setError(null);

    const id = crypto.randomUUID();
    const now = Date.now();
    const firstUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: note.trim() || "Here's what's broken. What should I do?",
      imageUrl: image,
      createdAt: now,
    };

    try {
      const apiMessages: ChatRequestMessage[] = [
        {
          role: firstUserMsg.role,
          text: firstUserMsg.text,
          imageDataUrl: firstUserMsg.imageUrl,
        },
      ];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      const rawText: string = data.text ?? "";

      const { title, body } = extractTitle(rawText);
      const summary = buildSummary(body);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: body,
        createdAt: Date.now(),
      };

      const issue: Issue = {
        id,
        title: title || "New repair",
        summary,
        status: "in_progress",
        createdAt: now,
        updatedAt: Date.now(),
        coverImage: image,
        messages: [firstUserMsg, assistantMsg],
      };

      upsertIssue(issue);
      router.push(`/issues/${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg p-2 text-stone-600 hover:bg-stone-100"
          aria-label="Back"
        >
          <BackIcon />
        </Link>
        <h1 className="text-xl font-bold text-stone-900">New repair</h1>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-semibold text-stone-800">
          1. Show HandyBot what&apos;s wrong
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Take a photo of the broken thing. Close-ups help.
        </p>
        <div className="mt-4">
          <ImageUpload value={image} onChange={setImage} preferCamera />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-semibold text-stone-800">
          2. Add a quick note (optional)
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Anything you know about the problem — when it started, sounds,
          smells, what you&apos;ve already tried.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. My kitchen faucet started dripping last night..."
          className="mt-3 w-full resize-none rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!image || submitting}
        className="btn-primary"
      >
        {submitting ? "Analyzing..." : "Get fix instructions"}
      </button>
    </div>
  );
}

function extractTitle(text: string): { title: string; body: string } {
  const match = /^\s*TITLE:\s*(.+?)\s*(?:\r?\n|$)/i.exec(text);
  if (match) {
    return {
      title: match[1].trim(),
      body: text.slice(match[0].length).trimStart(),
    };
  }
  return { title: "", body: text };
}

function buildSummary(body: string): string {
  const firstLine = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "Continue the repair conversation.";
  return firstLine.length > 140 ? firstLine.slice(0, 137) + "..." : firstLine;
}

function BackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
