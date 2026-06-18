import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

const PROBLEMS = [
  "A prominent citizen has vanished without a trace",
  "Something valuable has been stolen from a powerful faction",
  "A recurring monster attack is escalating in frequency",
  "A dangerous secret is about to become public knowledge",
  "Two factions are on the brink of open war",
  "A ritual gone wrong has left lingering consequences",
  "An ancient threat has reawakened after centuries of dormancy",
  "A child claims to have witnessed something nobody believes",
  "A sacred site has been desecrated and its guardian is furious",
  "A trusted ally has been compromised or corrupted",
  "Resources are running out and tensions are at breaking point",
  "A prophecy is being deliberately fulfilled by a hidden actor",
  "A plague is spreading but its source isn't what it seems",
  "Someone powerful owes the party a debt — and wants to collect",
  "A gate or portal has opened somewhere it shouldn't",
  "The evidence at a crime scene doesn't add up",
  "A festival or ceremony has attracted the wrong kind of attention",
  "A map or artefact has surfaced that shouldn't exist",
  "A trade route has gone silent for three weeks",
  "A member of the local power structure has gone rogue",
];

const TWISTS = [
  "The person asking for help is the actual villain",
  "The monster is protecting something, not attacking",
  "The real target was someone the party trusts",
  "It has happened before — and the last group didn't come back",
  "Two factions are independently hiring the party for the same job",
  "The reward is cursed",
  "The 'obvious solution' will make things significantly worse",
  "Someone has been watching the party from the very start",
  "The threat is a distraction from the real problem",
  "The quest is a test, not a real mission",
  "The enemy becomes a temporary ally mid-mission",
  "The party has been here before — they just don't remember",
  "The real deadline is much sooner than anyone said",
  "Solving it will destroy something the party cares about",
  "The villain is already dead — someone else is using their name",
];

const LOCATIONS = [
  "A merchant quarter under quarantine",
  "Ancient ruins beneath the city",
  "A remote monastery recently gone silent",
  "A ship becalmed at sea for two weeks",
  "A town where no one will meet your eyes",
  "A noble estate the night of a grand feast",
  "A mine that broke into something unexpected",
  "A crossroads where three roads refuse to stay straight",
  "An island that doesn't appear on any charts",
  "A bathhouse used by every faction in the city",
  "A mountain pass claimed by three different groups",
  "A forest that locals refuse to enter after dark",
  "A prison that has never had a successful escape",
  "A theatre staging a play that mirrors real events too closely",
  "A cemetery where fresh graves keep appearing",
  "An abandoned wizard's tower that isn't actually abandoned",
];

const REWARDS = [
  "Significant coin, but someone will come looking for it",
  "A favour from a powerful faction — always double-edged",
  "Information that opens a bigger, scarier door",
  "Safe passage through somewhere dangerous",
  "A unique item with unknown side effects",
  "The gratitude of someone who will become important later",
  "Access to a resource the party has been missing",
  "A title, deed, or claim that comes with complications",
  "Knowledge of a secret that changes everything",
  "A map to somewhere they didn't know they needed to go",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0]!;
}

function generateHook() {
  return {
    problem: pick(PROBLEMS),
    twist: pick(TWISTS),
    location: pick(LOCATIONS),
    reward: pick(REWARDS),
  };
}

type HookDraft = ReturnType<typeof generateHook>;

export default function HookGenScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hook, setHook] = useState<HookDraft>(generateHook);

  const saveToNotes = () => {
    const camp = db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId)).get();
    if (!camp) return;
    const settings = (camp.settings ?? {}) as Record<string, unknown>;
    const existing = (settings["notes"] as string | undefined) ?? "";
    const hookText = `\n\n---\n**Plot Hook**\n- **Situation:** ${hook.problem}\n- **Location:** ${hook.location}\n- **Twist:** ${hook.twist}\n- **Reward:** ${hook.reward}`;
    const updated = { ...settings, notes: (existing + hookText).trim() };
    db.update(schema.campaigns).set({ settings: updated }).where(eq(schema.campaigns.id, campaignId)).run();
    Alert.alert("Saved", "Hook added to Campaign Notes.", [
      { text: "OK", onPress: () => router.back() },
      { text: "Generate Another", onPress: () => setHook(generateHook()) },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Plot Hook Generator" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
            Adventure Hook
          </Text>

          <GoldRule />

          <View style={{ marginTop: 20, gap: 12 }}>
            <HookField
              label="Situation"
              value={hook.problem}
              color="#7A2418"
              onReroll={() => setHook((h) => ({ ...h, problem: pick(PROBLEMS) }))}
            />
            <HookField
              label="Setting"
              value={hook.location}
              color="#4A8060"
              onReroll={() => setHook((h) => ({ ...h, location: pick(LOCATIONS) }))}
            />
            <HookField
              label="Twist"
              value={hook.twist}
              color="#5A3A7A"
              onReroll={() => setHook((h) => ({ ...h, twist: pick(TWISTS) }))}
            />
            <HookField
              label="Reward"
              value={hook.reward}
              color="#A07A2C"
              onReroll={() => setHook((h) => ({ ...h, reward: pick(REWARDS) }))}
            />
          </View>

          <View style={{ marginTop: 24 }}><GoldRule /></View>

          <View style={{ marginTop: 24, gap: 12 }}>
            <Pressable
              onPress={() => setHook(generateHook())}
              style={{ paddingVertical: 14, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2, alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5 }}>
                ⚄ Generate New Hook
              </Text>
            </Pressable>

            <Pressable
              onPress={saveToNotes}
              style={{ paddingVertical: 14, backgroundColor: "#7A2418", borderWidth: 1, borderColor: "#C9A24A40", borderRadius: 2, alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1.5 }}>
                Save to Campaign Notes
              </Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function HookField({ label, value, color, onReroll }: { label: string; value: string; color: string; onReroll: () => void }) {
  return (
    <View style={{ padding: 14, borderWidth: 1, borderColor: `${color}25`, borderRadius: 2, backgroundColor: `${color}06` }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color, textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
          {label}
        </Text>
        <Pressable onPress={onReroll}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: `${color}60` }}>⚄</Text>
        </Pressable>
      </View>
      <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 17, color: "#2C2014", lineHeight: 26 }}>
        {value}
      </Text>
    </View>
  );
}
