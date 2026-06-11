/**
 * The linking engine — the hero feature. Extracts @-mentions from rich text,
 * diffs them against stored entity_links rows, and computes backlinks.
 *
 * Invariant: entity_links is always a pure function of the source bodies.
 * Callers re-run computeLinkChanges on every save; links are never hand-edited.
 */
import {
  MENTION_NODE,
  type RichTextNode,
  isBlock,
  nodeText,
  walk,
} from "./richtext";

export interface Mention {
  entityId: string;
  label: string;
  /** The surrounding block's text, trimmed around the mention. */
  contextSnippet: string;
}

const SNIPPET_MAX = 160;

/** Trim a block's text to a window around the mention label. */
function snippet(blockText: string, label: string): string {
  const clean = blockText.replace(/\s+/g, " ").trim();
  if (clean.length <= SNIPPET_MAX) return clean;
  const at = label ? clean.indexOf(label) : -1;
  if (at === -1) return clean.slice(0, SNIPPET_MAX - 1) + "…";
  const half = Math.floor((SNIPPET_MAX - label.length) / 2);
  const start = Math.max(0, at - half);
  const end = Math.min(clean.length, at + label.length + half);
  return (
    (start > 0 ? "…" : "") +
    clean.slice(start, end).trim() +
    (end < clean.length ? "…" : "")
  );
}

/**
 * All mentions in a rich text body. Multiple mentions of the same entity are
 * all returned (the snippet of the first is what persists on the edge).
 */
export function extractMentions(body: RichTextNode): Mention[] {
  const mentions: Mention[] = [];
  walk(body, (node, blockAncestor) => {
    if (node.type !== MENTION_NODE) return;
    const entityId = String(node.attrs?.["entityId"] ?? "");
    if (!entityId) return;
    const label = String(node.attrs?.["label"] ?? "");
    const blockText = blockAncestor ? nodeText(blockAncestor) : label;
    mentions.push({ entityId, label, contextSnippet: snippet(blockText, label) });
  });
  return mentions;
}

export type LinkSource = "entity" | "session";

export interface EntityLinkRow {
  id: string;
  campaignId: string;
  fromType: LinkSource;
  fromId: string;
  toEntityId: string;
  contextSnippet: string | null;
}

export interface LinkChanges {
  /** New edges to insert (no id — the caller assigns one). */
  inserts: Omit<EntityLinkRow, "id">[];
  /** Existing row ids to delete (mention removed from the text). */
  deleteIds: string[];
  /** Existing row ids whose snippet should be refreshed, with the new value. */
  snippetUpdates: { id: string; contextSnippet: string }[];
}

/**
 * Diff the mentions found in a body against the stored edges for that source.
 * `existing` must be exactly the rows where (fromType, fromId) match.
 */
export function computeLinkChanges(args: {
  campaignId: string;
  fromType: LinkSource;
  fromId: string;
  body: RichTextNode;
  existing: EntityLinkRow[];
}): LinkChanges {
  const { campaignId, fromType, fromId, body, existing } = args;

  // First mention per entity wins the snippet; the edge itself is unique.
  const found = new Map<string, Mention>();
  for (const m of extractMentions(body)) {
    if (m.entityId === fromId && fromType === "entity") continue; // no self-links
    if (!found.has(m.entityId)) found.set(m.entityId, m);
  }

  const inserts: LinkChanges["inserts"] = [];
  const deleteIds: string[] = [];
  const snippetUpdates: LinkChanges["snippetUpdates"] = [];

  const existingByTarget = new Map(existing.map((r) => [r.toEntityId, r]));

  for (const [entityId, mention] of found) {
    const row = existingByTarget.get(entityId);
    if (!row) {
      inserts.push({
        campaignId,
        fromType,
        fromId,
        toEntityId: entityId,
        contextSnippet: mention.contextSnippet,
      });
    } else if (row.contextSnippet !== mention.contextSnippet) {
      snippetUpdates.push({ id: row.id, contextSnippet: mention.contextSnippet });
    }
  }

  for (const row of existing) {
    if (!found.has(row.toEntityId)) deleteIds.push(row.id);
  }

  return { inserts, deleteIds, snippetUpdates };
}

export interface Backlink {
  fromType: LinkSource;
  fromId: string;
  contextSnippet: string | null;
}

/** Everything that links TO an entity, sessions first then entities, stable order. */
export function backlinksFor(
  entityId: string,
  links: EntityLinkRow[],
): Backlink[] {
  return links
    .filter((l) => l.toEntityId === entityId)
    .map(({ fromType, fromId, contextSnippet }) => ({
      fromType,
      fromId,
      contextSnippet,
    }))
    .sort(
      (a, b) =>
        a.fromType.localeCompare(b.fromType) || a.fromId.localeCompare(b.fromId),
    );
}

// ---------------------------------------------------------------------------
// Plain-text capture (voice notes, quick capture): resolve "@Name" against
// known entity names and produce mention-token text the editor can hydrate.
// ---------------------------------------------------------------------------

export interface NamedEntity {
  id: string;
  name: string;
}

export interface PlainMentionMatch {
  entityId: string;
  name: string;
  /** Index of the "@" in the input. */
  index: number;
}

/**
 * Find `@Name` references in plain text, matching against known entities,
 * longest name first so "@Varga the Smuggler" beats "@Varga".
 * Matching is case-insensitive; names may contain spaces.
 */
export function matchPlainMentions(
  text: string,
  entities: NamedEntity[],
): PlainMentionMatch[] {
  const byLength = [...entities]
    .filter((e) => e.name.trim().length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  const matches: PlainMentionMatch[] = [];
  const lower = text.toLowerCase();

  let at = lower.indexOf("@");
  while (at !== -1) {
    const after = lower.slice(at + 1);
    const hit = byLength.find((e) => {
      const name = e.name.toLowerCase();
      if (!after.startsWith(name)) return false;
      const next = after[name.length];
      // Must end at a word boundary so "@Vargas" doesn't match "Varga".
      return next === undefined || !/[\p{L}\p{N}]/u.test(next);
    });
    if (hit) {
      matches.push({ entityId: hit.id, name: hit.name, index: at });
      at = lower.indexOf("@", at + 1 + hit.name.length);
    } else {
      at = lower.indexOf("@", at + 1);
    }
  }
  return matches;
}
