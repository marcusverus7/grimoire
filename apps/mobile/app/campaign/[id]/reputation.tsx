import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { eq, and } from "drizzle-orm";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { db, getKv, setKv } from "@/lib/db";
import { schema } from "@grimoire/core";
import { randomUUID } from "expo-crypto";
import { color, withAlpha } from "@/lib/theme";

// ── Types ─────────────────────────────────────────────────────────────────────
type RepEvent = { id: string; delta: number; note: string; timestamp: number };

type FactionRep = {
  factionId: string;
  factionName: string;
  score: number;
  history: RepEvent[];
};

type RepData = { factions: FactionRep[] };

// ── Standing labels ───────────────────────────────────────────────────────────
function standing(score: number): { label: string; color: string } {
  if (score <= -5) return { label: "Hostile", color: "#7A1A1A" };
  if (score <= -3) return { label: "Unfriendly", color: "#C44A1A" };
  if (score <= -1) return { label: "Wary", color: color.gold };
  if (score === 0) return { label: "Neutral", color: color.inkFaint };
  if (score <= 2) return { label: "Friendly", color: color.successBright };
  if (score <= 4) return { label: "Trusted", color: "#1A6A4A" };
  return { label: "Allied", color: "#0A4A30" };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReputationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storageKey = `reputation_${id}`;

  const [data, setData] = useState<RepData>({ factions: [] });
  const [allFactions, setAllFactions] = useState<Array<{ id: string; name: string }>>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFaction, setSelectedFaction] = useState<FactionRep | null>(null);
  const [delta, setDelta] = useState("1");
  const [note, setNote] = useState("");
  const [historyFaction, setHistoryFaction] = useState<FactionRep | null>(null);

  useFocusEffect(useCallback(() => {
    const saved = getKv(storageKey);
    if (saved) {
      try { setData(JSON.parse(saved) as RepData); } catch { /* default */ }
    }

    const factions = db.select({ id: schema.entities.id, name: schema.entities.name })
      .from(schema.entities)
      .where(and(eq(schema.entities.campaignId, id), eq(schema.entities.kind, "faction")))
      .all()
      .sort((a, b) => a.name.localeCompare(b.name));
    setAllFactions(factions);

    // Auto-add any factions not yet tracked
    setData(prev => {
      const known = new Set(prev.factions.map(f => f.factionId));
      const newEntries: FactionRep[] = factions
        .filter(f => !known.has(f.id))
        .map(f => ({ factionId: f.id, factionName: f.name, score: 0, history: [] }));
      if (newEntries.length === 0) return prev;
      const next = { factions: [...prev.factions, ...newEntries] };
      setKv(storageKey, JSON.stringify(next));
      return next;
    });
  }, [id, storageKey]));

  function save(next: RepData) {
    setData(next);
    setKv(storageKey, JSON.stringify(next));
  }

  function openAdjust(faction: FactionRep) {
    setSelectedFaction(faction);
    setDelta("1");
    setNote("");
    setModalVisible(true);
  }

  function submitAdjust(positive: boolean) {
    if (!selectedFaction) return;
    const d = (positive ? 1 : -1) * Math.max(1, parseInt(delta, 10) || 1);
    const clamped = Math.max(-5, Math.min(5, selectedFaction.score + d));
    const event: RepEvent = { id: randomUUID(), delta: clamped - selectedFaction.score, note: note.trim(), timestamp: Date.now() };
    const next: RepData = {
      factions: data.factions.map(f =>
        f.factionId === selectedFaction.factionId
          ? { ...f, score: clamped, history: [event, ...f.history].slice(0, 20) }
          : f
      ),
    };
    save(next);
    setModalVisible(false);
  }

  function resetReputation(factionId: string) {
    Alert.alert("Reset Reputation", "Reset this faction's standing to Neutral (0)?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        onPress: () => {
          const event: RepEvent = { id: randomUUID(), delta: 0, note: "Reset to neutral", timestamp: Date.now() };
          save({
            factions: data.factions.map(f =>
              f.factionId === factionId ? { ...f, score: 0, history: [event, ...f.history].slice(0, 20) } : f
            ),
          });
        },
      },
    ]);
  }

  function addFactionManual() {
    Alert.prompt(
      "Add Faction",
      "Enter faction name (or add factions as entities in the campaign)",
      name => {
        if (!name?.trim()) return;
        const existing = data.factions.find(f => f.factionName.toLowerCase() === name.trim().toLowerCase());
        if (existing) return;
        const entry: FactionRep = { factionId: randomUUID(), factionName: name.trim(), score: 0, history: [] };
        save({ factions: [...data.factions, entry] });
      },
      "plain-text"
    );
  }

  const sorted = [...data.factions].sort((a, b) => b.score - a.score);

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "Faction Reputation", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: color.ink, textAlign: "center", marginBottom: 4 }}>
          Faction Reputation
        </Text>
        <GoldRule />

        {data.factions.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: color.inkFaint, textAlign: "center", marginBottom: 12 }}>
              No factions tracked yet.{"\n"}Add faction entities to your campaign to track reputation automatically.
            </Text>
            <Pressable onPress={addFactionManual} style={{ borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255), borderRadius: 2, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.gold }}>+ Add Faction Manually</Text>
            </Pressable>
          </View>
        )}

        {sorted.map(faction => {
          const st = standing(faction.score);
          return (
            <View key={faction.factionId} style={{ backgroundColor: withAlpha("parchmentEdge", 0x20 / 255), borderRadius: 4, borderWidth: 1, borderColor: color.border, padding: 14, marginBottom: 12 }}>
              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: color.ink }}>{faction.factionName}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <View style={{ backgroundColor: st.color + "20", borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: st.color }}>{st.label.toUpperCase()}</Text>
                    </View>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.inkFaint }}>Score: {faction.score > 0 ? `+${faction.score}` : faction.score}</Text>
                  </View>
                </View>
                <Pressable
                  onLongPress={() => resetReputation(faction.factionId)}
                  onPress={() => {}}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkFaint", 0x60 / 255) }}>hold to reset</Text>
                </Pressable>
              </View>

              {/* Score bar */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 2 }}>
                {[-5,-4,-3,-2,-1,0,1,2,3,4,5].map(v => (
                  <View
                    key={v}
                    style={{
                      flex: 1, height: 6, borderRadius: 1,
                      backgroundColor: v === 0 ? color.border :
                        (faction.score >= v && v > 0) ? st.color :
                        (faction.score <= v && v < 0) ? "#7A1A1A" : color.parchmentEdge,
                      borderWidth: v === faction.score ? 1.5 : 0,
                      borderColor: st.color,
                    }}
                  />
                ))}
              </View>

              {/* Adjust buttons */}
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable onPress={() => openAdjust(faction)} style={{ flex: 1, backgroundColor: color.ink, borderRadius: 2, padding: 8, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.goldBright }}>± Adjust</Text>
                </Pressable>
                <Pressable onPress={() => setHistoryFaction(historyFaction?.factionId === faction.factionId ? null : faction)} style={{ borderWidth: 1, borderColor: color.border, borderRadius: 2, padding: 8, alignItems: "center", minWidth: 60 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.borderDark }}>History</Text>
                </Pressable>
              </View>

              {/* History */}
              {historyFaction?.factionId === faction.factionId && (
                <View style={{ marginTop: 10 }}>
                  {faction.history.length === 0 && (
                    <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 12, color: withAlpha("inkFaint", 0x60 / 255) }}>No history yet.</Text>
                  )}
                  {faction.history.slice(0, 8).map(ev => (
                    <View key={ev.id} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 5, borderTopWidth: 1, borderTopColor: color.parchmentEdge, gap: 8 }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: ev.delta > 0 ? color.successBright : ev.delta < 0 ? "#7A1A1A" : color.inkFaint, width: 28 }}>
                        {ev.delta > 0 ? `+${ev.delta}` : ev.delta}
                      </Text>
                      <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: color.borderDark }}>{ev.note || "—"}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {data.factions.length > 0 && (
          <Pressable onPress={addFactionManual} style={{ borderWidth: 1, borderColor: withAlpha("border", 0x60 / 255), borderRadius: 2, padding: 10, alignItems: "center", marginTop: 4 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.inkFaint }}>+ Add Faction</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Adjust Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: withAlpha("shadow", 0x60 / 255), justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: color.parchmentWarm, borderRadius: 4, padding: 20 }}>
            <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: color.ink, marginBottom: 4 }}>
              Adjust Reputation
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.borderDark, marginBottom: 16 }}>
              {selectedFaction?.factionName} — current: {(selectedFaction?.score ?? 0) > 0 ? `+${selectedFaction?.score}` : selectedFaction?.score}
            </Text>

            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.inkFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Amount</Text>
            <TextInput
              value={delta}
              onChangeText={setDelta}
              keyboardType="number-pad"
              style={{ borderWidth: 1, borderColor: color.border, borderRadius: 2, padding: 10, fontFamily: "Inter_400Regular", fontSize: 16, color: color.ink, textAlign: "center", marginBottom: 12 }}
            />

            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.inkFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Reason (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Helped recover stolen goods"
              placeholderTextColor={withAlpha("inkFaint", 0x80 / 255)}
              style={{ borderWidth: 1, borderColor: color.border, borderRadius: 2, padding: 10, fontFamily: "Inter_400Regular", fontSize: 13, color: color.ink, marginBottom: 16 }}
            />

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <Pressable onPress={() => submitAdjust(false)} style={{ flex: 1, backgroundColor: "#7A1A1A", borderRadius: 2, padding: 12, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: color.parchmentWarm }}>− Decrease</Text>
              </Pressable>
              <Pressable onPress={() => submitAdjust(true)} style={{ flex: 1, backgroundColor: color.successBright, borderRadius: 2, padding: 12, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: color.parchmentWarm }}>+ Increase</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setModalVisible(false)} style={{ padding: 8, alignItems: "center" }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.inkFaint }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ParchmentScreen>
  );
}
