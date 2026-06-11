import { describe, expect, it } from "vitest";
import {
  applyGmDeparture,
  canEditEntity,
  canViewEntity,
  revealedBlockRefs,
  successionCandidate,
  SuccessionError,
  transferGm,
  type Member,
} from "../src/permissions.js";

const gm: Member = { userId: "u_gm", role: "gm", joinedAt: 1000 };
const coGm: Member = { userId: "u_co", role: "co_gm", joinedAt: 2000 };
const playerA: Member = {
  userId: "u_a",
  role: "player",
  characterProfileId: "cp_a",
  joinedAt: 3000,
};
const playerB: Member = {
  userId: "u_b",
  role: "player",
  characterProfileId: "cp_b",
  joinedAt: 4000,
};
const table = [gm, coGm, playerA, playerB];

const secretNpc = { id: "ent_s", kind: "npc", visibility: "gm_only" as const };
const publicNpc = { id: "ent_p", kind: "npc", visibility: "table" as const };
const pcOfA = {
  id: "ent_pc_a",
  kind: "pc",
  visibility: "table" as const,
  characterProfileId: "cp_a",
};

describe("canViewEntity", () => {
  it("everyone sees table entities, even logged-out recap readers", () => {
    expect(canViewEntity(publicNpc, null)).toBe(true);
    expect(canViewEntity(publicNpc, playerA)).toBe(true);
  });

  it("gm_only entities are hidden from players and anonymous viewers", () => {
    expect(canViewEntity(secretNpc, playerA)).toBe(false);
    expect(canViewEntity(secretNpc, null)).toBe(false);
    expect(canViewEntity(secretNpc, gm)).toBe(true);
    expect(canViewEntity(secretNpc, coGm)).toBe(true);
  });

  it("a whole-entity reveal to the table opens it to players", () => {
    const reveals = [
      { entityId: "ent_s", blockRef: null, revealedTo: "table" as const },
    ];
    expect(canViewEntity(secretNpc, playerA, reveals)).toBe(true);
    expect(canViewEntity(secretNpc, null, reveals)).toBe(true);
  });

  it("a reveal to one player opens it to that player only", () => {
    const reveals = [
      {
        entityId: "ent_s",
        blockRef: null,
        revealedTo: "user" as const,
        revealedToUserId: "u_a",
      },
    ];
    expect(canViewEntity(secretNpc, playerA, reveals)).toBe(true);
    expect(canViewEntity(secretNpc, playerB, reveals)).toBe(false);
  });

  it("a block-level reveal does NOT expose a gm_only entity", () => {
    const reveals = [
      { entityId: "ent_s", blockRef: "blk_1", revealedTo: "table" as const },
    ];
    expect(canViewEntity(secretNpc, playerA, reveals)).toBe(false);
  });
});

describe("revealedBlockRefs", () => {
  const reveals = [
    { entityId: "ent_p", blockRef: "blk_1", revealedTo: "table" as const },
    {
      entityId: "ent_p",
      blockRef: "blk_2",
      revealedTo: "user" as const,
      revealedToUserId: "u_a",
    },
    { entityId: "ent_other", blockRef: "blk_9", revealedTo: "table" as const },
  ];

  it("collects table reveals plus the member's personal reveals", () => {
    expect(revealedBlockRefs("ent_p", playerA, reveals)).toEqual(
      new Set(["blk_1", "blk_2"]),
    );
    expect(revealedBlockRefs("ent_p", playerB, reveals)).toEqual(new Set(["blk_1"]));
    expect(revealedBlockRefs("ent_p", null, reveals)).toEqual(new Set(["blk_1"]));
  });
});

describe("canEditEntity", () => {
  it("GMs and co-GMs edit everything", () => {
    expect(canEditEntity(secretNpc, gm)).toBe(true);
    expect(canEditEntity(pcOfA, coGm)).toBe(true);
  });

  it("a player edits exactly their own pc — player ownership", () => {
    expect(canEditEntity(pcOfA, playerA)).toBe(true);
    expect(canEditEntity(pcOfA, playerB)).toBe(false);
    expect(canEditEntity(publicNpc, playerA)).toBe(false);
  });

  it("anonymous viewers edit nothing", () => {
    expect(canEditEntity(publicNpc, null)).toBe(false);
  });
});

describe("transferGm — Campaign Ownership Transfer", () => {
  it("swaps the seat and keeps the outgoing GM as co_gm", () => {
    const after = transferGm(table, "u_gm", "u_a");
    expect(after.find((m) => m.userId === "u_a")!.role).toBe("gm");
    expect(after.find((m) => m.userId === "u_gm")!.role).toBe("co_gm");
    expect(after.filter((m) => m.role === "gm")).toHaveLength(1);
  });

  it("only the current GM can transfer; target must be a member", () => {
    expect(() => transferGm(table, "u_co", "u_a")).toThrow(SuccessionError);
    expect(() => transferGm(table, "u_gm", "u_stranger")).toThrow(SuccessionError);
    expect(() => transferGm(table, "u_gm", "u_gm")).toThrow(SuccessionError);
  });

  it("does not mutate the input", () => {
    transferGm(table, "u_gm", "u_a");
    expect(gm.role).toBe("gm");
  });
});

describe("succession on GM departure", () => {
  it("prefers co-GMs, then longest-standing players", () => {
    expect(successionCandidate(table, "u_gm")).toBe("u_co");
    expect(successionCandidate([gm, playerB, playerA], "u_gm")).toBe("u_a");
  });

  it("applyGmDeparture promotes the heir and removes the departed", () => {
    const { members, newGmUserId } = applyGmDeparture(table, "u_gm");
    expect(newGmUserId).toBe("u_co");
    expect(members.find((m) => m.userId === "u_co")!.role).toBe("gm");
    expect(members.some((m) => m.userId === "u_gm")).toBe(false);
  });

  it("a non-GM departure promotes nobody", () => {
    const { members, newGmUserId } = applyGmDeparture(table, "u_b");
    expect(newGmUserId).toBeNull();
    expect(members.find((m) => m.userId === "u_gm")!.role).toBe("gm");
  });

  it("the last member leaving returns null — campaign should archive", () => {
    const { members, newGmUserId } = applyGmDeparture([gm], "u_gm");
    expect(members).toHaveLength(0);
    expect(newGmUserId).toBeNull();
  });
});
