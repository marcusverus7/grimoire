import { View, Text, Pressable, ScrollView, Alert, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and, lt, desc } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema, nodeText } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";

type Session = typeof schema.sessions.$inferSelect;
type Entity = typeof schema.entities.$inferSelect;

const STATUS_COLORS: Record<string, string> = {
  active: "#A07A2C",
  rumoured: "#5A4D3E",
  complete: "#4A7A2C",
  failed: "#7A2418",
};

export default function SessionPrepScreen() {
  const { id: campaignId, sessionId } = useLocalSearchParams<{
    id: string;
    sessionId: string;
  }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [prevSession, setPrevSession] = useState<Session | null>(null);
  const [activeQuests, setActiveQuests] = useState<Entity[]>([]);
  const [keyEntities, setKeyEntities] = useState<Entity[]>([]);
  const [flaggedEntities, setFlaggedEntities] = useState<Entity[]>([]);
  const [prepGoals, setPrepGoals] = useState("");
  const [partyStatus, setPartyStatus] = useState<{ id: string; name: string; hp: number | null; currentHp: number | null; conditions: string[] }[]>([]);

  const load = useCallback(() => {
    const s = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .get();
    if (!s) { setSession(null); return; }
    setSession(s);
    setPrepGoals(((s.attrs ?? {}) as { prepGoals?: string }).prepGoals ?? "");

    // Previous played session
    const prev = db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.campaignId, campaignId),
          eq(schema.sessions.status, "played"),
          lt(schema.sessions.number, s.number),
        ),
      )
      .orderBy(desc(schema.sessions.number))
      .limit(1)
      .get();
    setPrevSession(prev ?? null);

    // Entities flagged for prep
    const flagged = db.select().from(schema.entities)
      .where(eq(schema.entities.campaignId, campaignId))
      .all()
      .filter((e) => (e.attrs as Record<string, unknown> | null)?.["needsPrep"] === true)
      .sort((a, b) => a.name.localeCompare(b.name));
    setFlaggedEntities(flagged);

    // Active quests
    const quests = db
      .select()
      .from(schema.entities)
      .where(
        and(
          eq(schema.entities.campaignId, campaignId),
          eq(schema.entities.kind, "quest"),
        ),
      )
      .all()
      .filter((e) => {
        const status = (e.attrs as Record<string, unknown> | null)?.["questStatus"];
        return status === "active" || status === "rumoured";
      });
    setActiveQuests(quests);

    // Party status
    const pcs = db.select().from(schema.entities)
      .where(and(eq(schema.entities.campaignId, campaignId), eq(schema.entities.kind, "pc")))
      .all()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => {
        const a = e.attrs as Record<string, unknown> | null;
        const hp = a?.["hp"] != null ? Number(a["hp"]) : null;
        const currentHp = a?.["currentHp"] != null ? Number(a["currentHp"]) : hp;
        const conditions = Array.isArray(a?.["conditions"]) ? (a["conditions"] as string[]) : [];
        return { id: e.id, name: e.name, hp, currentHp, conditions };
      });
    setPartyStatus(pcs);

    // Key entities mentioned in previous session via entity links
    if (prev) {
      const links = db
        .select({ toEntityId: schema.entityLinks.toEntityId })
        .from(schema.entityLinks)
        .where(eq(schema.entityLinks.fromId, prev.id))
        .all();

      const entities = links
        .map((l) =>
          db
            .select()
            .from(schema.entities)
            .where(eq(schema.entities.id, l.toEntityId))
            .get(),
        )
        .filter((e): e is NonNullable<typeof e> => e != null)
        .filter((e) => e.kind === "npc" || e.kind === "pc" || e.kind === "faction")
        .sort((a, b) => a.name.localeCompare(b.name));
      setKeyEntities(entities);
    }
  }, [campaignId, sessionId]);

  useFocusEffect(load);

  const beginSession = () => {
    if (!session) return;
    Alert.alert(
      "Begin Session",
      `Mark Session ${session.number} as in progress?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Begin",
          onPress: () => {
            const current = (session.attrs ?? {}) as { startedAt?: number };
            db.update(schema.sessions)
              .set({
                status: "in_progress",
                attrs: current.startedAt ? session.attrs : { ...current, startedAt: Date.now() },
              })
              .where(eq(schema.sessions.id, sessionId))
              .run();
            // Clear needsPrep flags from all flagged entities
            for (const e of flaggedEntities) {
              const a = { ...(e.attrs as Record<string, unknown> | null ?? {}) };
              delete a["needsPrep"];
              db.update(schema.entities).set({ attrs: Object.keys(a).length > 0 ? a : null, updatedAt: new Date() }).where(eq(schema.entities.id, e.id)).run();
            }
            router.push(`/campaign/${campaignId}/session/${sessionId}/edit`);
          },
        },
      ],
    );
  };

  if (!session) {
    return (
      <View className="flex-1 bg-parchment items-center justify-center">
        <Text className="text-ink/50 font-inter text-sm">Session not found</Text>
      </View>
    );
  }

  const prevBodyText = prevSession?.body
    ? extractPlainText(prevSession.body as RichTextNode)
    : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: `Prep — Session ${session.number}`,
          headerRight: () => (
            <Pressable onPress={beginSession} style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#A07A2C" }}>
                Begin ›
              </Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          className="flex-1 bg-parchment"
          contentContainerStyle={{ padding: 20 }}
        >
          {/* Session Header */}
          <Text
            style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 26, color: "#2C2014" }}
          >
            Session {session.number}
            {session.title ? `: ${session.title}` : ""}
          </Text>
          {session.playedOn ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#8A7D6D", marginTop: 2 }}>
              {session.playedOn}
            </Text>
          ) : null}

          <View style={{ marginVertical: 16 }}><GoldRule /></View>

          {/* Previously on... */}
          <Section label="Previously On…">
            {prevSession ? (
              <View>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                  Session {prevSession.number}{prevSession.title ? `: ${prevSession.title}` : ""}
                </Text>
                {prevBodyText ? (
                  <Text
                    style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 16, color: "#3A2E24", lineHeight: 26 }}
                    numberOfLines={8}
                  >
                    {prevBodyText}
                  </Text>
                ) : (
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", fontStyle: "italic" }}>
                    No notes written for that session.
                  </Text>
                )}
                <Pressable
                  onPress={() => router.push(`/campaign/${campaignId}/session/${prevSession.id}`)}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C" }}>
                    Read full session →
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", fontStyle: "italic" }}>
                This is the first session.
              </Text>
            )}
          </Section>

          <View style={{ marginVertical: 16 }}><GoldRule /></View>

          {/* Flagged for Prep */}
          {flaggedEntities.length > 0 && (
            <>
              <Section label="⚑ Flagged for This Session">
                {flaggedEntities.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${e.id}`)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#7A241815" }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: "#2C2014" }}>{e.name}</Text>
                      {(e.attrs as Record<string, unknown> | null)?.["role"] ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E60" }}>{String((e.attrs as Record<string, unknown>)["role"])}</Text>
                      ) : null}
                    </View>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1 }}>{e.kind}</Text>
                  </Pressable>
                ))}
              </Section>
              <View style={{ marginVertical: 16 }}><GoldRule /></View>
            </>
          )}

          {/* Party Status */}
          {partyStatus.length > 0 && (
            <>
              <View style={{ marginVertical: 16 }}><GoldRule /></View>
              <Section label="Party Status">
                {partyStatus.map((pc) => {
                  const pct = pc.hp && pc.hp > 0 && pc.currentHp != null ? pc.currentHp / pc.hp : null;
                  const hpColor = pct == null ? "#2C2014" : pc.currentHp === 0 ? "#7A2418" : pct < 0.5 ? "#A07A2C" : "#2C2014";
                  return (
                    <Pressable
                      key={pc.id}
                      onPress={() => router.push(`/campaign/${campaignId}/entity/${pc.id}`)}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#A07A2C12" }}
                    >
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: "#2C2014", flex: 1 }}>{pc.name}</Text>
                      {pc.hp != null ? (
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: hpColor, marginRight: 8 }}>
                          {pc.currentHp != null && pc.currentHp !== pc.hp ? `${pc.currentHp}/` : ""}{pc.hp} HP
                        </Text>
                      ) : null}
                      {pc.conditions.length > 0 ? (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
                          {pc.conditions.slice(0, 2).map((c) => (
                            <View key={c} style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: "#7A241840", backgroundColor: "#7A241808" }}>
                              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#7A2418", textTransform: "uppercase" }}>{c}</Text>
                            </View>
                          ))}
                          {pc.conditions.length > 2 ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#7A241880" }}>+{pc.conditions.length - 2}</Text> : null}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </Section>
            </>
          )}

          <View style={{ marginVertical: 16 }}><GoldRule /></View>

          {/* Open Quests */}
          <Section label="Open Quests">
            {activeQuests.length === 0 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", fontStyle: "italic" }}>
                No active quests.
              </Text>
            ) : (
              activeQuests.map((q) => {
                const qStatus = (q.attrs as Record<string, unknown> | null)?.["questStatus"] as string ?? "rumoured";
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${q.id}`)}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: "#A07A2C15",
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: STATUS_COLORS[qStatus] ?? "#8A7D6D",
                        marginTop: 6,
                        marginRight: 10,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: "#2C2014" }}>
                        {q.name}
                      </Text>
                      {q.summary ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#8A7D6D", marginTop: 2 }} numberOfLines={2}>
                          {q.summary}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </Section>

          {/* Key NPCs from last session */}
          {keyEntities.length > 0 && (
            <>
              <View style={{ marginVertical: 16 }}><GoldRule /></View>
              <Section label="Key Characters Last Session">
                {keyEntities.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${e.id}`)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: "#A07A2C15",
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 0.8, width: 56 }}>
                      {e.kind}
                    </Text>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: "#2C2014", flex: 1 }}>
                      {e.name}
                    </Text>
                    {e.summary ? (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#8A7D6D", flex: 1 }} numberOfLines={1}>
                        {e.summary}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </Section>
            </>
          )}

          <View style={{ marginVertical: 16 }}><GoldRule /></View>

          {/* Session Goals */}
          <Section label="Goals for This Session">
            <TextInput
              value={prepGoals}
              onChangeText={setPrepGoals}
              onBlur={() => {
                if (!session) return;
                const current = (session.attrs ?? {}) as Record<string, unknown>;
                db.update(schema.sessions)
                  .set({ attrs: { ...current, prepGoals: prepGoals.trim() || undefined } })
                  .where(eq(schema.sessions.id, sessionId))
                  .run();
              }}
              placeholder="What do you want to accomplish this session?"
              placeholderTextColor="#8A7D6D"
              multiline
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: "#2C2014",
                borderWidth: 1,
                borderColor: "#A07A2C25",
                borderRadius: 2,
                padding: 12,
                minHeight: 80,
                textAlignVertical: "top",
                lineHeight: 20,
              }}
            />
          </Section>

          <View style={{ height: 40 }} />

          {/* Begin Session CTA */}
          <Pressable
            onPress={beginSession}
            style={{
              backgroundColor: "#7A2418",
              borderWidth: 1,
              borderColor: "#C9A24A40",
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 40,
            }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 2 }}>
              Begin Session {session.number}
            </Text>
          </Pressable>
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          color: "#A07A2C",
          textTransform: "uppercase",
          letterSpacing: 1.5,
          marginBottom: 12,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function extractPlainText(body: RichTextNode): string {
  if (!body.content) return typeof body.text === "string" ? body.text : "";
  return body.content
    .map((node) => nodeText(node))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
