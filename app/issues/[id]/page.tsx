"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Chat from "@/components/Chat";
import { deleteIssue, getIssue, upsertIssue } from "@/lib/storage";
import type { Issue } from "@/lib/types";

export default function IssueWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<Issue | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    const found = getIssue(params.id);
    setIssue(found ?? null);
  }, [params?.id]);

  if (issue === undefined) {
    return (
      <div className="card h-40 animate-pulse bg-stone-100" aria-hidden />
    );
  }

  if (issue === null) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <h2 className="text-lg font-semibold text-stone-900">
          Repair not found
        </h2>
        <p className="text-sm text-stone-600">
          This repair may have been deleted.
        </p>
        <Link href="/" className="btn-primary mt-2">
          Back to home
        </Link>
      </div>
    );
  }

  function toggleResolved() {
    if (!issue) return;
    const updated: Issue = {
      ...issue,
      status: issue.status === "resolved" ? "in_progress" : "resolved",
      updatedAt: Date.now(),
    };
    setIssue(updated);
    upsertIssue(updated);
    setMenuOpen(false);
  }

  function handleDelete() {
    if (!issue) return;
    if (!confirm("Delete this repair? This can't be undone.")) return;
    deleteIssue(issue.id);
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            className="rounded-lg p-2 text-stone-600 hover:bg-stone-100"
            aria-label="Back"
          >
            <BackIcon />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-stone-900">
              {issue.title || "Untitled repair"}
            </h1>
            {issue.status === "resolved" && (
              <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Resolved
              </span>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg p-2 text-stone-600 hover:bg-stone-100"
            aria-label="More options"
          >
            <DotsIcon />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-hidden
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={toggleResolved}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-stone-800 hover:bg-stone-50"
                >
                  {issue.status === "resolved"
                    ? "Mark as in progress"
                    : "Mark as resolved"}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 border-t border-stone-100 px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
                >
                  Delete repair
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <Chat issue={issue} onChange={setIssue} />
    </div>
  );
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

function DotsIcon() {
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
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
    </svg>
  );
}
