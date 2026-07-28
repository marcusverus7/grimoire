import { View, Text, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db, getKv, setKv } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

type NoteEntry = { id: string; text: string; ts: number };

type PCState = {
  id: string;
  name: string;
  hp: number | null;
  currentHp: number | null;
  resources: { name: string; max: number; current: number }[];
  conditions: string[];
  npcStatus: string | null;
};

type DeadMissing = { id: string; name: string; kind: string; status: string };
type Quest = { id: string; name: string; questStatus: string };
type Clock = { id: string; name: string; current: number; max: number; unit?: string };

export default function PlayViewScreen() {
  useThemeTick();
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [party, setParty] = useState<PCState[]>([]);
  const [deadMissing, setDeadMissing] = useState<DeadMissing[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [clocks, setClocks] = useState<Clock[]>([]);

  const load = useCallback(() => {
    const inProgress = db.select().from(schema.sessions)
      .where(and(eq(schema.sessions.campaignId, campaignId), eq(schema.sessions.status, "in_progress")))
      .get();

    if (inProgress) {
      setSessionId(inProgress.id);
      setSessionNumber(inProgress.number);
      const rawNotes = getKv(`session_notes_${inProgress.id}`);
      if (rawNotes) {
        try { setNotes(JSON.parse(rawNotes) as NoteEntry[]); } catch { setNotes([]); }
      } else { setNotes([]); }
    } else {
      setSessionId(null);
      setSessionNumber(null);
      setNotes([]);
    }

    const roundRaw = getKv(`tracker_round_${campaignId}`);
    setRound(roundRaw ? parseInt(roundRaw, 10) || 1 : 1);

    const allEntities = db.select().from(schema.entities)
      .where(eq(schema.entities.campaignId, campaignId))
      .all();

    const pcs = allEntities
      .filter((e) => e.kind === "pc")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => {
        const a = e.attrs as Record<string, unknown> | null;
        return {
          id: e.id,
          name: e.name,
          hp: a?.["hp"] != null ? Number(a["hp"]) : null,
          currentHp: a?.["currentHp"] != null ? Number(a["currentHp"]) : null,
          resources: Array.isArray(a?.["resources"]) ? (a["resources"] as { name: string; max: number; current: number }[]) : [],
          conditions: Array.isArray(a?.["conditions"]) ? (a["conditions"] as string[]) : [],
          npcStatus: typeof a?.["npcStatus"] === "string" ? a["npcStatus"] : null,
        };
      });
    setParty(pcs);

    const dm = allEntities
      .filter((e) => (e.kind === "npc" || e.kind === "pc"))
      .filter((e) => {
        const st = (e.attrs as Record<string, unknown> | null)?.["npcStatus"];
        return st === "dead" || st === "missing";
      })
      .map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        status: String((e.attrs as Record<string, unknown>)["npcStatus"]),
      }));
    setDeadMissing(dm);

    const activeQuests = allEntities
      .filter((e) => e.kind === "quest")
      .filter((e) => {
        const qs = (e.attrs as Record<string, unknown> | null)?.["questStatus"];
        return qs === "active" || qs === "open";
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({
        id: e.id,
        name: e.name,
        questStatus: String((e.attrs as Record<string, unknown> | null)?.["questStatus"] ?? "open"),
      }));
    setQuests(activeQuests);

    // Load clocks
    const rawClocks = getKv(`clocks_${campaignId}`);
    if (rawClocks) {
      try {
        const all = JSON.parse(rawClocks) as Clock[];
        setClocks(all.filter((c) => c.current < c.max));
      } catch { setClocks([]); }
    } else { setClocks([]); }
  }, [campaignId]);

  useFocusEffect(load);

  const changeRound = (delta: number) => {
    const next = Math.max(1, round + delta);
    setRound(next);
    setKv(`tracker_round_${campaignId}`, String(next));
  };

  const addNote = () => {
    if (!noteInput.trim() || !sessionId) return;
    const next = [...notes, { id: newId(), text: noteInput.trim(), ts: Date.now() }];
    setNotes(next);
    setKv(`session_notes_${sessionId}`, JSON.stringify(next));
    setNoteInput("");
  };

  const deleteNote = (noteId: string) => {
    if (!sessionId) return;
    const next = notes.filter((n) => n.id !== noteId);
    setNotes(next);
    setKv(`session_notes_${sessionId}`, JSON.stringify(next));
  };

  return (
    <>
      <Stack.Screen options={{ title: "Play View" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

          {/* Round counter */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, paddingHorizontal: 4 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
              Combat Round
            </Text>
            <Pressable
              onPress={() => changeRound(-1)}
              style={{ width: 32, height: 32, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("oxblood", 0x30 / 255), alignItems: "center", justifyContent: "center", marginRight: 8 }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: color.oxblood }}>−</Text>
            </Pressable>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 32, color: color.ink, minWidth: 36, textAlign: "center" }}>
              {round}
            </Text>
            <Pressable
              onPress={() => changeRound(1)}
              style={{ width: 32, height: 32, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("success", 0x30 / 255), alignItems: "center", justifyContent: "center", marginLeft: 8 }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: color.success }}>+</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/campaign/${campaignId}/tracker` as Parameters<typeof router.push>[0])}
              style={{ marginLeft: 16 }}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("gold", 0x80 / 255) }}>Tracker ›</Text>
            </Pressable>
          </View>

          <GoldRule />

          {/* Scene Notes */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                Scene Notes {sessionNumber != null ? `— Session ${sessionNumber}` : ""}
              </Text>
              {sessionId ? (
                <Pressable onPress={() => router.push(`/campaign/${campaignId}/session/${sessionId}/notes` as Parameters<typeof router.push>[0])}>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("gold", 0x80 / 255) }}>All notes ›</Text>
                </Pressable>
              ) : null}
            </View>
            {sessionId ? (
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                <TextInput
                  value={noteInput}
                  onChangeText={setNoteInput}
                  onSubmitEditing={addNote}
                  placeholder="Quick note…"
                  placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                  returnKeyType="done"
                  style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: color.ink, borderWidth: 1, borderColor: withAlpha("goldBright", 0x30 / 255), borderRadius: 2, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: color.paperBright, marginRight: 8 }}
                />
                <Pressable
                  onPress={addNote}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: color.goldBright, borderRadius: 2, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.onAccent }}>Add</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("inkSoft", 0x60 / 255), marginBottom: 8 }}>
                No session in progress — start a session to take notes here.
              </Text>
            )}
            {notes.slice().reverse().slice(0, 5).map((n) => (
              <Pressable
                key={n.id}
                onLongPress={() => Alert.alert("Delete note?", n.text, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteNote(n.id) },
                ])}
                style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: withAlpha("gold", 0x12 / 255) }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("gold", 0x80 / 255), marginRight: 6, marginTop: 1 }}>·</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.ink, flex: 1, lineHeight: 18 }}>{n.text}</Text>
              </Pressable>
            ))}
            {notes.length > 5 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("gold", 0x80 / 255), marginTop: 4 }}>
                +{notes.length - 5} more — tap "All notes" to see them
              </Text>
            ) : null}
          </View>

          <GoldRule />

          {/* Party */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                Party
              </Text>
              <Pressable onPress={() => router.push(`/campaign/${campaignId}/party` as Parameters<typeof router.push>[0])}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("gold", 0x80 / 255) }}>Overview ›</Text>
              </Pressable>
            </View>
            {party.length === 0 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("inkSoft", 0x60 / 255) }}>No PCs in this campaign.</Text>
            ) : party.map((pc) => {
              const hpCurrent = pc.currentHp ?? pc.hp;
              const hpMax = pc.hp;
              const hpPct = hpMax && hpMax > 0 && hpCurrent != null ? hpCurrent / hpMax : null;
              const hpColor = hpPct == null ? color.ink : hpPct === 0 ? color.oxblood : hpPct < 0.5 ? color.gold : color.success;
              return (
                <Pressable
                  key={pc.id}
                  onPress={() => router.push(`/campaign/${campaignId}/entity/${pc.id}`)}
                  style={{ marginBottom: 10 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>{pc.name}</Text>
                    {pc.hp != null ? (
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: hpColor, marginRight: 8 }}>
                        {hpCurrent !== hpMax && hpCurrent != null ? `${hpCurrent}/` : ""}{hpMax} HP
                      </Text>
                    ) : null}
                    {pc.npcStatus === "dead" ? (
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: color.oxblood }}>☠</Text>
                    ) : pc.npcStatus === "missing" ? (
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: color.gold }}>?</Text>
                    ) : null}
                  </View>
                  {hpPct != null ? (
                    <View style={{ height: 3, backgroundColor: withAlpha("panelInk", 0x15 / 255), borderRadius: 2, overflow: "hidden", marginBottom: pc.resources.length > 0 ? 4 : 0 }}>
                      <View style={{ height: 3, backgroundColor: hpColor, borderRadius: 2, width: `${Math.round(hpPct * 100)}%` as `${number}%` }} />
                    </View>
                  ) : null}
                  {pc.resources.length > 0 ? (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("inkSoft", 0x80 / 255) }} numberOfLines={1}>
                      {pc.resources.map((r) => `${r.name} ${r.current}/${r.max}`).join(" · ")}
                    </Text>
                  ) : null}
                  {pc.conditions.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                      {pc.conditions.map((c) => (
                        <View key={c} style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("oxblood", 0x40 / 255), backgroundColor: withAlpha("oxblood", 0x08 / 255) }}>
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: color.oxblood, textTransform: "uppercase" }}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {deadMissing.length > 0 ? (
            <>
              <GoldRule />
              <View style={{ marginTop: 16, marginBottom: 4 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.oxblood, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                  Dead / Missing
                </Text>
                {deadMissing.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${e.id}`)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: withAlpha("oxblood", 0x15 / 255) }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: e.status === "dead" ? color.oxblood : color.gold, marginRight: 8 }}>
                      {e.status === "dead" ? "☠" : "?"}
                    </Text>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>{e.name}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkSoft", 0x60 / 255), textTransform: "uppercase", letterSpacing: 0.5 }}>{e.kind}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {clocks.length > 0 ? (
            <>
              <GoldRule />
              <View style={{ marginTop: 16, marginBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                    Clocks
                  </Text>
                  <Pressable onPress={() => router.push(`/campaign/${campaignId}/clocks` as Parameters<typeof router.push>[0])}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("gold", 0x80 / 255) }}>All ›</Text>
                  </Pressable>
                </View>
                {clocks.map((c) => {
                  const pct = c.max > 0 ? c.current / c.max : 0;
                  return (
                    <View key={c.id} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>{c.name}</Text>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: color.oxblood }}>{c.current}/{c.max}</Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 3 }}>
                        {Array.from({ length: c.max }).map((_, i) => (
                          <View
                            key={i}
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 2,
                              backgroundColor: i < c.current ? color.oxblood : withAlpha("gold", 0x20 / 255),
                            }}
                          />
                        ))}
                      </View>
                      {c.unit ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkSoft", 0x50 / 255), marginTop: 2 }}>{c.unit}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {quests.length > 0 ? (
            <>
              <GoldRule />
              <View style={{ marginTop: 16, marginBottom: 4 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                  Active Quests
                </Text>
                {quests.map((q) => {
                  const questColor = q.questStatus === "active" ? color.gold : color.inkSoft;
                  return (
                    <Pressable
                      key={q.id}
                      onPress={() => router.push(`/campaign/${campaignId}/entity/${q.id}`)}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: withAlpha("gold", 0x12 / 255) }}
                    >
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: questColor, marginRight: 10 }} />
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: color.ink, flex: 1 }}>{q.name}</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: `${questColor}80`, textTransform: "capitalize" }}>{q.questStatus}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
