import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type Entity = typeof schema.entities.$inferSelect;

const STATUS_ORDER = ["active", "rumoured", "complete", "failed"] as const;
const STATUS_COLORS: Record<string, string> = {
  active: "#A07A2C",
  rumoured: "#5A4D3E",
  complete: "#4A7A2C",
  failed: "#7A2418",
};

export default function QuestsScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [quests, setQuests] = useState<Entity[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    const rows = db
      .select()
      .from(schema.entities)
      .where(
        and(
          eq(schema.entities.campaignId, campaignId),
          eq(schema.entities.kind, "quest"),
        ),
      )
      .all();
    setQuests(rows);
    // Build a name map for interested-entity lookups
    const allEntities = db.select({ id: schema.entities.id, name: schema.entities.name })
      .from(schema.entities)
      .where(eq(schema.entities.campaignId, campaignId))
      .all();
    const map: Record<string, string> = {};
    for (const e of allEntities) map[e.id] = e.name;
    setEntityNames(map);
  }, [campaignId]);

  const createQuest = () => {
    const qid = newId();
    const now = new Date();
    db.insert(schema.entities).values({
      id: qid,
      campaignId,
      kind: "quest",
      name: "New Quest",
      visibility: "table",
      attrs: { questStatus: "rumoured" },
      createdAt: now,
      updatedAt: now,
    }).run();
    router.push(`/campaign/${campaignId}/entity/${qid}/edit`);
  };

  useFocusEffect(load);

  const getQuestStatus = (q: Entity): string => {
    const attrs = q.attrs as Record<string, unknown> | null;
    return (attrs?.["questStatus"] as string) ?? "rumoured";
  };

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: quests.filter((q) => getQuestStatus(q) === status),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Quest Log",
          headerRight: () => (
            <Pressable onPress={createQuest} style={{ marginRight: 16 }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 22, color: "#A07A2C", lineHeight: 26 }}>+</Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        className="flex-1 bg-parchment"
        contentContainerStyle={{ padding: 20 }}
      >
        <Text
          className="text-ink text-xl mb-1"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          Quest Log
        </Text>
        <Text
          className="text-ink-faint text-xs mb-4"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          {quests.length} quest{quests.length !== 1 ? "s" : ""}
        </Text>

        <GoldRule />

        {quests.length === 0 ? (
          <View className="mt-6 items-center">
            <Text
              className="text-ink/50 text-sm text-center"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              No quests yet. Create a quest entity to track your party's
              objectives.
            </Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.status} className="mt-5">
              <View className="flex-row items-center mb-3">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: STATUS_COLORS[group.status] ?? "#8A7D6D",
                    marginRight: 8,
                  }}
                />
                <Text
                  className="text-xs uppercase tracking-wider"
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    color: STATUS_COLORS[group.status] ?? "#8A7D6D",
                  }}
                >
                  {group.status}
                </Text>
                <Text
                  className="text-ink/30 text-xs ml-2"
                  style={{ fontFamily: "Inter_400Regular" }}
                >
                  {group.items.length}
                </Text>
              </View>

              {group.items.map((quest) => {
                const qAttrs = quest.attrs as Record<string, unknown> | null;
                const interested = Array.isArray(qAttrs?.["interestedEntityIds"])
                  ? (qAttrs["interestedEntityIds"] as string[]).map((eid) => entityNames[eid]).filter(Boolean)
                  : [];
                return (
                  <Pressable
                    key={quest.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${quest.id}`)}
                    style={{ paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8, borderRadius: 2, borderWidth: 1, borderColor: "#2C201415", backgroundColor: "#FAF5EA" }}
                  >
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 17, color: "#2C2014", marginBottom: quest.summary || interested.length > 0 ? 4 : 0 }}>
                      {quest.name}
                    </Text>
                    {quest.summary ? (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#5A4D3E80", lineHeight: 18, marginBottom: interested.length > 0 ? 6 : 0 }} numberOfLines={2}>
                        {quest.summary}
                      </Text>
                    ) : null}
                    {interested.length > 0 ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                        {interested.map((name) => (
                          <View key={name} style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, backgroundColor: "#A07A2C12", borderWidth: 1, borderColor: "#A07A2C30" }}>
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C" }}>{name}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}
