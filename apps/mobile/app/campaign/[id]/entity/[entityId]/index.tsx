import { View, Text, Pressable, ScrollView, Share, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
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
            <View className="ml-2 px-2 py-0.5 bg-oxblood/10 rounded-sm">
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 10,
                  color: "#7A2418",
                  textTransform: "uppercase",
                }}
              >
                GM Only
              </Text>
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

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}

