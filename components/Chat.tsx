"use client";

import { useEffect, useRef, useState } from "react";
import ImageUpload from "./ImageUpload";
import type { ChatMessage, ChatRequestMessage, Issue } from "@/lib/types";
import { upsertIssue } from "@/lib/storage";

interface Props {
  issue: Issue;
  onChange: (issue: Issue) => void;
}

export default function Chat({ issue, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [issue.messages.length, sending]);

  async function handleSend() {
    if (sending) return;
    const trimmed = draft.trim();
    if (!trimmed && !pendingImage) return;

    setError(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      imageUrl: pendingImage ?? undefined,
      createdAt: Date.now(),
    };

    const withUserMsg: Issue = {
      ...issue,
      messages: [...issue.messages, userMsg],
      updatedAt: Date.now(),
    };
    onChange(withUserMsg);
    try {
      upsertIssue(withUserMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save message.");
      return;
    }

    setDraft("");
    setPendingImage(null);
    setSending(true);

    try {
      const apiMessages: ChatRequestMessage[] = withUserMsg.messages.map(
        (m) => ({
          role: m.role,
          text: m.text,
          imageDataUrl: m.imageUrl,
        })
      );

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      const text: string = data.text ?? "";

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text,
        createdAt: Date.now(),
      };

      const updated: Issue = {
        ...withUserMsg,
        messages: [...withUserMsg.messages, assistantMsg],
        updatedAt: Date.now(),
      };
      onChange(updated);
      upsertIssue(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach Claude";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {issue.messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card sticky bottom-4 flex flex-col gap-3 p-3">
        {pendingImage && (
          <div className="max-w-[160px]">
            <ImageUpload
              value={pendingImage}
              onChange={setPendingImage}
              preferCamera
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          {!pendingImage && (
            <AttachButton onPicked={(dataUrl) => setPendingImage(dataUrl)} />
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Ask a follow-up, share an update..."
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || (!draft.trim() && !pendingImage)}
            className="btn-primary !px-4 !py-2.5"
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function AttachButton({
  onPicked,
}: {
  onPicked: (dataUrl: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    const { fileToResizedDataUrl } = await import("@/lib/image");
    const dataUrl = await fileToResizedDataUrl(file);
    onPicked(dataUrl);
    if (ref.current) ref.current.value = "";
  }
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-600 transition hover:bg-stone-50"
        aria-label="Attach photo"
      >
        <CameraIcon />
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? "rounded-br-md bg-brand-600 text-white"
            : "rounded-bl-md border border-stone-200 bg-white text-stone-900"
        }`}
      >
        {message.imageUrl && (
          <div className="mb-2 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt=""
              className="max-h-80 w-full object-cover"
            />
          </div>
        )}
        {message.text && (
          <div
            className={
              isUser
                ? "whitespace-pre-wrap text-sm leading-relaxed"
                : "assistant-body whitespace-pre-wrap text-sm leading-relaxed"
            }
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-1 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-stone-400"
      style={{ animationDelay: delay }}
    />
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      width="20"
      height="20"
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
