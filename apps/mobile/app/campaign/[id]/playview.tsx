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
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
              Combat Round
            </Text>
            <Pressable
              onPress={() => changeRound(-1)}
              style={{ width: 32, height: 32, borderRadius: 2, borderWidth: 1, borderColor: "#7A241830", alignItems: "center", justifyContent: "center", marginRight: 8 }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#7A2418" }}>−</Text>
            </Pressable>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 32, color: "#2C2014", minWidth: 36, textAlign: "center" }}>
              {round}
            </Text>
            <Pressable
              onPress={() => changeRound(1)}
              style={{ width: 32, height: 32, borderRadius: 2, borderWidth: 1, borderColor: "#4A806030", alignItems: "center", justifyContent: "center", marginLeft: 8 }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#4A8060" }}>+</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/campaign/${campaignId}/tracker` as Parameters<typeof router.push>[0])}
              style={{ marginLeft: 16 }}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#A07A2C80" }}>Tracker ›</Text>
            </Pressable>
          </View>

          <GoldRule />

          {/* Scene Notes */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                Scene Notes {sessionNumber != null ? `— Session ${sessionNumber}` : ""}
              </Text>
              {sessionId ? (
                <Pressable onPress={() => router.push(`/campaign/${campaignId}/session/${sessionId}/notes` as Parameters<typeof router.push>[0])}>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C80" }}>All notes ›</Text>
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
                  placeholderTextColor="#2C201440"
                  returnKeyType="done"
                  style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014", borderWidth: 1, borderColor: "#C9A24A30", borderRadius: 2, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#FFFDF7", marginRight: 8 }}
                />
                <Pressable
                  onPress={addNote}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#C9A24A", borderRadius: 2, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FAF5EA" }}>Add</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E60", marginBottom: 8 }}>
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
                style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#A07A2C12" }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C80", marginRight: 6, marginTop: 1 }}>·</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014", flex: 1, lineHeight: 18 }}>{n.text}</Text>
              </Pressable>
            ))}
            {notes.length > 5 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C80", marginTop: 4 }}>
                +{notes.length - 5} more — tap "All notes" to see them
              </Text>
            ) : null}
          </View>

          <GoldRule />

          {/* Party */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                Party
              </Text>
              <Pressable onPress={() => router.push(`/campaign/${campaignId}/party` as Parameters<typeof router.push>[0])}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C80" }}>Overview ›</Text>
              </Pressable>
            </View>
            {party.length === 0 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E60" }}>No PCs in this campaign.</Text>
            ) : party.map((pc) => {
              const hpCurrent = pc.currentHp ?? pc.hp;
              const hpMax = pc.hp;
              const hpPct = hpMax && hpMax > 0 && hpCurrent != null ? hpCurrent / hpMax : null;
              const hpColor = hpPct == null ? "#2C2014" : hpPct === 0 ? "#7A2418" : hpPct < 0.5 ? "#A07A2C" : "#4A8060";
              return (
                <Pressable
                  key={pc.id}
                  onPress={() => router.push(`/campaign/${campaignId}/entity/${pc.id}`)}
                  style={{ marginBottom: 10 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>{pc.name}</Text>
                    {pc.hp != null ? (
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: hpColor, marginRight: 8 }}>
                        {hpCurrent !== hpMax && hpCurrent != null ? `${hpCurrent}/` : ""}{hpMax} HP
                      </Text>
                    ) : null}
                    {pc.npcStatus === "dead" ? (
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#7A2418" }}>☠</Text>
                    ) : pc.npcStatus === "missing" ? (
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#A07A2C" }}>?</Text>
                    ) : null}
                  </View>
                  {hpPct != null ? (
                    <View style={{ height: 3, backgroundColor: "#2C201415", borderRadius: 2, overflow: "hidden", marginBottom: pc.resources.length > 0 ? 4 : 0 }}>
                      <View style={{ height: 3, backgroundColor: hpColor, borderRadius: 2, width: `${Math.round(hpPct * 100)}%` as `${number}%` }} />
                    </View>
                  ) : null}
                  {pc.resources.length > 0 ? (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E80" }} numberOfLines={1}>
                      {pc.resources.map((r) => `${r.name} ${r.current}/${r.max}`).join(" · ")}
                    </Text>
                  ) : null}
                  {pc.conditions.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                      {pc.conditions.map((c) => (
                        <View key={c} style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: "#7A241840", backgroundColor: "#7A241808" }}>
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#7A2418", textTransform: "uppercase" }}>{c}</Text>
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
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#7A2418", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                  Dead / Missing
                </Text>
                {deadMissing.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${e.id}`)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#7A241815" }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: e.status === "dead" ? "#7A2418" : "#A07A2C", marginRight: 8 }}>
                      {e.status === "dead" ? "☠" : "?"}
                    </Text>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>{e.name}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E60", textTransform: "uppercase", letterSpacing: 0.5 }}>{e.kind}</Text>
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
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                    Clocks
                  </Text>
                  <Pressable onPress={() => router.push(`/campaign/${campaignId}/clocks` as Parameters<typeof router.push>[0])}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C80" }}>All ›</Text>
                  </Pressable>
                </View>
                {clocks.map((c) => {
                  const pct = c.max > 0 ? c.current / c.max : 0;
                  return (
                    <View key={c.id} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>{c.name}</Text>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#7A2418" }}>{c.current}/{c.max}</Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 3 }}>
                        {Array.from({ length: c.max }).map((_, i) => (
                          <View
                            key={i}
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 2,
                              backgroundColor: i < c.current ? "#7A2418" : "#A07A2C20",
                            }}
                          />
                        ))}
                      </View>
                      {c.unit ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E50", marginTop: 2 }}>{c.unit}</Text>
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
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                  Active Quests
                </Text>
                {quests.map((q) => {
                  const color = q.questStatus === "active" ? "#A07A2C" : "#5A4D3E";
                  return (
                    <Pressable
                      key={q.id}
                      onPress={() => router.push(`/campaign/${campaignId}/entity/${q.id}`)}
                      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#A07A2C12" }}
                    >
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, marginRight: 10 }} />
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>{q.name}</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: `${color}80`, textTransform: "capitalize" }}>{q.questStatus}</Text>
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
