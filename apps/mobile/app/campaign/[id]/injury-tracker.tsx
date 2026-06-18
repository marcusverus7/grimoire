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

// ── Types ─────────────────────────────────────────────────────────────────────
type Severity = "Minor" | "Major" | "Severe" | "Permanent";
type InjuryStatus = "active" | "healing" | "recovered";

type Injury = {
  id: string;
  entityId: string;
  entityName: string;
  description: string;
  severity: Severity;
  status: InjuryStatus;
  daysToHeal: number;
  daysElapsed: number;
  effect: string;
};

type InjuryData = { injuries: Injury[] };

// ── Pre-written injuries ──────────────────────────────────────────────────────
const INJURY_PRESETS: Record<Severity, Array<{ description: string; effect: string; daysToHeal: number }>> = {
  Minor: [
    { description: "Bruised ribs", effect: "Disadvantage on Athletics checks", daysToHeal: 7 },
    { description: "Sprained wrist", effect: "Disadvantage on attack rolls with that hand", daysToHeal: 5 },
    { description: "Black eye", effect: "Disadvantage on Perception (sight) checks", daysToHeal: 4 },
    { description: "Deep cut on arm", effect: "Lose 1 HP per hour until bandaged", daysToHeal: 7 },
    { description: "Concussion", effect: "Disadvantage on Intelligence checks", daysToHeal: 3 },
    { description: "Twisted ankle", effect: "Speed reduced by 10 ft", daysToHeal: 5 },
  ],
  Major: [
    { description: "Broken arm", effect: "Can't wield two-handed weapons; disadvantage on Str checks", daysToHeal: 21 },
    { description: "Broken ribs", effect: "Speed halved; disadvantage on Constitution saves", daysToHeal: 14 },
    { description: "Deep stab wound", effect: "Max HP reduced by 1d6 until healed", daysToHeal: 14 },
    { description: "Festering wound", effect: "Poisoned until cured; DC 13 Con each day or worsen", daysToHeal: 10 },
    { description: "Eye injury", effect: "Disadvantage on ranged attacks and Perception", daysToHeal: 14 },
    { description: "Head wound", effect: "Disadvantage on all saving throws", daysToHeal: 10 },
  ],
  Severe: [
    { description: "Lost eye", effect: "Disadvantage on Perception and ranged attacks (permanent unless magical)", daysToHeal: 30 },
    { description: "Shattered knee", effect: "Speed reduced by 15 ft; can't Dash", daysToHeal: 30 },
    { description: "Severed tendon", effect: "Disadvantage on all Dexterity checks/saves; can't Dash", daysToHeal: 30 },
    { description: "Internal bleeding", effect: "Lose 1d4 HP per hour; DC 15 Medicine to stabilise", daysToHeal: 21 },
    { description: "Burns (30%)", effect: "Disadvantage on Charisma checks; pain causes difficulty concentrating", daysToHeal: 21 },
  ],
  Permanent: [
    { description: "Lost hand", effect: "Can't use two-handed weapons or hold a shield", daysToHeal: 0 },
    { description: "Lost foot", effect: "Speed reduced to 15 ft; can't jump or swim", daysToHeal: 0 },
    { description: "Lost eye (both)", effect: "Blinded; advantage against creatures that rely on sight, disadvantage on everything visual", daysToHeal: 0 },
    { description: "Severe facial scarring", effect: "Disadvantage on Persuasion; advantage on Intimidation", daysToHeal: 0 },
  ],
};

