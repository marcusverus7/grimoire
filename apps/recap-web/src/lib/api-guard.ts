/**
 * Lightweight protection for the public `generate-recap` endpoint, which spends
 * real Anthropic credits on every call. Three layers, no external infra:
 *
 *  1. Shared app token — the mobile app sends `x-grimoire-app-token`; the server
 *     checks it against GRIMOIRE_APP_TOKEN. A token baked into a shipped binary
 *     is not a true secret, so this only raises the bar against casual/bot abuse;
 *     the real spend caps are (2) and (3).
 *  2. Payload caps — bound the input size so a single request can't blow up the
 *     prompt (and the bill). Output is already capped by max_tokens.
 *  3. Best-effort per-IP rate limit — in-memory sliding window. On serverless
 *     this is per-instance, not global, so it's a speed bump rather than a wall;
 *     upgrade to Upstash/Vercel KV if this endpoint ever needs a hard guarantee.
 *
 * Rollout is safe: if GRIMOIRE_APP_TOKEN is unset on the server, the token check
 * is skipped (so deploying this before configuring the secret doesn't break the
 * live app) while the size and rate limits still apply.
 */

export const MAX_NOTES_CHARS = 20_000;
export const MAX_BEATS = 40;
export const MAX_CHARACTER_NAMES = 40;

const RATE_LIMIT_MAX = 10; // requests…
const RATE_LIMIT_WINDOW_MS = 60_000; // …per minute per IP

// Per-instance sliding window. Cleared when the serverless instance recycles.
const hits = new Map<string, number[]>();

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** Constant-time-ish string compare to avoid trivial timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface GuardFailure {
  status: number;
  error: string;
}

/** Returns a failure to short-circuit on, or null if the request may proceed. */
export function guardRecapRequest(headers: Headers): GuardFailure | null {
  // 1. App token (skipped only when the server hasn't configured one yet).
  const expected = process.env.GRIMOIRE_APP_TOKEN;
  if (expected) {
    const provided = headers.get("x-grimoire-app-token") ?? "";
    if (!safeEqual(provided, expected)) {
      return { status: 401, error: "Unauthorized" };
    }
  }

  // 3. Rate limit (2 is enforced in the route once the body is parsed).
  const ip = clientIp(headers);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    return { status: 429, error: "Too many requests. Please wait a moment and try again." };
  }
  recent.push(now);
  hits.set(ip, recent);

  return null;
}

/** Reject oversized inputs that would inflate the prompt (and the bill). */
export function checkPayloadSize(input: {
  sessionNotesMarkdown?: string;
  beats?: unknown[];
  characterNames?: unknown[];
}): GuardFailure | null {
  if ((input.sessionNotesMarkdown?.length ?? 0) > MAX_NOTES_CHARS) {
    return { status: 413, error: "Session notes are too long for AI recap generation." };
  }
  if ((input.beats?.length ?? 0) > MAX_BEATS) {
    return { status: 413, error: "Too many beats." };
  }
  if ((input.characterNames?.length ?? 0) > MAX_CHARACTER_NAMES) {
    return { status: 413, error: "Too many characters." };
  }
  return null;
}
