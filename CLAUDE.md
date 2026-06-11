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
  consuming `@grimoire/core`. 10 routes: tab layout (campaigns list, design
  showcase), campaign detail (entity list by kind, session list), entity
  create/edit/detail (with backlinks panel), session create/edit.
- `apps/recap-web` — Next.js skeleton with `/r/[slug]` recap route stub.

## Commands

- `pnpm test` — run all tests (vitest)
- `pnpm typecheck` — strict TS across workspace
- `pnpm db:generate` — regenerate SQL migration after schema changes

## Completed

- Phase 0: mobile scaffold, design system (/design), recap-web skeleton
- Phase 1: campaign detail, entity CRUD (all 7 kinds, quest attrs, visibility),
  session CRUD, entity detail with backlinks panel

## What to build next (phase 2)

1. Rich-text editor for entity bodies (TipTap/ProseMirror): on every save,
   call `computeLinkChanges` and apply inserts/deletes/snippet updates in one
   transaction. @-mention autocomplete against campaign entities. This is the
   hero feature — gate: "following links feels faster than remembering".
2. Session body editor (same rich-text editor, beat-marking for recap pipeline).
3. Recap flow: extract beats, build manual recap doc, share via recap-web.
4. Relationship graph visualization (entity detail → "see on map" action).
5. Campaign export (Markdown + JSON download).

When generating ids use UUIDs (`expo-crypto` randomUUID). Timestamps are epoch
ms integers (`timestamp_ms` mode in Drizzle).

## Conventions

- pnpm workspaces; strict TypeScript (`tsconfig.base.json` — keep
  `exactOptionalPropertyTypes` on; core already complies).
- Tests colocated under `packages/*/test`; add tests for any core change.
- No new dependencies in `packages/core` without a strong reason — it must
  stay runnable in Node, browser and React Native.
