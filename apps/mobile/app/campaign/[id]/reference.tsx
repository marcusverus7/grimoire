import { View, Text, Pressable, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";

type RefTab = "actions" | "conditions" | "dcs";

const ACTIONS = [
  { name: "Attack", type: "Action", rule: "Make one weapon attack. Extra attacks (Fighter, etc.) add more within the same action." },
  { name: "Dash", type: "Action", rule: "Gain extra movement equal to your speed. Difficult terrain still costs double." },
  { name: "Disengage", type: "Action", rule: "Your movement doesn't provoke opportunity attacks for the rest of the turn." },
  { name: "Dodge", type: "Action", rule: "Attackers have disadvantage on attacks against you until your next turn. You have advantage on Dex saves. Loses effect if incapacitated or speed drops to 0." },
  { name: "Help", type: "Action", rule: "Give one creature advantage on their next ability check, or give advantage on the next attack roll against a creature within 5 ft." },
  { name: "Hide", type: "Action", rule: "Make a Dexterity (Stealth) check. You must be hidden from the target. On success, attackers have disadvantage and you can't be targeted." },
  { name: "Ready", type: "Action", rule: "Declare a trigger and an action/movement. When the trigger occurs, use your reaction to carry it out. Spell readying uses the slot when cast, not when triggered." },
  { name: "Search", type: "Action", rule: "Make a Wisdom (Perception) or Intelligence (Investigation) check to find something that isn't obvious." },
  { name: "Use an Object", type: "Action", rule: "Interact with a second object (you can interact with one object free during your move/action). Also used when an item requires an action." },
  { name: "Shove", type: "Action", rule: "Make an Athletics check contested by the target's Athletics or Acrobatics. On win: knock prone or push 5 ft away. Can only target creatures up to one size larger than you." },
  { name: "Grapple", type: "Action", rule: "Make an Athletics check contested by Athletics or Acrobatics. On win: target is Grappled (speed 0). Move at half speed while grappling." },
  { name: "Opportunity Attack", type: "Reaction", rule: "Triggered when a hostile creature you can see moves out of your reach. Use your reaction to make one melee attack." },
  { name: "Cast a Spell", type: "Varies", rule: "1 action unless spell states otherwise. Bonus action spells restrict you to cantrips with your action. Reactions are instant." },
  { name: "Two-Weapon Fight", type: "Bonus Action", rule: "After attacking with a light weapon, attack again with another light weapon offhand. No modifier to damage unless you have the feat." },
  { name: "Disengage (Rogue)", type: "Bonus Action", rule: "Rogues can Disengage or Dash as a bonus action due to Cunning Action." },
];

const CONDITIONS_SUMMARY = [
  { name: "Blinded", effect: "Auto-fail sight checks. Attacks against: advantage. Your attacks: disadvantage." },
  { name: "Charmed", effect: "Can't attack charmer. Charmer has advantage on social checks against you." },
  { name: "Deafened", effect: "Auto-fail hearing checks. No other mechanical effect." },
  { name: "Exhaustion", effect: "6 levels. 1: Disadv checks. 2: Speed halved. 3: Disadv attacks/saves. 4: HP max halved. 5: Speed 0. 6: Death." },
  { name: "Frightened", effect: "Disadvantage on checks/attacks while source is visible. Can't willingly move closer to it." },
  { name: "Grappled", effect: "Speed 0. Ends if grappler is incapacitated or target moves out of reach." },
  { name: "Incapacitated", effect: "Can't take actions or reactions." },
  { name: "Invisible", effect: "Can't be seen. Attacks against: disadvantage. Your attacks: advantage. Still detectable by noise." },
  { name: "Paralyzed", effect: "Incapacitated + can't move/speak. Auto-fail Str/Dex saves. Attacks have advantage. Hits within 5 ft are crits." },
  { name: "Petrified", effect: "Paralyzed + turned to stone. Resistant to all damage. Immune to poison/disease." },
  { name: "Poisoned", effect: "Disadvantage on attack rolls and ability checks." },
  { name: "Prone", effect: "Attacks within 5 ft: advantage. Ranged or distant attacks: disadvantage. Move costs double. Stand up costs half movement." },
  { name: "Restrained", effect: "Speed 0. Attacks against: advantage. Your attacks: disadvantage. Disadv on Dex saves." },
  { name: "Stunned", effect: "Incapacitated. Can't move. Can speak only falteringly. Auto-fail Str/Dex saves. Attacks against: advantage." },
  { name: "Unconscious", effect: "Paralyzed + fall prone. Drop held items. Hits within 5 ft are crits." },
  { name: "Exhaustion (Death)", effect: "At 0 HP: 3 failures = death. 3 successes = stable. Crit while down = 2 failures. Damage while down = 1 failure." },
];

const DC_REFERENCE = [
  { dc: "5", label: "Very Easy", example: "Notice a large open door, jump over a small puddle" },
  { dc: "10", label: "Easy", example: "Climb a knotted rope, recall common knowledge" },
  { dc: "15", label: "Medium", example: "Pick a simple lock, spot a hidden creature" },
  { dc: "20", label: "Hard", example: "Swim in rough water, recall obscure lore" },
  { dc: "25", label: "Very Hard", example: "Break iron manacles, translate an unknown language" },
  { dc: "30", label: "Nearly Impossible", example: "Track a ghost, lift a portcullis without help" },
];

export default function ReferenceScreen() {
  const [tab, setTab] = useState<RefTab>("actions");

  return (
    <>
      <Stack.Screen options={{ title: "Quick Reference" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
            Quick Reference
          </Text>
          <GoldRule />

          {/* Tab picker */}
          <View style={{ flexDirection: "row", gap: 6, marginTop: 14, marginBottom: 16 }}>
            {(["actions", "conditions", "dcs"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{ flex: 1, paddingVertical: 7, borderRadius: 2, borderWidth: 1, alignItems: "center", borderColor: tab === t ? "#7A2418" : "#A07A2C30", backgroundColor: tab === t ? "#7A241810" : "transparent" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: tab === t ? "#7A2418" : "#5A4D3E80" }}>
                  {t === "actions" ? "Actions" : t === "conditions" ? "Conditions" : "DCs"}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === "actions" && (
            <View style={{ gap: 8 }}>
              {ACTIONS.map((a) => (
                <View key={a.name} style={{ padding: 12, borderWidth: 1, borderColor: "#A07A2C15", borderRadius: 2, backgroundColor: a.type === "Reaction" ? "#5A3A7A06" : a.type === "Bonus Action" ? "#4A806006" : "#A07A2C04" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#2C2014", flex: 1 }}>{a.name}</Text>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: a.type === "Reaction" ? "#5A3A7A30" : a.type === "Bonus Action" ? "#4A806030" : "#A07A2C25", backgroundColor: "transparent" }}>
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: a.type === "Reaction" ? "#5A3A7A" : a.type === "Bonus Action" ? "#4A8060" : "#A07A2C" }}>
                        {a.type}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#3A2E24", lineHeight: 18 }}>{a.rule}</Text>
                </View>
              ))}
            </View>
          )}

          {tab === "conditions" && (
            <View style={{ gap: 6 }}>
              {CONDITIONS_SUMMARY.map((c) => (
                <View key={c.name} style={{ padding: 12, borderWidth: 1, borderColor: "#7A241815", borderRadius: 2, backgroundColor: "#7A241804" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#7A2418", marginBottom: 3 }}>{c.name}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#3A2E24", lineHeight: 18 }}>{c.effect}</Text>
                </View>
              ))}
            </View>
          )}

          {tab === "dcs" && (
            <View style={{ gap: 6 }}>
              {DC_REFERENCE.map((d) => (
                <View key={d.dc} style={{ flexDirection: "row", alignItems: "flex-start", padding: 12, borderWidth: 1, borderColor: "#A07A2C15", borderRadius: 2 }}>
                  <View style={{ width: 36, alignItems: "center", marginRight: 12 }}>
                    <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: "#7A2418", lineHeight: 26 }}>{d.dc}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#2C2014", marginBottom: 2 }}>{d.label}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E80", lineHeight: 16 }}>{d.example}</Text>
                  </View>
                </View>
              ))}

              <View style={{ marginTop: 12, padding: 12, borderWidth: 1, borderColor: "#A07A2C20", borderRadius: 2, backgroundColor: "#A07A2C08" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Ability Check Bonuses</Text>
                {[["Proficiency (Level 1–4)", "+2"], ["Proficiency (Level 5–8)", "+3"], ["Proficiency (Level 9–12)", "+4"], ["Proficiency (Level 13–16)", "+5"], ["Proficiency (Level 17–20)", "+6"], ["Expertise", "×2 proficiency"]].map(([label, val]) => (
                  <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#3A2E24" }}>{label}</Text>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#A07A2C" }}>{val}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
