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
import { color, withAlpha, useThemeTick } from "@/lib/theme";

// ── Types ─────────────────────────────────────────────────────────────────────
type ActivityType =
  | "Training" | "Crafting" | "Research" | "Carousing" | "Recuperating"
  | "Work" | "Religious" | "Crime" | "Pit Fighting" | "Custom";

type DowntimeActivity = {
  id: string;
  pcId: string;
  pcName: string;
  activity: ActivityType;
  customLabel: string;
  daysSpent: number;
  daysRequired: number;
  notes: string;
  complete: boolean;
};

const ACTIVITY_TYPES: ActivityType[] = [
  "Training", "Crafting", "Research", "Carousing", "Recuperating",
  "Work", "Religious", "Crime", "Pit Fighting", "Custom",
];

const ACTIVITY_DESCRIPTIONS: Record<ActivityType, string> = {
  Training: "Learn a new language, tool, or weapon proficiency (250 days × item rarity)",
  Crafting: "Create a non-magical item from components at half market price",
  Research: "Uncover lore, follow a rumour, or investigate a mystery",
  Carousing: "Spend gold on revelry — make contacts, gain reputation (or enemies)",
  Recuperating: "Recover from injury, poison, disease; remove Exhaustion levels",
  Work: "Earn modest income using a tool or professional skill",
  Religious: "Serve a temple, pray, perform duties — maintain divine favour",
  Crime: "Plan or execute a heist, theft, or illegal enterprise",
  "Pit Fighting": "Earn coin and renown brawling in an arena",
  Custom: "Custom activity",
};

