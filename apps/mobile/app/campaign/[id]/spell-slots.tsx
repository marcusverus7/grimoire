import { View, Text, ScrollView, Pressable, Modal, TextInput } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { eq, and } from "drizzle-orm";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { db, getKv, setKv } from "@/lib/db";
import { schema } from "@grimoire/core";

// ── D&D 5e spell slot tables ──────────────────────────────────────────────────
// [level] → [slot counts per spell level 1-9]
const FULL_CASTER_SLOTS: number[][] = [
  [],                                    // placeholder (0-indexed)
  [2,0,0,0,0,0,0,0,0],                  // level 1
  [3,0,0,0,0,0,0,0,0],                  // level 2
  [4,2,0,0,0,0,0,0,0],                  // level 3
  [4,3,0,0,0,0,0,0,0],                  // level 4
  [4,3,2,0,0,0,0,0,0],                  // level 5
  [4,3,3,0,0,0,0,0,0],                  // level 6
  [4,3,3,1,0,0,0,0,0],                  // level 7
  [4,3,3,2,0,0,0,0,0],                  // level 8
  [4,3,3,3,1,0,0,0,0],                  // level 9
  [4,3,3,3,2,0,0,0,0],                  // level 10
  [4,3,3,3,2,1,0,0,0],                  // level 11
  [4,3,3,3,2,1,0,0,0],                  // level 12
  [4,3,3,3,2,1,1,0,0],                  // level 13
  [4,3,3,3,2,1,1,0,0],                  // level 14
  [4,3,3,3,2,1,1,1,0],                  // level 15
  [4,3,3,3,2,1,1,1,0],                  // level 16
  [4,3,3,3,2,1,1,1,1],                  // level 17
  [4,3,3,3,3,1,1,1,1],                  // level 18
  [4,3,3,3,3,2,1,1,1],                  // level 19
  [4,3,3,3,3,2,2,1,1],                  // level 20
];

const HALF_CASTER_SLOTS: number[][] = [
  [],
  [0,0,0,0,0,0,0,0,0],
  [2,0,0,0,0,0,0,0,0],
  [3,0,0,0,0,0,0,0,0],
  [3,0,0,0,0,0,0,0,0],
  [4,2,0,0,0,0,0,0,0],
  [4,2,0,0,0,0,0,0,0],
  [4,3,0,0,0,0,0,0,0],
  [4,3,0,0,0,0,0,0,0],
  [4,3,2,0,0,0,0,0,0],
  [4,3,2,0,0,0,0,0,0],
  [4,3,3,0,0,0,0,0,0],
  [4,3,3,0,0,0,0,0,0],
  [4,3,3,1,0,0,0,0,0],
  [4,3,3,1,0,0,0,0,0],
  [4,3,3,2,0,0,0,0,0],
  [4,3,3,2,0,0,0,0,0],
  [4,3,3,3,1,0,0,0,0],
  [4,3,3,3,1,0,0,0,0],
  [4,3,3,3,2,0,0,0,0],
  [4,3,3,3,2,0,0,0,0],
];

// Warlock: pact magic (all same level, short rest)
const WARLOCK_PACT_SLOTS: [number, number][] = [
  [0,0],[1,1],[2,1],[2,2],[2,2],[2,3],[2,3],[2,4],[2,4],[2,5],[2,5],
  [3,5],[3,5],[3,5],[3,5],[3,5],[3,5],[4,5],[4,5],[4,5],[4,5],
];

type CasterType = "Full" | "Half" | "Warlock";

type PCSlots = {
  pcId: string;
  pcName: string;
  level: number;
  casterType: CasterType;
  used: number[];
};

type SlotData = { pcs: PCSlots[] };

