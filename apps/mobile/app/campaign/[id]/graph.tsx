import { View, Text, Pressable, Dimensions, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState, useCallback } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { db } from "@/lib/db";
import { schema } from "@grimoire/core";
import {
  buildRelationshipGraph,
  type GraphNode,
  type GraphEdge,
  type GraphEntity,
} from "@grimoire/core";
import type { EntityLinkRow } from "@grimoire/core";

type EdgeKind = "direct" | "co_mention" | "faction_member" | "faction_rel";
type RelType = "ally" | "enemy" | "rival" | "neutral";
type ExtEdge = { fromId: string; toId: string; kind: EdgeKind; relType?: RelType; weight: number };

const REL_COLORS: Record<RelType, string> = {
  ally: "#4A8060",
  enemy: "#7A2418",
  rival: "#A07A2C",
  neutral: "#8A7D6D",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRAPH_W = SCREEN_WIDTH - 32;
const GRAPH_H = 400;
const NODE_R = 20;

const KIND_COLORS: Record<string, string> = {
  npc: "#A07A2C",
  pc: "#C9A24A",
  location: "#4A8060",
  faction: "#7A2418",
  item: "#6A5ACD",
  quest: "#D4A843",
  custom: "#4A3F32",
};

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
}

function layoutGraph(
  nodes: GraphNode[],
  edges: { fromId: string; toId: string }[],
): LayoutNode[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [{ ...nodes[0]!, x: GRAPH_W / 2, y: GRAPH_H / 2 }];
  }

  const pad = NODE_R + 10;
  const placed: LayoutNode[] = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const rx = (GRAPH_W / 2 - pad) * 0.7;
    const ry = (GRAPH_H / 2 - pad) * 0.7;
    return {
      ...n,
      x: GRAPH_W / 2 + rx * Math.cos(angle),
      y: GRAPH_H / 2 + ry * Math.sin(angle),
    };
  });

  const idxMap = new Map(placed.map((n, i) => [n.id, i]));

  for (let iter = 0; iter < 80; iter++) {
    const fx = new Float64Array(placed.length);
    const fy = new Float64Array(placed.length);

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const dx = placed[j]!.x - placed[i]!.x;
        const dy = placed[j]!.y - placed[i]!.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const repulse = 8000 / (dist * dist);
        const ux = dx / dist;
        const uy = dy / dist;
        fx[i]! -= repulse * ux;
        fy[i]! -= repulse * uy;
        fx[j]! += repulse * ux;
        fy[j]! += repulse * uy;
      }
    }

    for (const edge of edges) {
      const ai = idxMap.get(edge.fromId);
      const bi = idxMap.get(edge.toId);
      if (ai == null || bi == null) continue;
      const dx = placed[bi]!.x - placed[ai]!.x;
      const dy = placed[bi]!.y - placed[ai]!.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const attract = (dist - 80) * 0.03;
      const ux = dx / dist;
      const uy = dy / dist;
      fx[ai]! += attract * ux;
      fy[ai]! += attract * uy;
      fx[bi]! -= attract * ux;
      fy[bi]! -= attract * uy;
    }

    const cx = GRAPH_W / 2;
    const cy = GRAPH_H / 2;
    for (let i = 0; i < placed.length; i++) {
      fx[i]! += (cx - placed[i]!.x) * 0.01;
      fy[i]! += (cy - placed[i]!.y) * 0.01;
    }

    const cooling = 1 - iter / 80;
    for (let i = 0; i < placed.length; i++) {
      placed[i]!.x += fx[i]! * cooling * 0.5;
      placed[i]!.y += fy[i]! * cooling * 0.5;
      placed[i]!.x = Math.max(pad, Math.min(GRAPH_W - pad, placed[i]!.x));
      placed[i]!.y = Math.max(pad, Math.min(GRAPH_H - pad, placed[i]!.y));
    }
  }

  return placed;
}

type GraphMode = "all" | "mentions" | "factions";

