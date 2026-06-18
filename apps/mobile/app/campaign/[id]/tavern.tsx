import { View, Text, ScrollView, Pressable } from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";

// ── Tables ────────────────────────────────────────────────────────────────────
const T_ADJ1 = ["Rusty", "Golden", "Silver", "Broken", "Lucky", "Wandering", "Weeping", "Laughing", "Crooked", "Faded", "Howling", "Merry", "Surly", "Gilded", "Battered", "Winking", "Stumbling", "Proud", "Fallen", "Thirsty"];
const T_ADJ2 = ["Old", "Sleeping", "Dancing", "Snoring", "Hollow", "Friendly", "Grumbling", "Winking", "Cursed", "Blessed", "Trembling", "Wandering"];
const T_NOUN1 = ["Anvil", "Axe", "Barrel", "Blade", "Boot", "Candle", "Coin", "Crown", "Dice", "Dragon", "Drum", "Flame", "Flagon", "Flask", "Goblin", "Hammer", "Harp", "Horse", "Kettle", "Lantern", "Manticore", "Mug", "Owl", "Pipe", "Plough", "Rat", "Raven", "Ring", "Rooster", "Serpent", "Shield", "Skull", "Sow", "Stag", "Star", "Sword", "Toad", "Wolf"];
const T_NOUN2 = ["Anchor", "Badger", "Bear", "Bell", "Boar", "Bull", "Cart", "Cat", "Chalice", "Chimney", "Claw", "Cockerel", "Compass", "Crest", "Cup", "Dagger", "Elk", "Fox", "Goat", "Griffin", "Hawk", "Helm", "Hen", "Horn", "Inn", "Jester", "Kettle", "Knight", "Knave", "Lady", "Lion", "Lute", "Mast", "Moon", "Nag", "Pig", "Plank", "Pony", "Quill", "Sail", "Salmon", "Stump", "Swan", "Tallow", "Thistle", "Torch", "Urn", "Vane", "Wagon", "Whale"];

const KEEPER_FIRST = ["Aldric", "Brenna", "Cait", "Devra", "Elan", "Fynn", "Gorsedd", "Hilde", "Ivar", "Joss", "Kira", "Lorn", "Mira", "Nora", "Oswin", "Petra", "Quintus", "Rael", "Seld", "Tava", "Unn", "Vasha", "Wren", "Xan", "Yeva", "Zeth"];
const KEEPER_LAST = ["Ashwood", "Barley", "Copperkettle", "Duskmantle", "Fairfax", "Greymoor", "Hammerfall", "Ironside", "Kettleboil", "Longbrewer", "Mosswick", "Nighthollow", "Oakhaven", "Pintwood", "Quickfingers", "Redmane", "Strongale", "Thistledown", "Underhill", "Vayne", "Wellspring"];
const KEEPER_TRAITS = ["A perpetual scowl that hides a warm heart", "Suspicious of everyone but will warm up quickly", "Talkative — knows every rumour within 10 miles", "Missing two fingers; never explains why", "Hums constantly off-key", "Former soldier with a haunted look", "Obsessively polishes the same mug", "Has a different accent every day", "Will give a discount for a good story", "Deeply religious, blesses every drink", "Extraordinarily nosy", "Never forgets a face — or a debt"];

const ATMOSPHERE = ["A fire crackles in the hearth. The smell of roasting meat fills the air.", "Pipe smoke drifts in lazy spirals. Low murmurs fill every corner.", "A bard in the corner plays a mournful tune no one requested.", "It's unusually quiet for this hour. People keep glancing at the door.", "A roaring hearth and the sound of dice rattling on wood.", "The smell of spilled ale and old rushes. Lively chatter from every bench.", "Candles are few and guttering. Faces are hard to make out.", "A warm buzz of conversation. Someone just won at cards.", "Rain hammers the shutters. Everyone here seems relieved to be inside.", "Tension near the bar — two patrons arguing in hushed, clipped tones.", "A drunk is singing badly. Nobody minds.", "The innkeeper keeps eyeing the back door."];

const PATRON_TYPES = ["Merchant", "Farmer", "Mercenary", "Travelling priest", "Bard", "Off-duty guard", "Shepherd", "Minor noble in disguise", "Hedgewitch", "Dwarven craftsman", "Elven scout", "Halfling courier", "Retired adventurer", "Beggar who wandered in", "Fisherman far from water", "Bounty hunter nursing a drink", "Grizzled hunter", "Runaway servant", "Gossip who knows everyone", "Drunk philosopher"];
const PATRON_MOODS = ["cheerful", "brooding", "nervous", "suspicious", "boisterous", "weeping quietly", "watching the door", "arguing with the barmaid", "passed out face-down", "sketching a map on the table"];

