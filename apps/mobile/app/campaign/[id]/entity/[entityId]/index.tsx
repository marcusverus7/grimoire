import { View, Text, Pressable, ScrollView, Share, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Image } from "react-native";
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
import { color, withAlpha, useThemeTick } from "@/lib/theme";

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
  useThemeTick();
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
      <View className="flex-1 bg-parchment dark:bg-night-bg items-center justify-center">
        <Text className="text-ink/50 dark:text-night-ink/50 font-inter text-sm">
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
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.gold }}>
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
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: attrs?.["needsPrep"] === true ? color.oxblood : withAlpha("gold", 0x80 / 255) }}>
                  {attrs?.["needsPrep"] === true ? "⚑ Prep" : "⚑"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setNoteInput(typeof attrs?.["sessionNote"] === "string" ? attrs["sessionNote"] : "");
                  setShowNoteModal(true);
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: attrs?.["sessionNote"] ? color.gold : withAlpha("gold", 0x50 / 255) }}>
                  ✎
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(`/campaign/${campaignId}/entity/${entityId}/edit`)
                }
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: color.gold }}>
                  Edit
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView className="flex-1" style={{ backgroundColor: "transparent" }} contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        {typeof attrs?.["imageUri"] === "string" && (
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <Image
              source={{ uri: attrs["imageUri"] as string }}
              style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: withAlpha("gold", 0x40 / 255) }}
            />
          </View>
        )}
        <Text
          className="text-ink dark:text-night-ink text-2xl mb-1"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          {entity.name}
        </Text>
        <View className="flex-row items-center flex-wrap mb-4">
          <Text
            className="text-ink-soft dark:text-night-ink-soft text-xs uppercase tracking-wider"
            style={{ fontFamily: "Inter_500Medium" }}
          >
            {KIND_LABELS[entity.kind] ?? entity.kind}
          </Text>
          {attrs?.["role"] ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("inkSoft", 0x80 / 255), marginLeft: 8 }}>
              · {String(attrs["role"])}
            </Text>
          ) : null}
          {(entity.kind === "npc" || entity.kind === "pc") && typeof attrs?.["pronouns"] === "string" && attrs["pronouns"] ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.inkFaint, marginLeft: 8, fontStyle: "italic" }}>
              {String(attrs["pronouns"])}
            </Text>
          ) : null}
          {attrs?.["factionId"] ? (() => {
            const fn = db.select({ name: schema.entities.name }).from(schema.entities).where(eq(schema.entities.id, String(attrs["factionId"]))).get();
            return fn ? (
              <Pressable onPress={() => router.push(`/campaign/${campaignId}/entity/${String(attrs["factionId"])}`)} style={{ marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 2, backgroundColor: withAlpha("oxblood", 0x10 / 255), borderWidth: 1, borderColor: withAlpha("oxblood", 0x30 / 255) }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: color.oxblood }}>{fn.name}</Text>
              </Pressable>
            ) : null;
          })() : null}
          {(entity.kind === "npc" || entity.kind === "pc") ? (() => {
            const status = typeof attrs?.["npcStatus"] === "string" ? attrs["npcStatus"] : "alive";
            const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
              alive: { label: "● Alive", color: withAlpha("success", 0x90 / 255), bg: withAlpha("success", 0x08 / 255), border: withAlpha("success", 0x30 / 255) },
              dead: { label: "☠ Dead", color: color.oxblood, bg: withAlpha("oxblood", 0x10 / 255), border: withAlpha("oxblood", 0x40 / 255) },
              missing: { label: "? Missing", color: color.gold, bg: withAlpha("gold", 0x10 / 255), border: withAlpha("gold", 0x40 / 255) },
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
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: withAlpha("oxblood", 0x10 / 255), borderRadius: 2 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.oxblood, textTransform: "uppercase" }}>
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
                style={{ paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: withAlpha("success", 0x50 / 255), borderRadius: 2, backgroundColor: withAlpha("success", 0x08 / 255) }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.success, textTransform: "uppercase" }}>
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
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("success", 0x40 / 255), backgroundColor: withAlpha("success", 0x08 / 255) }}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("success", 0x90 / 255), marginRight: 4 }}>◈</Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: color.success }}>{loc.name}</Text>
            </Pressable>
          ) : null;
        })() : null}

        {/* Session Note banner */}
        {typeof attrs?.["sessionNote"] === "string" && attrs["sessionNote"] ? (
          <Pressable
            onPress={() => { setNoteInput(attrs["sessionNote"] as string); setShowNoteModal(true); }}
            style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("goldBright", 0x60 / 255), backgroundColor: withAlpha("goldBright", 0x12 / 255), borderLeftWidth: 3, borderLeftColor: color.goldBright }}
          >
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("goldBright", 0x80 / 255), marginRight: 6, marginTop: 1 }}>✎</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.inkSoft, flex: 1, lineHeight: 19 }}>
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
                  borderColor: withAlpha("gold", 0x40 / 255),
                  backgroundColor: withAlpha("gold", 0x0A / 255),
                }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.gold }}>{tag}</Text>
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
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("success", 0x90 / 255) }}>{parent.name}</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("success", 0x60 / 255), marginHorizontal: 6 }}>›</Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.success }}>{entity.name}</Text>
            </Pressable>
          ) : null;
        })() : null}

        {/* Quest status quick-toggle */}
        {entity.kind === "quest" && attrs != null ? (
          <View style={{ marginBottom: 16, flexDirection: "row", gap: 8 }}>
            {(["open", "active", "completed", "failed"] as const).map((status) => {
              const isCurrent = String(attrs["questStatus"] ?? "open") === status;
              const colors: Record<string, string> = { open: color.inkSoft, active: color.gold, completed: color.success, failed: color.oxblood };
              const statusColor = colors[status] ?? color.inkSoft;
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
                    borderColor: isCurrent ? statusColor : `${statusColor}40`,
                    backgroundColor: isCurrent ? `${statusColor}15` : "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: isCurrent ? statusColor : `${statusColor}80`, textTransform: "capitalize" }}>
                    {status}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Quest giver + reward */}
        {entity.kind === "quest" && attrs != null && (attrs["questGiver"] || attrs["questReward"]) ? (
          <View style={{ marginBottom: 16, gap: 8 }}>
            {typeof attrs["questGiver"] === "string" && attrs["questGiver"] ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 0.8 }}>Given by</Text>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 14, color: color.ink }}>{String(attrs["questGiver"])}</Text>
              </View>
            ) : null}
            {typeof attrs["questReward"] === "string" && attrs["questReward"] ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 0.8 }}>Reward</Text>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 14, color: color.success }}>{String(attrs["questReward"])}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Location region + population */}
        {entity.kind === "location" && attrs != null && (attrs["region"] || attrs["population"]) ? (
          <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
            {typeof attrs["region"] === "string" && attrs["region"] ? (
              <View>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>Region</Text>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 14, color: color.ink }}>{String(attrs["region"])}</Text>
              </View>
            ) : null}
            {typeof attrs["population"] === "string" && attrs["population"] ? (
              <View>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>Population</Text>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 14, color: color.ink }}>{String(attrs["population"])}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Faction relationships */}
        {entity.kind === "faction" && Array.isArray(attrs?.["relationships"]) && (attrs["relationships"] as { factionId: string; type: string }[]).length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            {(attrs["relationships"] as { factionId: string; type: string }[]).map((rel) => {
              const colors: Record<string, string> = { ally: color.success, enemy: color.oxblood, rival: color.gold, neutral: color.inkSoft };
              const relColor = colors[rel.type] ?? color.inkSoft;
              const factionName = db.select({ name: schema.entities.name }).from(schema.entities).where(eq(schema.entities.id, rel.factionId)).get()?.name ?? rel.factionId;
              return (
                <Pressable
                  key={rel.factionId}
                  onPress={() => router.push(`/campaign/${campaignId}/entity/${rel.factionId}`)}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 4, marginBottom: 2 }}
                >
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: `${relColor}50`, backgroundColor: `${relColor}10`, marginRight: 10 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: relColor, textTransform: "uppercase", letterSpacing: 1 }}>{rel.type}</Text>
                  </View>
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>{factionName}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.gold }}>›</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Item — Held By */}
        {entity.kind === "item" && heldByName ? (
          <Pressable
            onPress={() => router.push(`/campaign/${campaignId}/entity/${heldByName.id}`)}
            style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: withAlpha("arcane", 0x30 / 255), backgroundColor: withAlpha("arcane", 0x08 / 255), borderRadius: 2 }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: withAlpha("arcane", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1.5, marginRight: 10 }}>
              Held By
            </Text>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>
              {heldByName.name}
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.arcane }}>›</Text>
          </Pressable>
        ) : null}

        {/* Quest — Interested Characters */}
        {entity.kind === "quest" && interestedEntities.length > 0 ? (
          <View style={{ marginBottom: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {interestedEntities.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/campaign/${campaignId}/entity/${c.id}`)}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255), backgroundColor: withAlpha("gold", 0x08 / 255) }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.gold }}>
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
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("goldBright", 0x50 / 255), backgroundColor: withAlpha("goldBright", 0x10 / 255), marginRight: 12 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.goldBright }}>Lv {String(attrs["level"])}</Text>
              </View>
            ) : null}
            {attrs["xp"] && attrs["maxXp"] ? (
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkSoft", 0x60 / 255) }}>XP</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkSoft", 0x60 / 255) }}>{String(attrs["xp"])} / {String(attrs["maxXp"])}</Text>
                </View>
                <View style={{ height: 4, backgroundColor: withAlpha("goldBright", 0x20 / 255), borderRadius: 2 }}>
                  <View style={{ height: 4, backgroundColor: color.goldBright, borderRadius: 2, width: `${Math.min(100, Math.round(Number(attrs["xp"]) / Number(attrs["maxXp"]) * 100))}%` }} />
                </View>
              </View>
            ) : attrs["xp"] ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("inkSoft", 0x80 / 255) }}>XP: {String(attrs["xp"])}</Text>
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
              backgroundColor: withAlpha("panelInk", 0x0A / 255),
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
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>HP ✎</Text>
                {editingHp ? (
                  <TextInput
                    value={hpInput}
                    onChangeText={setHpInput}
                    keyboardType="numeric"
                    autoFocus
                    style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.ink, minWidth: 40, textAlign: "center", borderBottomWidth: 1, borderBottomColor: color.gold }}
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
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: Number(attrs["currentHp"]) === 0 ? color.oxblood : Number(attrs["currentHp"]) < Number(attrs["hp"]) / 2 ? color.gold : color.ink }}>
                    {String(attrs["currentHp"])}<Text style={{ fontSize: 13, color: withAlpha("inkSoft", 0x60 / 255) }}>/{String(attrs["hp"])}</Text>
                  </Text>
                ) : (
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.ink }}>{String(attrs["hp"])}</Text>
                )}
              </Pressable>
            ) : null}
            {attrs["ac"] ? (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>AC</Text>
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.ink }}>{String(attrs["ac"])}</Text>
              </View>
            ) : null}
            {attrs["initiative"] ? (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Init</Text>
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.ink }}>{String(attrs["initiative"])}</Text>
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
                    backgroundColor: withAlpha("gold", 0x0A / 255),
                    borderWidth: 1,
                    borderColor: withAlpha("gold", 0x25 / 255),
                    borderRadius: 2,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 10,
                      color: color.gold,
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
                      color: color.ink,
                    }}
                  >
                    {profile.name}
                  </Text>
                  {profile.summary ? (
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: color.inkFaint,
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
            className="text-ink/80 dark:text-night-ink/80 text-base mb-4 leading-6"
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
                {sessionBls.length > 0 && (() => {
                  const sessionDates = sessionBls.map((bl) => {
                    const s = db.select({ number: schema.sessions.number, playedOn: schema.sessions.playedOn })
                      .from(schema.sessions).where(eq(schema.sessions.id, bl.fromId)).get();
                    return s ? { number: s.number, date: typeof s.playedOn === "string" ? s.playedOn : null } : null;
                  }).filter((s): s is NonNullable<typeof s> => s != null && s.date != null)
                    .sort((a, b) => a.date!.localeCompare(b.date!));
                  const firstSession = sessionDates[0];
                  const lastSession = sessionDates.length > 1 ? sessionDates[sessionDates.length - 1] : null;
                  return (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: color.gold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
                      Appears in Sessions
                    </Text>
                    {firstSession && (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("inkSoft", 0x60 / 255), marginBottom: 8 }}>
                        First: Session {firstSession.number}{lastSession ? ` · Last: Session ${lastSession.number}` : ""}
                      </Text>
                    )}
                    {sessionBls.map((bl, i) => (
                      <Pressable
                        key={`s-${bl.fromId}-${i}`}
                        onPress={() => router.push(`/campaign/${campaignId}/session/${bl.fromId}` as Parameters<typeof router.push>[0])}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 4, marginBottom: 2, borderRadius: 2, backgroundColor: withAlpha("gold", 0x06 / 255) }}
                      >
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255), backgroundColor: withAlpha("gold", 0x10 / 255), marginRight: 10 }}>
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: color.gold, textTransform: "uppercase", letterSpacing: 1 }}>
                            Session
                          </Text>
                        </View>
                        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>
                          {bl.name}
                        </Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.gold }}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                  );
                })()}
                {entityBls.length > 0 && (
                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: color.inkSoft, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
                      Linked Entities
                    </Text>
                    {entityBls.map((bl, i) => (
                      <Pressable
                        key={`e-${bl.fromId}-${i}`}
                        onPress={() => router.push(`/campaign/${campaignId}/entity/${bl.fromId}` as Parameters<typeof router.push>[0])}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 4, marginBottom: 2 }}
                      >
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: withAlpha("panelBorderDark", 0x60 / 255), marginRight: 10 }} />
                        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>
                          {bl.name}
                        </Text>
                        {bl.snippet ? (
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.inkFaint, maxWidth: 120 }} numberOfLines={1}>
                            {bl.snippet}
                          </Text>
                        ) : null}
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.gold, marginLeft: 4 }}>›</Text>
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
                backgroundColor: withAlpha("oxblood", 0x08 / 255),
                borderWidth: 1,
                borderColor: withAlpha("oxblood", 0x25 / 255),
                borderRadius: 2,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 10,
                  color: color.oxblood,
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
                  color: color.ink,
                  lineHeight: 21,
                }}
              >
                {String(attrs["gmSecret"])}
              </Text>
            </View>
          </>
        ) : null}

        {/* PC Personality Traits */}
        {entity.kind === "pc" && attrs != null && (attrs["pcTrait"] || attrs["pcIdeal"] || attrs["pcBond"] || attrs["pcFlaw"]) ? (
          <>
            <GoldRule />
            <View style={{ marginTop: 14, marginBottom: 8 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: color.goldBright, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                Personality
              </Text>
              {([
                { key: "pcTrait", label: "Trait" },
                { key: "pcIdeal", label: "Ideal" },
                { key: "pcBond", label: "Bond" },
                { key: "pcFlaw", label: "Flaw" },
              ] as { key: string; label: string }[]).filter((f) => attrs[f.key]).map((f) => (
                <View key={f.key} style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: withAlpha("goldBright", 0x12 / 255) }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: withAlpha("goldBright", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{f.label}</Text>
                  <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 15, color: withAlpha("ink", 0xCC / 255), fontStyle: "italic", lineHeight: 22 }}>
                    {String(attrs[f.key])}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Custom attributes */}
        {Array.isArray(attrs?.["customAttrs"]) && (attrs["customAttrs"] as { key: string; value: string }[]).length > 0 ? (
          <>
            <GoldRule />
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              {(attrs["customAttrs"] as { key: string; value: string }[]).map((a, i) => (
                <View key={i} style={{ flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: withAlpha("gold", 0x12 / 255) }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, width: 100, paddingRight: 8 }} numberOfLines={1}>
                    {a.key}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, flex: 1 }}>{a.value}</Text>
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
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: color.inkSoft, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                {entity.kind === "faction" ? "Members" : "Inventory"}
              </Text>
              {inventory.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/campaign/${campaignId}/entity/${item.id}`)}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: withAlpha("arcane", 0x50 / 255), marginRight: 10 }} />
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>{item.name}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.gold }}>›</Text>
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
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: color.inkSoft, textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                  Resources
                </Text>
                {resources.length > 0 ? (
                  <Pressable
                    onPress={longRest}
                    style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("success", 0x50 / 255), backgroundColor: withAlpha("success", 0x08 / 255), marginRight: 8 }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: color.success, textTransform: "uppercase", letterSpacing: 1 }}>Long Rest</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => { setResourceName(""); setResourceMax(""); setShowResourceModal(true); }}
                  style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("gold", 0x50 / 255), backgroundColor: withAlpha("gold", 0x08 / 255) }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: color.gold, textTransform: "uppercase", letterSpacing: 1 }}>+ Add</Text>
                </Pressable>
              </View>
              {resources.length === 0 ? (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("inkSoft", 0x60 / 255), paddingBottom: 4 }}>
                  No resources — add spell slots, rage uses, ki points…
                </Text>
              ) : resources.map((res, i) => {
                const pct = res.max > 0 ? res.current / res.max : 0;
                const barColor = res.current === 0 ? color.oxblood : res.current < res.max / 2 ? color.gold : color.success;
                return (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.ink, flex: 1 }}>{res.name}</Text>
                      <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 16, color: barColor, marginRight: 10 }}>
                        {res.current}<Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkSoft", 0x60 / 255) }}>/{res.max}</Text>
                      </Text>
                      <Pressable
                        onPress={() => adjustResource(i, -1)}
                        style={{ width: 28, height: 28, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("oxblood", 0x30 / 255), alignItems: "center", justifyContent: "center", marginRight: 4 }}
                      >
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: color.oxblood }}>−</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => adjustResource(i, 1)}
                        style={{ width: 28, height: 28, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("success", 0x30 / 255), alignItems: "center", justifyContent: "center", marginRight: 8 }}
                      >
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: color.success }}>+</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteResource(i)}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: withAlpha("oxblood", 0x40 / 255) }}>×</Text>
                      </Pressable>
                    </View>
                    <View style={{ height: 3, backgroundColor: withAlpha("panelInk", 0x15 / 255), borderRadius: 2, overflow: "hidden" }}>
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
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: color.inkSoft, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                  Sub-locations
                </Text>
                {subs.map((sub) => (
                  <Pressable
                    key={sub.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${sub.id}`)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: withAlpha("success", 0x50 / 255), marginRight: 10 }} />
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>{sub.name}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.success }}>›</Text>
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
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: color.inkSoft, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                Quest Involvement
              </Text>
              {questHooks.map((q) => {
                const statusColors: Record<string, string> = { open: color.inkSoft, active: color.gold, completed: color.success, failed: color.oxblood };
                const questStatusColor = statusColors[q.questStatus] ?? color.inkSoft;
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${q.id}`)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 }}
                  >
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: `${questStatusColor}40`, backgroundColor: `${questStatusColor}0A`, marginRight: 10 }}>
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: questStatusColor, textTransform: "capitalize" }}>
                        {q.questStatus}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>
                      {q.name}
                    </Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.gold }}>›</Text>
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
            <Pressable onPress={() => {}} style={{ backgroundColor: color.parchment, borderRadius: 4, borderWidth: 1, borderColor: withAlpha("goldBright", 0x40 / 255), padding: 20 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 16, color: color.ink, marginBottom: 4 }}>
                Session Note
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.inkFaint, marginBottom: 12 }}>
                Quick note for this session — visible on entity detail as a banner.
              </Text>
              <TextInput
                value={noteInput}
                onChangeText={setNoteInput}
                placeholder="e.g. knows about the vault, wants coin, secretly works for Harwick…"
                placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                multiline
                autoFocus
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, minHeight: 80, borderWidth: 1, borderColor: withAlpha("goldBright", 0x30 / 255), borderRadius: 2, padding: 10, backgroundColor: color.paperBright, marginBottom: 16, lineHeight: 20 }}
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
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: withAlpha("oxblood", 0x70 / 255) }}>Clear</Text>
                  </Pressable>
                ) : <View />}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable onPress={() => setShowNoteModal(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.inkSoft }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const next = { ...(entity.attrs ?? {}) as Record<string, unknown> };
                      if (noteInput.trim()) { next["sessionNote"] = noteInput.trim(); } else { delete next["sessionNote"]; }
                      db.update(schema.entities).set({ attrs: next, updatedAt: new Date() }).where(eq(schema.entities.id, entityId)).run();
                      setEntity((prev) => prev ? { ...prev, attrs: next } : prev);
                      setShowNoteModal(false);
                    }}
                    style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: color.goldBright, borderRadius: 2 }}
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: color.onAccent, textTransform: "uppercase", letterSpacing: 1 }}>Save</Text>
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
            <Pressable onPress={() => {}} style={{ backgroundColor: color.parchment, borderRadius: 4, borderWidth: 1, borderColor: withAlpha("goldBright", 0x40 / 255), padding: 20 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 16, color: color.ink, marginBottom: 4 }}>
                Add Resource
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.inkFaint, marginBottom: 12 }}>
                Spell slots, ki points, rage uses, luck points…
              </Text>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Name
              </Text>
              <TextInput
                value={resourceName}
                onChangeText={setResourceName}
                placeholder="e.g. Spell Slots (3rd), Rage"
                placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                autoFocus
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, borderWidth: 1, borderColor: withAlpha("goldBright", 0x30 / 255), borderRadius: 2, padding: 10, backgroundColor: color.paperBright, marginBottom: 12 }}
              />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Maximum
              </Text>
              <TextInput
                value={resourceMax}
                onChangeText={setResourceMax}
                placeholder="e.g. 3"
                placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                keyboardType="number-pad"
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, borderWidth: 1, borderColor: withAlpha("goldBright", 0x30 / 255), borderRadius: 2, padding: 10, backgroundColor: color.paperBright, marginBottom: 16 }}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                <Pressable onPress={() => setShowResourceModal(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.inkSoft }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveNewResource}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: color.goldBright, borderRadius: 2 }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: color.onAccent, textTransform: "uppercase", letterSpacing: 1 }}>Add</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

