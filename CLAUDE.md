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
- Phase 4: navigation fix (← Campaigns back button), remove Design tab, Quotes
  Board (schema + CRUD screen + campaign list count + export to quotes.md),
  campaign Notes + Next Session date (stored in settings JSON, shown on detail),
  Session Zero & Safety Tools screen (X-Card, Lines & Veils, tone, stored in
  settings JSON, accessible from Settings → Session Zero), NPC/PC quick stat
  block (HP, AC, Initiative stored in attrs, shown on entity detail + edit),
  session-scoped quote capture (session detail links to quotes with sessionId),
  export includes quotes (quotes.md), cascade delete includes quotes on campaign
  delete. Design tab hidden via href:null.
- Phase 5: Session Prep screen (aggregates last session recap + open quests +
  key entities; Begin Session sets status to in_progress), Dice Vault modal
  (d4/d6/d8/d10/d12/d20/d100 with modifier + history; accessible from campaign
  detail), NPC Combat Tracker (live HP ± controls + colour bar per combatant,
  sort by initiative, Reset All; also exposes Dice button), "Prep" shortcut on
  campaign detail countdown banner, "Mark Played" quick action on session detail,
  session status extended to planned/in_progress/played, entity kind filter pills,
  archived campaign toggle, quote display on recap-web.
- Phase 6: Lore Search (full-text across entities/sessions/quotes, real-time,
  kind badges), "Previously on…" preview card on campaign detail, World Notes
  screen (rich-text scratchpad in campaign.settings.worldNotes, @-mention aware,
  previewed on campaign detail), Entity GM Secret Notes (attrs.gmSecret,
  collapsible ⚿ panel on entity detail), Campaign stats bar (sessions played/
  total, entity count, quote count), Shared RichTextRenderer component (entity
  detail + session detail refactored to use it), Export: world-notes.md included,
  ExportSession status updated to include "in_progress", gmSecret stripped from
  player exports, recap-web extractBodyText improved (handles headings/lists/
  blockquotes), Supabase quotes migration applied. Version bumped to 1.0.0.
  Build #4 submitted to TestFlight; build #6 queued on EAS.

## What to build next (phase 6–7)

1. @-mention autocomplete (requires tentap-editor customSource HTML).
2. Backup to Supabase (cloud snapshot push).
3. Player invites & roles (Phase 7 — requires auth).
4. Character passports UI (schema exists: character_profiles).
5. Per-entity secrets & progressive reveal (schema exists: reveals table).
6. Onboarding flow for first-time users (empty state wizard).

When generating ids use UUIDs (`expo-crypto` randomUUID). Timestamps are epoch
ms integers (`timestamp_ms` mode in Drizzle).

## Conventions

- pnpm workspaces; strict TypeScript (`tsconfig.base.json` — keep
  `exactOptionalPropertyTypes` on; core already complies).
- Tests colocated under `packages/*/test`; add tests for any core change.
- No new dependencies in `packages/core` without a strong reason — it must
  stay runnable in Node, browser and React Native.
