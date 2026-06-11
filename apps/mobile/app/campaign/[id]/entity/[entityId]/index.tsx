import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { schema } from "@grimoire/core";
import { backlinksFor, type EntityLinkRow } from "@grimoire/core";

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
      <View className="flex-1 bg-leather items-center justify-center">
        <Text className="text-parchment/50 font-inter text-sm">
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
            <Pressable
              onPress={() =>
                router.push(`/campaign/${campaignId}/entity/${entityId}/edit`)
              }
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  color: "#A07A2C",
                  marginRight: 8,
                }}
              >
                Edit
              </Text>
            </Pressable>
          ),
        }}
      />
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

        {/* Quest status badge */}
        {entity.kind === "quest" && attrs != null && "questStatus" in attrs ? (
          <View className="mb-4 flex-row">
            <View className="px-3 py-1 bg-gold/10 rounded-sm border border-gold/20">
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  color: "#A07A2C",
                  textTransform: "capitalize",
                }}
              >
                {String(attrs["questStatus"])}
              </Text>
            </View>
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

        {/* Body placeholder */}
        <View className="mt-4 mb-6">
          <Text
            className="text-ink-soft/40 text-sm"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            Body editor coming in phase 2
          </Text>
        </View>

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
    </>
  );
}
