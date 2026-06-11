import { describe, expect, it } from "vitest";
import {
  backlinksFor,
  computeLinkChanges,
  extractMentions,
  matchPlainMentions,
  type EntityLinkRow,
} from "../src/linking.js";
import { doc, mentionNode, paragraph, textNode } from "../src/richtext.js";

const body = doc(
  paragraph(
    textNode("The party owes "),
    mentionNode("ent_varga", "Varga"),
    textNode(" 200 gold after the warehouse job."),
  ),
  paragraph(
    textNode("They met her through "),
    mentionNode("ent_guild", "the Smugglers' Guild"),
    textNode("."),
  ),
);

describe("extractMentions", () => {
  it("finds every mention with a context snippet from its block", () => {
    const mentions = extractMentions(body);
    expect(mentions).toHaveLength(2);
    expect(mentions[0]).toMatchObject({ entityId: "ent_varga", label: "Varga" });
    expect(mentions[0]!.contextSnippet).toContain("owes Varga 200 gold");
    expect(mentions[1]!.entityId).toBe("ent_guild");
  });

  it("trims long blocks to a window around the mention", () => {
    const long = doc(
      paragraph(
        textNode("x".repeat(300) + " then "),
        mentionNode("ent_varga", "Varga"),
        textNode(" appeared " + "y".repeat(300)),
      ),
    );
    const [m] = extractMentions(long);
    expect(m!.contextSnippet.length).toBeLessThanOrEqual(170);
    expect(m!.contextSnippet).toContain("Varga");
  });

  it("ignores mention nodes with no entityId", () => {
    const bad = doc(paragraph({ type: "mention", attrs: { label: "ghost" } }));
    expect(extractMentions(bad)).toHaveLength(0);
  });
});

describe("computeLinkChanges", () => {
  const base = { campaignId: "camp_1", fromType: "session" as const, fromId: "sess_1" };

  it("inserts new edges for first-time mentions", () => {
    const changes = computeLinkChanges({ ...base, body, existing: [] });
    expect(changes.inserts).toHaveLength(2);
    expect(changes.deleteIds).toHaveLength(0);
    expect(changes.inserts[0]).toMatchObject({
      campaignId: "camp_1",
      fromType: "session",
      fromId: "sess_1",
      toEntityId: "ent_varga",
    });
  });

  it("deletes edges whose mentions were removed", () => {
    const existing: EntityLinkRow[] = [
      {
        id: "lnk_1",
        campaignId: "camp_1",
        fromType: "session",
        fromId: "sess_1",
        toEntityId: "ent_gone",
        contextSnippet: "old",
      },
    ];
    const changes = computeLinkChanges({ ...base, body, existing });
    expect(changes.deleteIds).toEqual(["lnk_1"]);
    expect(changes.inserts).toHaveLength(2);
  });

  it("is a no-op when text is unchanged", () => {
    const first = computeLinkChanges({ ...base, body, existing: [] });
    const existing = first.inserts.map((r, i) => ({ ...r, id: `lnk_${i}` }));
    const second = computeLinkChanges({ ...base, body, existing });
    expect(second.inserts).toHaveLength(0);
    expect(second.deleteIds).toHaveLength(0);
    expect(second.snippetUpdates).toHaveLength(0);
  });

  it("updates the snippet when surrounding text changes", () => {
    const existing: EntityLinkRow[] = [
      {
        id: "lnk_1",
        campaignId: "camp_1",
        fromType: "session",
        fromId: "sess_1",
        toEntityId: "ent_varga",
        contextSnippet: "stale snippet",
      },
      {
        id: "lnk_2",
        campaignId: "camp_1",
        fromType: "session",
        fromId: "sess_1",
        toEntityId: "ent_guild",
        contextSnippet: "They met her through the Smugglers' Guild.",
      },
    ];
    const changes = computeLinkChanges({ ...base, body, existing });
    expect(changes.snippetUpdates).toHaveLength(1);
    expect(changes.snippetUpdates[0]!.id).toBe("lnk_1");
  });

  it("dedupes repeated mentions of the same entity into one edge", () => {
    const repeated = doc(
      paragraph(mentionNode("ent_varga", "Varga"), textNode(" and again ")),
      paragraph(mentionNode("ent_varga", "Varga")),
    );
    const changes = computeLinkChanges({ ...base, body: repeated, existing: [] });
    expect(changes.inserts).toHaveLength(1);
  });

  it("never links an entity to itself", () => {
    const selfref = doc(paragraph(mentionNode("ent_varga", "Varga")));
    const changes = computeLinkChanges({
      campaignId: "camp_1",
      fromType: "entity",
      fromId: "ent_varga",
      body: selfref,
      existing: [],
    });
    expect(changes.inserts).toHaveLength(0);
  });
});

describe("backlinksFor", () => {
  it("returns only links targeting the entity, stably ordered", () => {
    const links: EntityLinkRow[] = [
      { id: "1", campaignId: "c", fromType: "session", fromId: "sess_2", toEntityId: "ent_varga", contextSnippet: "b" },
      { id: "2", campaignId: "c", fromType: "entity", fromId: "ent_guild", toEntityId: "ent_varga", contextSnippet: "a" },
      { id: "3", campaignId: "c", fromType: "session", fromId: "sess_1", toEntityId: "ent_other", contextSnippet: null },
    ];
    const backlinks = backlinksFor("ent_varga", links);
    expect(backlinks).toHaveLength(2);
    expect(backlinks[0]!.fromType).toBe("entity");
    expect(backlinks[1]!.fromId).toBe("sess_2");
  });
});

describe("matchPlainMentions", () => {
  const entities = [
    { id: "ent_varga", name: "Varga" },
    { id: "ent_varga_full", name: "Varga the Smuggler" },
    { id: "ent_guild", name: "Smugglers' Guild" },
  ];

  it("matches case-insensitively and prefers the longest name", () => {
    const matches = matchPlainMentions(
      "the party owes @varga the smuggler 200 gold",
      entities,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]!.entityId).toBe("ent_varga_full");
  });

  it("respects word boundaries", () => {
    expect(matchPlainMentions("met @Vargas today", entities)).toHaveLength(0);
    expect(matchPlainMentions("met @Varga today", entities)).toHaveLength(1);
  });

  it("finds multiple mentions", () => {
    const matches = matchPlainMentions("@Varga sold out the @Smugglers' Guild", entities);
    expect(matches.map((m) => m.entityId)).toEqual(["ent_varga", "ent_guild"]);
  });
});
