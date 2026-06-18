import { View, Text, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, asc } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db, getKv, setKv } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type Session = typeof schema.sessions.$inferSelect;
type SessionRow = Session & { mentions: { id: string; name: string; kind: string }[] };
type TimelineEvent = { id: string; text: string; afterSession: number; ts: number };

function eventsKey(id: string) { return `timeline_events_${id}`; }
function loadEvents(campaignId: string): TimelineEvent[] {
  try { return JSON.parse(getKv(eventsKey(campaignId)) ?? "[]") as TimelineEvent[]; } catch { return []; }
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function TimelineScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [campaignName, setCampaignName] = useState("Campaign");
  const [totalPlayMs, setTotalPlayMs] = useState(0);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventInput, setEventInput] = useState("");
  const [eventAfter, setEventAfter] = useState<number>(0);

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

    const allLinks = db
      .select({ fromId: schema.entityLinks.fromId, toEntityId: schema.entityLinks.toEntityId })
      .from(schema.entityLinks)
      .where(eq(schema.entityLinks.campaignId, campaignId))
      .all();

    const allEntities = db
      .select({ id: schema.entities.id, name: schema.entities.name, kind: schema.entities.kind })
      .from(schema.entities)
      .where(eq(schema.entities.campaignId, campaignId))
      .all();

    const entityMap = new Map(allEntities.map((e) => [e.id, e]));

    const enriched: SessionRow[] = rows.map((s) => {
      const sessionLinks = allLinks.filter((l) => l.fromId === s.id);
      const seen = new Set<string>();
      const mentions: { id: string; name: string; kind: string }[] = [];
      for (const link of sessionLinks) {
        if (!seen.has(link.toEntityId)) {
          seen.add(link.toEntityId);
          const e = entityMap.get(link.toEntityId);
          if (e) mentions.push(e);
        }
      }
      mentions.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "pc" ? -1 : b.kind === "pc" ? 1 : a.kind.localeCompare(b.kind);
        return a.name.localeCompare(b.name);
      });
      return { ...s, mentions };
    });

    setSessions(enriched);

    const total = rows.reduce((acc, s) => {
      const a = (s.attrs ?? {}) as { startedAt?: number; endedAt?: number };
      return a.startedAt && a.endedAt ? acc + (a.endedAt - a.startedAt) : acc;
    }, 0);
    setTotalPlayMs(total);
    setEvents(loadEvents(campaignId));
  }, [campaignId]);

  useFocusEffect(load);

  const addEvent = () => {
    const text = eventInput.trim();
    if (!text) return;
    const next: TimelineEvent[] = [...events, { id: newId(), text, afterSession: eventAfter, ts: Date.now() }];
    setEvents(next);
    setKv(eventsKey(campaignId), JSON.stringify(next));
    setEventInput("");
    setShowAddEvent(false);
  };

  const deleteEvent = (id: string) => {
    Alert.alert("Delete Event?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        const next = events.filter((e) => e.id !== id);
        setEvents(next);
        setKv(eventsKey(campaignId), JSON.stringify(next));
      }},
    ]);
  };

  const playedCount = sessions.filter((s) => s.status === "played").length;

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
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 4 }}>
          <Text className="text-ink-faint text-xs" style={{ fontFamily: "Inter_400Regular" }}>
            {playedCount}/{sessions.length} played
          </Text>
          {totalPlayMs > 0 && (
            <Text className="text-ink-faint text-xs" style={{ fontFamily: "Inter_400Regular" }}>
              ⏱ {fmtDuration(totalPlayMs)} total
            </Text>
          )}
        </View>

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
              const isActive = s.status === "in_progress";
              const dotColor = isActive ? "#7A2418" : isPlayed ? "#A07A2C" : "#8A7D6D";
              const dotFill = isActive || isPlayed;
              const sessionAttrs = (s.attrs ?? {}) as { startedAt?: number; endedAt?: number };
              const durationMs = sessionAttrs.startedAt && sessionAttrs.endedAt
                ? sessionAttrs.endedAt - sessionAttrs.startedAt
                : null;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/campaign/${campaignId}/session/${s.id}`)}
                  className="flex-row"
                >
                  {/* Timeline spine */}
                  <View className="items-center mr-4" style={{ width: 20 }}>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: dotFill ? dotColor : "transparent",
                        borderWidth: 2,
                        borderColor: dotColor,
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
                  <View className="flex-1 pb-6">
                    <Text
                      className="text-ink text-base"
                      style={{ fontFamily: "CormorantGaramond_700Bold" }}
                    >
                      Session {s.number}
                      {s.title ? `: ${s.title}` : ""}
                    </Text>
                    <View className="flex-row items-center mt-0.5 mb-1.5">
                      <Text
                        className="text-xs uppercase tracking-wider"
                        style={{ fontFamily: "Inter_500Medium", color: dotColor }}
                      >
                        {s.status}
                      </Text>
                      {s.playedOn ? (
                        <Text className="text-ink/30 text-xs ml-2" style={{ fontFamily: "Inter_400Regular" }}>
                          {s.playedOn}
                        </Text>
                      ) : null}
                      {durationMs !== null ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E50", marginLeft: 8 }}>
                          ⏱ {fmtDuration(durationMs)}
                        </Text>
                      ) : null}
                    </View>
                    {/* Entity mention chips */}
                    {s.mentions.length > 0 ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                        {s.mentions.slice(0, 6).map((e) => (
                          <Pressable
                            key={e.id}
                            onPress={(ev) => {
                              ev.stopPropagation();
                              router.push(`/campaign/${campaignId}/entity/${e.id}` as Parameters<typeof router.push>[0]);
                            }}
                            style={{
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 2,
                              borderWidth: 1,
                              borderColor: e.kind === "pc" ? "#C9A24A50" : "#A07A2C30",
                              backgroundColor: e.kind === "pc" ? "#C9A24A08" : "#A07A2C06",
                            }}
                          >
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: e.kind === "pc" ? "#C9A24A" : "#A07A2C90" }}>
                              {e.kind === "pc" ? "★ " : ""}{e.name}
                            </Text>
                          </Pressable>
                        ))}
                        {s.mentions.length > 6 ? (
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D", alignSelf: "center" }}>
                            +{s.mentions.length - 6}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Custom World Events */}
        {(events.length > 0 || sessions.length > 0) && (
          <>
            <View style={{ marginTop: 20 }}>
              <GoldRule />
            </View>
            <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                World Events
              </Text>
              <Pressable onPress={() => { setEventAfter(sessions.length > 0 ? sessions[sessions.length - 1]!.number : 0); setShowAddEvent((v) => !v); }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C" }}>+ Add</Text>
              </Pressable>
            </View>
            {showAddEvent && (
              <View style={{ marginBottom: 12, gap: 8 }}>
                <TextInput
                  value={eventInput}
                  onChangeText={setEventInput}
                  placeholder="World event, lore beat, or off-screen moment…"
                  placeholderTextColor="#8A7D6D60"
                  style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 6 }}
                  autoFocus
                  onSubmitEditing={addEvent}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={addEvent} style={{ flex: 1, paddingVertical: 8, backgroundColor: "#7A2418", borderRadius: 2, alignItems: "center" }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#FAF5EA" }}>Add Event</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowAddEvent(false)} style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 2, borderWidth: 1, borderColor: "#A07A2C20" }}>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#8A7D6D" }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {events.length === 0 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D80", fontStyle: "italic" }}>
                Record off-screen events, lore beats, and world changes here.
              </Text>
            ) : (
              events.sort((a, b) => a.afterSession - b.afterSession || a.ts - b.ts).map((ev) => (
                <Pressable key={ev.id} onLongPress={() => deleteEvent(ev.id)} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#A07A2C12" }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#5A4D3E60", marginTop: 4, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014", lineHeight: 20 }}>{ev.text}</Text>
                    {ev.afterSession > 0 && (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D80", marginTop: 1 }}>after Session {ev.afterSession}</Text>
                    )}
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}
