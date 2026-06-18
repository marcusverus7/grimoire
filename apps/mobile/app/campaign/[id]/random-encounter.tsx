import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { db } from "@/lib/db";
import { schema } from "@grimoire/core";
import { eq } from "drizzle-orm";

// ── Tables ────────────────────────────────────────────────────────────────────
type EncounterRow = { creatures: string; count: string };

const TERRAIN_TABLES: Record<string, Record<string, EncounterRow[]>> = {
  Forest: {
    low: [
      { creatures: "Wolves", count: "1d6+1" },
      { creatures: "Giant Spiders", count: "1d3" },
      { creatures: "Bandit Scouts", count: "1d4" },
      { creatures: "Pixies", count: "1d4" },
      { creatures: "Stirges", count: "2d4" },
      { creatures: "Elk herd (harmless)", count: "2d4" },
    ],
    medium: [
      { creatures: "Bugbears", count: "1d4" },
      { creatures: "Owlbear", count: "1" },
      { creatures: "Goblin Patrol", count: "2d6" },
      { creatures: "Giant Constrictor Snake", count: "1" },
      { creatures: "Dryad + Satyrs", count: "1 + 1d3" },
      { creatures: "Will-o'-wisps", count: "1d3" },
    ],
    high: [
      { creatures: "Young Green Dragon", count: "1" },
      { creatures: "Vampire Spawn", count: "1d3" },
      { creatures: "Green Hag Coven", count: "3" },
      { creatures: "Treant", count: "1d2" },
      { creatures: "Werewolf Pack", count: "1d6" },
      { creatures: "Hydra", count: "1" },
    ],
    deadly: [
      { creatures: "Adult Green Dragon", count: "1" },
      { creatures: "Ancient Treant + Dryad Allies", count: "1 + 1d6" },
      { creatures: "Lich seeking an artefact", count: "1" },
      { creatures: "Night Hag + Nightmare Steed", count: "1 + 1" },
    ],
  },
  Road: {
    low: [
      { creatures: "Bandits", count: "2d6" },
      { creatures: "Travelling Merchant + Guards", count: "1 + 1d4" },
      { creatures: "Stray Dogs", count: "1d3" },
      { creatures: "Wandering Beggar (rumour-bearer)", count: "1" },
      { creatures: "Cultist Patrol", count: "1d4" },
      { creatures: "Halfling Tinker (trade goods)", count: "1" },
    ],
    medium: [
      { creatures: "Hired Thugs", count: "2d4" },
      { creatures: "Ogre", count: "1d2" },
      { creatures: "Deserters", count: "1d4" },
      { creatures: "Gnolls", count: "1d6+2" },
      { creatures: "Spy (disguised as traveller)", count: "1" },
      { creatures: "Bandit Captain + Bandits", count: "1 + 2d4" },
    ],
    high: [
      { creatures: "Assassin", count: "1d2" },
      { creatures: "Knight + Retinue", count: "1 + 1d4" },
      { creatures: "Wyvern", count: "1" },
      { creatures: "Vampire Spawn", count: "1d4" },
      { creatures: "Golem (runaway construct)", count: "1" },
      { creatures: "Archmage + Apprentices", count: "1 + 1d3" },
    ],
    deadly: [
      { creatures: "Vampire (ancient, travelling in disguise)", count: "1" },
      { creatures: "Death Knight on a Hunt", count: "1" },
      { creatures: "Lich's Advance Scout", count: "1 + 1d4 undead" },
      { creatures: "Pit Fiend posing as a merchant lord", count: "1" },
    ],
  },
  Dungeon: {
    low: [
      { creatures: "Giant Rats", count: "2d6" },
      { creatures: "Kobold Trappers", count: "1d4+2" },
      { creatures: "Skeletons", count: "1d6" },
      { creatures: "Stirges", count: "2d4" },
      { creatures: "Poisonous Snakes", count: "1d4" },
      { creatures: "Fungi Patch (hazard)", count: "—" },
    ],
    medium: [
      { creatures: "Goblin Boss + Goblins", count: "1 + 2d4" },
      { creatures: "Gelatinous Cube", count: "1" },
      { creatures: "Ghouls", count: "1d4" },
      { creatures: "Duergar", count: "1d6" },
      { creatures: "Mimic (disguised as chest)", count: "1" },
      { creatures: "Troglodytes", count: "2d4" },
    ],
    high: [
      { creatures: "Mind Flayer", count: "1d3" },
      { creatures: "Beholder", count: "1" },
      { creatures: "Vampire Spawn + Shadows", count: "1d3 + 1d4" },
      { creatures: "Aboleth", count: "1" },
      { creatures: "Death Knight", count: "1" },
      { creatures: "Illithid Elder Brain Thrall", count: "1d4" },
    ],
    deadly: [
      { creatures: "Beholder Tyrant", count: "1" },
      { creatures: "Lich (lair encounter)", count: "1" },
      { creatures: "Aboleth + Dominated Servants", count: "1 + 1d6" },
      { creatures: "Ancient Dracolich", count: "1" },
    ],
  },
  City: {
    low: [
      { creatures: "Pickpocket (non-combat)", count: "1d2" },
      { creatures: "Drunk Sailors", count: "1d4" },
      { creatures: "Watch Patrol", count: "1d4" },
      { creatures: "Street Gang Youths", count: "2d4" },
      { creatures: "Escaped Prisoner", count: "1" },
      { creatures: "Merchant Dispute (social)", count: "2" },
    ],
    medium: [
      { creatures: "Thieves' Guild Enforcers", count: "1d4" },
      { creatures: "Corrupt Guards", count: "1d3" },
      { creatures: "Hired Thugs", count: "2d4" },
      { creatures: "Spy Watching the Party", count: "1" },
      { creatures: "Cultists in Disguise", count: "1d6" },
      { creatures: "Doppelganger (posing as NPC)", count: "1" },
    ],
    high: [
      { creatures: "Assassin + Spotter", count: "1 + 1" },
      { creatures: "Crime Lord + Bodyguards", count: "1 + 1d4" },
      { creatures: "Vampire (daytime agent)", count: "1d2" },
      { creatures: "Dark Wizard + Apprentice", count: "1 + 1" },
      { creatures: "Golem (runaway)", count: "1" },
      { creatures: "Rakshasa in Noble Guise", count: "1" },
    ],
    deadly: [
      { creatures: "Mindflayer Emissary + Dominated Officials", count: "1 + 1d4" },
      { creatures: "Vampire Master of the Thieves' Guild", count: "1 + 1d6" },
      { creatures: "Pit Fiend Disguised as Noble", count: "1" },
      { creatures: "Lich posing as Royal Advisor", count: "1" },
    ],
  },
  Mountain: {
    low: [
      { creatures: "Giant Eagles", count: "1d4" },
      { creatures: "Dwarf Scout", count: "1d4" },
      { creatures: "Cave Bear", count: "1" },
      { creatures: "Harpies", count: "1d3" },
      { creatures: "Goblin Raiders", count: "2d4" },
      { creatures: "Stirges (cliff roost)", count: "2d4" },
    ],
    medium: [
      { creatures: "Bugbear Clan", count: "1d6+2" },
      { creatures: "Manticore", count: "1" },
      { creatures: "Stone Giant", count: "1" },
      { creatures: "Griffon", count: "1d2" },
      { creatures: "Yeti", count: "1d3" },
      { creatures: "Gargoyles", count: "1d4" },
    ],
    high: [
      { creatures: "Roc (hunting)", count: "1" },
      { creatures: "Fire Giant", count: "1d2" },
      { creatures: "Purple Worm", count: "1" },
      { creatures: "Frost Giant + Ice Troll", count: "1 + 1d2" },
      { creatures: "Young White Dragon", count: "1" },
      { creatures: "Adult Blue Dragon", count: "1" },
    ],
    deadly: [
      { creatures: "Ancient White Dragon (lair)", count: "1" },
      { creatures: "Storm Giant King", count: "1" },
      { creatures: "Purple Worm + Spawn", count: "1 + 1d3" },
      { creatures: "Empyrean (fallen deity fragment)", count: "1" },
    ],
  },
  Desert: {
    low: [
      { creatures: "Jackals", count: "2d4" },
      { creatures: "Giant Scorpion", count: "1d3" },
      { creatures: "Nomad Wanderers", count: "1d4" },
      { creatures: "Giant Centipedes", count: "1d4" },
      { creatures: "Dust Mephits", count: "1d4" },
      { creatures: "Skeleton (animated)", count: "1d6" },
    ],
    medium: [
      { creatures: "Gnoll Pack", count: "1d6+2" },
      { creatures: "Mummies", count: "1d3" },
      { creatures: "Lamia", count: "1" },
      { creatures: "Blue Slaad", count: "1d2" },
      { creatures: "Yuan-ti Purebloods", count: "1d4" },
      { creatures: "Wights", count: "1d4" },
    ],
    high: [
      { creatures: "Mummy Lord", count: "1" },
      { creatures: "Sphinx (guardian)", count: "1" },
      { creatures: "Adult Blue Dragon", count: "1" },
      { creatures: "Dao + Earth Elementals", count: "1 + 1d4" },
      { creatures: "Efreeti", count: "1" },
      { creatures: "Yuan-ti Abomination + Purebloods", count: "1 + 1d6" },
    ],
    deadly: [
      { creatures: "Ancient Blue Dragon (storm lair)", count: "1" },
      { creatures: "Elder Sphinx + Tomb Guardians", count: "1 + 1d6" },
      { creatures: "Death Giant (primordial)", count: "1" },
      { creatures: "Efreeti Noble + Magmin Servants", count: "1 + 2d6" },
    ],
  },
  Swamp: {
    low: [
      { creatures: "Crocodiles", count: "1d4" },
      { creatures: "Giant Frogs", count: "2d4" },
      { creatures: "Bullywugs", count: "2d6" },
      { creatures: "Stirges", count: "2d6" },
      { creatures: "Will-o'-wisps", count: "1d3" },
      { creatures: "Giant Spiders", count: "1d3" },
    ],
    medium: [
      { creatures: "Black Dragon Wyrmling", count: "1" },
      { creatures: "Lizardfolk Shaman + Warriors", count: "1 + 1d6" },
      { creatures: "Troll", count: "1d2" },
      { creatures: "Yuan-ti Purebloods", count: "1d4" },
      { creatures: "Shambling Mound", count: "1" },
      { creatures: "Sea Hag", count: "1d2" },
    ],
    high: [
      { creatures: "Green Hag Coven", count: "3" },
      { creatures: "Yuan-ti Abomination", count: "1" },
      { creatures: "Hydra", count: "1" },
      { creatures: "Adult Black Dragon", count: "1" },
      { creatures: "Vampire Spawn (bound to bog)", count: "1d4" },
      { creatures: "Nabassu Demon", count: "1d2" },
    ],
    deadly: [
      { creatures: "Ancient Black Dragon (sunken lair)", count: "1" },
      { creatures: "Yuan-ti Anathema", count: "1" },
      { creatures: "Hag Coven + Golem", count: "3 + 1" },
      { creatures: "Dracolich (swamp cursed)", count: "1" },
    ],
  },
  Coast: {
    low: [
      { creatures: "Merfolk", count: "1d6" },
      { creatures: "Bandits (wreckers)", count: "1d4" },
      { creatures: "Giant Octopus", count: "1" },
      { creatures: "Sahuagin Scouts", count: "1d4" },
      { creatures: "Harpies", count: "1d3" },
      { creatures: "Crabs (giant)", count: "2d4" },
    ],
    medium: [
      { creatures: "Merfolk Warriors + Shaman", count: "1d6+2 + 1" },
      { creatures: "Sahuagin Baron + Warriors", count: "1 + 2d4" },
      { creatures: "Water Weird", count: "1" },
      { creatures: "Giant Shark", count: "1" },
      { creatures: "Sea Hag", count: "1d2" },
      { creatures: "Siren (luring sailors)", count: "1" },
    ],
    high: [
      { creatures: "Marid (water genie)", count: "1" },
      { creatures: "Storm Giant", count: "1" },
      { creatures: "Sea Serpent", count: "1" },
      { creatures: "Adult Bronze Dragon", count: "1" },
      { creatures: "Aboleth (coastal ruin)", count: "1" },
      { creatures: "Vampire Pirate Lord + Spawn", count: "1 + 1d6" },
    ],
    deadly: [
      { creatures: "Kraken (ancient)", count: "1" },
      { creatures: "Ancient Bronze Dragon", count: "1" },
      { creatures: "Aboleth + Dominated Sea Creatures", count: "1 + 2d6" },
      { creatures: "Storm Giant Quintessent", count: "1" },
    ],
  },
  Underdark: {
    low: [
      { creatures: "Cave Fishers", count: "1d4" },
      { creatures: "Myconid Sprouts", count: "2d6" },
      { creatures: "Giant Centipedes", count: "1d6" },
      { creatures: "Duergar Scouts", count: "1d4" },
      { creatures: "Darkmantle Cluster", count: "1d4" },
      { creatures: "Shrieker Mushrooms (alarm)", count: "2d4" },
    ],
    medium: [
      { creatures: "Duergar Patrol", count: "1d6+2" },
      { creatures: "Hook Horror", count: "1d3" },
      { creatures: "Otyugh", count: "1" },
      { creatures: "Mind Flayer Scout", count: "1" },
      { creatures: "Deep Gnome Traders", count: "1d4" },
      { creatures: "Cloaker", count: "1d2" },
    ],
    high: [
      { creatures: "Mind Flayer + Intellect Devourers", count: "1 + 1d4" },
      { creatures: "Beholder (lair patrol)", count: "1" },
      { creatures: "Drow Patrol + Drider", count: "2d4 + 1" },
      { creatures: "Aboleth Servant", count: "1d3" },
      { creatures: "Illithid Elder Brain Cultists", count: "2d6" },
      { creatures: "Death Tyrant", count: "1" },
    ],
    deadly: [
      { creatures: "Elder Brain + Mind Flayer Thralls", count: "1 + 1d8" },
      { creatures: "Ancient Shadow Dragon", count: "1" },
      { creatures: "Drow Matron + Yochlol Demon", count: "1 + 1" },
      { creatures: "Beholder Hive Node + Drones", count: "1 + 1d6" },
    ],
  },
};

