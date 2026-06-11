import { describe, expect, it } from "vitest";
import {
  buildAiRecapPrompt,
  buildManualRecapDoc,
  extractBeats,
  generateShareSlug,
} from "../src/recap.js";
import { doc, nodeText, paragraph, textNode } from "../src/richtext.js";

const sessionBody = doc(
  { ...paragraph(textNode("Boring travel montage.")) },
  {
    type: "paragraph",
    attrs: { beat: true, blockId: "blk_1" },
    content: [textNode("The party torched the warehouse.")],
  },
  paragraph(textNode("Some shopping happened.")),
  {
    type: "paragraph",
    attrs: { beat: true, blockId: "blk_2" },
    content: [textNode("Varga swore revenge.")],
  },
);

describe("extractBeats", () => {
  it("returns only marked blocks, in narrative order, with blockRefs", () => {
    const beats = extractBeats(sessionBody);
    expect(beats).toEqual([
      { blockRef: "blk_1", text: "The party torched the warehouse." },
      { blockRef: "blk_2", text: "Varga swore revenge." },
    ]);
  });

  it("skips empty marked blocks", () => {
    const body = doc({ type: "paragraph", attrs: { beat: true }, content: [] });
    expect(extractBeats(body)).toHaveLength(0);
  });
});

describe("buildManualRecapDoc", () => {
  it("renders a heading and one paragraph per beat", () => {
    const recap = buildManualRecapDoc({
      campaignName: "The Ravenport Job",
      sessionNumber: 4,
      sessionTitle: "Fire at the Docks",
      beats: extractBeats(sessionBody),
    });
    expect(recap.content).toHaveLength(3);
    expect(nodeText(recap.content![0]!)).toContain("Previously on The Ravenport Job");
    expect(nodeText(recap.content![0]!)).toContain("Session 4");
    expect(nodeText(recap.content![1]!)).toBe("The party torched the warehouse.");
  });
});

describe("generateShareSlug", () => {
  it("makes 12-char URL-safe slugs that don't collide casually", () => {
    const slugs = new Set(Array.from({ length: 500 }, generateShareSlug));
    expect(slugs.size).toBe(500);
    for (const s of slugs) expect(s).toMatch(/^[A-Za-z0-9]{12}$/);
  });
});

describe("buildAiRecapPrompt", () => {
  const base = {
    campaignName: "The Ravenport Job",
    systemTag: "Blades in the Dark",
    sessionNumber: 4,
    sessionTitle: "Fire at the Docks",
    tone: "noir" as const,
    sessionNotesMarkdown: "The party torched the warehouse. [[Varga]] swore revenge.",
    beats: extractBeats(sessionBody),
    characterNames: ["Bram", "Sable"],
    gmOnlyNotes: "Varga is secretly the party's patron.",
  };

  it("puts rules in system and data in user, with secrecy first", () => {
    const { system, user } = buildAiRecapPrompt(base);
    expect(system).toContain("NEVER reveal information marked GM-only");
    expect(system.indexOf("NEVER reveal")).toBeLessThan(system.indexOf("Tone:"));
    expect(user).toContain("<session_notes>");
    expect(user).toContain("<gm_only_do_not_reveal>");
    expect(user).toContain("Varga is secretly the party's patron.");
    expect(user).toContain("Player characters: Bram, Sable");
  });

  it("each tone changes only the direction line", () => {
    const noir = buildAiRecapPrompt(base).system;
    const epic = buildAiRecapPrompt({ ...base, tone: "epic" }).system;
    expect(noir).not.toBe(epic);
    expect(noir).toContain("hard-boiled");
    expect(epic).toContain("high-fantasy");
  });

  it("omits optional sections cleanly", () => {
    const { user } = buildAiRecapPrompt({
      campaignName: "C",
      sessionNumber: 1,
      tone: "plain",
      sessionNotesMarkdown: "notes",
    });
    expect(user).not.toContain("<gm_only_do_not_reveal>");
    expect(user).not.toContain("<beats_that_must_appear_in_order>");
    expect(user).not.toContain("<previous_recap>");
  });
});
