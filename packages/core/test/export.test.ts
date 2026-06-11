import { describe, expect, it } from "vitest";
import {
  exportCampaign,
  richTextToMarkdown,
  slugify,
  type ExportEntity,
  type ExportSession,
} from "../src/export.js";
import { doc, mentionNode, paragraph, textNode } from "../src/richtext.js";

describe("slugify", () => {
  it("normalises names to safe file slugs", () => {
    expect(slugify("Varga the Smuggler")).toBe("varga-the-smuggler");
    expect(slugify("  Crown & Sceptre!  ")).toBe("crown-sceptre");
    expect(slugify("Éowyn")).toBe("eowyn");
    expect(slugify("???")).toBe("untitled");
  });
});

describe("richTextToMarkdown", () => {
  it("renders paragraphs, marks, headings, lists and mentions", () => {
    const body = doc(
      { type: "heading", attrs: { level: 2 }, content: [textNode("The Job")] },
      paragraph(
        textNode("The party owes "),
        mentionNode("ent_varga", "Varga"),
        { type: "text", text: "200 gold", marks: [{ type: "bold" }] },
      ),
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [paragraph(textNode("Find the ledger"))] },
        ],
      },
    );
    const md = richTextToMarkdown(body);
    expect(md).toContain("## The Job");
    expect(md).toContain("[[Varga]]");
    expect(md).toContain("**200 gold**");
    expect(md).toContain("- Find the ledger");
  });

  it("handles empty bodies", () => {
    expect(richTextToMarkdown(null)).toBe("");
    expect(richTextToMarkdown(doc())).toBe("");
  });
});

const campaign = {
  id: "camp_1",
  name: "The Ravenport Job",
  systemTag: "Blades in the Dark",
  status: "active",
};

const entities: ExportEntity[] = [
  {
    id: "ent_varga",
    kind: "npc",
    name: "Varga",
    summary: "A smuggler with a ledger",
    body: doc(paragraph(textNode("Runs the docks."))),
    visibility: "table",
  },
  {
    id: "ent_traitor",
    kind: "npc",
    name: "The Traitor",
    visibility: "gm_only",
    body: null,
  },
  { id: "ent_varga2", kind: "npc", name: "Varga", visibility: "table", body: null },
];

const sessions: ExportSession[] = [
  {
    id: "sess_2",
    number: 2,
    title: "The Warehouse",
    playedOn: "2026-06-04",
    body: doc(paragraph(textNode("It went badly."))),
    status: "played",
  },
  { id: "sess_1", number: 1, title: null, playedOn: null, body: null, status: "played" },
];

describe("exportCampaign", () => {
  it("produces index, entity and session files with frontmatter", () => {
    const out = exportCampaign({ campaign, entities, sessions });
    const paths = out.files.map((f) => f.path);
    expect(paths).toContain("index.md");
    expect(paths).toContain("entities/npc/varga.md");
    expect(paths).toContain("sessions/session-01.md");
    expect(paths).toContain("sessions/session-02-the-warehouse.md");

    const varga = out.files.find((f) => f.path === "entities/npc/varga.md")!;
    expect(varga.content).toContain('id: "ent_varga"');
    expect(varga.content).toContain("# Varga");
    expect(varga.content).toContain("Runs the docks.");
  });

  it("suffixes colliding slugs instead of overwriting", () => {
    const out = exportCampaign({ campaign, entities, sessions });
    const vargaFiles = out.files.filter((f) => f.path.startsWith("entities/npc/varga"));
    expect(vargaFiles).toHaveLength(2);
    expect(new Set(vargaFiles.map((f) => f.path)).size).toBe(2);
  });

  it("sessions are ordered by number regardless of input order", () => {
    const out = exportCampaign({ campaign, entities, sessions });
    const index = out.files.find((f) => f.path === "index.md")!;
    expect(index.content.indexOf("Session 01")).toBeLessThan(
      index.content.indexOf("Session 02"),
    );
  });

  it("a player export (includeGmOnly=false) omits gm_only records everywhere", () => {
    const out = exportCampaign({ campaign, entities, sessions, includeGmOnly: false });
    expect(out.files.some((f) => f.content.includes("The Traitor"))).toBe(false);
    expect(out.json).not.toContain("ent_traitor");
  });

  it("the JSON export round-trips the structured data", () => {
    const out = exportCampaign({ campaign, entities, sessions });
    const parsed = JSON.parse(out.json);
    expect(parsed.format).toBe("grimoire-export");
    expect(parsed.entities).toHaveLength(3);
    expect(parsed.campaign.name).toBe("The Ravenport Job");
  });
});
