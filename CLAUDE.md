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
- `apps/mobile` — Expo 54 + Expo Router + NativeWind v4 + expo-sqlite + Drizzle,
  consuming `@grimoire/core`. Routes: tab layout (campaigns list, design
  showcase), campaign detail (entity list by kind, session list, quests,
  timeline), entity create/edit/detail (with backlinks, rich-text body),
  session create/edit/detail (rich-text body, recap creation), campaign
  export, graph, settings.
- `apps/recap-web` — Next.js on Vercel at `grimoire-recap-web.vercel.app`.
  `/r/[slug]` renders recaps from Supabase with social card meta tags.
  `/r/demo` serves a hardcoded demo recap.

## Commands

- `pnpm test` — run all tests (vitest)
- `pnpm typecheck` — strict TS across workspace
- `pnpm db:generate` — regenerate SQL migration after schema changes

## Completed

- Phase 0: mobile scaffold, design system (/design), recap-web skeleton
- Phase 1: campaign detail, entity CRUD (all 7 kinds, quest attrs, visibility),
  session CRUD, entity detail with backlinks panel
- Phase 2: rich-text editor (TipTap via tentap-editor) for entity + session
  bodies with computeLinkChanges on save, relationship graph, campaign export
  (Markdown + JSON), security audit + RLS on all Supabase tables
- Phase 3: recap creation screen (beat selection, tone picker, share slug),
  open-quests view, campaign timeline, social card meta tags on recap-web

## What to build next (phase 4–5)

1. MVP polish: onboarding flow, empty states, performance.
2. Founders run 4 weeks of own game (Path-A test).
3. @-mention autocomplete (requires tentap-editor customSource HTML).
4. Backup to Supabase (cloud snapshot push).
5. Session scheduling card (date + RSVP stub).

When generating ids use UUIDs (`expo-crypto` randomUUID). Timestamps are epoch
ms integers (`timestamp_ms` mode in Drizzle).

## Conventions

- pnpm workspaces; strict TypeScript (`tsconfig.base.json` — keep
  `exactOptionalPropertyTypes` on; core already complies).
- Tests colocated under `packages/*/test`; add tests for any core change.
- No new dependencies in `packages/core` without a strong reason — it must
  stay runnable in Node, browser and React Native.