const TACTICS = [
  "Surprise attack from concealment",
  "Standing their ground — protecting territory",
  "Defensive formation, waiting for the party to advance",
  "Fleeing from something more dangerous nearby",
  "Hungry and aggressive — attacked on sight",
  "Unaware of the party until they make noise",
  "Setting an ambush from high ground",
  "Negotiable if approached without weapons drawn",
  "Wounded and desperate — may surrender",
  "Protecting young or eggs — ferocious defender",
  "Bribed or sent by a third party",
  "In the middle of looting something themselves",
];

const TERRAIN_HAZARDS: Record<string, string[]> = {
  Forest: [
    "Ankle-deep mud (difficult terrain in northern half)",
    "Fallen tree creates a chokepoint",
    "Dense undergrowth grants half cover to anyone within 5 ft",
    "Biting insects: DC 12 Con or Poisoned 1 hour",
  ],
  Road: [
    "Loose gravel: DC 12 Acrobatics or fall prone if dashing",
    "Abandoned campfire still smoldering — someone was here recently",
    "Deep wagon ruts (difficult terrain off the road surface)",
    "Narrow bridge — single file, Str DC 13 if combat breaks out",
  ],
  Dungeon: [
    "Slippery floor: DC 12 Acrobatics to sprint",
    "Unstable ceiling — loud noises risk a cave-in (DC 14 Dex)",
    "Rusty ancient trap still partially active",
    "Fungal spores: DC 12 Con or Poisoned for 1 hour",
  ],
  City: [
    "Crowded market — difficult terrain, poor sightlines",
    "Watch garrison 300 ft away — combat will draw attention",
    "Narrow alley: two creatures wide max",
    "Rooftop access: Athletics DC 13 to climb in one action",
  ],
  Mountain: [
    "High altitude — unacclimatised characters gain 1 Exhaustion",
    "Loose scree: half speed, no running",
    "Exposed ridge: wind gusts impose disadvantage on ranged attacks",
    "Updraft — flying creatures have advantage on movement",
  ],
  Desert: [
    "Heat haze: Perception DC +3 for targets beyond 60 ft",
    "Loose sand — half speed, no running (off packed trail)",
    "Midday sun: DC 13 Con or 1 Exhaustion if unprotected",
    "Flash flood channel — sudden 5 ft water rush (DC 14 Str)",
  ],
  Swamp: [
    "Knee-deep water — difficult terrain throughout",
    "Quicksand pocket: DC 15 Str or sink 1 ft per round",
    "Decaying gas pocket: DC 12 Con or Poisoned 10 minutes",
    "Slippery roots — Stealth checks at disadvantage",
  ],
  Coast: [
    "Tidal pools: difficult terrain in lower section",
    "Sea mist: visibility reduced to 60 ft",
    "Crumbling sea cliff edge (DC 14 Dex or fall to rocks below)",
    "Slippery rocks: DC 12 Acrobatics to sprint",
  ],
  Underdark: [
    "Zero natural light — darkvision required",
    "Narrow passage: two creatures wide max",
    "Phosphorescent fungi — light betrays position",
    "Unstable stalactites: DC 14 Dex on area spell or stalagmite rain",
  ],
};

