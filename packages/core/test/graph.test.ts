import { describe, expect, it } from "vitest";
import { buildRelationshipGraph, type GraphEntity } from "../src/graph.js";
import type { EntityLinkRow } from "../src/linking.js";
import type { Member } from "../src/permissions.js";

const entities: GraphEntity[] = [
  { id: "ent_varga", name: "Varga", kind: "npc", visibility: "table" },
  { id: "ent_guild", name: "Smugglers' Guild", kind: "faction", visibility: "table" },
  { id: "ent_pc", name: "Bram", kind: "pc", visibility: "table" },
  { id: "ent_traitor", name: "The Traitor", kind: "npc", visibility: "gm_only" },
];

const link = (
  id: string,
  fromType: "entity" | "session",
  fromId: string,
  toEntityId: string,
  snippet: string | null = null,
): EntityLinkRow => ({
  id,
  campaignId: "camp_1",
  fromType,
  fromId,
  toEntityId,
  contextSnippet: snippet,
});

const links: EntityLinkRow[] = [
  link("1", "entity", "ent_varga", "ent_guild", "Varga runs jobs for the Guild"),
  link("2", "session", "sess_1", "ent_varga"),
  link("3", "session", "sess_1", "ent_pc"),
  link("4", "session", "sess_1", "ent_traitor"),
  link("5", "session", "sess_2", "ent_varga"),
  link("6", "session", "sess_2", "ent_pc"),
];

const player: Member = { userId: "u_a", role: "player", joinedAt: 1 };
const gm: Member = { userId: "u_gm", role: "gm", joinedAt: 1 };

describe("buildRelationshipGraph", () => {
  it("builds direct edges from entity-to-entity mentions with snippets", () => {
    const g = buildRelationshipGraph({ entities, links, viewer: gm });
    const direct = g.edges.find((e) => e.kind === "direct");
    expect(direct).toMatchObject({ fromId: "ent_varga", toId: "ent_guild", weight: 1 });
    expect(direct!.snippets[0]).toContain("runs jobs");
  });

  it("derives co-mention edges from shared sessions, weighted by count", () => {
    const g = buildRelationshipGraph({ entities, links, viewer: gm });
    const co = g.edges.find(
      (e) =>
        e.kind === "co_mention" &&
        [e.fromId, e.toId].sort().join() === ["ent_pc", "ent_varga"].sort().join(),
    );
    expect(co!.weight).toBe(2); // together in sess_1 and sess_2
  });

  it("merges A→B and B→A into one undirected edge", () => {
    const both = [
      link("1", "entity", "ent_varga", "ent_guild"),
      link("2", "entity", "ent_guild", "ent_varga"),
    ];
    const g = buildRelationshipGraph({ entities, links: both, viewer: gm });
    const direct = g.edges.filter((e) => e.kind === "direct");
    expect(direct).toHaveLength(1);
    expect(direct[0]!.weight).toBe(2);
  });

  it("the player view drops gm_only nodes and every edge touching them", () => {
    const g = buildRelationshipGraph({ entities, links, viewer: player });
    expect(g.nodes.some((n) => n.id === "ent_traitor")).toBe(false);
    expect(
      g.edges.some((e) => e.fromId === "ent_traitor" || e.toId === "ent_traitor"),
    ).toBe(false);
  });

  it("a table reveal brings the hidden node into the player view", () => {
    const g = buildRelationshipGraph({
      entities,
      links,
      viewer: player,
      reveals: [{ entityId: "ent_traitor", blockRef: null, revealedTo: "table" }],
    });
    expect(g.nodes.some((n) => n.id === "ent_traitor")).toBe(true);
  });

  it("the GM sees everything", () => {
    const g = buildRelationshipGraph({ entities, links, viewer: gm });
    expect(g.nodes).toHaveLength(4);
  });
});
