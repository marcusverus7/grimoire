import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { DiceRoller } from "@/components/DiceRoller";
import { schema } from "@grimoire/core";

type Entity = typeof schema.entities.$inferSelect;
type Attrs = Record<string, unknown>;

type TrackerEntry = Entity & {
  currentHp: number;
  maxHp: number;
  ac: number;
  initiative: number | null;
};

export default function TrackerScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [sortByInit, setSortByInit] = useState(false);
  const [showDice, setShowDice] = useState(false);

  const load = useCallback(() => {
    const entities = db
      .select()
      .from(schema.entities)
      .where(
        and(
          eq(schema.entities.campaignId, campaignId),
          // Only entities with HP defined
        ),
      )
      .all()
      .filter((e) => {
        const attrs = e.attrs as Attrs | null;
        return (
          (e.kind === "npc" || e.kind === "pc") &&
          attrs?.["hp"] != null
        );
      })
      .map((e) => {
        const attrs = e.attrs as Attrs | null;
        const maxHp = Number(attrs?.["hp"] ?? 0);
        const currentHp = Number(attrs?.["currentHp"] ?? maxHp);
        const ac = Number(attrs?.["ac"] ?? 0);
        const initiative = attrs?.["initiative"] != null ? Number(attrs["initiative"]) : null;
        return { ...e, currentHp, maxHp, ac, initiative };
      });
    setEntries(entities);
  }, [campaignId]);

  useFocusEffect(load);

  const adjustHp = (entity: TrackerEntry, delta: number) => {
    const newHp = Math.max(0, Math.min(entity.maxHp, entity.currentHp + delta));
    const attrs = { ...(entity.attrs as Attrs | null ?? {}), currentHp: newHp };
    db.update(schema.entities)
      .set({ attrs })
      .where(eq(schema.entities.id, entity.id))
      .run();
    setEntries((prev) =>
      prev.map((e) => (e.id === entity.id ? { ...e, currentHp: newHp } : e)),
    );
  };

  const setHpDirect = (entity: TrackerEntry, value: string) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return;
    const newHp = Math.max(0, Math.min(entity.maxHp, parsed));
    const attrs = { ...(entity.attrs as Attrs | null ?? {}), currentHp: newHp };
    db.update(schema.entities)
      .set({ attrs })
      .where(eq(schema.entities.id, entity.id))
      .run();
    setEntries((prev) =>
      prev.map((e) => (e.id === entity.id ? { ...e, currentHp: newHp } : e)),
    );
  };

  const resetAll = () => {
    Alert.alert("Reset HP", "Restore all combatants to full HP?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset All",
        onPress: () => {
          entries.forEach((e) => {
            const attrs = { ...(e.attrs as Attrs | null ?? {}), currentHp: e.maxHp };
            db.update(schema.entities)
              .set({ attrs })
              .where(eq(schema.entities.id, e.id))
              .run();
          });
          setEntries((prev) => prev.map((e) => ({ ...e, currentHp: e.maxHp })));
        },
      },
    ]);
  };

  const sorted = sortByInit
    ? [...entries].sort((a, b) => (b.initiative ?? -1) - (a.initiative ?? -1))
    : entries;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Combat Tracker",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable onPress={() => setShowDice(true)} style={{ marginRight: 14 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#A07A2C" }}>Dice</Text>
              </Pressable>
              <Pressable onPress={resetAll} style={{ marginRight: 8 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#A07A2C" }}>Reset</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        {entries.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014", marginBottom: 8, textAlign: "center" }}>
              No Combatants
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", textAlign: "center", lineHeight: 20 }}>
              Add HP to NPC or PC entities to track them here. Edit any character and fill in their HP stat.
            </Text>
            <Pressable
              onPress={() => router.push(`/campaign/${campaignId}/entity/new/edit` as Parameters<typeof router.push>[0])}
              style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2 }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
                Add Entity
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Sort toggle */}
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#A07A2C15" }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#8A7D6D", flex: 1 }}>
                {entries.length} combatant{entries.length !== 1 ? "s" : ""}
              </Text>
              <Pressable
                onPress={() => setSortByInit((v) => !v)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: sortByInit ? "#A07A2C" : "#A07A2C40",
                  borderRadius: 10,
                  backgroundColor: sortByInit ? "#A07A2C15" : "transparent",
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C" }}>
                  {sortByInit ? "Initiative Order" : "Sort by Initiative"}
                </Text>
              </Pressable>
            </View>

            <FlatList
              data={sorted}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => <CombatantRow entry={item} onAdjust={adjustHp} onSetHp={setHpDirect} onNavigate={() => router.push(`/campaign/${campaignId}/entity/${item.id}`)} />}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          </>
        )}
      </ParchmentScreen>

      <DiceRoller visible={showDice} onClose={() => setShowDice(false)} />
    </>
  );
}

function CombatantRow({
  entry,
  onAdjust,
  onSetHp,
  onNavigate,
}: {
  entry: TrackerEntry;
  onAdjust: (e: TrackerEntry, delta: number) => void;
  onSetHp: (e: TrackerEntry, v: string) => void;
  onNavigate: () => void;
}) {
  const pct = entry.maxHp > 0 ? entry.currentHp / entry.maxHp : 1;
  const barColor = pct > 0.5 ? "#4A7A2C" : pct > 0.25 ? "#A07A2C" : "#7A2418";
  const isDead = entry.currentHp === 0;

  return (
    <View
      style={{
        backgroundColor: isDead ? "#7A241808" : "#FAF5EA",
        borderWidth: 1,
        borderColor: isDead ? "#7A241830" : "#A07A2C20",
        borderRadius: 4,
        padding: 12,
        opacity: isDead ? 0.7 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        {/* Name + kind */}
        <Pressable style={{ flex: 1 }} onPress={onNavigate}>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 17, color: isDead ? "#8A7D6D" : "#2C2014" }}>
            {entry.name}
            {isDead ? " ✝" : ""}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 0.8 }}>
            {entry.kind}
            {entry.ac > 0 ? ` · AC ${entry.ac}` : ""}
            {entry.initiative != null ? ` · Init ${entry.initiative}` : ""}
          </Text>
        </Pressable>

        {/* HP controls */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => onAdjust(entry, -1)}
            onLongPress={() => onAdjust(entry, -5)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#7A241815", borderWidth: 1, borderColor: "#7A241830", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: "#7A2418", fontSize: 20, lineHeight: 22 }}>−</Text>
          </Pressable>

          <TextInput
            value={String(entry.currentHp)}
            onChangeText={(v) => onSetHp(entry, v)}
            keyboardType="number-pad"
            selectTextOnFocus
            style={{
              fontFamily: "CormorantGaramond_700Bold",
              fontSize: 22,
              color: barColor,
              textAlign: "center",
              width: 52,
              marginHorizontal: 6,
            }}
          />

          <Pressable
            onPress={() => onAdjust(entry, 1)}
            onLongPress={() => onAdjust(entry, 5)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#4A7A2C15", borderWidth: 1, borderColor: "#4A7A2C30", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: "#4A7A2C", fontSize: 20, lineHeight: 22 }}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* HP bar */}
      <View style={{ height: 3, backgroundColor: "#A07A2C15", borderRadius: 2 }}>
        <View style={{ height: 3, width: `${Math.round(pct * 100)}%`, backgroundColor: barColor, borderRadius: 2 }} />
      </View>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D", textAlign: "right", marginTop: 2 }}>
        {entry.currentHp} / {entry.maxHp} HP
      </Text>
    </View>
  );
}
