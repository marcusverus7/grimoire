import { View, Text, ScrollView, Pressable } from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";

// ── Tables ────────────────────────────────────────────────────────────────────
const ROOM_SIZES = [
  "Small (10×10 ft) — barely enough for a patrol",
  "Medium (20×20 ft) — standard chamber",
  "Large (30×30 ft) — grand hall or barracks",
  "Long (10×40 ft) — corridor or gallery",
  "Irregularly shaped — carved naturally or collapsed",
  "Enormous (50×50 ft+) — cavern or throne room",
];

const CEILING_HEIGHTS = [
  "Low (6 ft) — medium creatures stoop",
  "Normal (8–10 ft) — unremarkable",
  "High (15 ft) — echoing, arrows gain range",
  "Vaulted (25 ft+) — flying is advantageous",
  "Collapsed — rubble blocks sections",
];

const LIGHT_LEVELS = [
  "Pitch dark — no natural or artificial light",
  "Dim — a single torch or guttering lantern",
  "Moderate — a few sconces or windows",
  "Bright — torches every 10 ft or sunlight",
  "Eerie glow — phosphorescent moss or magic",
  "Flickering — torches sputter from a draft",
];

const SMELLS = [
  "Damp stone and mildew",
  "Charred wood and cold ash",
  "Rotting vegetation",
  "Iron and dried blood",
  "Stale air, sealed for decades",
  "Animal musk",
  "Candle wax and incense",
  "Sewage or standing water",
  "Smoke drifting in from somewhere above",
  "Sweetly corrupt — something died here recently",
];

const SOUNDS = [
  "Total silence",
  "Distant dripping",
  "The creak of settling stone",
  "Faint chittering from the walls",
  "Wind moaning through a crack",
  "Echoing footsteps (origin unclear)",
  "Low mechanical hum",
  "Water running beneath the floor",
  "Distant voices — unintelligible",
  "Nothing — then a single sharp knock",
];

const FLOOR_CONDITIONS = [
  "Dry stone, even and clear",
  "Scattered bones and debris",
  "Thick dust — footprints are immediately visible",
  "Puddles and algae — slippery",
  "Cracked flagstones with wide gaps",
  "Mossy cobblestones",
  "Sunken centre — water pools in the middle",
  "Sand over stone — soft footing, no echo",
];

const ROOM_FEATURES = [
  "A collapsed pillar creates difficult terrain in the eastern half",
  "A large stone altar, scorched and cracked",
  "Rows of rotting wooden benches face a dais",
  "A central fire pit, cold but recently used",
  "Alcoves along the north wall, each holding a statue",
  "A raised platform with an iron throne",
  "A 10 ft diameter pit in the centre, depth unknown",
  "Iron rings set into the walls — once held chains",
  "A mosaic floor depicting a battle, partially smashed",
  "A crumbling bookshelf, most pages dissolved",
  "A wine rack, bottles long since shattered or empty",
  "A stone table with iron manacles bolted to the corners",
  "Tapestries rotting on the walls — faded heraldry visible",
  "A door-sized iron mirror, tarnished beyond reflection",
  "A summoning circle etched into the floor — still active?",
  "Three large bronze braziers, unlit",
];

const HIDDEN_ELEMENTS = [
  "A concealed door (DC 15 Perception) in the south wall",
  "A pressure plate trap (DC 13 Perception or Thieves' Tools DC 15)",
  "A loose stone hiding a small cache (DC 14 Investigation)",
  "Scratch marks in dwarvish on the north wall",
  "A spy hole drilled in the wall at eye height",
  "Residue of a recent magical effect (DC 12 Arcana to identify)",
  "A false bottom in the chest in the corner",
  "Nothing — but the dust suggests recent footprints that don't leave",
];

// ── Door tables ───────────────────────────────────────────────────────────────
const DOOR_MATERIALS = [
  "Rotting wood", "Solid oak, iron-banded", "Iron, rusted shut",
  "Stone slab", "No door — open archway", "Steel, cold to the touch",
  "Wood with arcane sigils burned in", "Portcullis, raised",
];

const DOOR_CONDITIONS = [
  "Standing open",
  "Closed but unlocked",
  "Locked (DC 13 Thieves' Tools or Str DC 15 to force)",
  "Barred from the other side",
  "Locked (DC 18 Thieves' Tools or Str DC 20 to force)",
  "Stuck shut (Str DC 12 to open)",
  "Magically sealed (Arcana DC 16 to identify, Dispel Magic 3rd level)",
];

