"use client";

import type { Issue, User } from "./types";

const ISSUES_KEY = "handyman:issues";
const USER_KEY = "handyman:user";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadIssues(): Issue[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ISSUES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Issue[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveIssues(issues: Issue[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ISSUES_KEY, JSON.stringify(issues));
  } catch (err) {
    // localStorage can be full with images; surface a friendly error.
    console.error("Failed to save issues to localStorage", err);
    throw new Error(
      "Your browser's storage is full. Try deleting an older issue to free up space."
    );
  }
}

export function getIssue(id: string): Issue | undefined {
  return loadIssues().find((i) => i.id === id);
}

export function upsertIssue(issue: Issue) {
  const all = loadIssues();
  const idx = all.findIndex((i) => i.id === issue.id);
  if (idx >= 0) {
    all[idx] = issue;
  } else {
    all.unshift(issue);
  }
  saveIssues(all);
}

export function deleteIssue(id: string) {
  const all = loadIssues().filter((i) => i.id !== id);
  saveIssues(all);
}

export function loadUser(): User | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveUser(user: User) {
  if (!isBrowser()) return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(USER_KEY);
}

export function wipeAllData() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ISSUES_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function ensureUser(): User {
  let user = loadUser();
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      name: "You",
      createdAt: Date.now(),
    };
    saveUser(user);
  }
  return user;
}
