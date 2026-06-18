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
  Build #4 (v0.1.0) submitted to TestFlight. Build #9 errored (package.json/lock
  mismatch + missing reanimated Babel plugin). Build #10 queued with fix.
- Phase 7: Tappable @-mentions in RichTextRenderer (attrs.id → entity navigate),
  Inline quotes on session detail (shows + "Add Quote" link), Share as Text on
  export screen (shares index.md via native share), Share entity as markdown
  (header button in entity detail), Quest status quick-toggle on entity detail
  (open/active/completed/failed without full edit), HP inline-edit on entity
  detail (tap HP → editable TextInput → saves to attrs), Entity kind color dots
  on campaign detail group headers, EAS build fix (reanimated Babel plugin,
  package.json aligned with pnpm-lock.yaml, expo-linear-gradient restored).
  Build #10 queued (v1.0.0, all Phase 6-7 features).
- Phase 8: Sample campaign seeder (The Sunken Throne — 8 entities, 2 sessions,
  3 quotes, full @-mention links), Character Passports tab (global list with
  class/level/race attrs, archive/restore), PC entity ↔ character passport
  linking (radio picker in edit, badge in detail), Lore search per-kind entity
  badge, EAS build fix (downgrade tentap-editor 1.0.1 → 0.4.58 — 0.4.x uses
  WebView, same API, no worklets dep; pin react-native-worklets@0.8.3 to stay
  in reanimated 4.1.7's accepted range 0.5–0.8). Build #13 queued (quota
  exhausted until Jul 1 2026).
- Phase 9: app_kv SQLite table + getKv/setKv helpers; OnboardingModal (3-step
  carousel, shown once via kv flag, CTAs branch to new campaign or sample);
  Reveal to Table on gm_only entity detail (Alert confirm → sets visibility to
  table + logs reveals row); Recently Revealed section on campaign detail;
  Character Passport detail screen (class/race/level, linked campaigns, journal
  list); Character edit screen (dedicated route + delete); Journal entry create
  (rich-text) + view + delete; character list taps navigate to detail; entity
  sort toggles (Name/Recent/Kind) on campaign detail; seedSampleCampaign guard
  against double-seeding; First Steps checklist on empty campaign. Build #14
  queued (see below).
- Phase 10: Quick-add entity modal (kind picker + name → navigate to edit);
  Campaign rename + duplicate (long-press menu; duplicate deep-copies entities/
  sessions/quotes with @-mention ID remapping); Session duration timer (Start/
  End buttons via session.attrs.startedAt/endedAt; ALTER TABLE migration for
  sessions.attrs); Campaign detail polish: GM-Only entity filter, total play time
  in stats bar, session durations in list, Begin Session auto-starts timer;
  Entity pinning (long-press → pin/unpin; pinned sort to top with ★); Session
  Share button (markdown body + quotes via native share); Fix delete cascade
  (reveals, recapEvents, recaps now correctly deleted before entities/sessions);
  Prep screen Session Goals field (auto-saves to attrs.prepGoals on blur);
  About button in Campaigns tab header; version bumped to 1.1.0.
  Build #14 ready to queue Jul 1 2026.
- Phase 11: Per-character quest interest tracking (interestedEntityIds in quest
  attrs, chip picker in edit, pill row in detail + quest board); Quest board
  "+ New" button + richer cards with character chips; Prev/next session navigation
  on session detail (replace() to avoid stack growth); Session Zero Today button
  on played-on date; NPC/PC faction membership (factionId attr, chip picker,
  badge on detail); item holder tracking (heldBy attr, held-by banner, PC/NPC
  inventory section); NPC role/title field for NPC/PC/faction/custom entities;
  Random NPC name generator (⚄ Gen button, 35 given + 25 family names);
  "⚑ Needs Prep" flag on entity detail (header button, cleared on Begin Session);
  Flagged entities section on Session Prep screen; existingAttrs preservation on
  entity edit (base attrs on load to keep pinned etc.); Faction relationship
  tracker (ally/enemy/rival/neutral, chip list with Alert type picker); PC level
  + XP tracking (Level/XP/Max XP fields, XP progress bar on detail, level badge
  on campaign list); Conditions in combat tracker (16 D&D conditions, per-
  combatant chip picker, persist in attrs.conditions); Random tables screen
  (per-campaign d-tables stored in app_kv, create/edit/roll); Current/Max HP
  display on entity detail when tracker has modified HP; Party overview screen
  (all PCs with level, HP bar, XP bar, conditions, inventory); Session Wrap Up
  screen (end-of-session HP + XP + quest progress capture, marks session played);
  Location hierarchy (parentId in attrs, parent picker in edit, breadcrumb +
  sub-locations on detail). Version bumped to 1.2.0. Build #14 queue Jul 1 2026.

