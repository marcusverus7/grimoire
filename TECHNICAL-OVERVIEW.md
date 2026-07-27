# Grimoire — Technical Overview & Engineering Case Study

> A cross-platform campaign-memory system for tabletop RPGs, and a worked
> example of product/security auditing on a live codebase. This document
> describes the system architecture, the technology choices behind it, the
> AI/LLM integration, and a real audit performed on it — including a finding
> that corrected a mistaken assumption using primary evidence.

---

## 1. Executive summary

**Grimoire** is a monorepo application that lets a tabletop-RPG group capture
their campaign as they play — NPCs, factions, locations, quests, sessions,
quotes — link it together automatically, generate AI "Previously on…" recaps,
and share those recaps on the web. It ships to **iOS, Android, and web from one
codebase**, with a strict doctrine that every feature reaches all three
platforms in the same change.

The project spans three deployable surfaces, a framework-free domain core with a
full test suite, an LLM integration for recap generation, and a self-hosted
build/release pipeline to TestFlight. This document doubles as an audit
case study: the latter half walks through a structured review that surfaced a
broken data-ownership guarantee, an unauthenticated LLM endpoint, a silent
authentication failure mode, and a **misdiagnosed native crash** — the last
resolved by pulling and reading primary crash-log evidence rather than trusting
the existing assumption.

---

## 2. System overview

| Surface | Purpose | Runtime |
|---|---|---|
| `packages/core` | Framework-free domain logic (schema, linking, permissions, export, recap prompts, entitlements) | Pure TypeScript — runs in Node, browser, and React Native |
| `apps/mobile` | The app GMs use | Expo / React Native, on-device SQLite |
| `apps/recap-web` | Public recap viewer + AI recap API + marketing page | Next.js on Vercel |

**Design principles enforced in code:**
- **Platform parity** — a feature must work identically on iOS, Android, and web
  in the same change; partial coverage is flagged, never shipped silently.
- **Ownership over lock-in** — full Markdown + JSON export is free forever and is
  never gated behind payment.
- **Group ownership** — campaigns belong to the play group (membership rows),
  not to a single "owner" account; the GM seat is a transferable role.
- **Derived data stays derived** — the entity-relationship graph is always
  recomputed from body text on save, never hand-edited.

---

## 3. Architecture

### 3.1 Monorepo layout

```
grimoire/
├─ packages/core/        # domain logic, no framework deps — the source of truth
│  ├─ src/
│  │  ├─ schema.ts         # Drizzle SQLite schema (single schema, all surfaces)
│  │  ├─ linking.ts        # @-mention → entity-link derivation engine
│  │  ├─ permissions.ts    # GM-only vs table visibility, reveal, succession
│  │  ├─ graph.ts          # relationship-graph derivation
│  │  ├─ export.ts         # Markdown + JSON campaign export
│  │  ├─ campaignData.ts   # single manifest of all app_kv data namespaces
│  │  ├─ entitlements.ts   # capability gating (dark-launched)
│  │  ├─ keepsake.ts       # print-ready keepsake-book HTML builder
│  │  └─ recap.ts          # AI recap prompt construction
│  └─ test/                # vitest — 65 tests
├─ apps/mobile/          # Expo Router app consuming @grimoire/core
└─ apps/recap-web/       # Next.js app consuming @grimoire/core
```

The key architectural decision is a **framework-free core**. All domain logic —
the data schema, the linking engine, permissions, export, and the LLM prompt
builders — lives in `packages/core` as pure TypeScript with no React, no
Expo, no Next. That gives one testable source of truth that the mobile app, the
web app, and the test runner all consume identically. It is the reason platform
parity is achievable: the hard logic exists once.

### 3.2 Data model

- **Persistence:** SQLite via **Drizzle ORM**. On mobile the database is local
  (`expo-sqlite`); the same Drizzle schema definition is used to generate the
  migration and drives both mobile and the (Supabase/Postgres) server mirror.
- **Two storage tiers on the client:**
  1. *Relational tables* (campaigns, entities, sessions, quotes, memberships…)
     for the core domain objects.
  2. *A key/value table* (`app_kv`) for the long tail of GM-utility features
     (clues, clocks, party bonds, timelines, loot, calendars, injuries, …),
     each stored as a JSON blob under a namespaced key like `clues_<campaignId>`.
- **IDs** are UUIDs (`expo-crypto`); **timestamps** are epoch-ms integers.

### 3.3 The @-mention linking engine

