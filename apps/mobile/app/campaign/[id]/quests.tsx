import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { schema } from "@grimoire/core";

type Entity = typeof schema.entities.$inferSelect;

const STATUS_ORDER = ["active", "rumoured", "complete", "failed"] as const;
const STATUS_COLORS: Record<string, string> = {
  active: "#A07A2C",
  rumoured: "#ECE3CF60",
  complete: "#4A7A2C",
  failed: "#7A2418",
};

export default function QuestsScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [quests, setQuests] = useState<Entity[]>([]);

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
  }, [campaignId]);

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
      <Stack.Screen options={{ title: "Quests" }} />
      <ScrollView
        className="flex-1 bg-leather"
        contentContainerStyle={{ padding: 20 }}
      >
        <Text
          className="text-parchment text-xl mb-1"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          Quest Log
        </Text>
        <Text
          className="text-parchment/40 text-xs mb-4"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          {quests.length} quest{quests.length !== 1 ? "s" : ""}
        </Text>

        <GoldRule />

        {quests.length === 0 ? (
          <View className="mt-6 items-center">
            <Text
              className="text-parchment/50 text-sm text-center"
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
                    backgroundColor: STATUS_COLORS[group.status] ?? "#ECE3CF40",
                    marginRight: 8,
                  }}
                />
                <Text
                  className="text-xs uppercase tracking-wider"
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    color: STATUS_COLORS[group.status] ?? "#ECE3CF40",
                  }}
                >
                  {group.status}
                </Text>
                <Text
                  className="text-parchment/30 text-xs ml-2"
                  style={{ fontFamily: "Inter_400Regular" }}
                >
                  {group.items.length}
                </Text>
              </View>

              {group.items.map((quest) => (
                <Pressable
                  key={quest.id}
                  onPress={() =>
                    router.push(
                      `/campaign/${campaignId}/entity/${quest.id}`,
                    )
                  }
                  className="py-3 px-3 mb-1.5 rounded-sm border border-parchment/10 bg-parchment/3"
                >
                  <Text
                    className="text-parchment text-base"
                    style={{ fontFamily: "CormorantGaramond_600SemiBold" }}
                  >
                    {quest.name}
                  </Text>
                  {quest.summary ? (
                    <Text
                      className="text-parchment/50 text-sm mt-1"
                      style={{ fontFamily: "Inter_400Regular" }}
                      numberOfLines={2}
                    >
                      {quest.summary}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ))
        )}

        <View className="h-20" />
      </ScrollView>
    </>
  );
}