const DISTANCES = [
  "30 ft — immediate range",
  "60 ft — one move away",
  "120 ft — within longbow range",
  "300 ft — barely visible, likely aware of party",
];

const NIGHT_NOTES = [
  "Darkness imposes disadvantage on Perception beyond 30 ft",
  "Torchlight may alert creatures — gain advantage on Stealth vs. lit targets",
  "Nocturnal predators: treat as one tier higher",
  "Ambient noise drops — sound travels twice as far",
];

const TERRAINS = ["Forest", "Road", "Dungeon", "City", "Mountain", "Desert", "Swamp", "Coast", "Underdark"];
const TIERS = [
  { key: "low", label: "Low", color: "#2D7A4F" },
  { key: "medium", label: "Medium", color: "#8A5C1A" },
  { key: "high", label: "High", color: "#8A1A1A" },
  { key: "deadly", label: "Deadly", color: "#3A0A0A" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function rng(n: number) { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T { return arr[rng(arr.length)]; }

type EncounterResult = {
  creatures: string;
  count: string;
  tactic: string;
  distance: string;
  hazard: string;
  nightNote: string | null;
};

function rollEncounter(terrain: string, tier: string, isNight: boolean): EncounterResult {
  const table = TERRAIN_TABLES[terrain]?.[tier] ?? TERRAIN_TABLES["Forest"]["low"];
  const row = pick(table);
  return {
    creatures: row.creatures,
    count: row.count,
    tactic: pick(TACTICS),
    distance: pick(DISTANCES),
    hazard: pick(TERRAIN_HAZARDS[terrain] ?? TERRAIN_HAZARDS["Forest"]),
    nightNote: isNight ? pick(NIGHT_NOTES) : null,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RandomEncounterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [terrain, setTerrain] = useState("Forest");
  const [tier, setTier] = useState("medium");
  const [isNight, setIsNight] = useState(false);
  const [result, setResult] = useState<EncounterResult | null>(null);

  function saveToNotes() {
    if (!result) return;
    const camp = db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id)).get();
    if (!camp) return;
    const existing = (camp.settings as Record<string, string>)?.notes ?? "";
    const stamp = `\n\n**Encounter (${terrain}, ${tier}${isNight ? ", night" : ""}):**\n${result.creatures} × ${result.count}\n*${result.tactic}*\n${result.distance} • ${result.hazard}${result.nightNote ? `\n${result.nightNote}` : ""}`;
    db.update(schema.campaigns)
      .set({ settings: { ...(camp.settings as object), notes: existing + stamp } })
      .where(eq(schema.campaigns.id, id))
      .run();
    Alert.alert("Saved", "Encounter added to campaign notes.");
  }

  function reroll(field: keyof EncounterResult) {
    if (!result) return;
    const table = TERRAIN_TABLES[terrain]?.[tier] ?? TERRAIN_TABLES["Forest"]["low"];
    setResult(prev => {
      if (!prev) return prev;
      if (field === "creatures" || field === "count") {
        const row = pick(table);
        return { ...prev, creatures: row.creatures, count: row.count };
      }
      if (field === "tactic") return { ...prev, tactic: pick(TACTICS) };
      if (field === "distance") return { ...prev, distance: pick(DISTANCES) };
      if (field === "hazard") return { ...prev, hazard: pick(TERRAIN_HAZARDS[terrain] ?? TERRAIN_HAZARDS["Forest"]) };
      if (field === "nightNote") return { ...prev, nightNote: isNight ? pick(NIGHT_NOTES) : null };
      return prev;
    });
  }

  const tierColor = TIERS.find(t => t.key === tier)?.color ?? "#8A5C1A";

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "Random Encounter", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 4 }}>
          Random Encounter
        </Text>
        <GoldRule />

        {/* Terrain selector */}
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Terrain
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {TERRAINS.map(t => (
            <Pressable
              key={t}
              onPress={() => setTerrain(t)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderRadius: 2,
                backgroundColor: terrain === t ? "#2C2014" : "#E8DCC8",
                borderWidth: 1, borderColor: terrain === t ? "#2C2014" : "#C4B49A",
              }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: terrain === t ? "#C9A24A" : "#4A3F32" }}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Danger tier */}
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Danger Level
        </Text>
        <View style={{ flexDirection: "row", marginBottom: 16, gap: 8 }}>
          {TIERS.map(t => (
            <Pressable
              key={t.key}
              onPress={() => setTier(t.key)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 2, alignItems: "center",
                backgroundColor: tier === t.key ? t.color : "#E8DCC8",
                borderWidth: 1, borderColor: tier === t.key ? t.color : "#C4B49A",
              }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: tier === t.key ? "#F5EDD8" : "#4A3F32" }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Day/Night toggle */}
        <Pressable
          onPress={() => setIsNight(n => !n)}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center",
            backgroundColor: isNight ? "#1A1430" : "#E8DCC8",
            borderRadius: 2, padding: 10, marginBottom: 20,
            borderWidth: 1, borderColor: isNight ? "#4A3A7A" : "#C4B49A",
          }}
        >
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: isNight ? "#B0A0E0" : "#4A3F32" }}>
            {isNight ? "🌙 Night" : "☀ Day"} — tap to toggle
          </Text>
        </Pressable>

        {/* Generate */}
        <Pressable
          onPress={() => setResult(rollEncounter(terrain, tier, isNight))}
          style={{ backgroundColor: "#2C2014", borderRadius: 2, padding: 14, alignItems: "center", marginBottom: 24 }}
        >
          <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: "#C9A24A", letterSpacing: 1 }}>
            ⚄ Roll Encounter
          </Text>
        </Pressable>

        {/* Result */}
        {result && (
          <View style={{ backgroundColor: "#E8DCC820", borderRadius: 4, borderWidth: 1, borderColor: "#A07A2C40", padding: 16, gap: 14 }}>
            {/* Creatures */}
            <View>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Encounter
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 15, color: tierColor }}>
                    {result.creatures}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#4A3F32", marginTop: 2 }}>
                    × {result.count}
                  </Text>
                </View>
                <Pressable onPress={() => reroll("creatures")} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 14, color: "#A07A2C" }}>⚄</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: "#A07A2C20" }} />

            {/* Tactic */}
            <ResultRow label="Tactic" value={result.tactic} onReroll={() => reroll("tactic")} />

            {/* Distance */}
            <ResultRow label="Initial Distance" value={result.distance} onReroll={() => reroll("distance")} />

            {/* Hazard */}
            <ResultRow label="Terrain Hazard" value={result.hazard} onReroll={() => reroll("hazard")} />

            {/* Night note */}
            {result.nightNote && (
              <ResultRow label="Night Condition" value={result.nightNote} onReroll={() => reroll("nightNote")} />
            )}

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Pressable
                onPress={() => setResult(rollEncounter(terrain, tier, isNight))}
                style={{ flex: 1, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, padding: 10, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C" }}>⚄ Re-roll All</Text>
              </Pressable>
              <Pressable
                onPress={saveToNotes}
                style={{ flex: 1, backgroundColor: "#2C2014", borderRadius: 2, padding: 10, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#C9A24A" }}>Save to Notes</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!result && (
          <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#8A7D6D60", textAlign: "center", marginTop: 20 }}>
            Select terrain and danger level, then roll an encounter.
          </Text>
        )}
      </ScrollView>
    </ParchmentScreen>
  );
}

function ResultRow({ label, value, onReroll }: { label: string; value: string; onReroll: () => void }) {
  return (
    <View>
      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014", lineHeight: 18 }}>{value}</Text>
        <Pressable onPress={onReroll} style={{ padding: 6, marginLeft: 4 }}>
          <Text style={{ fontSize: 14, color: "#A07A2C" }}>⚄</Text>
        </Pressable>
      </View>
    </View>
  );
}
