import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useState } from "react";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { getKv, setKv } from "@/lib/db";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

// ── Treasure tables (CR-based hoard) ──────────────────────────────────────────
const COIN_BY_CR: [number, number, number, number, number][] = [
  // [cp, sp, ep, gp, pp] — totals, not dice — we add random variance
  [100, 0, 0, 0, 0],      // 0
  [200, 100, 0, 10, 0],   // 1
  [300, 200, 0, 20, 0],   // 2
  [400, 300, 0, 40, 0],   // 3
  [600, 500, 0, 60, 0],   // 4
  [0, 0, 0, 250, 0],      // 5
  [0, 0, 0, 300, 0],      // 6
  [0, 0, 0, 400, 10],     // 7
  [0, 0, 0, 500, 20],     // 8
  [0, 0, 0, 700, 30],     // 9
  [0, 0, 0, 900, 50],     // 10
  [0, 0, 0, 1200, 100],   // 11
  [0, 0, 0, 1600, 150],   // 12
  [0, 0, 0, 2000, 200],   // 13
  [0, 0, 0, 2500, 300],   // 14
  [0, 0, 0, 3000, 500],   // 15
  [0, 0, 0, 4000, 800],   // 16
  [0, 0, 0, 5000, 1200],  // 17
  [0, 0, 0, 6000, 1800],  // 18
  [0, 0, 0, 8000, 2500],  // 19
  [0, 0, 0, 10000, 4000], // 20
];

const GEMS = [
  "Azurite (10 gp)", "Blue quartz (10 gp)", "Hematite (10 gp)", "Lapis lazuli (10 gp)",
  "Malachite (10 gp)", "Moss agate (10 gp)", "Obsidian (10 gp)", "Rhodonite (10 gp)",
  "Tiger eye (10 gp)", "Turquoise (10 gp)",
  "Bloodstone (50 gp)", "Carnelian (50 gp)", "Chalcedony (50 gp)", "Chrysoprase (50 gp)",
  "Citrine (50 gp)", "Jasper (50 gp)", "Moonstone (50 gp)", "Onyx (50 gp)", "Quartz (50 gp)",
  "Sardonyx (50 gp)", "Star rose quartz (50 gp)", "Zircon (50 gp)",
  "Amber (100 gp)", "Amethyst (100 gp)", "Chrysoberyl (100 gp)", "Coral (100 gp)",
  "Garnet (100 gp)", "Jade (100 gp)", "Jet (100 gp)", "Spinel (100 gp)",
  "Tourmaline (100 gp)", "White pearl (100 gp)",
  "Alexandrite (500 gp)", "Aquamarine (500 gp)", "Black pearl (500 gp)", "Deep blue spinel (500 gp)",
  "Golden yellow topaz (500 gp)", "Violet garnet (500 gp)",
  "Black sapphire (5,000 gp)", "Blue sapphire (1,000 gp)", "Emerald (1,000 gp)",
  "Fire opal (1,000 gp)", "Opal (1,000 gp)", "Star ruby (1,000 gp)", "Star sapphire (1,000 gp)",
  "Diamond (5,000 gp)", "Jacinth (5,000 gp)", "Ruby (5,000 gp)",
];

const ART = [
  "Silver ewer (25 gp)", "Carved bone statuette (25 gp)", "Gold locket (25 gp)",
  "Pair of engraved bone dice (25 gp)", "Cloth-of-gold vestments (25 gp)",
  "Copper chalice with silver filigree (25 gp)", "Small mirror set in a painted wooden frame (25 gp)",
  "Embroidered silk handkerchief (25 gp)", "Carved ivory statuette (250 gp)",
  "Large gold bracelet (250 gp)", "Bronze crown (250 gp)", "Silk robe with gold embroidery (250 gp)",
  "Large well-made tapestry (250 gp)", "Brass mug with jade inlay (250 gp)",
  "Box of turquoise animal figurines (250 gp)",
  "Gold ring set with bloodstones (250 gp)", "Ceremonial electrum dagger (250 gp)",
  "Silver necklace with a gemstone pendant (250 gp)",
  "Bronze medals shaped like skulls (250 gp)", "Painted portrait of a noble (250 gp)",
  "Fine gold chain set with a fire opal (2,500 gp)",
  "Old masterpiece painting (2,500 gp)", "Embroidered silk and velvet mantle (2,500 gp)",
  "Jewelled gold crown (2,500 gp)", "Jewelled platinum ring (2,500 gp)",
  "Silver figurine of a unicorn (2,500 gp)", "Gold music box with dancing figures (2,500 gp)",
];

