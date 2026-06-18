import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

const GIVEN = ["Aldric","Mirra","Tavorn","Sela","Karath","Vessa","Dunn","Orwyn","Thessa","Bren","Isolde","Maren","Cael","Rynn","Doreth","Lira","Oswin","Thal","Vera","Grim","Nessa","Ulrik","Petra","Corvin","Sira","Halek","Mira","Fenwick","Aella","Rudgar","Tyra","Caspian","Lysa","Darak","Solene"];
const FAMILY = ["Stone","Mire","Ashford","Vale","Crowe","Blackwood","Wren","Fell","Marsh","Dunmore","Hollowell","Crag","Thorn","Greaves","Harwick","Moon","Dusk","Ivry","Colm","Steele","Vane","Holt","Brooke","Sallow","Fenn"];

const ROLES = [
  "Village elder", "Innkeeper", "Blacksmith", "Merchant", "City guard",
  "Town crier", "Herbalist", "Cartographer", "Fence/Black market trader", "Retired soldier",
  "Street beggar", "Dockworker", "Stable hand", "Priest", "Scholar",
  "Assassin in disguise", "Spy", "Smuggler", "Tax collector", "Moneylender",
  "Bard", "Grave digger", "Farrier", "Midwife", "Apothecary",
  "Court advisor", "Traveling merchant", "Bounty hunter", "Ship captain", "Mine foreman",
];

const HOOKS = [
  "Owes a large debt to the wrong people",
  "Lost a sibling years ago under mysterious circumstances",
  "Secretly in love with someone they can never have",
  "Knows a rumour they're afraid to repeat",
  "Carrying a cursed item they believe is lucky",
  "Has been impersonating someone for years",
  "Witnessed a crime they haven't reported",
  "Searching for a missing person who vanished last winter",
  "Has a birthmark they believe marks them as chosen",
  "Claims to have met a god once — and survived",
  "Keeps a locked box under their bed they've never opened",
  "Recently returned from somewhere they won't talk about",
  "Owes a favour to a very powerful entity",
  "Secretly a member of a forbidden organisation",
  "Knows where something valuable is buried",
  "Haunted by a ghost only they can see",
  "Was once accused of a crime they didn't commit",
  "Their entire past life is fabricated",
  "Deeply afraid of a specific animal or creature",
  "Collecting something unusual nobody knows about",
];

const SECRETS = [
  "Is working for the antagonist",
  "Was exiled from their homeland under a false name",
  "Has a child they've never acknowledged",
  "Murdered someone and got away with it",
  "Is immune to a particular kind of magic",
  "Can read minds for a few seconds after touching someone",
  "Knows who the real villain is",
  "Has a map tattooed somewhere hidden on their body",
  "Was present at a famous historical event and lied about it",
  "Is not entirely human",
  "Has been replaced by a doppelganger — and is now imprisoned nearby",
  "Stole the identity of a dead noble",
  "Is prophesied to betray the party",
  "Has access to a secret tunnel network",
  "Owes loyalty to a second faction the players don't know about",
  "Is dying and has only weeks to live",
  "Knows the location of a dimensional rift",
  "Has been blackmailing someone powerful",
  "Was the previous champion/chosen one before the players arrived",
  "Is playing multiple factions against each other for profit",
];

const LOC_ADJS = ["Ashen","Iron","Shadow","Broken","Hollow","Whispering","Sunken","Ancient","Forsaken","Silver","Frost","Ember","Lost","Cursed","Thorn","Crumbling","Silent","Bitter","Pale","Veiled"];
const LOC_NOUNS = ["Vale","Keep","Crossing","Ruins","Hamlet","Port","Shrine","Bridge","Forge","Abbey","Crypt","Pass","Tower","Hold","Haven","Moor","Glen","Fen","Peak","Ridge"];
const LOC_PREFIXES = ["The","Upper","Lower","Old","New","East","West","North","South","Far","High","Deep","Dead","Dark","White","Black","Red","Green","Pale"];
const LOC_SUFFIXES = ["reach","wood","ford","holm","gate","wall","mere","cliff","fell","stone","barrow","hollow","briar","field","heath","ash","mound","well","watch","water"];