const SPECIALS = ["The stew today. Thick, grey, and somehow warm.", "Roasted river trout with herbs.", "House ale — bitter and surprisingly drinkable.", "Honeyed mead, one jug per table.", "Pig knuckles with turnip mash.", "Bread soup — a full loaf hollowed out.", "Dried venison and hard cheese.", "Black pudding and fried eggs.", "Three-day-old mutton pie with ale gravy.", "Smoked eel on a split bread roll."];

const RUMOURS = [
  "Someone's been stealing milk from doorsteps. Folks blame a kobold.",
  "The miller owes money to the wrong people. He's been missing two days.",
  "A merchant passed through last week with a locked chest and no servants. He paid double.",
  "Road north has been 'watched' — travellers feel eyes but see no one.",
  "The blacksmith was overheard praying to a god with no name.",
  "Strange lights on the hill last three nights. Nobody's gone up to look.",
  "Lord's tax collector arrived a month early. Something changed at the manor.",
  "A man claiming to be a healer cured a child everyone said was dying. Now he's gone.",
  "Someone dug up the old barrow on the edge of town. Everyone's pretending not to know.",
  "Two guards quit the same day. Won't say why.",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function rng(n: number) { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T { return arr[rng(arr.length)]; }

type Patron = { type: string; mood: string };
type TavernData = {
  name: string;
  keeper: string;
  keeperTrait: string;
  atmosphere: string;
  special: string;
  patrons: Patron[];
  rumour: string;
};

function generateTavern(): TavernData {
  const namePattern = rng(3);
  let name: string;
  if (namePattern === 0) name = `The ${pick(T_ADJ1)} ${pick(T_NOUN1)}`;
  else if (namePattern === 1) name = `The ${pick(T_NOUN1)} and ${pick(T_NOUN2)}`;
  else name = `The ${pick(T_ADJ2)} ${pick(T_ADJ1)} ${pick(T_NOUN1)}`;

  const patronCount = 2 + rng(4);
  const patrons: Patron[] = [];
  for (let i = 0; i < patronCount; i++) {
    patrons.push({ type: pick(PATRON_TYPES), mood: pick(PATRON_MOODS) });
  }

  return {
    name,
    keeper: `${pick(KEEPER_FIRST)} ${pick(KEEPER_LAST)}`,
    keeperTrait: pick(KEEPER_TRAITS),
    atmosphere: pick(ATMOSPHERE),
    special: pick(SPECIALS),
    patrons,
    rumour: pick(RUMOURS),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TavernScreen() {
  const [tavern, setTavern] = useState<TavernData | null>(null);

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          {title}
        </Text>
        {children}
      </View>
    );
  }

  return (
    <ParchmentScreen>
      <Stack.Screen options={{ title: "Tavern Generator", headerBackTitle: "Campaign" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 4 }}>
          Tavern Generator
        </Text>
        <GoldRule />

        <Pressable
          onPress={() => setTavern(generateTavern())}
          style={{ backgroundColor: "#2C2014", borderRadius: 2, padding: 14, alignItems: "center", marginBottom: 24 }}
        >
          <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 14, color: "#C9A24A", letterSpacing: 1 }}>
            ⚄ Generate Tavern
          </Text>
        </Pressable>

        {tavern && (
          <View>
            {/* Name */}
            <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 20, color: "#2C2014", textAlign: "center", marginBottom: 4 }}>
              {tavern.name}
            </Text>
            <GoldRule />

            <Section title="Atmosphere">
              <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 15, color: "#2C2014", lineHeight: 22 }}>
                {tavern.atmosphere}
              </Text>
            </Section>

            <Section title="Innkeeper">
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#2C2014" }}>{tavern.keeper}</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#4A3F32", marginTop: 2 }}>{tavern.keeperTrait}</Text>
            </Section>

            <Section title="Today's Special">
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014" }}>{tavern.special}</Text>
            </Section>

            <Section title={`Patrons (${tavern.patrons.length})`}>
              {tavern.patrons.map((p, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4 }}>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", width: 16 }}>•</Text>
                  <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014" }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold" }}>{p.type}</Text>
                    {" — "}{p.mood}
                  </Text>
                </View>
              ))}
            </Section>

            <Section title="Overheard Rumour">
              <View style={{ backgroundColor: "#A07A2C08", borderLeftWidth: 3, borderLeftColor: "#A07A2C40", padding: 10, borderRadius: 2 }}>
                <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#2C2014", lineHeight: 20 }}>
                  "{tavern.rumour}"
                </Text>
              </View>
            </Section>

            <Pressable
              onPress={() => setTavern(generateTavern())}
              style={{ borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, padding: 10, alignItems: "center", marginTop: 4 }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C" }}>⚄ Re-roll Tavern</Text>
            </Pressable>
          </View>
        )}

        {!tavern && (
          <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#8A7D6D60", textAlign: "center", marginTop: 20 }}>
            Generate a tavern to populate your next scene.
          </Text>
        )}
      </ScrollView>
    </ParchmentScreen>
  );
}
