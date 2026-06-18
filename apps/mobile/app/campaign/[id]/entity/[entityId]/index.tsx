import { View, Text, Pressable, ScrollView, Share, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";
import { backlinksFor, richTextToMarkdown, type EntityLinkRow } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";
import { RichTextRenderer } from "@/components/RichTextRenderer";

type Entity = typeof schema.entities.$inferSelect;

const KIND_LABELS: Record<string, string> = {
  npc: "NPC",
  pc: "Player Character",
  location: "Location",
  faction: "Faction",
  item: "Item",
  quest: "Quest",
  custom: "Custom",
};

export default function EntityDetailScreen() {
  const { id: campaignId, entityId } = useLocalSearchParams<{
    id: string;
    entityId: string;
  }>();
  const router = useRouter();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [backlinks, setBacklinks] = useState<
    { fromType: string; fromId: string; name: string; snippet: string | null }[]
  >([]);
  const [interestedEntities, setInterestedEntities] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [questHooks, setQuestHooks] = useState<{ id: string; name: string; questStatus: string }[]>([]);
  const [heldByName, setHeldByName] = useState<{ id: string; name: string } | null>(null);
  const [inventory, setInventory] = useState<{ id: string; name: string }[]>([]);
  const [editingHp, setEditingHp] = useState(false);
  const [hpInput, setHpInput] = useState("");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceName, setResourceName] = useState("");
  const [resourceMax, setResourceMax] = useState("");

  const load = useCallback(() => {
    const e = db
      .select()
      .from(schema.entities)
      .where(eq(schema.entities.id, entityId))
      .get();
    setEntity(e ?? null);

    if (e) {
      const allLinks = db
        .select()
        .from(schema.entityLinks)
        .where(eq(schema.entityLinks.campaignId, campaignId))
        .all();

      const linkRows: EntityLinkRow[] = allLinks.map((l) => ({
        id: l.id,
        campaignId: l.campaignId,
        fromType: l.fromType as "entity" | "session",
        fromId: l.fromId,
        toEntityId: l.toEntityId,
        contextSnippet: l.contextSnippet,
      }));

      const bls = backlinksFor(entityId, linkRows);

      const enriched = bls.map((bl) => {
        let name = bl.fromId;
        if (bl.fromType === "entity") {
          const src = db
            .select({ name: schema.entities.name })
            .from(schema.entities)
            .where(eq(schema.entities.id, bl.fromId))
            .get();
          if (src) name = src.name;
        } else {
          const src = db
            .select({
              number: schema.sessions.number,
              title: schema.sessions.title,
            })
            .from(schema.sessions)
            .where(eq(schema.sessions.id, bl.fromId))
            .get();
          if (src)
            name = `Session ${src.number}${src.title ? `: ${src.title}` : ""}`;
        }
        return {
          fromType: bl.fromType,
          fromId: bl.fromId,
          name,
          snippet: bl.contextSnippet,
        };
      });
      setBacklinks(enriched);

      // Quest interest tracking
      if (e.kind === "quest") {
        const ids = (e.attrs as Record<string, unknown> | null)?.["interestedEntityIds"];
        if (Array.isArray(ids) && ids.length > 0) {
          const chars = (ids as string[]).map((eid) =>
            db.select({ id: schema.entities.id, name: schema.entities.name, kind: schema.entities.kind })
              .from(schema.entities)
              .where(eq(schema.entities.id, eid))
              .get()
          ).filter((c): c is NonNullable<typeof c> => c != null);
          setInterestedEntities(chars);
        } else {
          setInterestedEntities([]);
        }
        setQuestHooks([]);
      } else if (e.kind === "pc" || e.kind === "npc") {
        const quests = db.select().from(schema.entities)
          .where(eq(schema.entities.campaignId, campaignId))
          .all()
          .filter((q) => q.kind === "quest")
          .filter((q) => {
            const ids = (q.attrs as Record<string, unknown> | null)?.["interestedEntityIds"];
            return Array.isArray(ids) && (ids as string[]).includes(e.id);
          })
          .map((q) => ({
            id: q.id,
            name: q.name,
            questStatus: String((q.attrs as Record<string, unknown> | null)?.["questStatus"] ?? "open"),
          }));
        setQuestHooks(quests);
        setInterestedEntities([]);
        // PC/NPC inventory
        const items = db.select().from(schema.entities)
          .where(eq(schema.entities.campaignId, campaignId))
          .all()
          .filter((item) => {
            if (item.kind !== "item") return false;
            const held = (item.attrs as Record<string, unknown> | null)?.["heldBy"];
            return held === e.id;
          })
          .map((item) => ({ id: item.id, name: item.name }));
        setInventory(items);
        setHeldByName(null);
      } else if (e.kind === "faction") {
        const members = db.select().from(schema.entities)
          .where(eq(schema.entities.campaignId, campaignId))
          .all()
          .filter((m) => (m.attrs as Record<string, unknown> | null)?.["factionId"] === e.id)
          .sort((a, b) => a.name.localeCompare(b.name));
        setInventory(members.map((m) => ({ id: m.id, name: m.name })));
        setInterestedEntities([]);
        setQuestHooks([]);
        setHeldByName(null);
      } else if (e.kind === "item") {
        const hbId = (e.attrs as Record<string, unknown> | null)?.["heldBy"];
        if (typeof hbId === "string") {
          const holder = db.select({ id: schema.entities.id, name: schema.entities.name }).from(schema.entities).where(eq(schema.entities.id, hbId)).get();
          setHeldByName(holder ?? null);
        } else {
          setHeldByName(null);
        }
        setInterestedEntities([]);
        setQuestHooks([]);
        setInventory([]);
      } else {
        setInterestedEntities([]);
        setQuestHooks([]);
        setHeldByName(null);
        setInventory([]);
      }
    }
  }, [campaignId, entityId]);

  useFocusEffect(load);

  if (!entity) {
    return (
      <View className="flex-1 bg-parchment items-center justify-center">
        <Text className="text-ink/50 font-inter text-sm">
          Entity not found
        </Text>
      </View>
    );
  }

  const attrs = entity.attrs as Record<string, unknown> | null;

  const resources = Array.isArray(attrs?.["resources"])
    ? (attrs["resources"] as { name: string; max: number; current: number }[])
    : [];

  const adjustResource = (idx: number, delta: number) => {
    const res = resources[idx];
    if (!res) return;
    const newCurrent = Math.max(0, Math.min(res.max, res.current + delta));
    const updated = resources.map((r, i) => i === idx ? { ...r, current: newCurrent } : r);
    const next = { ...(entity.attrs ?? {}) as Record<string, unknown>, resources: updated };
    db.update(schema.entities).set({ attrs: next, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
    setEntity((prev) => prev ? { ...prev, attrs: next } : prev);
  };

  const deleteResource = (idx: number) => {
    const updated = resources.filter((_, i) => i !== idx);
    const next = { ...(entity.attrs ?? {}) as Record<string, unknown>, resources: updated };
    db.update(schema.entities).set({ attrs: next, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
    setEntity((prev) => prev ? { ...prev, attrs: next } : prev);
  };

  const saveNewResource = () => {
    const maxVal = parseInt(resourceMax, 10);
    if (!resourceName.trim() || isNaN(maxVal) || maxVal <= 0) return;
    const updated = [...resources, { name: resourceName.trim(), max: maxVal, current: maxVal }];
    const next = { ...(entity.attrs ?? {}) as Record<string, unknown>, resources: updated };
    db.update(schema.entities).set({ attrs: next, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
    setEntity((prev) => prev ? { ...prev, attrs: next } : prev);
    setResourceName("");
    setResourceMax("");
    setShowResourceModal(false);
  };

  const longRest = () => {
    if (resources.length === 0) return;
    const updated = resources.map((r) => ({ ...r, current: r.max }));
    const next = { ...(entity.attrs ?? {}) as Record<string, unknown>, resources: updated };
    db.update(schema.entities).set({ attrs: next, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
    setEntity((prev) => prev ? { ...prev, attrs: next } : prev);
  };

  const cycleStatus = () => {
    const cur = typeof attrs?.["npcStatus"] === "string" ? attrs["npcStatus"] : "alive";
    const next = cur === "alive" ? "dead" : cur === "dead" ? "missing" : "alive";
    const nextAttrs = { ...(entity.attrs ?? {}) as Record<string, unknown>, npcStatus: next };
    db.update(schema.entities).set({ attrs: nextAttrs, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
    setEntity((prev) => prev ? { ...prev, attrs: nextAttrs } : prev);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: entity.name,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginRight: 8 }}>
              <Pressable
                onPress={async () => {
                  const kind = KIND_LABELS[entity.kind] ?? entity.kind;
                  const bodyMd = entity.body
                    ? richTextToMarkdown(entity.body as RichTextNode)
                    : "";
                  const summary = entity.summary ? `\n_${entity.summary}_\n` : "";
                  const text = `# ${entity.name}\n**${kind}**${summary}\n${bodyMd}`.trim();
                  await Share.share({ title: entity.name, message: text });
                }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#A07A2C" }}>
                  Share
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const current = (entity.attrs ?? {}) as Record<string, unknown>;
                  const flagged = current["needsPrep"] === true;
                  const next: Record<string, unknown> = { ...current };
                  if (flagged) { delete next["needsPrep"]; } else { next["needsPrep"] = true; }
                  db.update(schema.entities).set({ attrs: next, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
                  setEntity((prev) => prev ? { ...prev, attrs: next } : prev);
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: attrs?.["needsPrep"] === true ? "#7A2418" : "#A07A2C80" }}>
                  {attrs?.["needsPrep"] === true ? "⚑ Prep" : "⚑"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setNoteInput(typeof attrs?.["sessionNote"] === "string" ? attrs["sessionNote"] : "");
                  setShowNoteModal(true);
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: attrs?.["sessionNote"] ? "#A07A2C" : "#A07A2C50" }}>
                  ✎
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(`/campaign/${campaignId}/entity/${entityId}/edit`)
                }
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#A07A2C" }}>
                  Edit
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView className="flex-1 bg-parchment-deep" contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <Text
          className="text-ink text-2xl mb-1"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          {entity.name}
        </Text>
        <View className="flex-row items-center flex-wrap mb-4">
          <Text
            className="text-ink-soft text-xs uppercase tracking-wider"
            style={{ fontFamily: "Inter_500Medium" }}
          >
            {KIND_LABELS[entity.kind] ?? entity.kind}
          </Text>
          {attrs?.["role"] ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E80", marginLeft: 8 }}>
              · {String(attrs["role"])}
            </Text>
          ) : null}
          {attrs?.["factionId"] ? (() => {
            const fn = db.select({ name: schema.entities.name }).from(schema.entities).where(eq(schema.entities.id, String(attrs["factionId"]))).get();
            return fn ? (
              <Pressable onPress={() => router.push(`/campaign/${campaignId}/entity/${String(attrs["factionId"])}`)} style={{ marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 2, backgroundColor: "#7A241810", borderWidth: 1, borderColor: "#7A241830" }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#7A2418" }}>{fn.name}</Text>
              </Pressable>
            ) : null;
          })() : null}
          {(entity.kind === "npc" || entity.kind === "pc") ? (() => {
            const status = typeof attrs?.["npcStatus"] === "string" ? attrs["npcStatus"] : "alive";
            const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
              alive: { label: "● Alive", color: "#4A806090", bg: "#4A806008", border: "#4A806030" },
              dead: { label: "☠ Dead", color: "#7A2418", bg: "#7A241810", border: "#7A241840" },
              missing: { label: "? Missing", color: "#A07A2C", bg: "#A07A2C10", border: "#A07A2C40" },
            };
            const cfg = statusConfig[status] ?? statusConfig["alive"];
            return (
              <Pressable
                onPress={cycleStatus}
                style={{ marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 2, backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: cfg.color }}>{cfg.label}</Text>
              </Pressable>
            );
          })() : null}
          {entity.visibility === "gm_only" && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "#7A241810", borderRadius: 2 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#7A2418", textTransform: "uppercase" }}>
                  GM Only
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Reveal to Table",
                    `Show "${entity.name}" to your players? This changes its visibility from GM-only to visible at the table.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Reveal",
                        style: "default",
                        onPress: () => {
                          const now = Date.now();
                          db.update(schema.entities)
                            .set({ visibility: "table", updatedAt: new Date(now) })
                            .where(eq(schema.entities.id, entityId))
                            .run();
                          db.insert(schema.reveals)
                            .values({
                              id: newId(),
                              entityId,
                              blockRef: null,
                              revealedTo: "table",
                              revealedToUserId: null,
                              revealedAt: new Date(now),
                            })
                            .run();
                          setEntity((prev) => prev ? { ...prev, visibility: "table" } : prev);
                        },
                      },
                    ],
                  );
                }}
                style={{ paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: "#4A806050", borderRadius: 2, backgroundColor: "#4A806008" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#4A8060", textTransform: "uppercase" }}>
                  Reveal ↗
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Currently At badge */}
        {attrs?.["locationId"] ? (() => {
          const loc = db.select({ id: schema.entities.id, name: schema.entities.name }).from(schema.entities).where(eq(schema.entities.id, String(attrs["locationId"]))).get();
          return loc ? (
            <Pressable
              onPress={() => router.push(`/campaign/${campaignId}/entity/${loc.id}` as Parameters<typeof router.push>[0])}
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: "#4A806040", backgroundColor: "#4A806008" }}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#4A806090", marginRight: 4 }}>◈</Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#4A8060" }}>{loc.name}</Text>
            </Pressable>
          ) : null;
        })() : null}

        {/* Session Note banner */}
        {typeof attrs?.["sessionNote"] === "string" && attrs["sessionNote"] ? (
          <Pressable
            onPress={() => { setNoteInput(attrs["sessionNote"] as string); setShowNoteModal(true); }}
            style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 2, borderWidth: 1, borderColor: "#C9A24A60", backgroundColor: "#C9A24A12", borderLeftWidth: 3, borderLeftColor: "#C9A24A" }}
          >
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#C9A24A80", marginRight: 6, marginTop: 1 }}>✎</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#5A4D3E", flex: 1, lineHeight: 19 }}>
              {attrs["sessionNote"] as string}
            </Text>
          </Pressable>
        ) : null}

        {/* Tags */}
        {Array.isArray(attrs?.["tags"]) && (attrs["tags"] as string[]).length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {(attrs["tags"] as string[]).map((tag, i) => (
              <View
                key={i}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#A07A2C40",
                  backgroundColor: "#A07A2C0A",
                }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C" }}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Location breadcrumb */}
        {entity.kind === "location" && attrs?.["parentId"] ? (() => {
          const parent = db.select({ id: schema.entities.id, name: schema.entities.name }).from(schema.entities).where(eq(schema.entities.id, String(attrs["parentId"]))).get();
          return parent ? (
            <Pressable
              onPress={() => router.push(`/campaign/${campaignId}/entity/${parent.id}`)}
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#4A806090" }}>{parent.name}</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#4A806060", marginHorizontal: 6 }}>›</Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#4A8060" }}>{entity.name}</Text>
            </Pressable>
          ) : null;
        })() : null}

        {/* Quest status quick-toggle */}
        {entity.kind === "quest" && attrs != null ? (
          <View style={{ marginBottom: 16, flexDirection: "row", gap: 8 }}>
            {(["open", "active", "completed", "failed"] as const).map((status) => {
              const isCurrent = String(attrs["questStatus"] ?? "open") === status;
              const colors: Record<string, string> = { open: "#5A4D3E", active: "#A07A2C", completed: "#4A8060", failed: "#7A2418" };
              const color = colors[status] ?? "#5A4D3E";
              return (
                <Pressable
                  key={status}
                  onPress={() => {
                    if (isCurrent) return;
                    const newAttrs = { ...(entity.attrs as Record<string, unknown> | null ?? {}), questStatus: status };
                    db.update(schema.entities)
                      .set({ attrs: newAttrs, updatedAt: new Date() })
                      .where(eq(schema.entities.id, entityId))
                      .run();
                    setEntity((prev) => prev ? { ...prev, attrs: newAttrs } : prev);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 2,
                    borderWidth: 1,
                    borderColor: isCurrent ? color : `${color}40`,
                    backgroundColor: isCurrent ? `${color}15` : "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: isCurrent ? color : `${color}80`, textTransform: "capitalize" }}>
                    {status}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Faction relationships */}
        {entity.kind === "faction" && Array.isArray(attrs?.["relationships"]) && (attrs["relationships"] as { factionId: string; type: string }[]).length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            {(attrs["relationships"] as { factionId: string; type: string }[]).map((rel) => {
              const colors: Record<string, string> = { ally: "#4A8060", enemy: "#7A2418", rival: "#A07A2C", neutral: "#5A4D3E" };
              const color = colors[rel.type] ?? "#5A4D3E";
              const factionName = db.select({ name: schema.entities.name }).from(schema.entities).where(eq(schema.entities.id, rel.factionId)).get()?.name ?? rel.factionId;
              return (
                <Pressable
                  key={rel.factionId}
                  onPress={() => router.push(`/campaign/${campaignId}/entity/${rel.factionId}`)}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 4, marginBottom: 2 }}
                >
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: `${color}50`, backgroundColor: `${color}10`, marginRight: 10 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color, textTransform: "uppercase", letterSpacing: 1 }}>{rel.type}</Text>
                  </View>
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>{factionName}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#A07A2C" }}>›</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Item — Held By */}
        {entity.kind === "item" && heldByName ? (
          <Pressable
            onPress={() => router.push(`/campaign/${campaignId}/entity/${heldByName.id}`)}
            style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#6A5ACD30", backgroundColor: "#6A5ACD08", borderRadius: 2 }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#6A5ACD80", textTransform: "uppercase", letterSpacing: 1.5, marginRight: 10 }}>
              Held By
            </Text>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>
              {heldByName.name}
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#6A5ACD" }}>›</Text>
          </Pressable>
        ) : null}

        {/* Quest — Interested Characters */}
        {entity.kind === "quest" && interestedEntities.length > 0 ? (
          <View style={{ marginBottom: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {interestedEntities.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/campaign/${campaignId}/entity/${c.id}`)}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#A07A2C40", backgroundColor: "#A07A2C08" }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#A07A2C" }}>
                  {c.kind === "pc" ? "★ " : ""}{c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* PC level / XP bar */}
        {entity.kind === "pc" && attrs != null && (attrs["level"] || attrs["xp"]) ? (
          <View style={{ marginBottom: 12, flexDirection: "row", alignItems: "center" }}>
            {attrs["level"] ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: "#C9A24A50", backgroundColor: "#C9A24A10", marginRight: 12 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#C9A24A" }}>Lv {String(attrs["level"])}</Text>
              </View>
            ) : null}
            {attrs["xp"] && attrs["maxXp"] ? (
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E60" }}>XP</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E60" }}>{String(attrs["xp"])} / {String(attrs["maxXp"])}</Text>
                </View>
                <View style={{ height: 4, backgroundColor: "#C9A24A20", borderRadius: 2 }}>
                  <View style={{ height: 4, backgroundColor: "#C9A24A", borderRadius: 2, width: `${Math.min(100, Math.round(Number(attrs["xp"]) / Number(attrs["maxXp"]) * 100))}%` }} />
                </View>
              </View>
            ) : attrs["xp"] ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E80" }}>XP: {String(attrs["xp"])}</Text>
            ) : null}
          </View>
        ) : null}

        {/* NPC/PC stat block */}
        {(entity.kind === "npc" || entity.kind === "pc") && attrs != null &&
          (attrs["hp"] || attrs["ac"] || attrs["initiative"]) ? (
          <View
            style={{
              flexDirection: "row",
              marginBottom: 16,
              backgroundColor: "#2C20140A",
              borderRadius: 2,
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 20,
            }}
          >
            {attrs["hp"] ? (
              <Pressable
                style={{ alignItems: "center" }}
                onPress={() => { setHpInput(String(attrs["hp"] ?? "")); setEditingHp(true); }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>HP ✎</Text>
                {editingHp ? (
                  <TextInput
                    value={hpInput}
                    onChangeText={setHpInput}
                    keyboardType="numeric"
                    autoFocus
                    style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014", minWidth: 40, textAlign: "center", borderBottomWidth: 1, borderBottomColor: "#A07A2C" }}
                    onBlur={() => {
                      const newAttrs = { ...(entity?.attrs as Record<string, unknown> ?? {}), hp: hpInput };
                      db.update(schema.entities).set({ attrs: newAttrs, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
                      setEntity((prev) => prev ? { ...prev, attrs: newAttrs } : prev);
                      setEditingHp(false);
                    }}
                    onSubmitEditing={() => {
                      const newAttrs = { ...(entity?.attrs as Record<string, unknown> ?? {}), hp: hpInput };
                      db.update(schema.entities).set({ attrs: newAttrs, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
                      setEntity((prev) => prev ? { ...prev, attrs: newAttrs } : prev);
                      setEditingHp(false);
                    }}
                  />
                ) : attrs["currentHp"] != null && Number(attrs["currentHp"]) !== Number(attrs["hp"]) ? (
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: Number(attrs["currentHp"]) === 0 ? "#7A2418" : Number(attrs["currentHp"]) < Number(attrs["hp"]) / 2 ? "#A07A2C" : "#2C2014" }}>
                    {String(attrs["currentHp"])}<Text style={{ fontSize: 13, color: "#5A4D3E60" }}>/{String(attrs["hp"])}</Text>
                  </Text>
                ) : (
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014" }}>{String(attrs["hp"])}</Text>
                )}
              </Pressable>
            ) : null}
            {attrs["ac"] ? (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>AC</Text>
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014" }}>{String(attrs["ac"])}</Text>
              </View>
            ) : null}
            {attrs["initiative"] ? (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Init</Text>
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014" }}>{String(attrs["initiative"])}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Character Passport link */}
        {entity.kind === "pc" && entity.characterProfileId ? (
          <View style={{ marginBottom: 12 }}>
            {(() => {
              const profile = db
                .select({ name: schema.characterProfiles.name, summary: schema.characterProfiles.summary })
                .from(schema.characterProfiles)
                .where(eq(schema.characterProfiles.id, entity.characterProfileId!))
                .get();
              return profile ? (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: "#A07A2C0A",
                    borderWidth: 1,
                    borderColor: "#A07A2C25",
                    borderRadius: 2,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 10,
                      color: "#A07A2C",
                      textTransform: "uppercase",
                      letterSpacing: 1.5,
                      marginBottom: 4,
                    }}
                  >
                    Character Passport
                  </Text>
                  <Text
                    style={{
                      fontFamily: "CormorantGaramond_600SemiBold",
                      fontSize: 16,
                      color: "#2C2014",
                    }}
                  >
                    {profile.name}
                  </Text>
                  {profile.summary ? (
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: "#8A7D6D",
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {profile.summary}
                    </Text>
                  ) : null}
                </View>
              ) : null;
            })()}
          </View>
        ) : null}

        {/* Summary */}
        {entity.summary ? (
          <Text
            className="text-ink/80 text-base mb-4 leading-6"
            style={{ fontFamily: "CormorantGaramond_400Regular_Italic" }}
          >
            {entity.summary}
          </Text>
        ) : null}

        <GoldRule />

        {/* Body */}
        {entity.body ? (
          <View className="mt-4 mb-6">
            <RichTextRenderer body={entity.body as RichTextNode} campaignId={campaignId} />
          </View>
        ) : null}

        {/* Connections — sessions and entities that mention this one */}
        {backlinks.length > 0 && (() => {
          const sessionBls = backlinks.filter((bl) => bl.fromType === "session");
          const entityBls = backlinks.filter((bl) => bl.fromType === "entity");
          return (
            <>
              <GoldRule />
              <View style={{ marginTop: 16, marginBottom: 4 }}>
                {sessionBls.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
                      Appears in Sessions
                    </Text>
                    {sessionBls.map((bl, i) => (
                      <Pressable
                        key={`s-${bl.fromId}-${i}`}
                        onPress={() => router.push(`/campaign/${campaignId}/session/${bl.fromId}` as Parameters<typeof router.push>[0])}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 4, marginBottom: 2, borderRadius: 2, backgroundColor: "#A07A2C06" }}
                      >
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: "#A07A2C40", backgroundColor: "#A07A2C10", marginRight: 10 }}>
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
                            Session
                          </Text>
                        </View>
                        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>
                          {bl.name}
                        </Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#A07A2C" }}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {entityBls.length > 0 && (
                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#5A4D3E", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
                      Linked Entities
                    </Text>
                    {entityBls.map((bl, i) => (
                      <Pressable
                        key={`e-${bl.fromId}-${i}`}
                        onPress={() => router.push(`/campaign/${campaignId}/entity/${bl.fromId}` as Parameters<typeof router.push>[0])}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 4, marginBottom: 2 }}
                      >
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#4A3F3260", marginRight: 10 }} />
                        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>
                          {bl.name}
                        </Text>
                        {bl.snippet ? (
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", maxWidth: 120 }} numberOfLines={1}>
                            {bl.snippet}
                          </Text>
                        ) : null}
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#A07A2C", marginLeft: 4 }}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </>
          );
        })()}

        {/* GM Secret panel */}
        {attrs?.["gmSecret"] ? (
          <>
            <GoldRule />
            <View
              style={{
                marginTop: 16,
                marginBottom: 8,
                padding: 12,
                backgroundColor: "#7A241808",
                borderWidth: 1,
                borderColor: "#7A241825",
                borderRadius: 2,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 10,
                  color: "#7A2418",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}
              >
                ⚿ GM Secret
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: "#2C2014",
                  lineHeight: 21,
                }}
              >
                {String(attrs["gmSecret"])}
              </Text>
            </View>
          </>
        ) : null}

        {/* Custom attributes */}
        {Array.isArray(attrs?.["customAttrs"]) && (attrs["customAttrs"] as { key: string; value: string }[]).length > 0 ? (
          <>
            <GoldRule />
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              {(attrs["customAttrs"] as { key: string; value: string }[]).map((a, i) => (
                <View key={i} style={{ flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#A07A2C12" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, width: 100, paddingRight: 8 }} numberOfLines={1}>
                    {a.key}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", flex: 1 }}>{a.value}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}


        {/* PC/NPC inventory / faction members */}
        {inventory.length > 0 ? (
          <>
            <GoldRule />
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#5A4D3E", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                {entity.kind === "faction" ? "Members" : "Inventory"}
              </Text>
              {inventory.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/campaign/${campaignId}/entity/${item.id}`)}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#6A5ACD50", marginRight: 10 }} />
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>{item.name}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#A07A2C" }}>›</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* PC/NPC — Resource tracker */}
        {(entity.kind === "pc" || entity.kind === "npc") ? (
          <>
            <GoldRule />
            <View style={{ marginTop: 16, marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#5A4D3E", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                  Resources
                </Text>
                {resources.length > 0 ? (
                  <Pressable
                    onPress={longRest}
                    style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: "#4A806050", backgroundColor: "#4A806008", marginRight: 8 }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#4A8060", textTransform: "uppercase", letterSpacing: 1 }}>Long Rest</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => { setResourceName(""); setResourceMax(""); setShowResourceModal(true); }}
                  style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: "#A07A2C50", backgroundColor: "#A07A2C08" }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>+ Add</Text>
                </Pressable>
              </View>
              {resources.length === 0 ? (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E60", paddingBottom: 4 }}>
                  No resources — add spell slots, rage uses, ki points…
                </Text>
              ) : resources.map((res, i) => {
                const pct = res.max > 0 ? res.current / res.max : 0;
                const barColor = res.current === 0 ? "#7A2418" : res.current < res.max / 2 ? "#A07A2C" : "#4A8060";
                return (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#2C2014", flex: 1 }}>{res.name}</Text>
                      <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 16, color: barColor, marginRight: 10 }}>
                        {res.current}<Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E60" }}>/{res.max}</Text>
                      </Text>
                      <Pressable
                        onPress={() => adjustResource(i, -1)}
                        style={{ width: 28, height: 28, borderRadius: 2, borderWidth: 1, borderColor: "#7A241830", alignItems: "center", justifyContent: "center", marginRight: 4 }}
                      >
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#7A2418" }}>−</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => adjustResource(i, 1)}
                        style={{ width: 28, height: 28, borderRadius: 2, borderWidth: 1, borderColor: "#4A806030", alignItems: "center", justifyContent: "center", marginRight: 8 }}
                      >
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#4A8060" }}>+</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteResource(i)}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#7A241840" }}>×</Text>
                      </Pressable>
                    </View>
                    <View style={{ height: 3, backgroundColor: "#2C201415", borderRadius: 2, overflow: "hidden" }}>
                      <View style={{ height: 3, backgroundColor: barColor, borderRadius: 2, width: `${Math.round(pct * 100)}%` as `${number}%` }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Location — sub-locations */}
        {entity.kind === "location" ? (() => {
          const subs = db.select({ id: schema.entities.id, name: schema.entities.name, kind: schema.entities.kind, attrs: schema.entities.attrs })
            .from(schema.entities)
            .where(eq(schema.entities.campaignId, campaignId))
            .all()
            .filter((e) => e.kind === "location" && (e.attrs as Record<string, unknown> | null)?.["parentId"] === entity.id)
            .sort((a, b) => a.name.localeCompare(b.name));
          if (subs.length === 0) return null;
          return (
            <>
              <GoldRule />
              <View style={{ marginTop: 16, marginBottom: 4 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#5A4D3E", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                  Sub-locations
                </Text>
                {subs.map((sub) => (
                  <Pressable
                    key={sub.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${sub.id}`)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#4A806050", marginRight: 10 }} />
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>{sub.name}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#4A8060" }}>›</Text>
                  </Pressable>
                ))}
              </View>
            </>
          );
        })() : null}

        {/* PC/NPC — Quest involvement */}
        {questHooks.length > 0 ? (
          <>
            <GoldRule />
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#5A4D3E", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                Quest Involvement
              </Text>
              {questHooks.map((q) => {
                const statusColors: Record<string, string> = { open: "#5A4D3E", active: "#A07A2C", completed: "#4A8060", failed: "#7A2418" };
                const color = statusColors[q.questStatus] ?? "#5A4D3E";
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${q.id}`)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 }}
                  >
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: `${color}40`, backgroundColor: `${color}0A`, marginRight: 10 }}>
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color, textTransform: "capitalize" }}>
                        {q.questStatus}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>
                      {q.name}
                    </Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#A07A2C" }}>›</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>

      {/* Quick Session Note modal */}
      <Modal visible={showNoteModal} transparent animationType="fade" onRequestClose={() => setShowNoteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable onPress={() => setShowNoteModal(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 24 }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: "#FAF5EA", borderRadius: 4, borderWidth: 1, borderColor: "#C9A24A40", padding: 20 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 16, color: "#2C2014", marginBottom: 4 }}>
                Session Note
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", marginBottom: 12 }}>
                Quick note for this session — visible on entity detail as a banner.
              </Text>
              <TextInput
                value={noteInput}
                onChangeText={setNoteInput}
                placeholder="e.g. knows about the vault, wants coin, secretly works for Harwick…"
                placeholderTextColor="#2C201440"
                multiline
                autoFocus
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", minHeight: 80, borderWidth: 1, borderColor: "#C9A24A30", borderRadius: 2, padding: 10, backgroundColor: "#FFFDF7", marginBottom: 16, lineHeight: 20 }}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                {typeof attrs?.["sessionNote"] === "string" && attrs["sessionNote"] ? (
                  <Pressable
                    onPress={() => {
                      const next = { ...(entity.attrs ?? {}) as Record<string, unknown> };
                      delete next["sessionNote"];
                      db.update(schema.entities).set({ attrs: next, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
                      setEntity((prev) => prev ? { ...prev, attrs: next } : prev);
                      setShowNoteModal(false);
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#7A241870" }}>Clear</Text>
                  </Pressable>
                ) : <View />}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable onPress={() => setShowNoteModal(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#5A4D3E" }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const next = { ...(entity.attrs ?? {}) as Record<string, unknown> };
                      if (noteInput.trim()) { next["sessionNote"] = noteInput.trim(); } else { delete next["sessionNote"]; }
                      db.update(schema.entities).set({ attrs: next, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
                      setEntity((prev) => prev ? { ...prev, attrs: next } : prev);
                      setShowNoteModal(false);
                    }}
                    style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#C9A24A", borderRadius: 2 }}
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1 }}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Resource modal */}
      <Modal visible={showResourceModal} transparent animationType="fade" onRequestClose={() => setShowResourceModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable onPress={() => setShowResourceModal(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 24 }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: "#FAF5EA", borderRadius: 4, borderWidth: 1, borderColor: "#C9A24A40", padding: 20 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 16, color: "#2C2014", marginBottom: 4 }}>
                Add Resource
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", marginBottom: 12 }}>
                Spell slots, ki points, rage uses, luck points…
              </Text>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Name
              </Text>
              <TextInput
                value={resourceName}
                onChangeText={setResourceName}
                placeholder="e.g. Spell Slots (3rd), Rage"
                placeholderTextColor="#2C201440"
                autoFocus
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", borderWidth: 1, borderColor: "#C9A24A30", borderRadius: 2, padding: 10, backgroundColor: "#FFFDF7", marginBottom: 12 }}
              />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Maximum
              </Text>
              <TextInput
                value={resourceMax}
                onChangeText={setResourceMax}
                placeholder="e.g. 3"
                placeholderTextColor="#2C201440"
                keyboardType="number-pad"
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", borderWidth: 1, borderColor: "#C9A24A30", borderRadius: 2, padding: 10, backgroundColor: "#FFFDF7", marginBottom: 16 }}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                <Pressable onPress={() => setShowResourceModal(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#5A4D3E" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveNewResource}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#C9A24A", borderRadius: 2 }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1 }}>Add</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