const FACTION_ADJS = ["Crimson","Iron","Shadow","Golden","Silver","Ancient","Broken","Hidden","Scarlet","Hollow","Frost","Ember","Pale","Obsidian","Brass","Copper","Veiled","Ivory","Amber","Onyx"];
const FACTION_TYPES = ["Brotherhood","Order","Circle","Covenant","Guild","Council","Society","Assembly","Hand","Eye","Watch","Lodge","Compact","Accord","Conclave","Legion","Union","Pact","Tribunal","Vigil"];
const FACTION_SYMBOLS = ["Serpent","Crown","Flame","Lantern","Sword","Coin","Star","Moon","Sun","Rose","Raven","Wolf","Boar","Gate","Eye","Hand","Bell","Mask","Key","Compass"];

function generateLocationName(): string {
  const r = Math.random();
  if (r < 0.4) {
    return `${pick(LOC_ADJS)} ${pick(LOC_NOUNS)}`;
  } else if (r < 0.7) {
    return `${pick(LOC_PREFIXES)}${pick(LOC_SUFFIXES)}`;
  } else {
    return `The ${pick(LOC_ADJS)} ${pick(LOC_NOUNS)}`;
  }
}

// D&D 5e typical HP/AC by CR (DMG reference)
const CR_STATS: Record<string, { hp: number; ac: number }> = {
  "0": { hp: 3, ac: 10 }, "1/8": { hp: 21, ac: 13 }, "1/4": { hp: 42, ac: 13 },
  "1/2": { hp: 60, ac: 13 }, "1": { hp: 78, ac: 13 }, "2": { hp: 93, ac: 13 },
  "3": { hp: 108, ac: 13 }, "4": { hp: 123, ac: 14 }, "5": { hp: 138, ac: 15 },
  "6": { hp: 153, ac: 15 }, "7": { hp: 168, ac: 15 }, "8": { hp: 183, ac: 16 },
  "9": { hp: 198, ac: 16 }, "10": { hp: 213, ac: 17 }, "12": { hp: 243, ac: 17 },
  "15": { hp: 288, ac: 18 }, "20": { hp: 378, ac: 19 },
};
const CR_LIST = ["0","1/8","1/4","1/2","1","2","3","4","5","6","7","8","9","10","12","15","20"];

function generateFactionName(): string {
  const r = Math.random();
  if (r < 0.5) {
    return `The ${pick(FACTION_ADJS)} ${pick(FACTION_TYPES)}`;
  } else {
    return `${pick(FACTION_TYPES)} of the ${pick(FACTION_ADJS)} ${pick(FACTION_SYMBOLS)}`;
  }
}

const APPEARANCES = [
  "Weathered face with deep-set eyes, grey at the temples",
  "Unnervingly still; rarely blinks",
  "Expressive hands — always gesturing when they speak",
  "Crooked nose, clearly broken more than once",
  "Unusually tall, always ducking through doorways",
  "Fine clothes that no longer fit properly",
  "A prominent scar running jaw to ear",
  "Calloused hands that contradict their gentle manner",
  "Ink-stained fingers and permanently squinting eyes",
  "Moves with a slight but deliberate limp",
  "Immaculately groomed despite clearly hard circumstances",
  "Missing two fingers on the left hand",
  "Bright, mismatched eyes — one brown, one pale grey",
  "Hair prematurely white, cut close to the skull",
  "A tattoo partially visible at the collar, origin unclear",
  "Teeth filed to points — claims it's cultural",
  "Wears gloves at all times and never explains why",
  "Faint burn scarring on neck and lower jaw",
  "Deceptively youthful face for someone their apparent age",
  "Extremely short, but takes up a lot of space",
];

const MANNERISMS = [
  "Repeats the last few words of whatever you say before responding",
  "Constantly checking over their shoulder",
  "Laughs at inappropriate moments, then looks embarrassed",
  "Speaks in careful, measured sentences — never wastes a word",
  "Uses elaborate metaphors that usually don't quite land",
  "Keeps changing the subject whenever the conversation gets personal",
  "Addresses everyone as a rank or title, never by name",
  "Picks up small objects and fidgets with them while talking",
  "Never makes eye contact — stares just past your shoulder",
  "Writes down things people say to them in a small notebook",
  "Answers questions with questions",
  "Constantly cleaning or adjusting something nearby",
  "Speaks very quietly — forces people to lean in",
  "Pauses for long uncomfortable silences before replying",
  "Smells everything before eating or drinking it",
  "Offers food or drink to everyone, regardless of context",
  "Hums softly when thinking, stops abruptly when they realise",
  "Always sitting with their back to a wall",
  "Quotes proverbs that don't quite apply to the situation",
  "Excessively apologetic about the smallest inconveniences",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0]!;
}

