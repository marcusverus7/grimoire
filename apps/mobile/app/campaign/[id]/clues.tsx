import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getKv, setKv } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";

type Clue = { id: string; text: string; connected: boolean; sessionNote: string; ts: number };

function kvKey(campaignId: string) { return `clues_${campaignId}`; }

function loadClues(campaignId: string): Clue[] {
  const raw = getKv(kvKey(campaignId));
  if (!raw) return [];
  try { return JSON.parse(raw) as Clue[]; } catch { return []; }
}

function saveClues(campaignId: string, clues: Clue[]) {
  setKv(kvKey(campaignId), JSON.stringify(clues));
}

export default function CluesScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const [clues, setClues] = useState<Clue[]>([]);
  const [input, setInput] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setClues(loadClues(campaignId));
    }, [campaignId]),
  );

  const addClue = () => {
    const text = input.trim();
    if (!text) return;
    const next: Clue[] = [{ id: newId(), text, connected: false, sessionNote: sessionNote.trim(), ts: Date.now() }, ...clues];
    setClues(next);
    saveClues(campaignId, next);
    setInput("");
    setSessionNote("");
  };

  const toggleConnected = (id: string) => {
    const next = clues.map((c) => c.id === id ? { ...c, connected: !c.connected } : c);
    setClues(next);
    saveClues(campaignId, next);
  };

  const deleteClue = (id: string) => {
    Alert.alert("Delete Clue?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          const next = clues.filter((c) => c.id !== id);
          setClues(next);
          saveClues(campaignId, next);
        },
      },
    ]);
  };

  const active = clues.filter((c) => !c.connected);
  const resolved = clues.filter((c) => c.connected);

  return (
    <>
      <Stack.Screen options={{ title: "Clue Tracker" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
            Clue Tracker
          </Text>
          <GoldRule />

          {/* Add clue */}
          <View style={{ marginTop: 18, gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Clue or discovery…"
              placeholderTextColor="#8A7D6D60"
              multiline
              style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "#A07A2C30", borderRadius: 2, backgroundColor: "#FAF5EA", minHeight: 56, textAlignVertical: "top" }}
              onSubmitEditing={addClue}
            />
            <TextInput
              value={sessionNote}
              onChangeText={setSessionNote}
              placeholder="Where found (optional)…"
              placeholderTextColor="#8A7D6D60"
              style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#2C2014", paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "#A07A2C20", borderRadius: 2, backgroundColor: "#FAF5EA" }}
            />
            <Pressable
              onPress={addClue}
              style={{ paddingVertical: 10, backgroundColor: "#7A2418", borderRadius: 2, alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1.5 }}>
                + Add Clue
              </Text>
            </Pressable>
          </View>

          {/* Active clues */}
          {active.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#7A2418", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                Unresolved ({active.length})
              </Text>
              {active.map((c) => (
                <ClueRow key={c.id} clue={c} onToggle={toggleConnected} onDelete={deleteClue} />
              ))}
            </View>
          )}

          {active.length === 0 && clues.length === 0 && (
            <View style={{ marginTop: 32, alignItems: "center", paddingHorizontal: 24 }}>
              <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: "#8A7D6D80", textAlign: "center", lineHeight: 24 }}>
                No clues recorded yet.{"\n"}Add discoveries, evidence, and loose threads here.
              </Text>
            </View>
          )}

          {/* Resolved clues */}
          {resolved.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Pressable onPress={() => setShowResolved((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#5A4D3E80", textTransform: "uppercase", letterSpacing: 1.5 }}>
                  {showResolved ? "▼" : "▶"} Connected ({resolved.length})
                </Text>
              </Pressable>
              {showResolved && resolved.map((c) => (
                <ClueRow key={c.id} clue={c} onToggle={toggleConnected} onDelete={deleteClue} />
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function ClueRow({ clue, onToggle, onDelete }: { clue: Clue; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <Pressable
      onPress={() => onToggle(clue.id)}
      onLongPress={() => onDelete(clue.id)}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: "#A07A2C12",
      }}
    >
      <View style={{
        width: 18, height: 18, marginTop: 2,
        borderRadius: 1, borderWidth: 1,
        borderColor: clue.connected ? "#4A8060" : "#A07A2C60",
        backgroundColor: clue.connected ? "#4A806020" : "transparent",
        alignItems: "center", justifyContent: "center",
      }}>
        {clue.connected && <Text style={{ fontSize: 10, color: "#4A8060" }}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          fontFamily: "Inter_400Regular", fontSize: 13, color: clue.connected ? "#5A4D3E70" : "#2C2014",
          textDecorationLine: clue.connected ? "line-through" : "none", lineHeight: 20,
        }}>
          {clue.text}
        </Text>
        {!!clue.sessionNote && (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D80", marginTop: 2 }}>
            {clue.sessionNote}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
