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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0]!;
}

function generateNpc() {
  return {
    name: `${pick(GIVEN)} ${pick(FAMILY)}`,
    role: pick(ROLES),
    hook: pick(HOOKS),
    secret: pick(SECRETS),
  };
}

type NpcDraft = ReturnType<typeof generateNpc>;

export default function NpcGenScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [npc, setNpc] = useState<NpcDraft>(generateNpc);

  const save = () => {
    const entityId = newId();
    const now = new Date();
    db.insert(schema.entities).values({
      id: entityId,
      campaignId,
      kind: "npc",
      name: npc.name,
      summary: npc.role,
      attrs: { role: npc.role, gmSecret: npc.secret },
      visibility: "table",
      createdAt: now,
      updatedAt: now,
    }).run();
    Alert.alert("Saved", `${npc.name} added to your campaign. Open to edit?`, [
      { text: "Later", style: "cancel", onPress: () => setNpc(generateNpc()) },
      { text: "Edit", onPress: () => router.push(`/campaign/${campaignId}/entity/${entityId}/edit` as Parameters<typeof router.push>[0]) },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "NPC Generator" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
            Quick NPC
          </Text>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 30, color: "#2C2014", marginBottom: 4 }}>
            {npc.name}
          </Text>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#5A4D3E", marginBottom: 24 }}>
            {npc.role}
          </Text>

          <GoldRule />

          <View style={{ marginTop: 20, marginBottom: 20 }}>
            <FieldRow label="Personality Hook" value={npc.hook} />
            <View style={{ height: 12 }} />
            <FieldRow label="⚿ GM Secret" value={npc.secret} oxblood />
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
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function FieldRow({ label, value, oxblood = false }: { label: string; value: string; oxblood?: boolean }) {
  return (
    <View style={{ padding: 12, backgroundColor: oxblood ? "#7A241808" : "#A07A2C06", borderWidth: 1, borderColor: oxblood ? "#7A241825" : "#A07A2C20", borderRadius: 2 }}>
      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: oxblood ? "#7A2418" : "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 16, color: "#2C2014", lineHeight: 24 }}>
        {value}
      </Text>
    </View>
  );
}
