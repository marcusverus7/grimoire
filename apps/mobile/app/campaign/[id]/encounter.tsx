import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db, getKv, setKv } from "@/lib/db";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { newId } from "@/lib/id";
import { schema } from "@grimoire/core";

type Attrs = Record<string, unknown>;

type TempCombatant = { id: string; name: string; hp: number; ac: number };

export default function EncounterBuilderScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  type NpcEntry = {
    id: string;
    name: string;
    kind: string;
    hp: number;
    ac: number;
    imageUri?: string;
    npcStatus?: string;
  };

  const [npcs, setNpcs] = useState<NpcEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [temps, setTemps] = useState<TempCombatant[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempHp, setTempHp] = useState("");
  const [tempAc, setTempAc] = useState("");

  const load = useCallback(() => {
    const entities = db
      .select()
      .from(schema.entities)
      .where(and(eq(schema.entities.campaignId, campaignId)))
      .all()
      .filter((e) => {
        const a = (e.attrs as Attrs | null);
        if (e.kind !== "npc" && e.kind !== "pc") return false;
        if ((a?.["npcStatus"] as string | undefined) === "dead") return false;
        return a?.["hp"] != null;
      })
      .map((e) => {
        const a = (e.attrs as Attrs | null) ?? {};
        return {
          id: e.id,
          name: e.name,
          kind: e.kind,
          hp: Number(a["hp"] ?? 0),
          ac: Number(a["ac"] ?? 0),
          imageUri: typeof a["imageUri"] === "string" ? a["imageUri"] : undefined,
          npcStatus: typeof a["npcStatus"] === "string" ? a["npcStatus"] : undefined,
        };
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "npc" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    setNpcs(entities);

    // Restore previous selection
    const saved = getKv(`encounter_${campaignId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved) as { entityIds: string[]; temps: TempCombatant[] };
        setSelected(new Set(data.entityIds ?? []));
        setTemps(data.temps ?? []);
      } catch { /* ignore */ }
    }
  }, [campaignId]);

  useFocusEffect(load);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addTemp = () => {
    const n = tempName.trim();
    const h = parseInt(tempHp, 10);
    if (!n || isNaN(h) || h <= 0) {
      Alert.alert("Invalid", "Provide a name and HP.");
      return;
    }
    const t: TempCombatant = { id: `temp_${newId()}`, name: n, hp: h, ac: parseInt(tempAc, 10) || 0 };
    setTemps((prev) => [...prev, t]);
    setTempName("");
    setTempHp("");
    setTempAc("");
    setShowAdd(false);
  };

  const removeTemp = (id: string) => {
    setTemps((prev) => prev.filter((t) => t.id !== id));
  };

  const startEncounter = () => {
    const total = selected.size + temps.length;
    if (total === 0) {
      Alert.alert("Empty Encounter", "Select at least one combatant.");
      return;
    }
    setKv(
      `encounter_${campaignId}`,
      JSON.stringify({ entityIds: [...selected], temps }),
    );
    router.push(`/campaign/${campaignId}/tracker` as Parameters<typeof router.push>[0]);
  };

  const clearEncounter = () => {
    setKv(`encounter_${campaignId}`, "");
    setSelected(new Set());
    setTemps([]);
  };

  const selectedCount = selected.size + temps.length;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Encounter Builder",
          headerRight: () => (
            <Pressable onPress={clearEncounter} style={{ marginRight: 8 }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#8A7D6D" }}>Clear</Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            {/* NPC list */}
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
              Campaign Combatants
            </Text>
            {npcs.length === 0 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D80", fontStyle: "italic", marginBottom: 16 }}>
                No alive NPC/PC entities with HP found.
              </Text>
            ) : (
              npcs.map((npc) => {
                const isSelected = selected.has(npc.id);
                return (
                  <Pressable
                    key={npc.id}
                    onPress={() => toggle(npc.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      marginBottom: 6,
                      borderRadius: 3,
                      borderWidth: 1.5,
                      borderColor: isSelected ? "#7A2418" : "#A07A2C20",
                      backgroundColor: isSelected ? "#7A241808" : "transparent",
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 1.5,
                        borderColor: isSelected ? "#7A2418" : "#A07A2C50",
                        backgroundColor: isSelected ? "#7A2418" : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 10,
                      }}
                    >
                      {isSelected && <Text style={{ color: "#FAF5EA", fontSize: 10 }}>✓</Text>}
                    </View>
                    {npc.imageUri ? (
                      <Image source={{ uri: npc.imageUri }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
                    ) : (
                      <View style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: npc.kind === "pc" ? "#C9A24A15" : "#A07A2C10", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 14, color: npc.kind === "pc" ? "#C9A24A80" : "#A07A2C80" }}>
                          {npc.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: "#2C2014" }}>{npc.name}</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D" }}>
                        {npc.kind === "pc" ? "PC" : "NPC"} · HP {npc.hp}{npc.ac ? ` · AC ${npc.ac}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Temp combatants */}
            {temps.length > 0 && (
              <>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#7A2418", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 16, marginBottom: 10 }}>
                  Temporary Combatants
                </Text>
                {temps.map((t) => (
                  <View
                    key={t.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      marginBottom: 6,
                      borderRadius: 3,
                      borderWidth: 1,
                      borderColor: "#7A241840",
                      backgroundColor: "#7A241806",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: "#2C2014" }}>{t.name}</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D" }}>
                        Temp · HP {t.hp}{t.ac ? ` · AC ${t.ac}` : ""}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeTemp(t.id)}>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#7A241860" }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            {/* Add temp combatant */}
            {showAdd ? (
              <View style={{ marginTop: 12, padding: 12, borderWidth: 1, borderColor: "#A07A2C20", borderRadius: 3 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                  Add Temporary Combatant
                </Text>
                <TextInput
                  value={tempName}
                  onChangeText={setTempName}
                  placeholder="Name (e.g. Goblin)"
                  placeholderTextColor="#2C201440"
                  style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C20", paddingBottom: 6, marginBottom: 10 }}
                />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>HP</Text>
                    <TextInput
                      value={tempHp}
                      onChangeText={setTempHp}
                      placeholder="12"
                      placeholderTextColor="#2C201440"
                      keyboardType="numeric"
                      style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C20", paddingBottom: 4, textAlign: "center" }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>AC</Text>
                    <TextInput
                      value={tempAc}
                      onChangeText={setTempAc}
                      placeholder="13"
                      placeholderTextColor="#2C201440"
                      keyboardType="numeric"
                      style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C20", paddingBottom: 4, textAlign: "center" }}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={addTemp}
                    style={{ flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: "#7A241840", borderRadius: 2, alignItems: "center" }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#7A2418" }}>Add</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowAdd(false)}
                    style={{ flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: "#A07A2C20", borderRadius: 2, alignItems: "center" }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#8A7D6D" }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowAdd(true)}
                style={{ marginTop: 12, paddingVertical: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#A07A2C30", borderRadius: 3, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C80" }}>+ Add Temporary Combatant</Text>
              </Pressable>
            )}
          </ScrollView>

          {/* Launch bar */}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#A07A2C15", backgroundColor: "#FAF5EA" }}>
            <Pressable
              onPress={startEncounter}
              style={{
                backgroundColor: selectedCount > 0 ? "#7A2418" : "#7A241840",
                paddingVertical: 14,
                borderRadius: 3,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#A07A2C30",
              }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1.5 }}>
                {selectedCount > 0 ? `Start Encounter (${selectedCount})` : "Select Combatants"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ParchmentScreen>
    </>
  );
}