// ── Component ─────────────────────────────────────────────────────────────────
export default function SpellSlotsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storageKey = `spell_slots_${id}`;

  const [data, setData] = useState<SlotData>({ pcs: [] });
  const [allPcs, setAllPcs] = useState<Array<{ id: string; name: string; level: number }>>([]);
  const [addModal, setAddModal] = useState(false);
  const [selPc, setSelPc] = useState("");
  const [selPcId, setSelPcId] = useState("");
  const [selLevel, setSelLevel] = useState(5);
  const [selType, setSelType] = useState<CasterType>("Full");

  useFocusEffect(useCallback(() => {
    const saved = getKv(storageKey);
    if (saved) {
      try { setData(JSON.parse(saved) as SlotData); } catch { /* default */ }
    }

    const pcs = db.select({ id: schema.entities.id, name: schema.entities.name, attrs: schema.entities.attrs })
      .from(schema.entities)
      .where(and(eq(schema.entities.campaignId, id), eq(schema.entities.kind, "pc")))
      .all();

    setAllPcs(pcs.map(p => ({
      id: p.id,
      name: p.name,
      level: (p.attrs as Record<string, number>)?.level ?? 1,
    })));
  }, [id, storageKey]));

  function save(next: SlotData) {
    setData(next);
    setKv(storageKey, JSON.stringify(next));
  }

  function getMaxSlots(pc: PCSlots): number[] {
    const l = Math.min(20, Math.max(1, pc.level));
    if (pc.casterType === "Warlock") {
      const [count, slotLevel] = WARLOCK_PACT_SLOTS[l];
      if (slotLevel === 0) return Array(9).fill(0);
      const arr = Array(9).fill(0);
      arr[slotLevel - 1] = count;
      return arr;
    }
    const table = pc.casterType === "Full" ? FULL_CASTER_SLOTS : HALF_CASTER_SLOTS;
    return table[l] ?? Array(9).fill(0);
  }

  function useSlot(pcId: string, slotIdx: number) {
    save({
      pcs: data.pcs.map(p => {
        if (p.pcId !== pcId) return p;
        const max = getMaxSlots(p);
        if (p.used[slotIdx] >= max[slotIdx]) return p;
        const used = [...p.used];
        used[slotIdx] = (used[slotIdx] ?? 0) + 1;
        return { ...p, used };
      }),
    });
  }

  function restoreSlot(pcId: string, slotIdx: number) {
    save({
      pcs: data.pcs.map(p => {
        if (p.pcId !== pcId) return p;
        const used = [...p.used];
        used[slotIdx] = Math.max(0, (used[slotIdx] ?? 0) - 1);
        return { ...p, used };
      }),
    });
  }

  function longRest() {
    save({ pcs: data.pcs.map(p => ({ ...p, used: Array(9).fill(0) })) });
  }

  function shortRest() {
    save({
      pcs: data.pcs.map(p =>
        p.casterType === "Warlock" ? { ...p, used: Array(9).fill(0) } : p
      ),
    });
  }

  function addPc() {
    if (!selPc) return;
    const existing = data.pcs.find(p => p.pcId === selPcId);
    if (existing) { setAddModal(false); return; }
    const entry: PCSlots = { pcId: selPcId, pcName: selPc, level: selLevel, casterType: selType, used: Array(9).fill(0) };
    save({ pcs: [...data.pcs, entry] });
    setAddModal(false);
  }

  function removePc(pcId: string) {
    save({ pcs: data.pcs.filter(p => p.pcId !== pcId) });
  }

  const SLOT_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "Spell Slots", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 4 }}>
          Spell Slot Tracker
        </Text>
        <GoldRule />

        {/* Rest buttons */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
          <Pressable
            onPress={shortRest}
            style={{ flex: 1, borderWidth: 1, borderColor: "#2D7A4F40", borderRadius: 2, padding: 10, alignItems: "center" }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#2D7A4F" }}>⏸ Short Rest</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D", marginTop: 2 }}>Warlocks recover</Text>
          </Pressable>
          <Pressable
            onPress={longRest}
            style={{ flex: 1, backgroundColor: "#2C2014", borderRadius: 2, padding: 10, alignItems: "center" }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#C9A24A" }}>☾ Long Rest</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#C9A24A80", marginTop: 2 }}>All recover</Text>
          </Pressable>
        </View>

        {/* PC caster cards */}
        {data.pcs.length === 0 && (
          <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#8A7D6D60", textAlign: "center", paddingVertical: 20 }}>
            Add casters to track their spell slots.
          </Text>
        )}
        {data.pcs.map(pc => {
          const max = getMaxSlots(pc);
          const activeSlots = max.map((m, i) => ({ level: i + 1, max: m, used: pc.used[i] ?? 0 })).filter(s => s.max > 0);
          return (
            <View key={pc.pcId} style={{ backgroundColor: "#E8DCC820", borderRadius: 4, borderWidth: 1, borderColor: "#C4B49A", padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <View>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#2C2014" }}>{pc.pcName}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D" }}>
                    Level {pc.level} • {pc.casterType} Caster
                    {pc.casterType === "Warlock" ? " (Pact Magic)" : ""}
                  </Text>
                </View>
                <Pressable onPress={() => removePc(pc.pcId)} style={{ padding: 4 }}>
                  <Text style={{ fontSize: 12, color: "#8A7D6D60" }}>✕</Text>
                </Pressable>
              </View>
              {activeSlots.map(slot => (
                <View key={slot.level} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#8A7D6D", width: 28 }}>
                    {SLOT_ORDINALS[slot.level - 1]}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 4, flex: 1 }}>
                    {Array.from({ length: slot.max }).map((_, i) => (
                      <Pressable
                        key={i}
                        onPress={() => i < slot.used ? restoreSlot(pc.pcId, slot.level - 1) : useSlot(pc.pcId, slot.level - 1)}
                        style={{
                          width: 22, height: 22, borderRadius: 11,
                          borderWidth: 1.5,
                          borderColor: i < slot.used ? "#C4B49A60" : "#A07A2C",
                          backgroundColor: i < slot.used ? "transparent" : "#A07A2C20",
                        }}
                      />
                    ))}
                  </View>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", width: 32, textAlign: "right" }}>
                    {slot.max - slot.used}/{slot.max}
                  </Text>
                </View>
              ))}
              {activeSlots.length === 0 && (
                <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 12, color: "#8A7D6D80" }}>
                  No spell slots at this level.
                </Text>
              )}
            </View>
          );
        })}

        {/* Add button */}
        <Pressable
          onPress={() => {
            const first = allPcs[0];
            setSelPc(first?.name ?? ""); setSelPcId(first?.id ?? "");
            setSelLevel(first?.level ?? 5); setSelType("Full");
            setAddModal(true);
          }}
          style={{ borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, padding: 10, alignItems: "center", marginTop: 4 }}
        >
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C" }}>+ Add Caster</Text>
        </Pressable>
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={addModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#F5EDD8", borderRadius: 4, padding: 20 }}>
            <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: "#2C2014", marginBottom: 16 }}>
              Add Caster
            </Text>

            <Text style={labelStyle}>Character</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {allPcs.map(pc => (
                <Pressable
                  key={pc.id}
                  onPress={() => { setSelPc(pc.name); setSelPcId(pc.id); setSelLevel(pc.level); }}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 2, borderWidth: 1, borderColor: selPcId === pc.id ? "#2C2014" : "#C4B49A", backgroundColor: selPcId === pc.id ? "#2C2014" : "#E8DCC8" }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: selPcId === pc.id ? "#C9A24A" : "#4A3F32" }}>{pc.name}</Text>
                </Pressable>
              ))}
              {allPcs.length === 0 && (
                <TextInput
                  value={selPc} onChangeText={setSelPc}
                  placeholder="Enter PC name"
                  placeholderTextColor="#8A7D6D80"
                  style={{ borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 8, fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014" }}
                />
              )}
            </ScrollView>

            <Text style={labelStyle}>Level</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(l => (
                <Pressable
                  key={l}
                  onPress={() => setSelLevel(l)}
                  style={{ width: 32, height: 32, marginRight: 4, borderRadius: 2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: selLevel === l ? "#A07A2C" : "#C4B49A", backgroundColor: selLevel === l ? "#A07A2C20" : "#E8DCC8" }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: selLevel === l ? "#A07A2C" : "#4A3F32" }}>{l}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={labelStyle}>Caster Type</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
              {(["Full", "Half", "Warlock"] as CasterType[]).map(t => (
                <Pressable
                  key={t}
                  onPress={() => setSelType(t)}
                  style={{ flex: 1, padding: 8, alignItems: "center", borderRadius: 2, borderWidth: 1, borderColor: selType === t ? "#A07A2C" : "#C4B49A", backgroundColor: selType === t ? "#A07A2C20" : "#E8DCC8" }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: selType === t ? "#A07A2C" : "#4A3F32" }}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setAddModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 10, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#4A3F32" }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={addPc} style={{ flex: 1, backgroundColor: "#2C2014", borderRadius: 2, padding: 10, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#C9A24A" }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ParchmentScreen>
  );
}

const labelStyle = { fontFamily: "Inter_600SemiBold" as const, fontSize: 10, color: "#8A7D6D", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 };
