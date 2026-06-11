/**
 * Relationship graph derivation — the V1 feature that makes the moat visible.
 * Pure projection over entities + entity_links; visibility-filtered so the
 * player view never leaks gm_only nodes.
 */
import type { EntityLinkRow } from "./linking.js";
import {
  type EntityForAccess,
  type Member,
  type RevealForAccess,
  canViewEntity,
} from "./permissions.js";

export interface GraphEntity extends EntityForAccess {
  name: string;
}

export interface GraphNode {
  id: string;
  name: string;
  kind: string;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  kind: "direct" | "co_mention";
  /** Direct: number of linking sources. Co-mention: number of shared sessions. */
  weight: number;
  snippets: string[];
}

export interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const MAX_SNIPPETS_PER_EDGE = 3;

/** Undirected edge key so A→B and B→A merge. */
function edgeKey(a: string, b: string, kind: string): string {
  return a < b ? `${kind}:${a}:${b}` : `${kind}:${b}:${a}`;
}

/**
 * Build the relationship web for a viewer.
 *  - Direct edges: entity body mentions another entity.
 *  - Co-mention edges: two entities are both mentioned by the same session
 *    ("they were in the scene together").
 * Edges touching an entity the viewer can't see are dropped with the node.
 */
export function buildRelationshipGraph(args: {
  entities: GraphEntity[];
  links: EntityLinkRow[];
  viewer?: Member | null;
  reveals?: RevealForAccess[];
}): RelationshipGraph {
  const { entities, links, viewer = null, reveals = [] } = args;

  const visible = new Map<string, GraphEntity>();
  for (const e of entities) {
    if (canViewEntity(e, viewer, reveals)) visible.set(e.id, e);
  }

  const edges = new Map<string, GraphEdge>();

  const addEdge = (
    fromId: string,
    toId: string,
    kind: GraphEdge["kind"],
    snippet: string | null,
  ) => {
    if (fromId === toId) return;
    if (!visible.has(fromId) || !visible.has(toId)) return;
    const key = edgeKey(fromId, toId, kind);
    let edge = edges.get(key);
    if (!edge) {
      edge = { fromId, toId, kind, weight: 0, snippets: [] };
      edges.set(key, edge);
    }
    edge.weight += 1;
    if (snippet && edge.snippets.length < MAX_SNIPPETS_PER_EDGE) {
      edge.snippets.push(snippet);
    }
  };

  // Direct entity → entity links.
  for (const link of links) {
    if (link.fromType !== "entity") continue;
    addEdge(link.fromId, link.toEntityId, "direct", link.contextSnippet);
  }

  // Session co-mentions: every pair of entities linked from the same session.
  const bySession = new Map<string, EntityLinkRow[]>();
  for (const link of links) {
    if (link.fromType !== "session") continue;
    const rows = bySession.get(link.fromId) ?? [];
    rows.push(link);
    bySession.set(link.fromId, rows);
  }
  for (const rows of bySession.values()) {
    const ids = [...new Set(rows.map((r) => r.toEntityId))].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        addEdge(ids[i]!, ids[j]!, "co_mention", null);
      }
    }
  }

  // Keep only nodes that participate in at least one edge, plus pcs/npcs the
  // viewer can see (lonely nodes still belong on the map for small campaigns).
  const nodes: GraphNode[] = [...visible.values()].map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
  }));

  return { nodes, edges: [...edges.values()] };
}