const DOOR_FEATURES = [
  "A heavy iron knocker shaped like a skull",
  "A peephole at eye height, currently covered",
  "Scratches around the lock — someone picked it before",
  "Hinges on the inside — opens toward you",
  "No handle — must be pushed at a specific spot",
  "A faint draft passes through the gap",
  "A keyhole with a strange gear-shaped profile",
  "Warning glyphs etched around the frame",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function rng(n: number) { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T { return arr[rng(arr.length)]; }

type RoomResult = {
  size: string; ceiling: string; light: string; smell: string;
  sound: string; floor: string; feature: string; hidden: string;
};

type DoorResult = { material: string; condition: string; feature: string };

function rollRoom(): RoomResult {
  return {
    size: pick(ROOM_SIZES),
    ceiling: pick(CEILING_HEIGHTS),
    light: pick(LIGHT_LEVELS),
    smell: pick(SMELLS),
    sound: pick(SOUNDS),
    floor: pick(FLOOR_CONDITIONS),
    feature: pick(ROOM_FEATURES),
    hidden: pick(HIDDEN_ELEMENTS),
  };
}

function rollDoor(): DoorResult {
  return {
    material: pick(DOOR_MATERIALS),
    condition: pick(DOOR_CONDITIONS),
    feature: pick(DOOR_FEATURES),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RoomGenScreen() {
  const [mode, setMode] = useState<"room" | "door">("room");
  const [room, setRoom] = useState<RoomResult | null>(null);
  const [door, setDoor] = useState<DoorResult | null>(null);

  function rerollRoomField(field: keyof RoomResult) {
    if (!room) return;
    const tables: Record<keyof RoomResult, string[]> = {
      size: ROOM_SIZES, ceiling: CEILING_HEIGHTS, light: LIGHT_LEVELS,
      smell: SMELLS, sound: SOUNDS, floor: FLOOR_CONDITIONS,
      feature: ROOM_FEATURES, hidden: HIDDEN_ELEMENTS,
    };
    setRoom(prev => prev ? { ...prev, [field]: pick(tables[field]) } : prev);
  }

  function rerollDoorField(field: keyof DoorResult) {
    if (!door) return;
    const tables: Record<keyof DoorResult, string[]> = {
      material: DOOR_MATERIALS, condition: DOOR_CONDITIONS, feature: DOOR_FEATURES,
    };
    setDoor(prev => prev ? { ...prev, [field]: pick(tables[field]) } : prev);
  }

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "Room & Door Generator", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 4 }}>
          Room & Door Generator
        </Text>
        <GoldRule />

        {/* Mode tabs */}
        <View style={{ flexDirection: "row", marginBottom: 20, borderWidth: 1, borderColor: "#C4B49A", borderRadius: 2, overflow: "hidden" }}>
          {(["room", "door"] as const).map(m => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{ flex: 1, padding: 10, alignItems: "center", backgroundColor: mode === m ? "#2C2014" : "#E8DCC8" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: mode === m ? "#C9A24A" : "#4A3F32", textTransform: "capitalize" }}>{m}</Text>
            </Pressable>
          ))}
        </View>

        {/* Room mode */}
        {mode === "room" && (
          <>
            <Pressable
              onPress={() => setRoom(rollRoom())}
              style={{ backgroundColor: "#2C2014", borderRadius: 2, padding: 14, alignItems: "center", marginBottom: 24 }}
            >
              <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: "#C9A24A", letterSpacing: 1 }}>
                ⚄ Generate Room
              </Text>
            </Pressable>
            {room ? (
              <View style={{ gap: 0 }}>
                <RoomRow label="Size" value={room.size} onReroll={() => rerollRoomField("size")} />
                <RoomRow label="Ceiling" value={room.ceiling} onReroll={() => rerollRoomField("ceiling")} />
                <RoomRow label="Light" value={room.light} onReroll={() => rerollRoomField("light")} />
                <RoomRow label="Smell" value={room.smell} onReroll={() => rerollRoomField("smell")} />
                <RoomRow label="Sound" value={room.sound} onReroll={() => rerollRoomField("sound")} />
                <RoomRow label="Floor" value={room.floor} onReroll={() => rerollRoomField("floor")} />
                <RoomRow label="Feature" value={room.feature} onReroll={() => rerollRoomField("feature")} highlight />
                <RoomRow label="Hidden" value={room.hidden} onReroll={() => rerollRoomField("hidden")} muted />
                <Pressable
                  onPress={() => setRoom(rollRoom())}
                  style={{ borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, padding: 10, alignItems: "center", marginTop: 12 }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C" }}>⚄ Re-roll All</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#8A7D6D60", textAlign: "center", marginTop: 20 }}>
                Generate a room to describe the space to your players.
              </Text>
            )}
          </>
        )}

        {/* Door mode */}
        {mode === "door" && (
          <>
            <Pressable
              onPress={() => setDoor(rollDoor())}
              style={{ backgroundColor: "#2C2014", borderRadius: 2, padding: 14, alignItems: "center", marginBottom: 24 }}
            >
              <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: "#C9A24A", letterSpacing: 1 }}>
                ⚄ Generate Door
              </Text>
            </Pressable>
            {door ? (
              <View>
                <RoomRow label="Material" value={door.material} onReroll={() => rerollDoorField("material")} />
                <RoomRow label="Condition" value={door.condition} onReroll={() => rerollDoorField("condition")} highlight />
                <RoomRow label="Detail" value={door.feature} onReroll={() => rerollDoorField("feature")} />
                <Pressable
                  onPress={() => setDoor(rollDoor())}
                  style={{ borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, padding: 10, alignItems: "center", marginTop: 12 }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C" }}>⚄ Re-roll All</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#8A7D6D60", textAlign: "center", marginTop: 20 }}>
                Generate a door for your next encounter or dungeon room.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </ParchmentScreen>
  );
}

function RoomRow({
  label, value, onReroll, highlight, muted
}: {
  label: string; value: string; onReroll: () => void; highlight?: boolean; muted?: boolean;
}) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: "#E8DCC8", paddingVertical: 10 }}>
      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ flex: 1, fontFamily: highlight ? "CormorantGaramond_400Regular_Italic" : "Inter_400Regular", fontSize: highlight ? 14 : 13, color: muted ? "#8A7D6D" : "#2C2014", lineHeight: 20 }}>
          {value}
        </Text>
        <Pressable onPress={onReroll} style={{ padding: 6, marginLeft: 4 }}>
          <Text style={{ fontSize: 14, color: "#A07A2C" }}>⚄</Text>
        </Pressable>
      </View>
    </View>
  );
}
