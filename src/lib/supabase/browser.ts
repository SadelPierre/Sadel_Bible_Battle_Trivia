"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Anon-key client — used ONLY to subscribe to realtime sync events.
 * RLS denies this key access to every table except the game_events feed.
 */
let cached: SupabaseClient | null = null;

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function supabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseBrowserConfigured()) return null;
  if (!cached) {
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      publishableKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cached;
}
