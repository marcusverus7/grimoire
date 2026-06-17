import { View, Text, Pressable, ScrollView, Share, TextInput, Alert } from "react-native";
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
      }

      // PC/NPC inventory
      if (e.kind === "pc" || e.kind === "npc") {
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
      } else {
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
        <View className="flex-row items-center mb-4">
          <Text
            className="text-ink-soft text-xs uppercase tracking-wider"
            style={{ fontFamily: "Inter_500Medium" }}
          >
            {KIND_LABELS[entity.kind] ?? entity.kind}
          </Text>
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

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <>
            <GoldRule />
            <View className="mt-4">
              <Text
                className="text-ink-soft text-xs uppercase tracking-wider mb-3"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                Mentioned In
              </Text>
              {backlinks.map((bl, i) => (
                <Pressable
                  key={`${bl.fromType}-${bl.fromId}-${i}`}
                  onPress={() => {
                    if (bl.fromType === "entity") {
                      router.push(
                        `/campaign/${campaignId}/entity/${bl.fromId}`,
                      );
                    } else {
                      router.push(
                        `/campaign/${campaignId}/session/${bl.fromId}`,
                      );
                    }
                  }}
                  className="py-2 px-2 mb-1"
                >
                  <View className="flex-row items-center">
                    <Text
                      className="text-xs uppercase tracking-wider mr-2"
                      style={{
                        fontFamily: "Inter_500Medium",
                        color: bl.fromType === "session" ? "#A07A2C" : "#4A3F32",
                      }}
                    >
                      {bl.fromType === "session" ? "Session" : "Entity"}
                    </Text>
                    <Text
                      className="text-ink text-base flex-1"
                      style={{ fontFamily: "CormorantGaramond_600SemiBold" }}
                    >
                      {bl.name}
                    </Text>
                  </View>
                  {bl.snippet && (
                    <Text
                      className="text-ink-soft/60 text-sm mt-0.5"
                      style={{ fontFamily: "Inter_400Regular" }}
                      numberOfLines={2}
                    >
                      {bl.snippet}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* PC/NPC — Inventory */}
        {inventory.length > 0 ? (
          <>
            <GoldRule />
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#5A4D3E", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                Inventory
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
    </>
  );
}

