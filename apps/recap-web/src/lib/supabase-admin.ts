import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY.
 *
 * RLS on campaigns/sessions/recaps is deliberately read-only for the public
 * anon key; writes happen exclusively through API routes using this client.
 * The service-role key bypasses RLS, so it must only ever live in server env
 * (Vercel env var SUPABASE_SERVICE_ROLE_KEY) — never NEXT_PUBLIC_*, never
 * imported from a client component.
 */
export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
