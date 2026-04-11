"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearUser, ensureUser, wipeAllData } from "@/lib/storage";
import type { User } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(ensureUser());
  }, []);

  function handleSignOut() {
    if (!confirm("Sign out of HandyBot?")) return;
    clearUser();
    router.push("/");
  }

  function handleDeleteAccount() {
    if (
      !confirm(
        "Delete your account and ALL your repairs? This can't be undone."
      )
    ) {
      return;
    }
    wipeAllData();
    router.push("/");
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
        <h1 className="text-xl font-bold text-stone-900">Settings</h1>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-semibold text-stone-800">Account</h2>
        <p className="mt-1 text-sm text-stone-600">
          HandyBot stores your repairs locally in this browser. There&apos;s
          nothing else to it.
        </p>
        {user && (
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">User ID</dt>
              <dd className="truncate font-mono text-stone-700">
                {user.id.slice(0, 8)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Joined</dt>
              <dd className="text-stone-700">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="card flex flex-col gap-3 p-5">
        <button type="button" onClick={handleSignOut} className="btn-secondary">
          Sign out
        </button>
        <button
          type="button"
          onClick={handleDeleteAccount}
          className="btn-danger"
        >
          Delete account
        </button>
      </div>

      <p className="px-1 text-center text-xs text-stone-400">
        HandyBot v0.1 — powered by Claude
      </p>
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