const MAGIC_COMMON = [
  "Potion of healing", "Potion of climbing", "Potion of water breathing",
  "Spell scroll (cantrip)", "Spell scroll (1st-level)", "Bag of holding",
  "Boots of elvenkind", "Cloak of elvenkind", "Eyes of minute seeing",
  "Hat of disguise", "Lantern of revealing", "Ring of swimming",
  "Rope of climbing", "Wand of magic missiles",
];

const MAGIC_UNCOMMON = [
  "Potion of greater healing", "Potion of fire breath", "Potion of resistance",
  "Potion of animal friendship", "Potion of hill giant strength",
  "Spell scroll (2nd-level)", "Spell scroll (3rd-level)",
  "+1 weapon", "+1 shield", "+1 armour", "Wand of web",
  "Wand of secrets", "Bracers of archery", "Cloak of protection",
  "Gauntlets of ogre power", "Helm of telepathy", "Javelin of lightning",
  "Ring of protection", "Slippers of spider climbing",
];

const MAGIC_RARE = [
  "Potion of superior healing", "Potion of heroism", "Potion of invisibility",
  "Spell scroll (4th-level)", "Spell scroll (5th-level)",
  "+2 weapon", "+2 armour", "Bag of tricks", "Belt of dwarvenkind",
  "Boots of striding and springing", "Chime of opening", "Cloak of displacement",
  "Cloak of the manta ray", "Crystal ball", "Dimensional shackles",
  "Flame tongue", "Frost brand", "Gauntlets of ogre power",
  "Helm of brilliance", "Horn of blasting", "Manual of bodily health",
  "Necklace of fireballs", "Periapt of proof against poison",
  "Ring of feather falling", "Ring of free action", "Sword of life stealing",
];

const MAGIC_VERY_RARE = [
  "Potion of storm giant strength", "Spell scroll (6th-level)", "Spell scroll (7th-level)",
  "+3 weapon", "+3 armour", "Amulet of the planes", "Bowl of commanding water elementals",
  "Cape of the mountebank", "Cloak of invisibility", "Crystal ball of mind reading",
  "Dancing sword", "Demon armour", "Dragon slayer",
  "Helm of teleportation", "Instrument of the bards", "Ioun stone",
  "Manual of golems", "Mirror of life trapping",
  "Nine lives stealer", "Nolzur's marvelous pigments", "Ring of regeneration",
  "Ring of spell storing", "Ring of the ram", "Rod of alertness",
  "Scimitar of speed", "Staff of charming", "Staff of healing",
];

const MAGIC_LEGENDARY = [
  "Apparatus of Kwalish", "Armor of invulnerability", "Belt of giant strength (fire)",
  "Cloak of invisibility (attunement)",  "Crystal ball of telepathy",
  "Deck of many things", "Defender", "Efreeti chain",
  "Holy avenger", "Horn of Valhalla (iron)", "Luck blade", "Plate armor of etherealness",
  "Ring of djinni summoning", "Ring of elemental command",
  "Ring of invisibility", "Ring of spell turning", "Ring of three wishes",
  "Scarab of protection", "Sphere of annihilation", "Staff of the magi",
  "Talisman of pure good", "Talisman of ultimate evil", "Vorpal sword",
];

const MAGIC_TABLES = [MAGIC_COMMON, MAGIC_UNCOMMON, MAGIC_RARE, MAGIC_VERY_RARE, MAGIC_LEGENDARY];
const MAGIC_LABELS = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];