export default function GraphScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [nodes, setNodes] = useState<LayoutNode[]>([]);
  const [allEdges, setAllEdges] = useState<ExtEdge[]>([]);
  const [graphMode, setGraphMode] = useState<GraphMode>("all");

  const load = useCallback(() => {
    const entities = db
      .select()
      .from(schema.entities)
      .where(eq(schema.entities.campaignId, campaignId))
      .all();

    const links = db
      .select()
      .from(schema.entityLinks)
      .where(eq(schema.entityLinks.campaignId, campaignId))
      .all();

    const graphEntities: GraphEntity[] = entities.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      visibility: e.visibility as "gm_only" | "table",
      characterProfileId: e.characterProfileId,
    }));

    const linkRows: EntityLinkRow[] = links.map((l) => ({
      id: l.id,
      campaignId: l.campaignId,
      fromType: l.fromType as "entity" | "session",
      fromId: l.fromId,
      toEntityId: l.toEntityId,
      contextSnippet: l.contextSnippet,
    }));

    const graph = buildRelationshipGraph({
      entities: graphEntities,
      links: linkRows,
    });

    // Build extended edges: mention-derived + faction relationships + NPC faction membership
    const ext: ExtEdge[] = graph.edges.map((e: GraphEdge) => ({
      fromId: e.fromId,
      toId: e.toId,
      kind: e.kind as "direct" | "co_mention",
      weight: e.weight,
    }));

    for (const entity of entities) {
      const attrs = entity.attrs as Record<string, unknown> | null;
      if (entity.kind === "faction" && Array.isArray(attrs?.["relationships"])) {
        for (const rel of attrs["relationships"] as { factionId: string; type: string }[]) {
          if (entities.some((e) => e.id === rel.factionId)) {
            // Avoid duplicate reverse edge
            if (!ext.some((e) => (e.fromId === entity.id && e.toId === rel.factionId && e.kind === "faction_rel") || (e.fromId === rel.factionId && e.toId === entity.id && e.kind === "faction_rel"))) {
              ext.push({ fromId: entity.id, toId: rel.factionId, kind: "faction_rel", relType: rel.type as RelType, weight: 2 });
            }
          }
        }
      }
      if ((entity.kind === "npc" || entity.kind === "pc") && typeof attrs?.["factionId"] === "string") {
        if (entities.some((e) => e.id === attrs["factionId"])) {
          ext.push({ fromId: entity.id, toId: attrs["factionId"] as string, kind: "faction_member", weight: 1 });
        }
      }
    }

    // Compute which nodes appear in faction edges for "factions" mode
    const factionEdgeIds = new Set(ext.filter(e => e.kind === "faction_rel" || e.kind === "faction_member").flatMap(e => [e.fromId, e.toId]));
    const mentionEdgeIds = new Set(ext.filter(e => e.kind === "direct" || e.kind === "co_mention").flatMap(e => [e.fromId, e.toId]));
    const allNodeIds = new Set([...factionEdgeIds, ...mentionEdgeIds]);
    const filteredNodes = graph.nodes.filter((n: GraphNode) => allNodeIds.has(n.id));

    setAllEdges(ext);
    setNodes(layoutGraph(filteredNodes.length > 0 ? filteredNodes : graph.nodes, ext));
  }, [campaignId]);

  useFocusEffect(load);

  const visibleEdges = allEdges.filter((e) => {
    if (graphMode === "mentions") return e.kind === "direct" || e.kind === "co_mention";
    if (graphMode === "factions") return e.kind === "faction_rel" || e.kind === "faction_member";
    return true;
  });

  const visibleNodeIds = new Set(visibleEdges.flatMap((e) => [e.fromId, e.toId]));
  const visibleNodes = graphMode === "all" ? nodes : nodes.filter((n) => visibleNodeIds.has(n.id));

  return (
    <>
      <Stack.Screen options={{ title: "Relationship Map" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView className="flex-1" style={{ backgroundColor: "transparent" }} contentContainerStyle={{ padding: 16 }}>
        {nodes.length === 0 ? (
          <View style={{ paddingTop: 80, alignItems: "center" }}>
            <Text
              className="text-ink/50 text-sm text-center"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              No entities yet — add NPCs, locations, and factions to see their
              relationships emerge
            </Text>
          </View>
        ) : (
          <>
            {/* Mode filter */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 }}>
              {(["all", "mentions", "factions"] as GraphMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setGraphMode(mode)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 2,
                    borderWidth: 1,
                    borderColor: graphMode === mode ? "#A07A2C" : "#A07A2C40",
                    backgroundColor: graphMode === mode ? "#A07A2C15" : "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: graphMode === mode ? "#A07A2C" : "#A07A2C80", textTransform: "capitalize" }}>
                    {mode === "all" ? "All" : mode === "mentions" ? "Mentions" : "Factions"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Svg width={GRAPH_W} height={GRAPH_H}>
              {visibleEdges.map((edge, i) => {
                const from = visibleNodes.find((n) => n.id === edge.fromId);
                const to = visibleNodes.find((n) => n.id === edge.toId);
                if (!from || !to) return null;
                const stroke = edge.kind === "faction_rel" && edge.relType
                  ? REL_COLORS[edge.relType]
                  : edge.kind === "faction_member"
                  ? "#7A241840"
                  : edge.kind === "direct" ? "#A07A2C" : "#A07A2C40";
                const dashArray = edge.kind === "co_mention" ? "4,4" : edge.kind === "faction_member" ? "3,3" : undefined;
                return (
                  <Line
                    key={i}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={stroke}
                    strokeWidth={edge.kind === "faction_rel" ? 2 : Math.min(edge.weight + 0.5, 3)}
                    strokeDasharray={dashArray}
                  />
                );
              })}
              {visibleNodes.map((node) => (
                <G
                  key={node.id}
                  onPress={() =>
                    router.push(`/campaign/${campaignId}/entity/${node.id}` as Parameters<typeof router.push>[0])
                  }
                >
                  <Circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_R + 6}
                    fill="transparent"
                  />
                  <Circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_R}
                    fill={KIND_COLORS[node.kind] ?? "#4A3F32"}
                    opacity={0.85}
                    stroke="#2C2014"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={node.x}
                    y={node.y + NODE_R + 14}
                    fill="#2C2014"
                    fontSize={10}
                    fontFamily="Inter_500Medium"
                    textAnchor="middle"
                  >
                    {node.name.length > 12
                      ? node.name.slice(0, 11) + "…"
                      : node.name}
                  </SvgText>
                </G>
              ))}
            </Svg>

            {/* Kind legend */}
            <View className="mt-4 flex-row flex-wrap justify-center">
              {Object.entries(KIND_COLORS).map(([kind, color]) => {
                const hasKind = visibleNodes.some((n) => n.kind === kind);
                if (!hasKind) return null;
                return (
                  <View key={kind} className="flex-row items-center mr-4 mb-2">
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: color,
                        marginRight: 4,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 10,
                        color: "#5A4D3E",
                        textTransform: "capitalize",
                      }}
                    >
                      {kind}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Edge legend */}
            <View className="mt-2 flex-row flex-wrap justify-center">
              {(graphMode === "all" || graphMode === "mentions") && (
                <>
                  <View className="flex-row items-center mr-4 mb-1">
                    <View style={{ width: 16, height: 2, backgroundColor: "#A07A2C", marginRight: 4 }} />
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#2C201460" }}>Direct mention</Text>
                  </View>
                  <View className="flex-row items-center mr-4 mb-1">
                    <View style={{ width: 16, height: 2, backgroundColor: "#A07A2C40", marginRight: 4, borderStyle: "dashed", borderWidth: 1, borderColor: "#A07A2C40" }} />
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#2C201460" }}>Co-mention</Text>
                  </View>
                </>
              )}
              {(graphMode === "all" || graphMode === "factions") && (
                <>
                  {(["ally", "enemy", "rival", "neutral"] as RelType[]).map((rt) => (
                    <View key={rt} className="flex-row items-center mr-4 mb-1">
                      <View style={{ width: 16, height: 2, backgroundColor: REL_COLORS[rt], marginRight: 4 }} />
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#2C201460", textTransform: "capitalize" }}>{rt}</Text>
                    </View>
                  ))}
                  <View className="flex-row items-center mr-4 mb-1">
                    <View style={{ width: 16, height: 2, backgroundColor: "#7A241840", marginRight: 4, borderStyle: "dashed", borderWidth: 1, borderColor: "#7A241840" }} />
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#2C201460" }}>Member</Text>
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}
