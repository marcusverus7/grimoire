// IMPORTANT: the URL polyfill MUST be imported before @supabase/supabase-js.
// React Native's Hermes engine ships an incomplete WHATWG `URL`, and supabase-js
// (via realtime-js) constructs a `URL` at createClient() time. Without this
// polyfill that throws at module load → the app crashes on startup. (Was the
// cause of the "Crashed on start" TestFlight report on builds 5–7.)
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ghjkfwhrzxrjihpjrrxo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uhBYZVDtkIspMKWaAT0h8Q_Z5XNzE5L";

// The app persists the session itself in SQLite (see auth-context loadSession /
// setKv("supabase_session")), so supabase-js doesn't need its own storage
// adapter. Disabling persistence/refresh keeps us off AsyncStorage entirely.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