When a GM writes an entity or session note and @-mentions another entity, the
core `computeLinkChanges` routine derives the relationship edges from the body
text on every save. Links are **never** hand-inserted — they are a pure function
of content, which keeps the relationship graph consistent and makes the
Obsidian-style `[[wiki-link]]` export fall out for free.

---

## 4. Technology stack

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript (strict, `exactOptionalPropertyTypes`) | One language across all three surfaces |
| Monorepo | pnpm workspaces | `@grimoire/core` consumed by both apps |
| Mobile | Expo SDK 54, Expo Router, React Native | File-based routing, ~60 route files |
| Styling | NativeWind v4 (Tailwind for RN) + design tokens | Parchment/oxblood house style |
| DB (client) | expo-sqlite + Drizzle ORM | Local-first; migrations generated from schema |
| Web | Next.js 15 (App Router) on Vercel | SSR recap pages with social-card meta |
| Auth / cloud | Supabase (Postgres + Auth) | Email/password; RLS on all tables |
| AI | Anthropic Claude (Haiku) via `@anthropic-ai/sdk` | Recap generation, server-side |
| Testing | vitest | 65 unit tests on the domain core |
| CI/CD | GitHub Actions → `eas build --local` → TestFlight | Self-hosted signing pipeline |

---

## 5. AI / LLM integration  *(most relevant to AI-audit work)*

### 5.1 What the model does

Grimoire generates a narrative "Previously on…" recap of a play session. The
flow:

1. The mobile app assembles a typed `AiRecapInput` — campaign name, session
   number/title, tone, the session's notes as Markdown, selected story beats,
   and the party's character names.
2. `packages/core/recap.ts` (`buildAiRecapPrompt`) turns that input into a
   **structured system + user prompt**. Prompt construction lives in the shared,
   unit-tested core — not scattered in UI code — so the prompt is versionable and
   testable.
3. The web API route calls **Claude Haiku** (`claude-haiku-4-5`) with a bounded
   `max_tokens`, extracts the text, and returns it.
4. The client shows the generated text in an **editable field before saving** —
   the human stays in the loop; the model drafts, the GM approves.
5. If the API is unavailable, the app **falls back to a manual recap** rather
   than failing — graceful degradation around a non-deterministic dependency.

### 5.2 Controls around the model (cost, abuse, safety)

The recap endpoint is a public URL that spends real API credits on every call —
exactly the kind of surface an AI auditor scrutinises. The hardening applied:

- **Authentication** — a shared app-token header (`x-grimoire-app-token`) checked
  in constant time.
