// IMPORTANT: the URL polyfill MUST be imported before @supabase/supabase-js.
// React Native's Hermes engine ships an incomplete WHATWG `URL`, and supabase-js
// (via realtime-js) constructs a `URL` at createClient() time. Without this
// polyfill that throws at module load → the app crashes on startup. (Was the
// cause of the "Crashed on start" TestFlight report on builds 5–7.)
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase config is ENV-DRIVEN and may legitimately be absent.
 *
 * This previously hardcoded a project ref that does not exist — DNS for it does
 * not resolve and it is not in the account's project list. Every cloud feature
 * (auth, cloud backup, recap publishing) was therefore pointed at a dead
 * backend, and the old "demo mode" auth fallback silently swallowed the failure
 * so it looked like sign-in worked.
 *
 * Now: set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY once a real
 * project exists. Until then `isSupabaseConfigured` is false and the UI offers
 * local-only (guest) use instead of pretending an account can be created.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True only when a real backend is configured. Gate all cloud UI on this. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// A syntactically valid placeholder keeps createClient (and every existing
// `supabase.auth.*` call site) from throwing at module load when unconfigured.
// Requests against it fail as network errors, which is why UI must check
// isSupabaseConfigured first rather than relying on a request to tell it.
const EFFECTIVE_URL = isSupabaseConfigured ? SUPABASE_URL : "https://unconfigured.invalid";
const EFFECTIVE_KEY = isSupabaseConfigured ? SUPABASE_ANON_KEY : "unconfigured";

// The app persists the session itself in SQLite (see auth-context loadSession /
// setKv("supabase_session")), so supabase-js doesn't need its own storage
// adapter. Disabling persistence/refresh keeps us off AsyncStorage entirely.
export const supabase = createClient(EFFECTIVE_URL, EFFECTIVE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