// Magic item roll chance by CR tier (0-4, 5-10, 11-16, 17-20)
const MAGIC_CHANCE_BY_TIER = [
  [0.15, 0, 0, 0, 0],      // tier 0-4
  [0.3, 0.2, 0.05, 0, 0],  // tier 5-10
  [0.2, 0.3, 0.25, 0.1, 0.02], // tier 11-16
  [0.1, 0.2, 0.3, 0.25, 0.1],  // tier 17-20
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function rng(n: number) { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T { return arr[rng(arr.length)]; }
function variance(base: number) { return Math.max(0, Math.floor(base * (0.5 + Math.random()))); }

type LootItem = { type: "coin" | "gem" | "art" | "magic"; text: string; rarity?: string };

function generateLoot(cr: number): LootItem[] {
  const items: LootItem[] = [];
  const crIdx = Math.min(cr, 20);
  const [cp, sp, ep, gp, pp] = COIN_BY_CR[crIdx];

  // Coins with variance
  if (cp > 0) items.push({ type: "coin", text: `${variance(cp)} cp` });
  if (sp > 0) items.push({ type: "coin", text: `${variance(sp)} sp` });
  if (ep > 0) items.push({ type: "coin", text: `${variance(ep)} ep` });
  if (gp > 0) items.push({ type: "coin", text: `${variance(gp)} gp` });
  if (pp > 0) items.push({ type: "coin", text: `${variance(pp)} pp` });

  // Gems
  const gemCount = cr <= 4 ? 0 : cr <= 10 ? (Math.random() < 0.4 ? 1 : 0) :
    cr <= 16 ? (Math.random() < 0.6 ? rng(3) + 1 : 0) : rng(4) + 1;
  for (let i = 0; i < gemCount; i++) items.push({ type: "gem", text: pick(GEMS) });

  // Art objects
  const artCount = cr <= 4 ? 0 : cr <= 10 ? (Math.random() < 0.2 ? 1 : 0) :
    cr <= 16 ? (Math.random() < 0.4 ? 1 : 0) : (Math.random() < 0.6 ? rng(2) + 1 : 0);
  for (let i = 0; i < artCount; i++) items.push({ type: "art", text: pick(ART) });

  // Magic items
  const tier = cr <= 4 ? 0 : cr <= 10 ? 1 : cr <= 16 ? 2 : 3;
  const chances = MAGIC_CHANCE_BY_TIER[tier];
  chances.forEach((chance, tableIdx) => {
    if (Math.random() < chance) {
      const item = pick(MAGIC_TABLES[tableIdx]);
      items.push({ type: "magic", text: item, rarity: MAGIC_LABELS[tableIdx] });
    }
  });

  return items;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LootScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const [cr, setCr] = useState(5);
  const [loot, setLoot] = useState<LootItem[]>([]);
  const [savedLoot, setSavedLoot] = useState<{ ts: number; crUsed: number; items: LootItem[] }[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      const raw = await getKv(`loot_history_${campaignId}`);
      if (raw) {
        try { setSavedLoot(JSON.parse(raw)); } catch {}
      }
    })();
  }, [campaignId]));

  function roll() {
    setLoot(generateLoot(cr));
  }

  async function saveLoot() {
    if (!loot.length) return;
    const entry = { ts: Date.now(), crUsed: cr, items: loot };
    const next = [entry, ...savedLoot].slice(0, 10);
    setSavedLoot(next);
    await setKv(`loot_history_${campaignId}`, JSON.stringify(next));
    Alert.alert("Saved", "Loot added to history.");
  }

  function rerollItem(index: number) {
    const item = loot[index];
    let newText = item.text;
    if (item.type === "gem") newText = pick(GEMS);
    else if (item.type === "art") newText = pick(ART);
    else if (item.type === "magic") {
      const tableIdx = MAGIC_LABELS.indexOf(item.rarity ?? "Common");
      const table = MAGIC_TABLES[Math.max(0, tableIdx)];
      newText = pick(table);
    }
    const next = [...loot];
    next[index] = { ...item, text: newText };
    setLoot(next);
  }

  const coins = loot.filter(i => i.type === "coin");
  const gems = loot.filter(i => i.type === "gem");
  const arts = loot.filter(i => i.type === "art");
  const magics = loot.filter(i => i.type === "magic");

  const ITEM_COLORS: Record<string, string> = {
    coin: "#A07A2C", gem: "#4A8060", art: "#7A2418", magic: "#6A5ACD",
  };

  function renderSection(title: string, items: LootItem[]) {
    if (!items.length) return null;
    return (
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{title}</Text>
        {items.map((item, localIdx) => {
          const globalIdx = loot.indexOf(item);
          return (
            <View key={localIdx} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ITEM_COLORS[item.type], marginRight: 8 }} />
              <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014" }}>
                {item.text}
                {item.rarity ? <Text style={{ color: "#8A7D6D", fontSize: 11 }}> ({item.rarity})</Text> : null}
              </Text>
              {item.type !== "coin" && (
                <Pressable onPress={() => rerollItem(globalIdx)} style={{ paddingLeft: 8 }}>
                  <Text style={{ fontSize: 14, color: "#A07A2C" }}>⚄</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "Loot Generator", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 4 }}>
          Loot Generator
        </Text>
        <GoldRule />

        {/* CR selector */}
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 8 }}>
          Encounter CR
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {Array.from({ length: 21 }, (_, i) => i).map(c => (
            <Pressable
              key={c}
              onPress={() => setCr(c)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, borderRadius: 2,
                borderWidth: 1,
                borderColor: cr === c ? "#A07A2C" : "#C8B88A40",
                backgroundColor: cr === c ? "#A07A2C18" : "transparent",
              }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: cr === c ? "#A07A2C" : "#5C4A2A" }}>
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Roll button */}
        <Pressable
          onPress={roll}
          style={{ backgroundColor: "#2C2014", borderRadius: 2, padding: 14, alignItems: "center", marginBottom: 20 }}
        >
          <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: "#C9A24A", letterSpacing: 1 }}>
            ⚄ Roll Treasure
          </Text>
        </Pressable>

        {/* Results */}
        {loot.length > 0 && (
          <View style={{ backgroundColor: "#A07A2C08", borderRadius: 2, borderWidth: 1, borderColor: "#A07A2C20", padding: 14, marginBottom: 16 }}>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold_Italic", fontSize: 16, color: "#2C2014", marginBottom: 12 }}>
              CR {cr} Treasure Hoard
            </Text>
            {renderSection("Currency", coins)}
            {renderSection("Gems", gems)}
            {renderSection("Art Objects", arts)}
            {renderSection("Magic Items", magics)}
            {!gems.length && !arts.length && !magics.length && (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#8A7D6D60", fontStyle: "italic", marginTop: 4 }}>
                No gems, art, or magic items this time.
              </Text>
            )}
            <Pressable
              onPress={saveLoot}
              style={{ marginTop: 12, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, padding: 10, alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C" }}>Save to History</Text>
            </Pressable>
          </View>
        )}

        {loot.length === 0 && (
          <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#8A7D6D60", textAlign: "center", marginTop: 20 }}>
            Select a CR and roll for treasure.
          </Text>
        )}

        {/* History */}
        {savedLoot.length > 0 && (
          <>
            <GoldRule />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Recent History
            </Text>
            {savedLoot.slice(0, 5).map((entry, i) => (
              <View key={i} style={{ marginBottom: 10, borderLeftWidth: 2, borderLeftColor: "#A07A2C30", paddingLeft: 10 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#8A7D6D", marginBottom: 3 }}>
                  CR {entry.crUsed} — {new Date(entry.ts).toLocaleDateString()}
                </Text>
                {entry.items.map((item, j) => (
                  <Text key={j} style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#4A3F32" }}>
                    • {item.text}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ParchmentScreen>
  );
}