- **Rate limiting** — a per-IP sliding-window limiter. *(Documented honestly: on
  serverless this is per-instance, so it is a speed bump, not a hard global
  guarantee — the notes point to Upstash/Vercel KV for a true limit. Stating a
  control's actual strength is itself an audit discipline.)*
- **Input bounding** — payload-size caps on the notes, beat count, and character
  count, which directly bound the prompt size and therefore the token spend.
- **Output bounding** — `max_tokens` caps the response.
- **Safe rollout** — if the server token isn't configured yet, the token check
  is skipped while size + rate limits still apply, so deploying the hardening
  can't brick the live app before the secret is set.

### 5.3 Human-in-the-loop & provenance

Generated recaps are labelled as AI output in the UI ("✦ AI recap" badge), are
editable before persistence, and never auto-publish. This is a deliberate
provenance/oversight stance: the model's output is a draft attributed as such,
not an authoritative record.

---

## 6. Engineering practices

- **Strict typing end to end.** `exactOptionalPropertyTypes` is on; the core
  compiles under strict TS and the apps typecheck against it.
- **Tests live with the logic they cover.** The domain core carries 65 vitest
  unit tests (linking, permissions, graph, export, recap prompts, entitlements,
  keepsake). New core behaviour ships with tests; the review below added 15.
- **Single-source-of-truth refactors.** When two bugs shared a root cause
  (export and delete both ignored the same data), the fix was one manifest both
  consume — not two parallel patches.
- **Dark-launching.** Monetization and cloud-sync scaffolding are gated behind
  compile-time flags (`MONETIZATION_ENABLED`, `SYNC_ENABLED`) defaulting to the
  current behaviour, so the paywall/sync become a config flip, not a refactor.
- **Value-preserving mechanical refactors.** A design-token migration replaced
  raw hex literals with named tokens whose values are byte-identical to what was
  rendered before, so a large cleanup carries zero visual risk — and the one
  imprecise alpha conversion was caught and corrected.

---

## 7. Audit case study  *(methodology an AI auditor uses)*

A structured review was run across six dimensions — design, layout, features,
logic, security, and monetization — gathering evidence from the codebase before
writing conclusions. Representative findings and their resolutions:

### 7.1 Broken data-ownership guarantee (correctness)
**Finding:** the app promised "your data is always yours," but `export.ts`
exported nothing from the `app_kv` table — ~13 GM-tool feature areas (clues,
clocks, bonds, timelines, loot, …) were silently omitted. The *same* omission
meant campaign deletion orphaned those rows forever.
**Root cause:** no single registry of "what data belongs to a campaign."
**Fix:** a `campaignData.ts` manifest that both export and delete consume — one
architectural change closing two bugs. Covered by new tests.

### 7.2 Unauthenticated LLM endpoint (security / cost)
**Finding:** `/api/generate-recap` had no auth, no rate limiting, and no input
bounds — anyone could POST and burn Anthropic credits.
**Fix:** the layered controls in §5.2.

### 7.3 Silent authentication failure (logic / security)
**Finding:** sign-in/sign-up caught *any* Supabase error and fabricated a local
"demo" session — so a **wrong password silently succeeded** into an empty
account, masking real auth failures.
**Fix:** propagate the error and fail loudly; keep an explicit, clearly-labelled
guest mode for offline/testing.

### 7.4 Information architecture (product)
**Finding:** 44 screens hung off one campaign behind a flat ~32-button grid; the
core loop (capture → link → recap → share) was buried under GM-utility sprawl.
**Fix:** promoted the core loop to a always-visible row and collapsed 24
utilities into a "GM Toolbox" — no features removed, hierarchy restored.

### 7.5 Misdiagnosed native crash  *(evidence over assumption — core audit skill)*
**Context:** a tester's launch crash was assumed to be a known JavaScript URL-
polyfill bug, "fixed in build 9."
**Method:** rather than trust that, I extended the App Store Connect feedback
tool to pull the actual crash log via the `crashLog` relationship
(`attributes.logText`), then read the symbolicated stack.
**Finding:** builds 7 and 9 crash with the **identical native signature** — an
uncaught Objective-C exception thrown from a React Native TurboModule *void*
method on a background queue at launch (`SIGABRT`). That is a **native** failure,
not the JS polyfill bug — so **build 9 did not fix the crash**, contradicting the
standing assumption.
**Discipline shown:** I did *not* overclaim a root cause the evidence couldn't
support — the log captured no exception reason and app frames were
unsymbolicated, so the writeup names the exact next step (symbolicate against the
build dSYM) rather than guessing. Documented in `crashlogs/DIAGNOSIS.md`.

### 7.6 Brand/trademark clearance (diligence)
A preliminary name search found the bare name heavily crowded in the exact niche
(multiple live competitors and App Store apps share it), while the fuller brand
was more defensible — with an explicit caveat that this is preliminary and formal
USPTO/App Store clearance is required before a public listing. Findings recorded,
not acted on unilaterally.

---

## 8. Skills demonstrated (mapped to AI-audit competencies)

| Competency | Evidence in this project |
|---|---|
| **LLM integration** | Structured, testable prompt construction; model call with bounded I/O; graceful fallback; human-in-the-loop review before persistence |
| **AI cost & abuse control** | Auth, rate limiting, input/output bounding on a credit-spending endpoint; honest statement of each control's real strength |
| **Evidence-based verification** | Pulled and read primary crash-log data to overturn a wrong assumption instead of trusting it |
| **Not overclaiming** | Explicitly scoped what the crash log could and couldn't prove; named the next diagnostic step |
| **Security review** | Found open API, silent auth failure, orphaned data; remediated with safe rollouts |
| **Systems thinking** | Single-source-of-truth manifest closing two bugs; framework-free core enabling parity |
| **Full-stack breadth** | TypeScript monorepo across React Native, Next.js, SQLite/Drizzle, Supabase, GitHub Actions CI/CD |
| **Testing rigor** | 65 unit tests on domain logic; new behaviour ships with tests |
| **Judgement under monetization pressure** | Kept export/players free as invariants even while adding paid-tier scaffolding |

---

## 9. Metrics at a glance

- **3** deployable surfaces from **1** codebase (iOS, Android, web)
- **~60** mobile route files; **44** campaign screens reorganised into a core
  loop + collapsed toolbox
- **65** passing unit tests on the framework-free domain core
- **1** LLM integration (Claude Haiku) with full cost/abuse controls
- **6**-dimension structured audit; findings remediated with tests and safe
  rollouts
- Self-hosted **GitHub Actions → EAS local build → TestFlight** release pipeline

---

*Prepared as a technical overview of the Grimoire codebase and a review performed
on it. All architecture, stack, and audit details reflect the actual state of the
repository.*
