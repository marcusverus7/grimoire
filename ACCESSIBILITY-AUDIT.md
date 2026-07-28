# Dynamic Type audit — apps/mobile

Audit only. No behaviour was changed by this pass; the findings below are the
work item, not a record of it.

Scope: what happens to Grimoire when a player or GM raises the system text size
(iOS Settings → Accessibility → Larger Text, up to 310%; Android Display →
Font size, up to 200%).

## Baseline: better than expected

- **1,091** hardcoded `fontSize:` values across `app/` and `components/`.
- **0** uses of `allowFontScaling={false}`. Every `Text` in the app already
  scales with the OS setting. Nothing is opted out.
- **77** hardcoded `lineHeight:` values. These were the suspected failure —
  a fixed line height under a growing font means overlapping lines. **They are
  not a problem**, verified in the pinned React Native 0.81.5 source rather
  than assumed:
  - iOS — `Libraries/Text/RCTTextAttributes.mm:139`
    `CGFloat lineHeight = _lineHeight * self.effectiveFontSizeMultiplier;`
  - Android — `ReactAndroid/.../text/TextAttributes.kt:83`
    `if (allowFontScaling) PixelUtil.toPixelFromSP(lineHeight, …)`

  Both platforms scale `lineHeight` by the same multiplier as `fontSize`, so
  hardcoded pairs like `fontSize: 17, lineHeight: 26` stay proportional.

So the app degrades gracefully in the common case: text grows, containers grow
with it, layouts reflow. The exposure is narrower than the raw 1,091 suggests.

## Where it actually breaks

### 1. Fixed-size glyph badges (real clipping)

A `View` with an explicit `width`/`height` and a `Text` centred inside. The box
cannot grow; the glyph can.

| Site | Box | Content |
| --- | --- | --- |
| `app/campaign/[id]/entity/[entityId]/edit.tsx:451` | 20 × 20 | `✎` at 12pt |
| `app/campaign/[id]/encounter.tsx:259` | 32 × 32 | initial letter |
| `app/campaign/[id]/settings.tsx:185` | height 80 | "+ Add campaign cover image" |

Fix shape: swap `width/height` for `minWidth/minHeight` + padding so the box
grows, or cap the glyph with `maxFontSizeMultiplier`.

Most of the other 118 fixed `height:` values are ornaments — legend rules
(`graph.tsx:355`), bullet dots (4–8px), avatar circles with an image — and
contain no text. They are not at risk.

### 2. Micro-labels in horizontal chips (squeeze, not clip)

**244** uses at `fontSize: 8 | 9 | 10` — the uppercase, letter-spaced labels on
status chips, kind badges and the campaign action grid. Vertically these are
fine (chips are padding-driven and grow). Horizontally, at 310% a 9pt label
with `letterSpacing: 1.5` is roughly 3.4× wider inside a `flexDirection: "row"`
that was tuned for the 100% width.

Fix shape: `maxFontSizeMultiplier={1.6}` on ornamental micro-labels. This is
deliberately *not* `allowFontScaling={false}` — the text still responds to the
setting, it just stops before it destroys the row. Reserve the cap for
decorative labels; body text, entity names, session titles and recap prose must
keep scaling all the way.

### 3. `numberOfLines={1}` truncation (14 sites)

Only 14 places truncate rather than wrap, so this is small. Worth re-checking
each at 200% — a campaign name that fits at 100% becomes an ellipsis at 200%.

### 4. Not a problem

- `maxHeight` — one instance (`tracker.tsx:483`, a 240px `ScrollView`). It
  scrolls, so growing content is handled.
- The 36 `numberOfLines` sites that allow 2+ lines.

## Suggested order of work

1. The three fixed-size glyph badges (§1) — small, definite bugs.
2. `maxFontSizeMultiplier` on the ≤10pt ornamental labels (§2) — the widest win.
3. Walk the 14 `numberOfLines={1}` sites at 200% (§3).

Verification cannot be static: after each step, run the app with iOS Larger
Text at maximum and Android font size at 200% and walk campaign detail, entity
detail, the tracker and the play view. Those four screens carry the highest
density of micro-labels in the app.
