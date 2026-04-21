import { getSupabase } from "@/lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

/**
 * Thin wrappers around Supabase Auth.
 *
 * Login is optional — free-tier users never call these functions.
 * Cloud Backup in Settings routes to the login screen only when
 * no Supabase session exists.
 */

export async function signUp(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured." };

  const { error } = await sb.auth.signUp({ email, password });
  if (error) return { error: friendlyError(error.message) };
  return { error: null };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured." };

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: friendlyError(error.message) };
  return { error: null };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): (() => void) | undefined {
  const sb = getSupabase();
  if (!sb) return undefined;
  const { data } = sb.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

/** Map Supabase error strings to user-friendly messages. */
function friendlyError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials"))
    return "Wrong email or password.";
  if (lower.includes("user already registered"))
    return "An account with that email already exists. Try signing in instead.";
  if (lower.includes("password") && lower.includes("short"))
    return "Password must be at least 6 characters.";
  if (lower.includes("invalid email"))
    return "Please enter a valid email address.";
  return msg;
}
