import * as Linking from "expo-linking";
import { getSupabase } from "@/lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

/**
 * Thin wrappers around Supabase Auth.
 *
 * Login is optional — free-tier users never call these functions.
 * Cloud Backup in Settings routes to the login screen only when
 * no Supabase session exists.
 */

/** Error code returned alongside the friendly message so callers can branch. */
export interface AuthResult {
  error: string | null;
  code: string | null;
}

export async function signUp(
  email: string,
  password: string
): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured.", code: null };

  const { error } = await sb.auth.signUp({ email, password });
  if (error)
    return { error: friendlyError(error.message), code: error.code ?? null };
  return { error: null, code: null };
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured.", code: null };

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error)
    return { error: friendlyError(error.message), code: error.code ?? null };
  return { error: null, code: null };
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

/** Resend the signup confirmation email. */
export async function resendConfirmation(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured.", code: null };

  const { error } = await sb.auth.resend({ type: "signup", email });
  if (error)
    return { error: friendlyError(error.message), code: error.code ?? null };
  return { error: null, code: null };
}

/** Send a password-reset email with a deep link back into the app. */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured.", code: null };

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });
  if (error)
    return { error: friendlyError(error.message), code: error.code ?? null };
  return { error: null, code: null };
}

/** Set a new password for the currently authenticated user. */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured.", code: null };

  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error)
    return { error: friendlyError(error.message), code: error.code ?? null };
  return { error: null, code: null };
}

/**
 * Deep-link URL that Supabase embeds in the password-reset email.
 * Uses the app's registered scheme so the OS hands the link to the app.
 */
export function getPasswordResetRedirectUrl(): string {
  return Linking.createURL("/reset-password");
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
  if (lower.includes("email not confirmed"))
    return "Please confirm your email before signing in.";
  if (lower.includes("email rate limit"))
    return "Too many emails sent. Please wait a few minutes and try again.";
  return msg;
}
