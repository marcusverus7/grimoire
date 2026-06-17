/**
 * Full campaign export — Markdown + JSON, free forever (product principle 6:
 * ownership over lock-in). Markdown uses [[wiki-links]] so an export drops
 * straight into Obsidian, which is also the import story in reverse.
 */
import { MENTION_NODE, type RichTextNode } from "./richtext";

export interface ExportEntity {
  id: string;
  kind: string;
  name: string;
  summary?: string | null;
  body?: RichTextNode | null;
  attrs?: Record<string, unknown> | null;
  visibility: "gm_only" | "table";
}

export interface ExportSession {
  id: string;
  number: number;
  title?: string | null;
  playedOn?: string | null;
  body?: RichTextNode | null;
  status: "planned" | "in_progress" | "played";
}

export interface ExportCampaign {
  id: string;
  name: string;
  systemTag?: string | null;
  status: string;
}

export interface ExportQuote {
  id: string;
  attribution?: string | null;
  text: string;
}

export interface ExportFile {
  /** Forward-slash relative path inside the export. */
  path: string;
  content: string;
}

export interface CampaignExport {
  json: string;
  files: ExportFile[];
}

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

const escapeYaml = (s: string) =>
  `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;

function frontmatter(fields: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined || v === "") continue;
    lines.push(
      typeof v === "string" ? `${k}: ${escapeYaml(v)}` : `${k}: ${JSON.stringify(v)}`,
    );
  }
  lines.push("---");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Rich text → Markdown
// ---------------------------------------------------------------------------

function inlineToMarkdown(node: RichTextNode): string {
  if (node.type === MENTION_NODE) {
    return `[[${String(node.attrs?.["label"] ?? "")}]]`;
  }
  if (node.text != null) {
    let out = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") out = `**${out}**`;
      else if (mark.type === "italic") out = `*${out}*`;
      else if (mark.type === "code") out = `\`${out}\``;
    }
    return out;
  }
  return (node.content ?? []).map(inlineToMarkdown).join("");
}

function blockToMarkdown(node: RichTextNode): string {
  switch (node.type) {
    case "heading": {
      const level = Number(node.attrs?.["level"] ?? 2);
      return `${"#".repeat(Math.min(Math.max(level, 1), 6))} ${inlineToMarkdown(node)}`;
    }
    case "bulletList":
      return (node.content ?? [])
        .map((li) => `- ${(li.content ?? []).map(inlineToMarkdown).join(" ")}`)
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((li, i) => `${i + 1}. ${(li.content ?? []).map(inlineToMarkdown).join(" ")}`)
        .join("\n");
    case "blockquote":
      return (node.content ?? [])
        .map((b) => `> ${inlineToMarkdown(b)}`)
        .join("\n");
    case "paragraph":
    default:
      return inlineToMarkdown(node);
  }
}