const SEVERITY_COLORS: Record<Severity, string> = {
  Minor: "#2D7A4F",
  Major: "#8A5C1A",
  Severe: "#8A1A1A",
  Permanent: "#3A0A0A",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function InjuryTrackerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storageKey = `injuries_${id}`;

  const [data, setData] = useState<InjuryData>({ injuries: [] });
  const [entities, setEntities] = useState<Array<{ id: string; name: string }>>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editInjury, setEditInjury] = useState<Injury | null>(null);

  // Form state
  const [fEntityId, setFEntityId] = useState("");
  const [fEntityName, setFEntityName] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fSeverity, setFSeverity] = useState<Severity>("Minor");
  const [fEffect, setFEffect] = useState("");
  const [fDays, setFDays] = useState("7");

  useFocusEffect(useCallback(() => {
    const saved = getKv(storageKey);
    if (saved) {
      try { setData(JSON.parse(saved) as InjuryData); } catch { /* default */ }
    }
    const ents = db.select({ id: schema.entities.id, name: schema.entities.name })
      .from(schema.entities)
      .where(and(
        eq(schema.entities.campaignId, id),
        // PCs and NPCs only
      ))
      .all()
      .filter(e => {
        const k = (e as { kind?: string }).kind;
        return k === "pc" || k === "npc";
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    setEntities(ents);
  }, [id, storageKey]));

  function save(next: InjuryData) {
    setData(next);
    setKv(storageKey, JSON.stringify(next));
  }

  function openAdd() {
    setEditInjury(null);
    const first = entities[0];
    setFEntityId(first?.id ?? ""); setFEntityName(first?.name ?? "");
    setFDesc(""); setFSeverity("Minor"); setFEffect(""); setFDays("7");
    setModalVisible(true);
  }

  function openEdit(inj: Injury) {
    setEditInjury(inj);
    setFEntityId(inj.entityId); setFEntityName(inj.entityName);
    setFDesc(inj.description); setFSeverity(inj.severity);
    setFEffect(inj.effect); setFDays(String(inj.daysToHeal));
    setModalVisible(true);
  }

  function applyPreset(preset: typeof INJURY_PRESETS["Minor"][0]) {
    setFDesc(preset.description);
    setFEffect(preset.effect);
    setFDays(String(preset.daysToHeal));
  }

  function submit() {
    if (!fDesc.trim()) return;
    const entry: Injury = {
      id: editInjury?.id ?? randomUUID(),
      entityId: fEntityId,
      entityName: fEntityName,
      description: fDesc.trim(),
      severity: fSeverity,
      status: editInjury?.status ?? "active",
      daysToHeal: fSeverity === "Permanent" ? 0 : Math.max(0, parseInt(fDays, 10) || 7),
      daysElapsed: editInjury?.daysElapsed ?? 0,
      effect: fEffect.trim(),
    };
    if (editInjury) {
      save({ injuries: data.injuries.map(i => i.id === editInjury.id ? entry : i) });
    } else {
      save({ injuries: [...data.injuries, entry] });
    }
    setModalVisible(false);
  }

  function advanceDay(injId: string) {
    save({
      injuries: data.injuries.map(i => {
        if (i.id !== injId || i.severity === "Permanent") return i;
        const elapsed = i.daysElapsed + 1;
        const healed = elapsed >= i.daysToHeal;
        return { ...i, daysElapsed: elapsed, status: healed ? "recovered" : "healing" };
      }),
    });
  }

  function removeInjury(injId: string) {
    Alert.alert("Remove Injury", "Remove this injury record?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => save({ injuries: data.injuries.filter(i => i.id !== injId) }) },
    ]);
  }

  const active = data.injuries.filter(i => i.status !== "recovered");
  const recovered = data.injuries.filter(i => i.status === "recovered");
  const [showRecovered, setShowRecovered] = useState(false);

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "Injury Tracker", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 4 }}>
          Injury Tracker
        </Text>
        <GoldRule />

        <Pressable
          onPress={openAdd}
          style={{ backgroundColor: "#2C2014", borderRadius: 2, padding: 12, alignItems: "center", marginBottom: 20 }}
        >
          <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 13, color: "#C9A24A", letterSpacing: 1 }}>
            + Record Injury
          </Text>
        </Pressable>

        {active.length === 0 && recovered.length === 0 && (
          <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#8A7D6D60", textAlign: "center", paddingVertical: 20 }}>
            No injuries tracked.{"\n"}Record injuries to monitor their effects and healing.
          </Text>
        )}

        {active.map(inj => (
          <InjuryCard key={inj.id} injury={inj} onEdit={() => openEdit(inj)} onDelete={() => removeInjury(inj.id)} onAdvanceDay={() => advanceDay(inj.id)} />
        ))}

        {recovered.length > 0 && (
          <View>
            <Pressable onPress={() => setShowRecovered(s => !s)} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1 }}>
                Recovered ({recovered.length})
              </Text>
              <Text style={{ fontSize: 12, color: "#8A7D6D" }}>{showRecovered ? "▼" : "▶"}</Text>
            </Pressable>
            {showRecovered && recovered.map(inj => (
              <InjuryCard key={inj.id} injury={inj} onEdit={() => openEdit(inj)} onDelete={() => removeInjury(inj.id)} onAdvanceDay={() => {}} dimmed />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#F5EDD8", borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20, maxHeight: "92%" }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 15, color: "#2C2014", marginBottom: 16 }}>
                {editInjury ? "Edit Injury" : "Record Injury"}
              </Text>

              <FL label="Character / NPC" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {entities.map(e => (
                  <Pressable key={e.id} onPress={() => { setFEntityId(e.id); setFEntityName(e.name); }}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 2, borderWidth: 1, borderColor: fEntityId === e.id ? "#2C2014" : "#C4B49A", backgroundColor: fEntityId === e.id ? "#2C2014" : "#E8DCC8" }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: fEntityId === e.id ? "#C9A24A" : "#4A3F32" }}>{e.name}</Text>
                  </Pressable>
                ))}
                {entities.length === 0 && (
                  <TextInput value={fEntityName} onChangeText={setFEntityName} placeholder="Character name"
                    placeholderTextColor="#8A7D6D80"
                    style={{ borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 8, fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014" }}
                  />
                )}
              </ScrollView>

              <FL label="Severity" />
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
                {(["Minor", "Major", "Severe", "Permanent"] as Severity[]).map(s => (
                  <Pressable key={s} onPress={() => { setFSeverity(s); if (s === "Permanent") setFDays("0"); }}
                    style={{ flex: 1, padding: 6, alignItems: "center", borderRadius: 2, borderWidth: 1, borderColor: fSeverity === s ? SEVERITY_COLORS[s] : "#C4B49A", backgroundColor: fSeverity === s ? SEVERITY_COLORS[s] + "20" : "#E8DCC8" }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: fSeverity === s ? SEVERITY_COLORS[s] : "#4A3F32" }}>{s}</Text>
                  </Pressable>
                ))}
              </View>

              <FL label="Quick Presets" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {INJURY_PRESETS[fSeverity].map((p, i) => (
                  <Pressable key={i} onPress={() => applyPreset(p)}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 2, borderWidth: 1, borderColor: "#C4B49A", backgroundColor: "#E8DCC8" }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#4A3F32" }}>{p.description}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <FL label="Injury Description" />
              <TextInput value={fDesc} onChangeText={setFDesc} placeholder="e.g. Deep stab wound to the shoulder"
                placeholderTextColor="#8A7D6D80"
                style={inputStyle} />

              <FL label="Mechanical Effect" />
              <TextInput value={fEffect} onChangeText={setFEffect} placeholder="e.g. Disadvantage on Str checks"
                placeholderTextColor="#8A7D6D80"
                style={inputStyle} />

              {fSeverity !== "Permanent" && (
                <>
                  <FL label="Days to Heal" />
                  <TextInput value={fDays} onChangeText={setFDays} keyboardType="number-pad"
                    style={[inputStyle, { textAlign: "center" }]} />
                </>
              )}

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                <Pressable onPress={() => setModalVisible(false)} style={{ flex: 1, borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 10, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#4A3F32" }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={submit} style={{ flex: 1, backgroundColor: "#2C2014", borderRadius: 2, padding: 10, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#C9A24A" }}>{editInjury ? "Save" : "Record"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ParchmentScreen>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 10,
  fontFamily: "Inter_400Regular" as const, fontSize: 13, color: "#2C2014",
  backgroundColor: "#FFFDF8", marginBottom: 12,
};

function FL({ label }: { label: string }) {
  return <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</Text>;
}

function InjuryCard({ injury, onEdit, onDelete, onAdvanceDay, dimmed }: {
  injury: Injury; onEdit: () => void; onDelete: () => void; onAdvanceDay: () => void; dimmed?: boolean;
}) {
  const col = SEVERITY_COLORS[injury.severity];
  const pct = injury.daysToHeal > 0 ? Math.min(1, injury.daysElapsed / injury.daysToHeal) : 1;
  return (
    <Pressable onPress={onEdit} onLongPress={onDelete} style={{ backgroundColor: dimmed ? "#E8DCC808" : "#E8DCC820", borderRadius: 4, borderWidth: 1, borderColor: "#C4B49A", padding: 12, marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: dimmed ? "#8A7D6D" : "#2C2014" }}>{injury.entityName}</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <View style={{ backgroundColor: col + "20", borderRadius: 2, paddingHorizontal: 5, paddingVertical: 2 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: col }}>{injury.severity.toUpperCase()}</Text>
          </View>
          {injury.status === "recovered" && (
            <View style={{ backgroundColor: "#2D7A4F20", borderRadius: 2, paddingHorizontal: 5, paddingVertical: 2 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#2D7A4F" }}>RECOVERED</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: dimmed ? "#8A7D6D" : col }}>{injury.description}</Text>
      {injury.effect ? <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 12, color: dimmed ? "#8A7D6D80" : "#4A3F32", marginTop: 2 }}>{injury.effect}</Text> : null}

      {injury.severity !== "Permanent" && injury.status !== "recovered" && (
        <>
          <View style={{ height: 4, backgroundColor: "#C4B49A40", borderRadius: 2, marginTop: 8, marginBottom: 4 }}>
            <View style={{ height: 4, width: `${Math.round(pct * 100)}%`, backgroundColor: "#2D7A4F", borderRadius: 2 }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D" }}>
              Day {injury.daysElapsed}/{injury.daysToHeal}
            </Text>
            <Pressable onPress={onAdvanceDay} style={{ borderWidth: 1, borderColor: "#2D7A4F40", borderRadius: 2, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#2D7A4F" }}>+1 Day</Text>
            </Pressable>
          </View>
        </>
      )}
    </Pressable>
  );
}
