import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type Attrs = Record<string, unknown>;

export default function CampaignStatsScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<{
    totalSessions: number;
    playedSessions: number;
    totalPlayTime: number; // minutes
    avgRating: number;
    ratingDist: number[]; // [1,2,3,4,5]
    entityCounts: Record<string, number>;
    questStats: { active: number; complete: number; failed: number; rumoured: number };
    topEntities: { id: string; name: string; kind: string; linkCount: number }[];
    arcBreakdown: { arcId: string | null; arcName: string; count: number; playTime: number }[];
    streakInfo: { longestStreak: number; currentStreak: number };
  } | null>(null);

  const load = useCallback(() => {
    const sessions = db.select().from(schema.sessions).where(eq(schema.sessions.campaignId, campaignId)).all();
    const entities = db.select().from(schema.entities).where(eq(schema.entities.campaignId, campaignId)).all();
    const links = db.select().from(schema.entityLinks).where(eq(schema.entityLinks.campaignId, campaignId)).all();
    const arcsRaw = db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId)).get();
    const campArcs = (((arcsRaw?.settings as Attrs | null)?.arcs ?? []) as { id: string; name: string }[]);

    const playedSess = sessions.filter((s) => s.status === "played");
    const totalPlayTime = playedSess.reduce((sum, s) => {
      const a = (s.attrs as Attrs | null) ?? {};
      const start = a["startedAt"] as number | undefined;
      const end = a["endedAt"] as number | undefined;
      if (start && end && end > start) return sum + Math.round((end - start) / 60000);
      return sum;
    }, 0);

    const ratings = playedSess.map((s) => {
      const r = (s.attrs as Attrs | null)?.["rating"];
      return typeof r === "number" ? r : 0;
    }).filter((r) => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const ratingDist = [1, 2, 3, 4, 5].map((r) => ratings.filter((x) => x === r).length);

    const entityCounts: Record<string, number> = {};
    for (const e of entities) {
      entityCounts[e.kind] = (entityCounts[e.kind] ?? 0) + 1;
    }

    const quests = entities.filter((e) => e.kind === "quest");
    const questStats = {
      active: quests.filter((q) => (q.attrs as Attrs | null)?.["questStatus"] === "active").length,
      complete: quests.filter((q) => (q.attrs as Attrs | null)?.["questStatus"] === "complete").length,
      failed: quests.filter((q) => (q.attrs as Attrs | null)?.["questStatus"] === "failed").length,
      rumoured: quests.filter((q) => (q.attrs as Attrs | null)?.["questStatus"] === "rumoured").length,
    };

    // Top entities by link count (most @-mentioned)
    const linkCounts: Record<string, number> = {};
    for (const l of links) {
      if (l.toEntityId) linkCounts[l.toEntityId] = (linkCounts[l.toEntityId] ?? 0) + 1;
    }
    const topEntities = entities
      .filter((e) => e.kind === "npc" || e.kind === "pc")
      .map((e) => ({ id: e.id, name: e.name, kind: e.kind, linkCount: linkCounts[e.id] ?? 0 }))
      .filter((e) => e.linkCount > 0)
      .sort((a, b) => b.linkCount - a.linkCount)
      .slice(0, 5);

    // Arc breakdown
    const arcMap = new Map<string, { id: string; name: string }>();
    arcMap.set("none", { id: "none", name: "Unassigned" });
    for (const arc of campArcs) arcMap.set(arc.id, arc);
    const arcCount = new Map<string, { count: number; playTime: number }>();
    for (const s of playedSess) {
      const arcId = (s.attrs as Attrs | null)?.["arcId"] as string | undefined;
      const key = arcId ?? "none";
      const existing = arcCount.get(key) ?? { count: 0, playTime: 0 };
      const a = (s.attrs as Attrs | null) ?? {};
      const start = a["startedAt"] as number | undefined;
      const end = a["endedAt"] as number | undefined;
      const dur = start && end && end > start ? Math.round((end - start) / 60000) : 0;
      arcCount.set(key, { count: existing.count + 1, playTime: existing.playTime + dur });
    }
    const arcBreakdown = [...arcCount.entries()]
      .filter(([, v]) => v.count > 0)
      .map(([key, v]) => ({
        arcId: key === "none" ? null : key,
        arcName: arcMap.get(key)?.name ?? "Unknown",
        count: v.count,
        playTime: v.playTime,
      }))
      .sort((a, b) => b.count - a.count);

    // Streak calculation (consecutive weeks with a session)
    const sessionDates = playedSess
      .map((s) => s.playedOn)
      .filter((d): d is string => d != null)
      .map((d) => new Date(d).getTime())
      .sort((a, b) => a - b);

    let longestStreak = 0;
    let currentStreak = 0;
    if (sessionDates.length > 0) {
      let streak = 1;
      for (let i = 1; i < sessionDates.length; i++) {
        const gap = (sessionDates[i] - sessionDates[i - 1]) / (1000 * 60 * 60 * 24 * 7);
        if (gap <= 2) streak++;
        else streak = 1;
        if (streak > longestStreak) longestStreak = streak;
      }
      longestStreak = Math.max(longestStreak, 1);
      // Current streak: count back from most recent session
      currentStreak = 1;
      for (let i = sessionDates.length - 2; i >= 0; i--) {
        const gap = (sessionDates[sessionDates.length - 1] - sessionDates[i]) / (1000 * 60 * 60 * 24 * 7 * currentStreak);
        if (gap <= 1.5) currentStreak++;
        else break;
      }
    }

    setData({
      totalSessions: sessions.length,
      playedSessions: playedSess.length,
      totalPlayTime,
      avgRating,
      ratingDist,
      entityCounts,
      questStats,
      topEntities,
      arcBreakdown,
      streakInfo: { longestStreak, currentStreak },
    });
  }, [campaignId]);

  useFocusEffect(load);

  if (!data) return null;

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const maxRating = Math.max(...data.ratingDist, 1);

  return (
    <>
      <Stack.Screen options={{ title: "Campaign Stats" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

          {/* Overview row */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Sessions Played", value: String(data.playedSessions) },
              { label: "Total Play Time", value: data.totalPlayTime > 0 ? formatTime(data.totalPlayTime) : "—" },
              { label: "Avg Rating", value: data.avgRating > 0 ? `★ ${data.avgRating.toFixed(1)}` : "—" },
              { label: "Total Entities", value: String(Object.values(data.entityCounts).reduce((a, b) => a + b, 0)) },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  minWidth: 120,
                  backgroundColor: "#A07A2C08",
                  borderWidth: 1,
                  borderColor: "#A07A2C20",
                  borderRadius: 3,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 24, color: "#2C2014" }}>{stat.value}</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4, textAlign: "center" }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Session Rating Distribution */}
          {data.playedSessions > 0 && data.ratingDist.some((v) => v > 0) && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
                Session Ratings
              </Text>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = data.ratingDist[star - 1] ?? 0;
                const pct = count / maxRating;
                return (
                  <View key={star} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C", width: 28 }}>{"★".repeat(star)}</Text>
                    <View style={{ flex: 1, height: 14, backgroundColor: "#A07A2C10", borderRadius: 2, marginHorizontal: 8, overflow: "hidden" }}>
                      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: "#A07A2C", borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", width: 20, textAlign: "right" }}>{count}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <GoldRule />

          {/* Entity breakdown */}
          <View style={{ marginTop: 16, marginBottom: 20 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
              Entity Breakdown
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(data.entityCounts).sort((a, b) => b[1] - a[1]).map(([kind, count]) => (
                <View
                  key={kind}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: "#A07A2C25",
                    borderRadius: 3,
                    backgroundColor: "#A07A2C06",
                    alignItems: "center",
                    minWidth: 70,
                  }}
                >
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: "#2C2014" }}>{count}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D", textTransform: "capitalize" }}>{kind}s</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Quest stats */}
          {(data.questStats.complete + data.questStats.active + data.questStats.failed + data.questStats.rumoured) > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
                Quest Outcomes
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { label: "Complete", count: data.questStats.complete, color: "#4A8060" },
                  { label: "Active", count: data.questStats.active, color: "#A07A2C" },
                  { label: "Failed", count: data.questStats.failed, color: "#7A2418" },
                  { label: "Rumoured", count: data.questStats.rumoured, color: "#5A4D3E80" },
                ].map((q) => (
                  <View
                    key={q.label}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: `${q.color}30`,
                      borderRadius: 3,
                      backgroundColor: `${q.color}08`,
                    }}
                  >
                    <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: q.color }}>{q.count}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: q.color, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{q.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Top NPCs */}
          {data.topEntities.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
                Most Mentioned Characters
              </Text>
              {data.topEntities.map((e, i) => (
                <Pressable
                  key={e.id}
                  onPress={() => router.push(`/campaign/${campaignId}/entity/${e.id}` as Parameters<typeof router.push>[0])}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#A07A2C12" }}
                >
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 16, color: "#A07A2C60", width: 24 }}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: "#2C2014" }}>{e.name}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase" }}>{e.kind}</Text>
                  </View>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C" }}>{e.linkCount} mentions</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Arc breakdown */}
          {data.arcBreakdown.length > 1 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
                Sessions by Arc
              </Text>
              {data.arcBreakdown.map((arc) => (
                <View
                  key={arc.arcId ?? "none"}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#A07A2C12" }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: arc.arcId ? "#2C2014" : "#5A4D3E80" }}>
                      {arc.arcName}
                    </Text>
                    {arc.playTime > 0 && (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D" }}>{formatTime(arc.playTime)} play time</Text>
                    )}
                  </View>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C" }}>
                    {arc.count} session{arc.count !== 1 ? "s" : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
