import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getKv, setKv } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";

type Clock = {
  id: string;
  name: string;
  current: number;
  max: number;
  unit?: string;
  notes?: string;
};

function kvKey(campaignId: string) {
  return `clocks_${campaignId}`;
}

function loadClocks(campaignId: string): Clock[] {
  const raw = getKv(kvKey(campaignId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Clock[];
  } catch {
    return [];
  }
}

function saveClocks(campaignId: string, clocks: Clock[]) {
  setKv(kvKey(campaignId), JSON.stringify(clocks));
}

const MAX_SIZES = [4, 6, 8, 10, 12];

export default function ClocksScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const [clocks, setClocks] = useState<Clock[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState(6);
  const [newUnit, setNewUnit] = useState("");

  useFocusEffect(
    useCallback(() => {
      setClocks(loadClocks(campaignId));
    }, [campaignId]),
  );

  const update = (updated: Clock[]) => {
    setClocks(updated);
    saveClocks(campaignId, updated);
  };

  const addClock = () => {
    const name = newName.trim();
    if (!name) return;
    const next: Clock[] = [
      ...clocks,
      { id: newId(), name, current: 0, max: newMax, unit: newUnit.trim() || undefined },
    ];
    update(next);
    setNewName("");
    setNewMax(6);
    setNewUnit("");
    setShowAdd(false);
  };

  const tick = (id: string, delta: number) => {
    update(
      clocks.map((c) =>
        c.id === id ? { ...c, current: Math.max(0, Math.min(c.max, c.current + delta)) } : c,
      ),
    );
  };

  const deleteClock = (id: string) => {
    Alert.alert("Delete Clock", "Remove this clock permanently?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => update(clocks.filter((c) => c.id !== id)) },
    ]);
  };

  const resetClock = (id: string) => {
    update(clocks.map((c) => (c.id === id ? { ...c, current: 0 } : c)));
  };

  return (
    <>
      <Stack.Screen options={{ title: "Clocks" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 13, color: "#5A4D3E80", fontStyle: "italic", flex: 1 }}>
              Track in-world pressures, countdowns, and goals.
            </Text>
            <Pressable
              onPress={() => setShowAdd(true)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#7A2418", borderRadius: 2, marginLeft: 12 }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FAF5EA" }}>+ Clock</Text>
            </Pressable>
          </View>

          {clocks.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 16, color: "#5A4D3E50", fontStyle: "italic" }}>
                No clocks yet.
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E40", marginTop: 6, textAlign: "center" }}>
                Add a clock for events like "Dragon Arrives" or "Food Runs Out".
              </Text>
            </View>
          ) : (
            clocks.map((clock) => {
              const filled = clock.current;
              const empty = clock.max - filled;
              const pct = clock.max > 0 ? filled / clock.max : 0;
              const isComplete = filled >= clock.max;
              return (
                <View
                  key={clock.id}
                  style={{
                    marginBottom: 20,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: isComplete ? "#4A806040" : "#A07A2C25",
                    borderRadius: 3,
                    backgroundColor: isComplete ? "#4A806008" : "#A07A2C05",
                  }}
                >
                  {/* Name + delete */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 18, color: isComplete ? "#4A8060" : "#2C2014" }}>
                        {clock.name}
                      </Text>
                      {clock.unit ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E60", marginTop: 1 }}>{clock.unit}</Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {filled > 0 && (
                        <Pressable onPress={() => resetClock(clock.id)} style={{ paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E60" }}>Reset</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => deleteClock(clock.id)} style={{ padding: 4 }}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#7A241840" }}>✕</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Pie/clock segments */}
                  <View style={{ flexDirection: "row", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
                    {Array.from({ length: clock.max }).map((_, i) => {
                      const isFilled = i < filled;
                      return (
                        <View
                          key={i}
                          style={{
                            width: Math.max(28, Math.min(44, (320 - clock.max * 4) / clock.max)),
                            height: 28,
                            borderRadius: 2,
                            backgroundColor: isFilled
                              ? isComplete ? "#4A8060" : "#7A2418"
                              : "transparent",
                            borderWidth: 1.5,
                            borderColor: isFilled
                              ? isComplete ? "#4A806080" : "#7A241880"
                              : "#A07A2C30",
                          }}
                        />
                      );
                    })}
                  </View>

                  {/* Progress text */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: isComplete ? "#4A8060" : "#2C2014", marginRight: 8 }}>
                      {filled}/{clock.max}
                    </Text>
                    <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "#A07A2C15", overflow: "hidden" }}>
                      <View style={{ height: 3, borderRadius: 2, width: `${pct * 100}%`, backgroundColor: isComplete ? "#4A8060" : "#7A2418" }} />
                    </View>
                    {isComplete && (
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#4A8060", marginLeft: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                        Complete
                      </Text>
                    )}
                  </View>

                  {/* Controls */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => tick(clock.id, -1)}
                      disabled={filled <= 0}
                      style={{
                        flex: 1,
                        paddingVertical: 9,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: filled <= 0 ? "#A07A2C20" : "#A07A2C40",
                        borderRadius: 2,
                        backgroundColor: filled <= 0 ? "transparent" : "#A07A2C08",
                      }}
                    >
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: filled <= 0 ? "#A07A2C30" : "#A07A2C" }}>−</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => tick(clock.id, 1)}
                      disabled={filled >= clock.max}
                      style={{
                        flex: 2,
                        paddingVertical: 9,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: filled >= clock.max ? "#7A241820" : "#7A241860",
                        borderRadius: 2,
                        backgroundColor: filled >= clock.max ? "transparent" : "#7A241810",
                      }}
                    >
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: filled >= clock.max ? "#7A241830" : "#7A2418", textTransform: "uppercase", letterSpacing: 1 }}>
                        Tick
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </ParchmentScreen>

      {/* Add Clock Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable
            onPress={() => setShowAdd(false)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 24 }}
          >
            <Pressable onPress={() => {}} style={{ backgroundColor: "#FAF5EA", borderRadius: 4, borderWidth: 1, borderColor: "#A07A2C30", padding: 20 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 16 }}>
                New Clock
              </Text>

              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>
                Name
              </Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Dragon Arrives"
                placeholderTextColor="#2C201440"
                autoFocus
                style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 18, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 8, marginBottom: 20 }}
              />

              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
                Segments
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
                {MAX_SIZES.map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setNewMax(n)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: "center",
                      borderWidth: 1.5,
                      borderColor: newMax === n ? "#A07A2C" : "#A07A2C25",
                      borderRadius: 2,
                      backgroundColor: newMax === n ? "#A07A2C15" : "transparent",
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: newMax === n ? "#A07A2C" : "#5A4D3E" }}>{n}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>
                Unit (optional)
              </Text>
              <TextInput
                value={newUnit}
                onChangeText={setNewUnit}
                placeholder="e.g. sessions, days, milestones"
                placeholderTextColor="#2C201440"
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 8, marginBottom: 20 }}
              />

              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                <Pressable onPress={() => setShowAdd(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#5A4D3E" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={addClock}
                  disabled={!newName.trim()}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 2,
                    backgroundColor: newName.trim() ? "#7A2418" : "#7A241830",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: newName.trim() ? "#FAF5EA" : "#FAF5EA60", textTransform: "uppercase", letterSpacing: 1 }}>
                    Create
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