function generateNpc() {
  return {
    name: `${pick(GIVEN)} ${pick(FAMILY)}`,
    role: pick(ROLES),
    hook: pick(HOOKS),
    secret: pick(SECRETS),
    appearance: pick(APPEARANCES),
    mannerism: pick(MANNERISMS),
  };
}

type NpcDraft = ReturnType<typeof generateNpc>;

export default function NpcGenScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<"npc" | "location" | "faction">("npc");
  const [npc, setNpc] = useState<NpcDraft>(generateNpc);
  const [selectedCr, setSelectedCr] = useState<string | null>(null);
  const [locNames, setLocNames] = useState<string[]>(() => Array.from({ length: 6 }, generateLocationName));
  const [factionNames, setFactionNames] = useState<string[]>(() => Array.from({ length: 6 }, generateFactionName));

  const save = () => {
    const entityId = newId();
    const now = new Date();
    const crStats = selectedCr ? CR_STATS[selectedCr] : null;
    db.insert(schema.entities).values({
      id: entityId,
      campaignId,
      kind: "npc",
      name: npc.name,
      summary: npc.role,
      attrs: { role: npc.role, gmSecret: npc.secret, ...(crStats ? { hp: crStats.hp, ac: crStats.ac, currentHp: crStats.hp } : {}) },
      visibility: "table",
      createdAt: now,
      updatedAt: now,
    }).run();
    Alert.alert("Saved", `${npc.name} added to your campaign. Open to edit?`, [
      { text: "Later", style: "cancel", onPress: () => setNpc(generateNpc()) },
      { text: "Edit", onPress: () => router.push(`/campaign/${campaignId}/entity/${entityId}/edit` as Parameters<typeof router.push>[0]) },
    ]);
  };

  const saveLocation = (name: string) => {
    const entityId = newId();
    const now = new Date();
    db.insert(schema.entities).values({ id: entityId, campaignId, kind: "location", name, attrs: null, visibility: "table", createdAt: now, updatedAt: now }).run();
    Alert.alert("Saved", `"${name}" added as a Location.`, [
      { text: "OK" },
      { text: "Edit", onPress: () => router.push(`/campaign/${campaignId}/entity/${entityId}/edit` as Parameters<typeof router.push>[0]) },
    ]);
  };

  const saveFaction = (name: string) => {
    const entityId = newId();
    const now = new Date();
    db.insert(schema.entities).values({ id: entityId, campaignId, kind: "faction", name, attrs: null, visibility: "table", createdAt: now, updatedAt: now }).run();
    Alert.alert("Saved", `"${name}" added as a Faction.`, [
      { text: "OK" },
      { text: "Edit", onPress: () => router.push(`/campaign/${campaignId}/entity/${entityId}/edit` as Parameters<typeof router.push>[0]) },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "NPC Generator" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {/* Mode picker */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
            {(["npc", "location", "faction"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{ flex: 1, paddingVertical: 7, borderRadius: 2, borderWidth: 1, alignItems: "center", borderColor: mode === m ? "#7A2418" : "#A07A2C30", backgroundColor: mode === m ? "#7A241810" : "transparent" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: mode === m ? "#7A2418" : "#5A4D3E80", textTransform: "capitalize", letterSpacing: 0.8 }}>
                  {m === "npc" ? "NPC" : m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode !== "npc" && (
            <>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
                {mode === "location" ? "Location Names" : "Faction Names"}
              </Text>
              <GoldRule />
              <View style={{ marginTop: 16, gap: 8 }}>
                {(mode === "location" ? locNames : factionNames).map((n, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "#A07A2C20", borderRadius: 2 }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 18, color: "#2C2014", flex: 1 }}>{n}</Text>
                    <Pressable
                      onPress={() => {
                        if (mode === "location") {
                          const fresh = generateLocationName();
                          setLocNames((prev) => prev.map((x, j) => j === i ? fresh : x));
                        } else {
                          const fresh = generateFactionName();
                          setFactionNames((prev) => prev.map((x, j) => j === i ? fresh : x));
                        }
                      }}
                      style={{ padding: 6 }}
                    >
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C60" }}>⚄</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => mode === "location" ? saveLocation(n) : saveFaction(n)}
                      style={{ marginLeft: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: "#7A241830", backgroundColor: "#7A241806" }}
                    >
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#7A2418" }}>+ Use</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              <View style={{ marginTop: 20 }}>
                <Pressable
                  onPress={() => {
                    if (mode === "location") setLocNames(Array.from({ length: 6 }, generateLocationName));
                    else setFactionNames(Array.from({ length: 6 }, generateFactionName));
                  }}
                  style={{ paddingVertical: 14, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5 }}>
                    ⚄ Generate New Set
                  </Text>
                </Pressable>
              </View>
              <View style={{ height: 40 }} />
            </>
          )}

          {mode === "npc" && (
          <>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
            Quick NPC
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 30, color: "#2C2014", flex: 1 }}>
              {npc.name}
            </Text>
            <Pressable onPress={() => setNpc((n) => ({ ...n, name: `${pick(GIVEN)} ${pick(FAMILY)}` }))} style={{ padding: 6 }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C60" }}>⚄</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#5A4D3E", flex: 1 }}>
              {npc.role}
            </Text>
            <Pressable onPress={() => setNpc((n) => ({ ...n, role: pick(ROLES) }))} style={{ padding: 6 }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C60" }}>⚄</Text>
            </Pressable>
          </View>

          {/* CR Quick Stats */}
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 8, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>CR (optional — sets HP &amp; AC on save)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {CR_LIST.map((cr) => {
                  const stats = CR_STATS[cr];
                  const active = selectedCr === cr;
                  return (
                    <Pressable
                      key={cr}
                      onPress={() => setSelectedCr(active ? null : cr)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 2, borderWidth: 1, borderColor: active ? "#7A2418" : "#A07A2C25", backgroundColor: active ? "#7A241812" : "transparent" }}
                    >
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: active ? "#7A2418" : "#5A4D3E80" }}>CR {cr}</Text>
                      {stats && active ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#7A241890", textAlign: "center" }}>{stats.hp}HP · AC{stats.ac}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <GoldRule />

          <View style={{ marginTop: 20, marginBottom: 20 }}>
            <FieldRow label="Appearance" value={npc.appearance} onReroll={() => setNpc((n) => ({ ...n, appearance: pick(APPEARANCES) }))} />
            <View style={{ height: 12 }} />
            <FieldRow label="Mannerism" value={npc.mannerism} onReroll={() => setNpc((n) => ({ ...n, mannerism: pick(MANNERISMS) }))} />
            <View style={{ height: 12 }} />
            <FieldRow label="Personality Hook" value={npc.hook} onReroll={() => setNpc((n) => ({ ...n, hook: pick(HOOKS) }))} />
            <View style={{ height: 12 }} />
            <FieldRow label="⚿ GM Secret" value={npc.secret} oxblood onReroll={() => setNpc((n) => ({ ...n, secret: pick(SECRETS) }))} />
          </View>

          <GoldRule />

          <View style={{ marginTop: 24, gap: 12 }}>
            <Pressable
              onPress={() => setNpc(generateNpc())}
              style={{ paddingVertical: 14, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5 }}>
                ⚄ Generate Another
              </Text>
            </Pressable>

            <Pressable
              onPress={save}
              style={{ paddingVertical: 14, backgroundColor: "#7A2418", borderWidth: 1, borderColor: "#C9A24A40", borderRadius: 2, alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1.5 }}>
                Add to Campaign
              </Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
          </>
          )}
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function FieldRow({ label, value, oxblood = false, onReroll }: { label: string; value: string; oxblood?: boolean; onReroll?: () => void }) {
  return (
    <View style={{ padding: 12, backgroundColor: oxblood ? "#7A241808" : "#A07A2C06", borderWidth: 1, borderColor: oxblood ? "#7A241825" : "#A07A2C20", borderRadius: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: oxblood ? "#7A2418" : "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
          {label}
        </Text>
        {onReroll ? (
          <Pressable onPress={onReroll}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: oxblood ? "#7A241860" : "#A07A2C60" }}>⚄</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 16, color: "#2C2014", lineHeight: 24 }}>
        {value}
      </Text>
    </View>
  );
}
