# Grimoire — campaign memory system for tabletop RPGs

Monorepo for Grimoire (working title, trademark search pending). The strategic
plan is `Grimoire_Strategic_Plan_v2.pdf` in the founder's Downloads folder —
read Part IV (build plan) before starting any phase.

## Doctrine (do not violate in any code you write)

- **Campaigns belong to the group, not the GM.** No `owner_id` on campaigns;
  ownership lives in `memberships`, the GM seat is a transferable role.
- **Characters belong to players, not campaigns.** `character_profiles` (the
  passport) is user-owned and campaign-independent.
- **`entity_links` is derived data.** It is always recomputed from body text
  via `computeLinkChanges` on save — never hand-inserted or hand-edited.
- **Export is free forever.** Never gate `exportCampaign` behind the paid tier.
- **Functional screens are simpler than showcase screens.** Ceremony on
  reading/sharing surfaces (recaps, entity pages, graph); plainness on capture.

## Layout

- `packages/core` — **done, tested (50 tests), do not redesign.** Framework-free
  TypeScript: Drizzle SQLite schema (`src/schema.ts`, migration already
  generated in `migrations/`), rich-text model, @-mention linking engine,
  permissions/visibility/succession, relationship-graph derivation, Markdown+
  JSON export, recap pipeline + AI recap prompt builders.
- `apps/mobile` — NOT YET CREATED. Expo (React Native) + Expo Router +
  TypeScript + NativeWind + expo-sqlite + Drizzle, consuming `@grimoire/core`.
- `apps/recap-web` — NOT YET CREATED. Minimal Next.js on Vercel rendering
  recap JSON at `/r/[slug]`, logging `recap_events` (open/share/return).

## Commands

- `pnpm test` — run all tests (vitest)
- `pnpm typecheck` — strict TS across workspace
- `pnpm db:generate` — regenerate SQL migration after schema changes

## What to build next (phase 0–1, fine on a smaller model)

1. Scaffold `apps/mobile` with Expo Router (iOS/Android/web), NativeWind,
   expo-sqlite + Drizzle wired to `@grimoire/core`'s schema and migration.
   Apply migrations on app start.
2. Design tokens from the plan: leather `#1A1410` chrome, parchment `#ECE3CF`
   surfaces, gold `#A07A2C`, oxblood `#7A2418` single accent; Cinzel Decorative
   titles only, Cormorant Garamond body, Inter for form labels. Build a
   `/design` screen showing palette + type + the wax-seal component ("G").
3. Campaign create + entity CRUD screens (all kinds, kind-specific attrs,
   visibility flag). Use `canEditEntity`/`canViewEntity` from core for every
   read/write path — no ad-hoc permission checks.
4. Editor: on every body save, call `computeLinkChanges` and apply
   inserts/deletes/snippet updates in one transaction. Backlinks panel via
   `backlinksFor`. This is the hero feature — phase 2's gate is "following
   links feels faster than remembering".
5. Scaffold `apps/recap-web` (Next.js hello-world on Vercel).

When generating ids use UUIDs (`expo-crypto` randomUUID). Timestamps are epoch
ms integers (`timestamp_ms` mode in Drizzle).

## Conventions

- pnpm workspaces; strict TypeScript (`tsconfig.base.json` — keep
  `exactOptionalPropertyTypes` on; core already complies).
- Tests colocated under `packages/*/test`; add tests for any core change.
- No new dependencies in `packages/core` without a strong reason — it must
  stay runnable in Node, browser and React Native.
