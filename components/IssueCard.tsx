"use client";

import Link from "next/link";
import type { Issue } from "@/lib/types";

function timeAgo(ts: number) {
  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function IssueCard({ issue }: { issue: Issue }) {
  return (
    <Link
      href={`/issues/${issue.id}`}
      className="card flex items-center gap-4 p-3 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-stone-100">
        {issue.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={issue.coverImage}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-400">
            <PhotoIcon />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold text-stone-900">
            {issue.title || "Untitled repair"}
          </h3>
          {issue.status === "resolved" && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Resolved
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">
          {issue.summary || "Tap to continue the conversation."}
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Updated {timeAgo(issue.updatedAt)}
        </p>
      </div>
      <ChevronIcon />
    </Link>
  );
}

function PhotoIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  );
}

function ChevronIcon() {
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
      className="flex-shrink-0 text-stone-400"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
