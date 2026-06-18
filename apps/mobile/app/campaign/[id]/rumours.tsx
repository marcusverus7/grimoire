import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useState } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type RumourCategory = "world" | "local" | "dark" | "hook";

const RUMOURS: Record<RumourCategory, string[]> = {
  world: [
    "They say the old empire never truly fell — its legions march still, underground",
    "A new comet appeared last week. The astronomers are refusing to publish their findings",
    "Three ships left port for the eastern islands. Only one returned, and no one aboard will speak of it",
    "The trade roads north have gone quiet — merchants who try them don't come back",
    "Word is the king's chancellor has been replaced, though no announcement has been made",
    "The great library in the capital burned last month. They say it was no accident",
    "An ambassador arrived from a kingdom that doesn't appear on any current map",
    "The high priests declared a fast — but refused to say what they're praying against",
    "Two dukedoms that have been at peace for fifty years are suddenly raising levies",
    "A child was born in the western provinces who has already spoken in four different languages",
  ],
  local: [
    "Old Marta hasn't opened her shutters in three days. The neighbours are nervous",
    "The miller's son came back from apprenticeship… but something's wrong with his eyes",
    "Someone's been digging at the old cemetery outside town. Nothing has been taken",
    "The innkeeper refuses to rent the third room on the upper floor. Has for years",
    "A traveller paid for lodging with coins that haven't been minted in two hundred years",
    "The well water tastes different since the harvest festival. Not worse — just different",
    "The smith's forge has been burning for three days with no one working it",
    "Children have started sleepwalking to the edge of the forest. Always the same spot",
    "Two merchants are bidding against each other on a property no one else wants",
    "Someone has been leaving small offerings at the junction stone. It's working",
  ],
  dark: [
    "There's a butcher who never sells to locals — only to buyers who arrive at night",
    "The missing persons aren't missing. They chose to go. That's worse",
    "I saw three of the watch meeting someone outside the gates last night. No lanterns",
    "The cult that burned down the monastery didn't destroy everything. They took something first",
    "Every third prisoner in the gaol has the same scar. None of them will say where they got it",
    "The healer's herbs aren't from any garden in this region. Someone is supplying them",
    "There are more guards on the road north than last month. They're not stopping bandits",
    "The wizard's tower has been dark for weeks. No one is worried. They should be",
    "The tax collector was seen entering the restricted archive. He has no clearance to do so",
    "A new face in town keeps asking which families have been here the longest",
  ],
  hook: [
    "Someone is paying silver for information about an expedition that left fifteen years ago",
    "A locked chest washed up on the shore. The harbourmaster won't open it but won't destroy it",
    "An old woman in the market is selling maps. She claims to have been everywhere on them",
    "A letter arrived addressed to someone who died ten years ago. The seal is fresh",
    "The abandoned manor at the edge of town had candles lit in the upper windows last night",
    "A boy found a sword in the river. It's too heavy for him to lift, but no one else can pick it up either",
    "There's a reward posted — not for a criminal's capture, but for proof they're still alive",
    "Someone nailed a list of names to the tavern door overnight. All the names are still in town",
    "A dying man's last words were directions — to somewhere no one recognises",
    "A merchant is paying twice the market rate for something entirely ordinary",
  ],
};

const CATEGORY_LABELS: Record<RumourCategory, string> = {
  world: "World News",
  local: "Local Gossip",
  dark: "Dark Rumour",
  hook: "Plot Hook",
};

const CATEGORY_COLORS: Record<RumourCategory, string> = {
  world: "#2A4080",
  local: "#4A8060",
  dark: "#7A2418",
  hook: "#A07A2C",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0]!;
}

function generateRumours(count = 5): { category: RumourCategory; text: string }[] {
  const categories: RumourCategory[] = ["world", "local", "dark", "hook"];
  return Array.from({ length: count }, () => {
    const cat = pick(categories);
    return { category: cat, text: pick(RUMOURS[cat]) };
  });
}

export default function RumoursScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const [rumours, setRumours] = useState(() => generateRumours());
  const [filter, setFilter] = useState<RumourCategory | "all">("all");

  const filtered = filter === "all" ? rumours : rumours.filter((r) => r.category === filter);

  const saveToNotes = (text: string) => {
    const camp = db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId)).get();
    if (!camp) return;
    const settings = (camp.settings ?? {}) as Record<string, unknown>;
    const existing = (settings["notes"] as string | undefined) ?? "";
    const entry = `\n\n---\n**Rumour:** ${text}`;
    db.update(schema.campaigns).set({ settings: { ...settings, notes: (existing + entry).trim() } }).where(eq(schema.campaigns.id, campaignId)).run();
    Alert.alert("Saved", "Rumour added to Campaign Notes.");
  };

  return (
    <>
      <Stack.Screen options={{ title: "Rumour Mill" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
            Rumour Mill
          </Text>
          <GoldRule />

          {/* Category filter */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14, marginBottom: 14 }}>
            {(["all", "world", "local", "dark", "hook"] as const).map((c) => (
              <Pressable
                key={c}
                onPress={() => setFilter(c)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 2, borderWidth: 1,
                  borderColor: filter === c ? (c === "all" ? "#A07A2C" : CATEGORY_COLORS[c]) : "#A07A2C30",
                  backgroundColor: filter === c ? (c === "all" ? "#A07A2C12" : `${CATEGORY_COLORS[c]}10`) : "transparent",
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: filter === c ? (c === "all" ? "#A07A2C" : CATEGORY_COLORS[c]) : "#5A4D3E80" }}>
                  {c === "all" ? "All" : CATEGORY_LABELS[c]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Rumour list */}
          <View style={{ gap: 10 }}>
            {filtered.map((r, i) => (
              <View key={i} style={{ padding: 14, borderWidth: 1, borderColor: `${CATEGORY_COLORS[r.category]}25`, borderRadius: 2, backgroundColor: `${CATEGORY_COLORS[r.category]}06` }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 8, color: CATEGORY_COLORS[r.category], textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                    {CATEGORY_LABELS[r.category]}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const cat = r.category;
                      const fresh = pick(RUMOURS[cat]);
                      setRumours((prev) => prev.map((x, j) => j === rumours.indexOf(r) ? { ...x, text: fresh } : x));
                    }}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: `${CATEGORY_COLORS[r.category]}60` }}>⚄</Text>
                  </Pressable>
                  <Pressable onPress={() => saveToNotes(r.text)} style={{ marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: `${CATEGORY_COLORS[r.category]}30` }}>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: CATEGORY_COLORS[r.category] }}>Save</Text>
                  </Pressable>
                </View>
                <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: "#2C2014", lineHeight: 25 }}>
                  "{r.text}"
                </Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 20, gap: 10 }}>
            <Pressable
              onPress={() => setRumours(generateRumours())}
              style={{ paddingVertical: 13, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5 }}>
                ⚄ Generate New Rumours
              </Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
