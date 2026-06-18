import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { getKv, setKv } from "@/lib/db";
import { randomUUID } from "expo-crypto";

// ── Types ─────────────────────────────────────────────────────────────────────
type CalEvent = { id: string; label: string; day: number; month: number; year: number };
type CalData = {
  day: number; month: number; year: number;
  monthNames: string[];
  daysPerMonth: number;
  events: CalEvent[];
};

// ── Preset Calendars ──────────────────────────────────────────────────────────
const PRESETS: Record<string, { label: string; months: string[]; daysPerMonth: number }> = {
  standard: {
    label: "Standard (12×30)",
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    daysPerMonth: 30,
  },
  faerun: {
    label: "Faerûn (Forgotten Realms)",
    months: ["Hammer", "Alturiak", "Ches", "Tarsakh", "Mirtul", "Kythorn", "Flamerule", "Eleasis", "Eleint", "Marpenoth", "Uktar", "Nightal"],
    daysPerMonth: 30,
  },
  greyhawk: {
    label: "Greyhawk (D&D Classic)",
    months: ["Fireseek", "Readying", "Coldeven", "Planting", "Flocktime", "Wealsun", "Reaping", "Goodmonth", "Harvester", "Patchwall", "Ready'reat", "Sunsebb"],
    daysPerMonth: 28,
  },
  eberron: {
    label: "Eberron (Barony of)",
    months: ["Zarantyr", "Olarune", "Therendor", "Eyre", "Dravago", "Nymm", "Lharvion", "Barrakas", "Rhaan", "Sypheros", "Aryth", "Vult"],
    daysPerMonth: 28,
  },
  exandria: {
    label: "Exandria (Critical Role)",
    months: ["Horisal", "Misuthar", "Dualahei", "Thunsheer", "Unndilar", "Brussendar", "Sydenstar", "Fessuran", "Quen'pillar", "Cuersaar", "Duscar"],
    daysPerMonth: 29,
  },
};

function defaultCalData(): CalData {
  return {
    day: 1, month: 0, year: 1,
    monthNames: PRESETS.standard.months,
    daysPerMonth: 30,
    events: [],
  };
}

