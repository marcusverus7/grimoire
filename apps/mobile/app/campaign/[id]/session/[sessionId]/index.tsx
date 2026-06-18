import { View, Text, Pressable, ScrollView, Alert, Share, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema, richTextToMarkdown } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";
import { RichTextRenderer } from "@/components/RichTextRenderer";

type Session = typeof schema.sessions.$inferSelect;
type Quote = typeof schema.quotes.$inferSelect;
type SessionAttrs = { startedAt?: number; endedAt?: number; prepGoals?: string; highlights?: string[] };

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export default function SessionDetailScreen() {
  const { id: campaignId, sessionId } = useLocalSearchParams<{
    id: string;
    sessionId: string;
  }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [showXpAward, setShowXpAward] = useState(false);
  const [xpInput, setXpInput] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [showHighlightInput, setShowHighlightInput] = useState(false);
  const [highlightInput, setHighlightInput] = useState("");
  const [prevSession, setPrevSession] = useState<{ id: string; number: number } | null>(null);
  const [nextSession, setNextSession] = useState<{ id: string; number: number } | null>(null);
  const [linkedEntities, setLinkedEntities] = useState<
    { id: string; name: string; kind: string }[]
  >([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [recapSlug, setRecapSlug] = useState<string | null>(null);

  const load = useCallback(() => {
    const s = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .get();
    setSession(s ?? null);
    if (s) {
      const sa = (s.attrs ?? {}) as SessionAttrs;
      setHighlights(Array.isArray(sa.highlights) ? sa.highlights : []);
    }

    if (s) {
      // Adjacent session navigation
      const allSessions = db.select({ id: schema.sessions.id, number: schema.sessions.number })
        .from(schema.sessions)
        .where(eq(schema.sessions.campaignId, s.campaignId))
        .all()
        .sort((a, b) => a.number - b.number);
      const idx = allSessions.findIndex((x) => x.id === sessionId);
      setPrevSession(idx > 0 ? allSessions[idx - 1] : null);
      setNextSession(idx < allSessions.length - 1 ? allSessions[idx + 1] : null);
    }

    if (s) {
      const links = db
        .select({ toEntityId: schema.entityLinks.toEntityId })
        .from(schema.entityLinks)
        .where(eq(schema.entityLinks.fromId, sessionId))
        .all();

      const entities = links
        .map((l) =>
          db
            .select({
              id: schema.entities.id,
              name: schema.entities.name,
              kind: schema.entities.kind,
            })
            .from(schema.entities)
            .where(eq(schema.entities.id, l.toEntityId))
            .get(),
        )
        .filter((e): e is NonNullable<typeof e> => e != null)
        .sort((a, b) => a.name.localeCompare(b.name));

      setLinkedEntities(entities);

      const sessionQuotes = db
        .select()
        .from(schema.quotes)
        .where(eq(schema.quotes.sessionId, sessionId))
        .all();
      setQuotes(sessionQuotes);

      const recap = db
        .select({ shareSlug: schema.recaps.shareSlug })
        .from(schema.recaps)
        .where(eq(schema.recaps.sessionId, sessionId))
        .get();
      setRecapSlug(recap?.shareSlug ?? null);
    }
  }, [sessionId]);

  useFocusEffect(load);

  const updateAttrs = (patch: Partial<SessionAttrs>) => {
    const current = (session?.attrs ?? {}) as SessionAttrs;
    const next = { ...current, ...patch };
    db.update(schema.sessions)
      .set({ attrs: next })
      .where(eq(schema.sessions.id, sessionId))
      .run();
    setSession((prev) => prev ? { ...prev, attrs: next } : prev);
  };

  const awardXp = () => {
    const amount = parseInt(xpInput, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid XP", "Enter a positive number.");
      return;
    }
    const attendance = ((session?.attrs as Record<string, unknown> | null)?.attendance ?? []) as { entityId: string; status: string }[];
    let pcIds: string[] = [];
    if (attendance.length > 0) {
      pcIds = attendance.filter((a) => a.status === "yes" || a.status === "maybe").map((a) => a.entityId);
    } else {
      const allPcs = db.select({ id: schema.entities.id }).from(schema.entities)
        .where(and(eq(schema.entities.campaignId, campaignId), eq(schema.entities.kind, "pc"))).all();
      pcIds = allPcs.map((p) => p.id);
    }
    if (pcIds.length === 0) {
      Alert.alert("No PCs", "No PCs found for this session.");
      return;
    }
    let count = 0;
    for (const pcId of pcIds) {
      const pc = db.select().from(schema.entities).where(eq(schema.entities.id, pcId)).get();
      if (!pc) continue;
      const attrs = { ...(pc.attrs as Record<string, unknown> | null ?? {}) };
      const current = parseInt(String(attrs["xp"] ?? "0"), 10) || 0;
      attrs["xp"] = String(current + amount);
      db.update(schema.entities).set({ attrs }).where(eq(schema.entities.id, pcId)).run();
      count++;
    }
    Alert.alert("XP Awarded", `+${amount} XP awarded to ${count} PC${count !== 1 ? "s" : ""}.`);
    setXpInput("");
    setShowXpAward(false);
  };

  const addHighlight = () => {
    const text = highlightInput.trim();
    if (!text || !session) return;
    const next = [...highlights, text];
    setHighlights(next);
    setHighlightInput("");
    setShowHighlightInput(false);
    const current = (session.attrs ?? {}) as Record<string, unknown>;
    db.update(schema.sessions).set({ attrs: { ...current, highlights: next } }).where(eq(schema.sessions.id, sessionId)).run();
  };

  const deleteHighlight = (index: number) => {
    if (!session) return;
    const next = highlights.filter((_, i) => i !== index);
    setHighlights(next);
    const current = (session.attrs ?? {}) as Record<string, unknown>;
    db.update(schema.sessions).set({ attrs: { ...current, highlights: next } }).where(eq(schema.sessions.id, sessionId)).run();
  };

  if (!session) {
    return (
      <View className="flex-1 bg-parchment items-center justify-center">
        <Text className="text-ink/50 font-inter text-sm">
          Session not found
        </Text>
      </View>
    );
  }

  const sessionAttrs = (session.attrs ?? {}) as SessionAttrs;
  const { startedAt, endedAt } = sessionAttrs;
  const durationMs = startedAt && endedAt ? endedAt - startedAt : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: `Session ${session.number}`,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                onPress={async () => {
                  const title = `Session ${session.number}${session.title ? `: ${session.title}` : ""}`;
                  const body = session.body ? richTextToMarkdown(session.body as RichTextNode) : "";
                  const quoteText = quotes.length > 0
                    ? "\n\n---\n\n**Quotes**\n\n" + quotes.map((q) => `> "${q.text}"${q.attribution ? `\n> — ${q.attribution}` : ""}`).join("\n\n")
                    : "";
                  await Share.share({ title, message: `# ${title}\n\n${body}${quoteText}` });
                }}
                style={{ marginRight: 12 }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#A07A2C" }}>
                  Share
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(
                    `/campaign/${campaignId}/session/${sessionId}/edit`,
                  )
                }
                style={{ marginRight: 8 }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    color: "#A07A2C",
                  }}
                >
                  Edit
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        className="flex-1 bg-parchment-deep"
        contentContainerStyle={{ padding: 20 }}
      >
        {/* Prep shortcut for planned/in_progress sessions */}
        {(session.status === "planned" || session.status === "in_progress") && (
          <Pressable
            onPress={() => router.push(`/campaign/${campaignId}/session/${sessionId}/prep` as Parameters<typeof router.push>[0])}
            style={{
              marginBottom: 16,
              paddingVertical: 12,
              backgroundColor: "#7A241808",
              borderWidth: 1,
              borderColor: "#7A241830",
              borderRadius: 2,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#7A2418", textTransform: "uppercase", letterSpacing: 1.5 }}>
              ◈ Session Prep
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", marginTop: 2 }}>
              Recap · Quests · Key Characters
            </Text>
          </Pressable>
        )}

        {/* Header */}
        <Text
          className="text-ink text-2xl mb-1"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          Session {session.number}
          {session.title ? `: ${session.title}` : ""}
        </Text>
        <View className="flex-row items-center mb-1">
          <Text
            className="text-xs uppercase tracking-wider"
            style={{
              fontFamily: "Inter_500Medium",
              color: session.status === "played" ? "#A07A2C" : session.status === "in_progress" ? "#7A2418" : "#4A3F32",
            }}
          >
            {session.status}
          </Text>
          {session.playedOn ? (
            <Text
              className="text-ink-soft/50 text-xs ml-3"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {session.playedOn}
            </Text>
          ) : null}
        </View>

        {/* Duration row */}
        {durationMs !== null ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E80" }}>
              ⏱ {formatDuration(durationMs)}
            </Text>
            <Pressable
              onPress={() =>
                Alert.alert("Clear Timer", "Remove the recorded duration?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Clear", style: "destructive", onPress: () => updateAttrs({ startedAt: undefined, endedAt: undefined }) },
                ])
              }
              style={{ marginLeft: 8 }}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E40" }}>clear</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", marginBottom: 12, gap: 8 }}>
            {!startedAt ? (
              <Pressable
                onPress={() => updateAttrs({ startedAt: Date.now() })}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: "#5A4D3E30",
                  borderRadius: 2,
                }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E80" }}>
                  ▷ Start Timer
                </Text>
              </Pressable>
            ) : (
              <>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E60", alignSelf: "center" }}>
                  ⏱ running…
                </Text>
                <Pressable
                  onPress={() => updateAttrs({ endedAt: Date.now() })}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: "#4A7A2C40",
                    borderRadius: 2,
                  }}
                >
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#4A7A2C" }}>
                    ◼ End Timer
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        <GoldRule />

        {/* Prep goals (if set) */}
        {sessionAttrs.prepGoals ? (
          <View style={{ marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 2, borderLeftColor: "#A07A2C40", backgroundColor: "#A07A2C06", marginBottom: 4 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
              Session Goals
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#4A3F32", lineHeight: 20 }}>
              {sessionAttrs.prepGoals}
            </Text>
          </View>
        ) : null}

        {/* Body */}
        {session.body ? (
          <View className="mt-4 mb-6">
            <RichTextRenderer body={session.body as RichTextNode} campaignId={campaignId} />
          </View>
        ) : (
          <View style={{ marginTop: 16, marginBottom: 16, padding: 16, borderWidth: 1, borderColor: "#A07A2C20", borderRadius: 2, backgroundColor: "#A07A2C05" }}>
            <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: "#2C201455", fontStyle: "italic", lineHeight: 23, marginBottom: 12 }}>
              No notes yet. Tap Edit to record what happened, @-mention key characters, and capture important moments.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => router.push(`/campaign/${campaignId}/session/${sessionId}/edit` as Parameters<typeof router.push>[0])}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#A07A2C50", borderRadius: 2, backgroundColor: "#A07A2C0A" }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>✎ Add Notes</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/campaign/${campaignId}/session/${sessionId}/prep` as Parameters<typeof router.push>[0])}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#7A241830", borderRadius: 2, backgroundColor: "#7A241806" }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#7A2418", textTransform: "uppercase", letterSpacing: 1 }}>◈ Session Prep</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Wrap Up shortcut for in_progress sessions */}
        {session.status === "in_progress" ? (
          <Pressable
            onPress={() => router.push(`/campaign/${campaignId}/session/${sessionId}/wrap` as Parameters<typeof router.push>[0])}
            style={{
              marginBottom: 12,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: "#C9A24A40",
              borderRadius: 2,
              alignItems: "center",
              backgroundColor: "#C9A24A06",
            }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5 }}>
              ◈ Wrap Up Session
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", marginTop: 2 }}>
              HP · Quests · XP
            </Text>
          </Pressable>
        ) : null}

        {/* Scene Notes shortcut */}
        <Pressable
          onPress={() => router.push(`/campaign/${campaignId}/session/${sessionId}/notes` as Parameters<typeof router.push>[0])}
          style={{
            marginBottom: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "#A07A2C30",
            borderRadius: 2,
            alignItems: "center",
            backgroundColor: "#A07A2C06",
          }}
        >
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
            ✎ Scene Notes
          </Text>
        </Pressable>

        {/* Mark Played quick action */}
        {session.status !== "played" ? (
          <Pressable
            onPress={() => {
              Alert.alert(
                "Mark as Played?",
                "This will set the session status to Played.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Mark Played",
                    onPress: () => {
                      db.update(schema.sessions)
                        .set({ status: "played" })
                        .where(eq(schema.sessions.id, sessionId))
                        .run();
                      setSession((prev) => prev ? { ...prev, status: "played" } : prev);
                    },
                  },
                ],
              );
            }}
            style={{
              marginBottom: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: "#4A7A2C40",
              borderRadius: 2,
              alignItems: "center",
              backgroundColor: "#4A7A2C08",
            }}
          >
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#4A7A2C", textTransform: "uppercase", letterSpacing: 1 }}>
              ✓ Mark Session Played
            </Text>
          </Pressable>
        ) : null}

        {/* Recap actions */}
        {session.body && session.status === "played" ? (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <Pressable
              onPress={() => router.push(`/campaign/${campaignId}/session/${sessionId}/recap`)}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 2, borderWidth: 1, borderColor: "#C9A24A40", backgroundColor: "#7A2418", alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1.5 }}>
                {recapSlug ? "Edit Recap" : "Create Recap"}
              </Text>
            </Pressable>
            {recapSlug ? (
              <Pressable
                onPress={async () => {
                  const url = `https://grimoire-recap-web.vercel.app/r/${recapSlug}`;
                  await Share.share({ title: `Session ${session.number} Recap`, message: url, url });
                }}
                style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 2, borderWidth: 1, borderColor: "#A07A2C40", backgroundColor: "#A07A2C0A", alignItems: "center" }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
                  Share ↗
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Award XP (played sessions only) */}
        {session.status === "played" ? (
          <View style={{ marginBottom: 12 }}>
            {showXpAward ? (
              <View style={{ borderWidth: 1, borderColor: "#3A6830", borderRadius: 2, padding: 12, backgroundColor: "#3A683008" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#3A6830", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Award XP to Attendees</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TextInput
                    value={xpInput}
                    onChangeText={setXpInput}
                    placeholder="XP amount"
                    placeholderTextColor="#2C201440"
                    keyboardType="number-pad"
                    style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#2C2014", flex: 1, borderBottomWidth: 1, borderBottomColor: "#3A683040", paddingBottom: 4 }}
                  />
                  <Pressable onPress={awardXp} style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#3A6830", borderRadius: 2 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FAF5EA" }}>Award</Text>
                  </Pressable>
                  <Pressable onPress={() => { setShowXpAward(false); setXpInput(""); }} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D" }}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowXpAward(true)}
                style={{ paddingVertical: 8, borderWidth: 1, borderColor: "#3A683040", borderRadius: 2, alignItems: "center", backgroundColor: "#3A683008" }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#3A6830", textTransform: "uppercase", letterSpacing: 1 }}>◆ Award XP to Attendees</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Memorable Moments / Highlights */}
        <GoldRule />
        <View style={{ marginTop: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#5A4D3E", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
              Memorable Moments
            </Text>
            <Pressable onPress={() => setShowHighlightInput((v) => !v)}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C" }}>+ Add</Text>
            </Pressable>
          </View>
          {showHighlightInput && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <TextInput
                value={highlightInput}
                onChangeText={setHighlightInput}
                placeholder="What happened?"
                placeholderTextColor="#8A7D6D60"
                style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014", flex: 1, borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 4 }}
                onSubmitEditing={addHighlight}
                autoFocus
              />
              <Pressable onPress={addHighlight} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#7A2418", borderRadius: 2 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#FAF5EA" }}>Add</Text>
              </Pressable>
            </View>
          )}
          {highlights.length === 0 && !showHighlightInput ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D80", fontStyle: "italic" }}>
              Record standout moments, unexpected turns, and great player decisions here.
            </Text>
          ) : (
            highlights.map((h, i) => (
              <Pressable key={i} onLongPress={() => deleteHighlight(i)} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#A07A2C12" }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C", marginRight: 8, marginTop: 1 }}>◆</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014", flex: 1, lineHeight: 20 }}>{h}</Text>
              </Pressable>
            ))
          )}
        </View>

        {/* Quotes section */}
        <GoldRule />
        <View style={{ marginTop: 12, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#5A4D3E", textTransform: "uppercase", letterSpacing: 1.5 }}>
              Quotes
            </Text>
            <Pressable
              onPress={() =>
                router.push(
                  `/campaign/${campaignId}/quotes?sessionId=${sessionId}` as Parameters<typeof router.push>[0],
                )
              }
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C" }}>
                + Add Quote
              </Text>
            </Pressable>
          </View>
          {quotes.length === 0 ? (
            <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 15, color: "#2C201440", fontStyle: "italic" }}>
              No quotes yet — memorable lines, player jokes, dramatic moments…
            </Text>
          ) : (
            quotes.map((q) => (
              <View key={q.id} style={{ marginBottom: 12, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: "#A07A2C50" }}>
                <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: "#2C2014CC", fontStyle: "italic", lineHeight: 23 }}>
                  "{q.text}"
                </Text>
                {q.attribution ? (
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E", marginTop: 4 }}>
                    — {q.attribution}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* Linked entities */}
        {linkedEntities.length > 0 && (
          <>
            <GoldRule />
            <View className="mt-4">
              <Text
                className="text-ink-soft text-xs uppercase tracking-wider mb-3"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                Entities in This Session
              </Text>
              {linkedEntities.map((entity) => (
                <Pressable
                  key={entity.id}
                  onPress={() =>
                    router.push(
                      `/campaign/${campaignId}/entity/${entity.id}`,
                    )
                  }
                  className="py-2 px-2 mb-1"
                >
                  <View className="flex-row items-center">
                    <Text
                      className="text-xs uppercase tracking-wider mr-2"
                      style={{
                        fontFamily: "Inter_500Medium",
                        color: "#4A3F32",
                      }}
                    >
                      {entity.kind}
                    </Text>
                    <Text
                      className="text-ink text-base flex-1"
                      style={{ fontFamily: "CormorantGaramond_600SemiBold" }}
                    >
                      {entity.name}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Session navigation */}
        {(prevSession || nextSession) ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#A07A2C20" }}>
            {prevSession ? (
              <Pressable
                onPress={() => router.replace(`/campaign/${campaignId}/session/${prevSession.id}` as Parameters<typeof router.replace>[0])}
                style={{ flex: 1, paddingVertical: 8, alignItems: "flex-start" }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C60", marginBottom: 2 }}>← Previous</Text>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#A07A2C" }}>Session {prevSession.number}</Text>
              </Pressable>
            ) : <View style={{ flex: 1 }} />}
            {nextSession ? (
              <Pressable
                onPress={() => router.replace(`/campaign/${campaignId}/session/${nextSession.id}` as Parameters<typeof router.replace>[0])}
                style={{ flex: 1, paddingVertical: 8, alignItems: "flex-end" }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C60", marginBottom: 2 }}>Next →</Text>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#A07A2C" }}>Session {nextSession.number}</Text>
              </Pressable>
            ) : <View style={{ flex: 1 }} />}
          </View>
        ) : null}

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}
