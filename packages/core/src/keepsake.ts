/**
 * Keepsake book — the paid campaign artifact (strategic plan Part II, engine 2).
 *
 * When a campaign ends, a GM can turn it into a printable keepsake: a PDF
 * (£19.99) or a print-on-demand hardcover (£49.99). This module builds the
 * print-ready document (self-contained HTML with inline CSS, in the parchment
 * house style) from the same data the free export uses. The app renders it to
 * PDF (expo-print / browser print) or hands the HTML to a POD service.
 *
 * Monetization boundary: this builder is pure and unguarded. The *purchase* is
 * gated in the app (a one-time IAP), NOT here — and it stays entirely separate
 * from `exportCampaign`, which is free forever (doctrine, principle 4). Building
 * a keepsake never touches the export path, so free export can never regress.
 */

import { MENTION_NODE, type RichTextNode } from "./richtext";
import type { ExportEntity, ExportSession, ExportQuote } from "./export";

/** Retail products, for reference by the app's purchase flow. */
export const KEEPSAKE_PRODUCTS = {
  pdf: { id: "keepsake_pdf", label: "Keepsake PDF", priceGBP: 19.99 },
  hardcover: { id: "keepsake_hardcover", label: "Keepsake Hardcover", priceGBP: 49.99 },
} as const;

export interface KeepsakeBook {
  title: string;
  /** Self-contained HTML document (inline CSS), ready for print-to-PDF or POD. */
  html: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- Rich text → HTML (book styling) -------------------------------------

function inlineToHtml(node: RichTextNode): string {
  if (node.type === MENTION_NODE) {
    return `<span class="mention">${esc(String(node.attrs?.["label"] ?? ""))}</span>`;
  }
  if (node.text != null) {
    let out = esc(node.text);
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") out = `<strong>${out}</strong>`;
      else if (mark.type === "italic") out = `<em>${out}</em>`;
      else if (mark.type === "code") out = `<code>${out}</code>`;
    }
    return out;
  }
  return (node.content ?? []).map(inlineToHtml).join("");
}

function blockToHtml(node: RichTextNode): string {
  switch (node.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.["level"] ?? 2), 1), 6);
      return `<h${level}>${inlineToHtml(node)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${(node.content ?? [])
        .map((li) => `<li>${(li.content ?? []).map(inlineToHtml).join(" ")}</li>`)
        .join("")}</ul>`;
    case "orderedList":
      return `<ol>${(node.content ?? [])
        .map((li) => `<li>${(li.content ?? []).map(inlineToHtml).join(" ")}</li>`)
        .join("")}</ol>`;
    case "blockquote":
      return `<blockquote>${(node.content ?? []).map(inlineToHtml).join(" ")}</blockquote>`;
    case "paragraph":
    default: {
      const inner = inlineToHtml(node);
      return inner.trim() ? `<p>${inner}</p>` : "";
    }
  }
}

function richTextToHtml(body: RichTextNode | null | undefined): string {
  if (!body?.content) return "";
  return body.content.map(blockToHtml).filter(Boolean).join("\n");
}

function sessionTitle(s: ExportSession): string {
  const num = `Session ${s.number}`;
  return s.title ? `${num}: ${s.title}` : num;
}

// --- Book assembly --------------------------------------------------------

export interface KeepsakeInput {
  campaign: { id: string; name: string; systemTag?: string | null; status: string };
  entities: ExportEntity[];
  sessions: ExportSession[];
  quotes?: ExportQuote[];
  /** Subtitle / dedication line on the cover. */
  dedication?: string;
}