const ACTIVITY_DEFAULT_DAYS: Record<ActivityType, number> = {
  Training: 250, Crafting: 5, Research: 8, Carousing: 7, Recuperating: 3,
  Work: 5, Religious: 5, Crime: 10, "Pit Fighting": 7, Custom: 5,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function DowntimeScreen() {
  useThemeTick();
  const { id } = useLocalSearchParams<{ id: string }>();
  const storageKey = `downtime_${id}`;

  const [activities, setActivities] = useState<DowntimeActivity[]>([]);
  const [pcs, setPcs] = useState<Array<{ id: string; name: string }>>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editActivity, setEditActivity] = useState<DowntimeActivity | null>(null);

  // Form state
  const [fpc, setFpc] = useState("");
  const [fpcId, setFpcId] = useState("");
  const [ftype, setFtype] = useState<ActivityType>("Research");
  const [fcustom, setFcustom] = useState("");
  const [fdays, setFdays] = useState("5");
  const [frequired, setFrequired] = useState("5");
  const [fnotes, setFnotes] = useState("");

  const [showDone, setShowDone] = useState(false);

  useFocusEffect(useCallback(() => {
    const saved = getKv(storageKey);
    if (saved) {
      try { setActivities(JSON.parse(saved) as DowntimeActivity[]); } catch { /* keep empty */ }
    }
    const pcList = db.select({ id: schema.entities.id, name: schema.entities.name })
      .from(schema.entities)
      .where(and(eq(schema.entities.campaignId, id), eq(schema.entities.kind, "pc")))
      .all()
      .sort((a, b) => a.name.localeCompare(b.name));
    setPcs(pcList);
    if (pcList.length > 0 && !fpc) {
      setFpc(pcList[0].name);
      setFpcId(pcList[0].id);
    }
  }, [id, storageKey]));

  function save(next: DowntimeActivity[]) {
    setActivities(next);
    setKv(storageKey, JSON.stringify(next));
  }

  function openAdd() {
    setEditActivity(null);
    const first = pcs[0];
    setFpc(first?.name ?? ""); setFpcId(first?.id ?? "");
    setFtype("Research"); setFcustom(""); setFdays("5"); setFrequired("5"); setFnotes("");
    setModalVisible(true);
  }

  function openEdit(a: DowntimeActivity) {
    setEditActivity(a);
    setFpc(a.pcName); setFpcId(a.pcId);
    setFtype(a.activity); setFcustom(a.customLabel);
    setFdays(String(a.daysSpent)); setFrequired(String(a.daysRequired));
    setFnotes(a.notes);
    setModalVisible(true);
  }

  function submit() {
    if (!fpc) return;
    const label = ftype === "Custom" ? (fcustom.trim() || "Custom") : ftype;
    const entry: DowntimeActivity = {
      id: editActivity?.id ?? randomUUID(),
      pcId: fpcId,
      pcName: fpc,
      activity: ftype,
      customLabel: ftype === "Custom" ? fcustom.trim() : "",
      daysSpent: Math.max(0, parseInt(fdays, 10) || 0),
      daysRequired: Math.max(1, parseInt(frequired, 10) || 5),
      notes: fnotes.trim(),
      complete: editActivity?.complete ?? false,
    };
    if (editActivity) {
      save(activities.map(a => a.id === editActivity.id ? entry : a));
    } else {
      save([...activities, entry]);
    }
    setModalVisible(false);
  }

  function toggleComplete(actId: string) {
    save(activities.map(a => a.id === actId ? { ...a, complete: !a.complete } : a));
  }

  function addDay(actId: string) {
    save(activities.map(a => {
      if (a.id !== actId) return a;
      const next = Math.min(a.daysSpent + 1, a.daysRequired);
      return { ...a, daysSpent: next, complete: next >= a.daysRequired };
    }));
  }

  function deleteActivity(actId: string) {
    Alert.alert("Remove Activity", "Remove this downtime activity?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => save(activities.filter(a => a.id !== actId)) },
    ]);
  }

  const active = activities.filter(a => !a.complete);
  const done = activities.filter(a => a.complete);

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "Downtime Activities", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: color.ink, textAlign: "center", marginBottom: 4 }}>
          Downtime Activities
        </Text>
        <GoldRule />

        <Pressable
          onPress={openAdd}
          style={{ backgroundColor: color.panelInk, borderRadius: 2, padding: 12, alignItems: "center", marginBottom: 20 }}
        >
          <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 13, color: color.goldBright, letterSpacing: 1 }}>
            + Add Activity
          </Text>
        </Pressable>

        {/* Active activities */}
        {active.length === 0 && (
          <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: withAlpha("inkFaint", 0x60 / 255), textAlign: "center", paddingVertical: 20 }}>
            No active downtime activities.{"\n"}Add activities to track what PCs are doing between sessions.
          </Text>
        )}
        {active.map(a => (
          <ActivityCard
            key={a.id}
            activity={a}
            onEdit={() => openEdit(a)}
            onToggle={() => toggleComplete(a.id)}
            onAddDay={() => addDay(a.id)}
            onDelete={() => deleteActivity(a.id)}
          />
        ))}

        {/* Completed */}
        {done.length > 0 && (
          <View>
            <Pressable
              onPress={() => setShowDone(s => !s)}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, marginBottom: 8 }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.inkFaint, textTransform: "uppercase", letterSpacing: 1 }}>
                Completed ({done.length})
              </Text>
              <Text style={{ fontSize: 12, color: color.inkFaint }}>{showDone ? "▼" : "▶"}</Text>
            </Pressable>
            {showDone && done.map(a => (
              <ActivityCard
                key={a.id}
                activity={a}
                onEdit={() => openEdit(a)}
                onToggle={() => toggleComplete(a.id)}
                onAddDay={() => addDay(a.id)}
                onDelete={() => deleteActivity(a.id)}
                dimmed
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: withAlpha("shadow", 0x60 / 255), justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: color.parchmentWarm, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20, maxHeight: "90%" }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 15, color: color.ink, marginBottom: 16 }}>
                {editActivity ? "Edit Activity" : "New Downtime Activity"}
              </Text>

              <FL label="Character" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {pcs.map(pc => (
                  <Pressable
                    key={pc.id}
                    onPress={() => { setFpc(pc.name); setFpcId(pc.id); }}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 2, borderWidth: 1, borderColor: fpc === pc.name ? color.ink : color.border, backgroundColor: fpc === pc.name ? color.panelInk : color.parchmentEdge }}
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: fpc === pc.name ? color.goldBright : color.borderDark }}>{pc.name}</Text>
                  </Pressable>
                ))}
                {pcs.length === 0 && (
                  <TextInput
                    value={fpc} onChangeText={setFpc}
                    placeholder="PC name"
                    placeholderTextColor={withAlpha("inkFaint", 0x80 / 255)}
                    style={inputStyle()}
                  />
                )}
              </ScrollView>

              <FL label="Activity Type" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {ACTIVITY_TYPES.map(t => (
                  <Pressable
                    key={t}
                    onPress={() => {
                      setFtype(t);
                      if (t !== "Custom") setFrequired(String(ACTIVITY_DEFAULT_DAYS[t]));
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, borderRadius: 2, borderWidth: 1, borderColor: ftype === t ? color.gold : color.border, backgroundColor: ftype === t ? withAlpha("gold", 0x20 / 255) : color.parchmentEdge }}
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: ftype === t ? color.gold : color.borderDark }}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {ftype !== "Custom" && (
                <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 12, color: color.inkFaint, marginBottom: 12 }}>
                  {ACTIVITY_DESCRIPTIONS[ftype]}
                </Text>
              )}

              {ftype === "Custom" && (
                <>
                  <FL label="Custom Label" />
                  <TextInput
                    value={fcustom} onChangeText={setFcustom}
                    placeholder="e.g. Building a Safe House"
                    placeholderTextColor={withAlpha("inkFaint", 0x80 / 255)}
                    style={inputStyle()}
                  />
                </>
              )}

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <FL label="Days Spent" />
                  <TextInput
                    value={fdays} onChangeText={setFdays} keyboardType="number-pad"
                    style={[inputStyle(), { textAlign: "center", marginBottom: 0 }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FL label="Days Required" />
                  <TextInput
                    value={frequired} onChangeText={setFrequired} keyboardType="number-pad"
                    style={[inputStyle(), { textAlign: "center", marginBottom: 0 }]}
                  />
                </View>
              </View>

              <FL label="Notes (optional)" />
              <TextInput
                value={fnotes} onChangeText={setFnotes}
                placeholder="Outcome, cost, complications…"
                placeholderTextColor={withAlpha("inkFaint", 0x80 / 255)}
                multiline numberOfLines={2}
                style={[inputStyle(), { minHeight: 60, textAlignVertical: "top" }]}
              />

              <View style={{ flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 16 }}>
                <Pressable onPress={() => setModalVisible(false)} style={{ flex: 1, borderWidth: 1, borderColor: color.border, borderRadius: 2, padding: 10, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: color.borderDark }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={submit} style={{ flex: 1, backgroundColor: color.panelInk, borderRadius: 2, padding: 10, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: color.goldBright }}>
                    {editActivity ? "Save" : "Add"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ParchmentScreen>
  );
}

function inputStyle() {
  return {
    borderWidth: 1, borderColor: color.border, borderRadius: 2, padding: 10,
    fontFamily: "Inter_400Regular" as const, fontSize: 13, color: color.ink,
    backgroundColor: color.paperBrightWarm, marginBottom: 12,
  };
}

function FL({ label }: { label: string }) {
  return <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.inkFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</Text>;
}

function ActivityCard({
  activity, onEdit, onToggle, onAddDay, onDelete, dimmed
}: {
  activity: DowntimeActivity;
  onEdit: () => void;
  onToggle: () => void;
  onAddDay: () => void;
  onDelete: () => void;
  dimmed?: boolean;
}) {
  const label = activity.activity === "Custom" ? (activity.customLabel || "Custom") : activity.activity;
  const pct = Math.min(1, activity.daysSpent / activity.daysRequired);
  return (
    <Pressable
      onPress={onEdit}
      onLongPress={onDelete}
      style={{ backgroundColor: dimmed ? withAlpha("parchmentEdge", 0x08 / 255) : withAlpha("parchmentEdge", 0x20 / 255), borderRadius: 4, borderWidth: 1, borderColor: color.border, padding: 12, marginBottom: 10 }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: dimmed ? color.inkFaint : color.ink }}>{activity.pcName}</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: dimmed ? withAlpha("inkFaint", 0x80 / 255) : color.borderDark }}>{label}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: activity.complete ? color.successBright : color.gold }}>
            {activity.daysSpent}/{activity.daysRequired}d
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: color.inkFaint }}>days</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ height: 4, backgroundColor: withAlpha("border", 0x40 / 255), borderRadius: 2, marginBottom: 8 }}>
        <View style={{ height: 4, width: `${Math.round(pct * 100)}%`, backgroundColor: activity.complete ? color.successBright : color.gold, borderRadius: 2 }} />
      </View>

      {activity.notes ? (
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: dimmed ? withAlpha("inkFaint", 0x80 / 255) : color.borderDark, marginBottom: 8 }} numberOfLines={2}>
          {activity.notes}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        {!activity.complete && (
          <Pressable
            onPress={onAddDay}
            style={{ flex: 1, borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255), borderRadius: 2, padding: 6, alignItems: "center" }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: color.gold }}>+1 Day</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onToggle}
          style={{ flex: 1, borderWidth: 1, borderColor: activity.complete ? withAlpha("successBright", 0x40 / 255) : withAlpha("successBright", 0x40 / 255), borderRadius: 2, padding: 6, alignItems: "center", backgroundColor: activity.complete ? withAlpha("successBright", 0x10 / 255) : "transparent" }}
        >
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: color.successBright }}>
            {activity.complete ? "✓ Done" : "Mark Done"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
