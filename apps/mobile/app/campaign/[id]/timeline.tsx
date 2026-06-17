import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, asc } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type Session = typeof schema.sessions.$inferSelect;

export default function TimelineScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [campaignName, setCampaignName] = useState("Campaign");

  const load = useCallback(() => {
    const c = db
      .select({ name: schema.campaigns.name })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .get();
    setCampaignName(c?.name ?? "Campaign");

    const rows = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.campaignId, campaignId))
      .orderBy(asc(schema.sessions.number))
      .all();
    setSessions(rows);
  }, [campaignId]);

  useFocusEffect(load);

  return (
    <>
      <Stack.Screen options={{ title: "Timeline" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        className="flex-1 bg-parchment"
        contentContainerStyle={{ padding: 20 }}
      >
        <Text
          className="text-ink text-xl mb-1"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          {campaignName}
        </Text>
        <Text
          className="text-ink-faint text-xs mb-4"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </Text>

        <GoldRule />

        {sessions.length === 0 ? (
          <View className="mt-6 items-center">
            <Text
              className="text-ink/50 text-sm text-center"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              No sessions yet. Create your first session to begin the timeline.
            </Text>
          </View>
        ) : (
          <View className="mt-4">
            {sessions.map((s, i) => {
              const isLast = i === sessions.length - 1;
              const isPlayed = s.status === "played";
              return (
                <Pressable
                  key={s.id}
                  onPress={() =>
                    router.push(
                      `/campaign/${campaignId}/session/${s.id}`,
                    )
                  }
                  className="flex-row"
                >
                  {/* Timeline spine */}
                  <View className="items-center mr-4" style={{ width: 20 }}>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: isPlayed ? "#A07A2C" : "transparent",
                        borderWidth: 2,
                        borderColor: isPlayed ? "#A07A2C" : "#8A7D6D",
                        marginTop: 4,
                      }}
                    />
                    {!isLast && (
                      <View
                        style={{
                          width: 2,
                          flex: 1,
                          backgroundColor: "#E8DBBF",
                          minHeight: 40,
                        }}
                      />
                    )}
                  </View>

                  {/* Content */}
                  <View className="flex-1 pb-5">
                    <Text
                      className="text-ink text-base"
                      style={{ fontFamily: "CormorantGaramond_700Bold" }}
                    >
                      Session {s.number}
                      {s.title ? `: ${s.title}` : ""}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Text
                        className="text-xs uppercase tracking-wider"
                        style={{
                          fontFamily: "Inter_500Medium",
                          color: isPlayed ? "#A07A2C" : "#8A7D6D",
                        }}
                      >
                        {s.status}
                      </Text>
                      {s.playedOn ? (
                        <Text
                          className="text-ink/30 text-xs ml-2"
                          style={{ fontFamily: "Inter_400Regular" }}
                        >
                          {s.playedOn}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}
