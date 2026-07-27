import { describe, expect, it } from "vitest";
import { buildKeepsakeBook, KEEPSAKE_PRODUCTS } from "../src/keepsake.js";
import { doc, paragraph, textNode, mentionNode } from "../src/richtext.js";
import type { ExportEntity, ExportSession } from "../src/export.js";

const campaign = { id: "c1", name: "The Sunken Throne", systemTag: "5e", status: "ended" };

const entities: ExportEntity[] = [
  { id: "e1", kind: "pc", name: "Sister Maren", summary: "Warpriest of the tide", visibility: "table" },
  { id: "e2", kind: "npc", name: "Commander Varga", summary: "Turncoat officer", visibility: "table" },
];

const sessions: ExportSession[] = [
  {
    id: "s2",
    number: 2,
    title: "The Siege",
    playedOn: "2025-06-08",
    status: "played",
    body: doc(paragraph(textNode("The drums began at dawn. "), mentionNode("e2", "Varga"), textNode(" held the gate."))),
  },
  { id: "s3", number: 3, title: "Aftermath", status: "planned", body: null }, // not played → excluded
];

describe("buildKeepsakeBook", () => {
  it("builds a self-contained HTML book from played sessions only", () => {
    const book = buildKeepsakeBook({
      campaign,
      entities,
      sessions,
      quotes: [{ id: "q1", text: "I said I'd try.", attribution: "Maren" }],
      dedication: "For the ones who held the wall.",
    });

    expect(book.title).toContain("The Sunken Throne");
    expect(book.html.startsWith("<!doctype html>")).toBe(true);
    // Cover + dedication
    expect(book.html).toContain("The Sunken Throne");
    expect(book.html).toContain("For the ones who held the wall.");
    // Dramatis personae
    expect(book.html).toContain("Dramatis Personae");
    expect(book.html).toContain("Sister Maren");
    expect(book.html).toContain("Commander Varga");
    // Played chapter present, planned chapter excluded
    expect(book.html).toContain("Session 2: The Siege");
    expect(book.html).not.toContain("Aftermath");
    // Rich text rendered, mention styled
    expect(book.html).toContain("The drums began at dawn.");
    expect(book.html).toContain('<span class="mention">Varga</span>');
    // Quotes
    expect(book.html).toContain("Heard at the Table");
    expect(book.html).toContain("I said I'd try.");
  });

  it("escapes HTML to prevent injection from campaign data", () => {
    const book = buildKeepsakeBook({
      campaign: { ...campaign, name: "<script>alert(1)</script>" },
      entities: [],
      sessions: [],
    });
    expect(book.html).not.toContain("<script>alert(1)</script>");
    expect(book.html).toContain("&lt;script&gt;");
  });

  it("handles an empty campaign gracefully", () => {
    const book = buildKeepsakeBook({ campaign, entities: [], sessions: [] });
    expect(book.html).toContain("no played sessions yet");
  });

  it("exposes retail product definitions", () => {
    expect(KEEPSAKE_PRODUCTS.pdf.priceGBP).toBe(19.99);
    expect(KEEPSAKE_PRODUCTS.hardcover.priceGBP).toBe(49.99);
  });
});
