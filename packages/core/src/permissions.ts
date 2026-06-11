/**
 * Permission, visibility and succession rules.
 *
 * Doctrine (Strategic Plan v2.0, Part II §7):
 *  - Campaigns belong to the group; the GM seat is a role, not a deed.
 *  - Characters belong to players, not campaigns.
 *  - Erasing a person never erases the group's shared world.
 */

export type Role = "gm" | "co_gm" | "player";

export interface Member {
  userId: string;
  role: Role;
  characterProfileId?: string | null;
  joinedAt: number; // epoch ms
}

export interface EntityForAccess {
  id: string;
  kind: string;
  visibility: "gm_only" | "table";
  characterProfileId?: string | null;
}

export interface RevealForAccess {
  entityId: string;
  /** null = the whole entity is revealed. */
  blockRef: string | null;
  revealedTo: "table" | "user";
  revealedToUserId?: string | null;
}

const GM_ROLES: ReadonlySet<Role> = new Set(["gm", "co_gm"]);

export function isGm(member: Member | null | undefined): boolean {
  return !!member && GM_ROLES.has(member.role);
}

/**
 * Can this member (or anonymous viewer, member = null) see the entity at all?
 * gm_only entities are visible to GMs, and to others only via a whole-entity
 * reveal addressed to the table or to that user.
 */
export function canViewEntity(
  entity: EntityForAccess,
  member: Member | null,
  reveals: RevealForAccess[] = [],
): boolean {
  if (entity.visibility === "table") return true;
  if (isGm(member)) return true;
  return reveals.some(
    (r) =>
      r.entityId === entity.id &&
      r.blockRef === null &&
      (r.revealedTo === "table" ||
        (member != null && r.revealedToUserId === member.userId)),
  );
}

/**
 * Which gm-only blocks inside a visible entity this member may read.
 * GMs see everything; others see blocks individually revealed to the table
 * or to them. (Whole-entity reveals are handled by canViewEntity.)
 */
export function revealedBlockRefs(
  entityId: string,
  member: Member | null,
  reveals: RevealForAccess[],
): Set<string> {
  const refs = new Set<string>();
  for (const r of reveals) {
    if (r.entityId !== entityId || r.blockRef === null) continue;
    if (
      r.revealedTo === "table" ||
      (member != null && r.revealedToUserId === member.userId)
    ) {
      refs.add(r.blockRef);
    }
  }
  return refs;
}

/**
 * GMs edit everything. A player edits exactly the pc entities bound to a
 * character passport they hold in this campaign — their property, nothing else.
 */
export function canEditEntity(entity: EntityForAccess, member: Member | null): boolean {
  if (!member) return false;
  if (isGm(member)) return true;
  return (
    entity.kind === "pc" &&
    entity.characterProfileId != null &&
    entity.characterProfileId === member.characterProfileId
  );
}

// ---------------------------------------------------------------------------
// Succession
// ---------------------------------------------------------------------------

export class SuccessionError extends Error {}

/**
 * Campaign Ownership Transfer: hand the GM seat to another member.
 * The outgoing GM becomes a co_gm (they keep helping unless they leave).
 * Pure function — returns the new membership list, never mutates.
 */
export function transferGm(
  members: Member[],
  fromUserId: string,
  toUserId: string,
): Member[] {
  const from = members.find((m) => m.userId === fromUserId);
  const to = members.find((m) => m.userId === toUserId);
  if (!from || from.role !== "gm") {
    throw new SuccessionError("Only the current GM can transfer the GM seat.");
  }
  if (!to) {
    throw new SuccessionError("The new GM must already be a campaign member.");
  }
  if (fromUserId === toUserId) {
    throw new SuccessionError("Cannot transfer the GM seat to its holder.");
  }
  return members.map((m) => {
    if (m.userId === fromUserId) return { ...m, role: "co_gm" as Role };
    if (m.userId === toUserId) return { ...m, role: "gm" as Role };
    return m;
  });
}

/**
 * Who is offered the GM seat when the GM departs entirely (account deletion
 * or leaving the campaign): co-GMs first, then players, longest-standing
 * first. Null when the departing GM was the last member.
 */
export function successionCandidate(
  members: Member[],
  departingUserId: string,
): string | null {
  const rank: Record<Role, number> = { gm: 0, co_gm: 1, player: 2 };
  const remaining = members
    .filter((m) => m.userId !== departingUserId)
    .sort((a, b) => rank[a.role] - rank[b.role] || a.joinedAt - b.joinedAt);
  return remaining[0]?.userId ?? null;
}

export interface GmDepartureResult {
  members: Member[];
  /** Null means the campaign emptied out and should be archived. */
  newGmUserId: string | null;
}

/**
 * Apply a GM's departure: remove them, promote the succession candidate.
 * The campaign itself is untouched — the group's world survives the person.
 */
export function applyGmDeparture(
  members: Member[],
  departingUserId: string,
): GmDepartureResult {
  const departing = members.find((m) => m.userId === departingUserId);
  if (!departing) throw new SuccessionError("Departing user is not a member.");
  const remaining = members.filter((m) => m.userId !== departingUserId);
  if (departing.role !== "gm") {
    return { members: remaining, newGmUserId: null };
  }
  const heir = successionCandidate(members, departingUserId);
  return {
    members: remaining.map((m) =>
      m.userId === heir ? { ...m, role: "gm" as Role } : m,
    ),
    newGmUserId: heir,
  };
}