- Phase 12: Entity tags (freeform pill tags, tag filter on campaign list); Enhanced
  relationship map (faction-rel edges + NPC membership edges + mode filter:
  All/Mentions/Factions); Lore search extended (tag, GM secret, custom attr value
  matching); In-play bar on campaign detail when session in_progress (links to
  Tracker/Tables/Party/Dice); Export renders tags + customAttrs in entity markdown;
  Session prep Party Status section (PC HP + conditions); NPC Generator screen
  (random name/role/hook/secret, one-tap save). Version bumped to 1.3.0.
  Build #14 queue Jul 1 2026.

- Phase 13: Scene notepad per session (app_kv, Notes button in In-Play bar + session
  detail); Location entity assignment (attrs.locationId for NPC/PC/item, shown in
  location tree as resident chips + tappable badge on entity detail); Timeline
  enriched with entity mention chips per session + total play time; Scene notes
  exported to scene-notes/ dir in file export + appended to text share; Entity
  quick session note (amber banner via ✎ header button, stored in attrs.sessionNote);
  Recap link sharing from session detail (Share ↗ button alongside Create/Edit Recap);
  Round counter in combat tracker (persists via app_kv, resets with HP reset);
  In-app recap library (/recaps) with accordion view, share link, edit + delete.
  Version bumped to 1.4.0. Build #14 queue Jul 1 2026.

- Phase 14: Resource tracker (attrs.resources[] on PC/NPC — add/remove/adjust via ±
  buttons + modal, Long Rest resets all; shown in party overview + prep screen);
  NPC/PC quick-status badge (attrs.npcStatus: alive/dead/missing — tappable cycle on
  entity detail, dead/missing badges in campaign list + party overview);
  Export includes npcStatus + resources in entity markdown (core tests green);
  Play View dashboard (/playview, "Dash" in In-Play bar) — single in-session screen:
  round counter (synced with tracker), scene note quick-add (last 5, long-press delete),
  party HP bars + resources + conditions, dead/missing list, active quests.
  Version bumped to 1.5.0. Build #14 queue Jul 1 2026.

- Phase 15: Session wrap-up resource reset prompt (toggleable chips per PC resource, all
  checked by default for long rest, confirmation shows what will restore); Lore search
  npcStatus filter pills (Dead / Missing — browse all dead or missing characters without
  needing a text query, optionally narrowed by search term). Build pipeline fixed: symlink
  babel-preset-expo into apps/mobile/node_modules after pnpm install so Metro jest-worker
  processes find it; expo prebuild --no-install to skip redundant package manager run.
  Build #15 queued (GH Actions run 13 → TestFlight).

- Phase 16: Applied TestFlight tester feedback — navigation fix (‹ Campaigns back button now uses
  router.back() / router.replace instead of push("/") which was stacking screens); relationship map
  nodes made tappable via G wrapper (circle + label both trigger entity navigate); session detail
  empty state adds "Add Notes" + "Session Prep" CTA prompts when body is null; export success card
  now shows entity/session/quote counts alongside file count; entity detail backlinks panel moved
  above GM Secret, split into "Appears in Sessions" (gold, tappable) and "Linked Entities" sections
  for clearer connection surfacing. Version bumped to 1.6.0.

## What to build next (phase 17)

1. @-mention autocomplete (requires tentap-editor customSource HTML — deferred
   until tentap-editor 1.x is worklets-compatible with Expo 55+).
2. Backup to Supabase (cloud snapshot push — needs auth).
3. Player invites & roles (needs auth).

When generating ids use UUIDs (`expo-crypto` randomUUID). Timestamps are epoch
ms integers (`timestamp_ms` mode in Drizzle).

## Conventions

- pnpm workspaces; strict TypeScript (`tsconfig.base.json` — keep
  `exactOptionalPropertyTypes` on; core already complies).
- Tests colocated under `packages/*/test`; add tests for any core change.
- No new dependencies in `packages/core` without a strong reason — it must
  stay runnable in Node, browser and React Native.
