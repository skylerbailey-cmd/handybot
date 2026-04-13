import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Centralized Supabase client.
 *
 * The client is only used when the user is on the paid tier (see
 * lib/subscription.ts). Free-tier users never hit the network — their data
 * stays entirely in AsyncStorage + the device filesystem.
 *
 * The URL and publishable key come from the Expo env. They ship inside the
 * client bundle; that's OK because Row Level Security on the database is
 * the real gate. Never put a service-role key in here.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Lazily-instantiated Supabase client. Returns null if env vars are missing
 * so callers can fall back to local-only behavior without crashing.
 */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Persist auth state in AsyncStorage so sign-in (added in a later
      // step) survives app restarts on React Native.
      storage: AsyncStorage as unknown as Storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}