export function buildKeepsakeBook(input: KeepsakeInput): KeepsakeBook {
  const { campaign } = input;
  // Only the story that was actually played belongs in the keepsake.
  const sessions = [...input.sessions]
    .filter((s) => s.status === "played")
    .sort((a, b) => a.number - b.number);
  const quotes = input.quotes ?? [];

  const pcs = input.entities.filter((e) => e.kind === "pc");
  const keyNpcs = input.entities.filter((e) => e.kind === "npc").slice(0, 24);

  const personae = (label: string, list: ExportEntity[]): string =>
    list.length === 0
      ? ""
      : `<h3>${esc(label)}</h3>` +
        list
          .map(
            (e) =>
              `<p class="persona"><span class="persona-name">${esc(e.name)}</span>` +
              (e.summary ? ` — ${esc(e.summary)}` : "") +
              `</p>`,
          )
          .join("");

  const chapters = sessions
    .map((s) => {
      const bodyHtml = richTextToHtml(s.body) || `<p class="empty">No notes recorded for this session.</p>`;
      const date = s.playedOn ? `<p class="chapter-date">${esc(s.playedOn)}</p>` : "";
      return `<section class="chapter"><h2>${esc(sessionTitle(s))}</h2>${date}${bodyHtml}</section>`;
    })
    .join("\n");

  const quotesHtml =
    quotes.length === 0
      ? ""
      : `<section class="chapter quotes"><h2>Heard at the Table</h2>` +
        quotes
          .map(
            (q) =>
              `<blockquote class="table-quote">&ldquo;${esc(q.text)}&rdquo;` +
              (q.attribution ? `<cite>— ${esc(q.attribution)}</cite>` : "") +
              `</blockquote>`,
          )
          .join("") +
        `</section>`;

  const title = `${campaign.name} — A Grimoire Keepsake`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  @page { margin: 22mm 18mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #2C2014; background: #F5EFDE; line-height: 1.6; margin: 0; }
  .page { max-width: 720px; margin: 0 auto; padding: 2rem; }
  .cover { text-align: center; padding: 20vh 2rem; page-break-after: always; }
  .seal { width: 84px; height: 84px; border-radius: 50%; background: #7A2418; color: #F5EFDE; border: 3px solid #C9A24A;
          display: inline-flex; align-items: center; justify-content: center; font-size: 40px; font-weight: bold; margin-bottom: 1.5rem; }
  .cover h1 { font-size: 2.4rem; letter-spacing: 0.04em; margin: 0 0 0.5rem; color: #2C2014; }
  .cover .system { color: #A07A2C; text-transform: uppercase; letter-spacing: 0.25em; font-size: 0.8rem; }
  .cover .dedication { font-style: italic; color: #5A4D3E; margin-top: 2rem; }
  h2 { font-size: 1.6rem; color: #2C2014; border-bottom: 1px solid #C9A24A; padding-bottom: 0.3rem; margin-top: 2.5rem; }
  h3 { color: #A07A2C; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.85rem; }
  .chapter { page-break-inside: auto; }
  .chapter-date { color: #8A7D6D; font-size: 0.85rem; margin-top: -0.4rem; }
  .persona-name { font-weight: bold; }
  .mention { color: #7A2418; font-variant: small-caps; }
  blockquote { border-left: 2px solid #A07A2C; margin: 1rem 0; padding-left: 1rem; color: #3A2C1A; font-style: italic; }
  .table-quote cite { display: block; font-style: normal; font-size: 0.8rem; color: #A07A2C; margin-top: 0.3rem; }
  .empty { color: #8A7D6D; font-style: italic; }
  .colophon { text-align: center; color: #8A7D6D; font-size: 0.8rem; margin-top: 4rem; page-break-before: always; }
  .colophon .brand { color: #A07A2C; }
</style>
</head>
<body>
  <div class="cover">
    <div class="seal">G</div>
    <h1>${esc(campaign.name)}</h1>
    ${campaign.systemTag ? `<p class="system">${esc(campaign.systemTag)}</p>` : ""}
    ${input.dedication ? `<p class="dedication">${esc(input.dedication)}</p>` : ""}
  </div>
  <div class="page">
    <section class="chapter personae">
      <h2>Dramatis Personae</h2>
      ${personae("The Party", pcs)}
      ${personae("Of Note", keyNpcs)}
    </section>
    ${chapters || `<p class="empty">This campaign has no played sessions yet.</p>`}
    ${quotesHtml}
    <div class="colophon">
      <p>Bound in <span class="brand">The Grimoire Archive</span></p>
      <p>Write Your Story. Live Your Legend.</p>
    </div>
  </div>
</body>
</html>`;

  return { title, html };
}