function dateKey(d: number, m: number, y: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storageKey = `calendar_${id}`;

  const [cal, setCal] = useState<CalData>(defaultCalData());
  const [loaded, setLoaded] = useState(false);
  const [addEventVisible, setAddEventVisible] = useState(false);
  const [newEventText, setNewEventText] = useState("");
  const [presetModal, setPresetModal] = useState(false);
  const [setDateModal, setSetDateModal] = useState(false);
  const [inputDay, setInputDay] = useState("");
  const [inputMonth, setInputMonth] = useState("");
  const [inputYear, setInputYear] = useState("");

  useEffect(() => {
    (async () => {
      const saved = await getKv(storageKey);
      if (saved) {
        try { setCal(JSON.parse(saved) as CalData); } catch { /* keep default */ }
      }
      setLoaded(true);
    })();
  }, [storageKey]);

  async function save(next: CalData) {
    setCal(next);
    await setKv(storageKey, JSON.stringify(next));
  }

  function advance(days: number) {
    setCal(prev => {
      let d = prev.day + days;
      let m = prev.month;
      let y = prev.year;
      while (d > prev.daysPerMonth) { d -= prev.daysPerMonth; m++; if (m >= prev.monthNames.length) { m = 0; y++; } }
      while (d < 1) { m--; if (m < 0) { m = prev.monthNames.length - 1; y--; } d += prev.daysPerMonth; }
      const next = { ...prev, day: d, month: m, year: y };
      setKv(storageKey, JSON.stringify(next));
      return next;
    });
  }

  async function addEvent() {
    if (!newEventText.trim()) return;
    const ev: CalEvent = { id: randomUUID(), label: newEventText.trim(), day: cal.day, month: cal.month, year: cal.year };
    await save({ ...cal, events: [...cal.events, ev] });
    setNewEventText("");
    setAddEventVisible(false);
  }

  async function deleteEvent(evId: string) {
    await save({ ...cal, events: cal.events.filter(e => e.id !== evId) });
  }

  function applyPreset(key: string) {
    const p = PRESETS[key];
    if (!p) return;
    save({ ...cal, monthNames: p.months, daysPerMonth: p.daysPerMonth });
    setPresetModal(false);
  }

  function applySetDate() {
    const d = parseInt(inputDay, 10);
    const m = parseInt(inputMonth, 10) - 1;
    const y = parseInt(inputYear, 10);
    if (isNaN(d) || isNaN(m) || isNaN(y) || d < 1 || d > cal.daysPerMonth || m < 0 || m >= cal.monthNames.length || y < 1) {
      Alert.alert("Invalid Date", `Day must be 1–${cal.daysPerMonth}, month 1–${cal.monthNames.length}, year ≥ 1`);
      return;
    }
    save({ ...cal, day: d, month: m, year: y });
    setSetDateModal(false);
  }

  const todayKey = dateKey(cal.day, cal.month, cal.year);
  const todayEvents = cal.events.filter(e => dateKey(e.day, e.month, e.year) === todayKey);
  const futureEvents = cal.events
    .filter(e => dateKey(e.day, e.month, e.year) > todayKey)
    .sort((a, b) => dateKey(a.day, a.month, a.year).localeCompare(dateKey(b.day, b.month, b.year)));
  const pastEvents = cal.events
    .filter(e => dateKey(e.day, e.month, e.year) < todayKey)
    .sort((a, b) => dateKey(b.day, b.month, b.year).localeCompare(dateKey(a.day, a.month, a.year)))
    .slice(0, 5);

  if (!loaded) return null;

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "In-World Calendar", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 4 }}>
          In-World Calendar
        </Text>
        <GoldRule />

        {/* Current date display */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            Current Date
          </Text>
          <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 28, color: "#2C2014" }}>
            {cal.day} {cal.monthNames[cal.month]}
          </Text>
          <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: "#8A7D6D", marginTop: 2 }}>
            Year {cal.year}
          </Text>
        </View>

        {/* Advance buttons */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Advance Time
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <AdvanceBtn label="+1 Day" onPress={() => advance(1)} />
            <AdvanceBtn label="+7 Days" onPress={() => advance(7)} />
            <AdvanceBtn label="+1 Month" onPress={() => advance(cal.daysPerMonth)} />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <AdvanceBtn label="−1 Day" onPress={() => advance(-1)} dim />
            <AdvanceBtn label="−7 Days" onPress={() => advance(-7)} dim />
            <AdvanceBtn label="−1 Month" onPress={() => advance(-cal.daysPerMonth)} dim />
          </View>
        </View>

        {/* Utility buttons */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 24, marginTop: 12 }}>
          <Pressable
            onPress={() => { setInputDay(String(cal.day)); setInputMonth(String(cal.month + 1)); setInputYear(String(cal.year)); setSetDateModal(true); }}
            style={{ flex: 1, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, padding: 10, alignItems: "center" }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C" }}>Set Date</Text>
          </Pressable>
          <Pressable
            onPress={() => setPresetModal(true)}
            style={{ flex: 1, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, padding: 10, alignItems: "center" }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C" }}>Calendar Preset</Text>
          </Pressable>
        </View>

        {/* Today's Events */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1 }}>
              Events Today
            </Text>
            <Pressable onPress={() => setAddEventVisible(true)}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C" }}>+ Add</Text>
            </Pressable>
          </View>
          {todayEvents.length === 0 && (
            <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 13, color: "#8A7D6D80", textAlign: "center", paddingVertical: 8 }}>
              No events on this date.
            </Text>
          )}
          {todayEvents.map(ev => (
            <EventRow key={ev.id} ev={ev} onDelete={() => deleteEvent(ev.id)} showDate={false} monthNames={cal.monthNames} />
          ))}
        </View>

        {/* Upcoming Events */}
        {futureEvents.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Upcoming
            </Text>
            {futureEvents.slice(0, 10).map(ev => (
              <EventRow key={ev.id} ev={ev} onDelete={() => deleteEvent(ev.id)} showDate monthNames={cal.monthNames} />
            ))}
          </View>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Recent Past
            </Text>
            {pastEvents.map(ev => (
              <EventRow key={ev.id} ev={ev} onDelete={() => deleteEvent(ev.id)} showDate monthNames={cal.monthNames} dim />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Event Modal */}
      <Modal visible={addEventVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#F5EDD8", borderRadius: 4, padding: 20 }}>
            <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: "#2C2014", marginBottom: 12 }}>
              Add Event — {cal.day} {cal.monthNames[cal.month]}, Year {cal.year}
            </Text>
            <TextInput
              value={newEventText}
              onChangeText={setNewEventText}
              placeholder="Event description…"
              placeholderTextColor="#8A7D6D80"
              style={{ borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 10, fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014", marginBottom: 12 }}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setAddEventVisible(false)} style={{ flex: 1, borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 10, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#4A3F32" }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={addEvent} style={{ flex: 1, backgroundColor: "#2C2014", borderRadius: 2, padding: 10, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#C9A24A" }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preset Modal */}
      <Modal visible={presetModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#F5EDD8", borderRadius: 4, padding: 20 }}>
            <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: "#2C2014", marginBottom: 16 }}>
              Calendar Preset
            </Text>
            {Object.entries(PRESETS).map(([key, p]) => (
              <Pressable
                key={key}
                onPress={() => applyPreset(key)}
                style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E8DCC8" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#2C2014" }}>{p.label}</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", marginTop: 2 }}>
                  {p.months.slice(0, 3).join(" · ")} · … · {p.months[p.months.length - 1]} ({p.daysPerMonth} days/month)
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setPresetModal(false)} style={{ marginTop: 12, padding: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#8A7D6D" }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Set Date Modal */}
      <Modal visible={setDateModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#F5EDD8", borderRadius: 4, padding: 20 }}>
            <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: "#2C2014", marginBottom: 16 }}>
              Set Current Date
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 2 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", marginBottom: 4 }}>DAY</Text>
                <TextInput
                  value={inputDay} onChangeText={setInputDay} keyboardType="number-pad"
                  style={{ borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 8, fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", textAlign: "center" }}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", marginBottom: 4 }}>MONTH</Text>
                <TextInput
                  value={inputMonth} onChangeText={setInputMonth} keyboardType="number-pad"
                  style={{ borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 8, fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", textAlign: "center" }}
                />
              </View>
              <View style={{ flex: 3 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", marginBottom: 4 }}>YEAR</Text>
                <TextInput
                  value={inputYear} onChangeText={setInputYear} keyboardType="number-pad"
                  style={{ borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 8, fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", textAlign: "center" }}
                />
              </View>
            </View>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", marginBottom: 12 }}>
              Month 1 = {cal.monthNames[0]}, {cal.monthNames.length} months · {cal.daysPerMonth} days per month
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setSetDateModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, padding: 10, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#4A3F32" }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={applySetDate} style={{ flex: 1, backgroundColor: "#2C2014", borderRadius: 2, padding: 10, alignItems: "center" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#C9A24A" }}>Set Date</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ParchmentScreen>
  );
}

function AdvanceBtn({ label, onPress, dim }: { label: string; onPress: () => void; dim?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, borderWidth: 1, borderColor: dim ? "#C4B49A60" : "#C4B49A", borderRadius: 2, padding: 8, alignItems: "center", backgroundColor: dim ? "#E8DCC808" : "#E8DCC8" }}
    >
      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: dim ? "#8A7D6D" : "#2C2014" }}>{label}</Text>
    </Pressable>
  );
}

function EventRow({ ev, onDelete, showDate, monthNames, dim }: { ev: CalEvent; onDelete: () => void; showDate: boolean; monthNames: string[]; dim?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E8DCC8" }}>
      {showDate && (
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: dim ? "#8A7D6D" : "#A07A2C", width: 80 }}>
          {ev.day} {monthNames[ev.month]}
        </Text>
      )}
      <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: dim ? "#8A7D6D" : "#2C2014" }}>{ev.label}</Text>
      <Pressable
        onPress={() => {
          Alert.alert("Delete Event", `Delete "${ev.label}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: onDelete },
          ]);
        }}
        style={{ padding: 6 }}
      >
        <Text style={{ fontSize: 12, color: "#8A7D6D" }}>✕</Text>
      </Pressable>
    </View>
  );
}