export function richTextToMarkdown(body: RichTextNode | null | undefined): string {
  if (!body?.content) return "";
  return body.content
    .map(blockToMarkdown)
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Export assembly
// ---------------------------------------------------------------------------

export function exportCampaign(args: {
  campaign: ExportCampaign;
  entities: ExportEntity[];
  sessions: ExportSession[];
  quotes?: ExportQuote[];
  worldNotes?: RichTextNode | null;
  /** GM export includes gm_only records; a player export must pass false. */
  includeGmOnly?: boolean;
}): CampaignExport {
  const { campaign, includeGmOnly = true } = args;
  const entities = args.entities
    .filter((e) => includeGmOnly || e.visibility === "table")
    .map((e) => {
      if (includeGmOnly) return e;
      // Strip GM-only attrs from player exports
      if (!e.attrs) return e;
      const { gmSecret: _gs, ...rest } = e.attrs as Record<string, unknown> & { gmSecret?: unknown };
      return { ...e, attrs: Object.keys(rest).length > 0 ? rest : null };
    });
  const sessions = [...args.sessions].sort((a, b) => a.number - b.number);
  const quotes = args.quotes ?? [];
  const worldNotes = args.worldNotes ?? null;

  const files: ExportFile[] = [];

  files.push({
    path: "index.md",
    content: [
      frontmatter({
        id: campaign.id,
        name: campaign.name,
        system: campaign.systemTag ?? undefined,
        status: campaign.status,
      }),
      `# ${campaign.name}`,
      "",
      "## Sessions",
      ...sessions.map(
        (s) => `- [[${sessionFileTitle(s)}]]${s.playedOn ? ` — ${s.playedOn}` : ""}`,
      ),
      "",
      "## Entities",
      ...entities.map((e) => `- [[${e.name}]] (${e.kind})`),
      ...(quotes.length > 0 ? ["", "## Quotes", `[[quotes]]`] : []),
      ...(worldNotes ? ["", "## World Notes", `[[world-notes]]`] : []),
      "",
    ].join("\n"),
  });

  if (worldNotes) {
    files.push({
      path: "world-notes.md",
      content: [
        frontmatter({ campaign: campaign.name }),
        `# World Notes — ${campaign.name}`,
        "",
        richTextToMarkdown(worldNotes),
        "",
      ].join("\n"),
    });
  }

  if (quotes.length > 0) {
    files.push({
      path: "quotes.md",
      content: [
        `# Quotes — ${campaign.name}`,
        "",
        ...quotes.map((q) =>
          q.attribution
            ? `> "${q.text}"\n>\n> — *${q.attribution}*\n`
            : `> "${q.text}"\n`,
        ),
      ].join("\n"),
    });
  }

  // Slug collisions ("Varga" the npc and "Varga" the faction) get suffixes.
  const used = new Map<string, number>();
  const uniquePath = (dir: string, name: string): string => {
    const base = `${dir}/${slugify(name)}`;
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n === 0 ? `${base}.md` : `${base}-${n + 1}.md`;
  };

  for (const e of entities) {
    const attrLines: string[] = [];
    const a = e.attrs as Record<string, unknown> | null;
    if (typeof a?.["npcStatus"] === "string" && a["npcStatus"] !== "alive") {
      attrLines.push(`**Status:** ${a["npcStatus"]}`);
    }
    if (Array.isArray(a?.["tags"]) && (a["tags"] as string[]).length > 0) {
      attrLines.push(`**Tags:** ${(a["tags"] as string[]).join(", ")}`);
    }
    if (Array.isArray(a?.["resources"]) && (a["resources"] as { name: string; max: number; current: number }[]).length > 0) {
      attrLines.push("");
      attrLines.push("**Resources:**");
      for (const res of a["resources"] as { name: string; max: number; current: number }[]) {
        attrLines.push(`- ${res.name}: ${res.current}/${res.max}`);
      }
    }
    if (Array.isArray(a?.["customAttrs"]) && (a["customAttrs"] as { key: string; value: string }[]).length > 0) {
      attrLines.push("");
      for (const ca of a["customAttrs"] as { key: string; value: string }[]) {
        attrLines.push(`**${ca.key}:** ${ca.value}`);
      }
    }
    files.push({
      path: uniquePath(`entities/${e.kind}`, e.name),
      content: [
        frontmatter({
          id: e.id,
          kind: e.kind,
          visibility: e.visibility,
          attrs: e.attrs ?? undefined,
        }),
        `# ${e.name}`,
        ...(e.summary ? ["", `*${e.summary}*`] : []),
        "",
        richTextToMarkdown(e.body),
        ...(attrLines.length > 0 ? ["", ...attrLines] : []),
        "",
      ].join("\n"),
    });
  }

  for (const s of sessions) {
    files.push({
      path: uniquePath("sessions", sessionFileTitle(s)),
      content: [
        frontmatter({
          id: s.id,
          number: s.number,
          played_on: s.playedOn ?? undefined,
          status: s.status,
        }),
        `# ${sessionFileTitle(s)}`,
        "",
        richTextToMarkdown(s.body),
        "",
      ].join("\n"),
    });
  }

  const json = JSON.stringify(
    {
      format: "grimoire-export",
      version: 1,
      campaign,
      entities,
      sessions,
      quotes,
    },
    null,
    2,
  );

  return { json, files };
}

function sessionFileTitle(s: ExportSession): string {
  const num = `Session ${String(s.number).padStart(2, "0")}`;
  return s.title ? `${num} — ${s.title}` : num;
}
