"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import IssueCard from "@/components/IssueCard";
import { ensureUser, loadIssues } from "@/lib/storage";
import type { Issue } from "@/lib/types";

export default function HomePage() {
  const [issues, setIssues] = useState<Issue[] | null>(null);

  useEffect(() => {
    ensureUser();
    setIssues(loadIssues());
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-6">
        <h1 className="text-2xl font-bold text-stone-900">
          What needs fixing today?
        </h1>
        <p className="mt-2 text-stone-600">
          Snap a photo of something broken in your home and I&apos;ll walk you
          through how to fix it, step by step.
        </p>
        <div className="mt-5">
          <Link href="/issues/new" className="btn-primary">
            <PlusIcon />
            New repair
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold text-stone-800">
            Your repairs
          </h2>
          {issues && issues.length > 0 && (
            <span className="text-sm text-stone-500">
              {issues.length} {issues.length === 1 ? "issue" : "issues"}
            </span>
          )}
        </div>

        {issues === null ? (
          <LoadingList />
        ) : issues.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-3">
            {issues.map((issue) => (
              <li key={issue.id}>
                <IssueCard issue={issue} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="card h-24 animate-pulse bg-stone-100"
          aria-hidden
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <ToolIcon />
      </div>
      <h3 className="text-base font-semibold text-stone-800">
        No repairs yet
      </h3>
      <p className="max-w-sm text-sm text-stone-600">
        Tap <span className="font-medium">New repair</span> above to take a
        photo of what&apos;s broken and get started.
      </p>
    </div>
  );
}

function PlusIcon() {
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ToolIcon() {
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
      <path d="M14.7 6.3a4 4 0 0 1 5.66 5.66l-1.06 1.06-5.66-5.66z" />
      <path d="m2 22 9.7-9.7" />
      <path d="m13 13 3.5 3.5" />
    </svg>
  );
}
