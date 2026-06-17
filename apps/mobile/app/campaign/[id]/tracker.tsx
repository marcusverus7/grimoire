import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db, getKv, setKv } from "@/lib/db";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { DiceRoller } from "@/components/DiceRoller";
import { schema } from "@grimoire/core";

const CONDITIONS = [
  "Blinded", "Charmed", "Concentration", "Deafened", "Exhausted",
  "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed",
  "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
];

const CONDITION_COLORS: Record<string, string> = {
  Poisoned: "#4A7A2C",
  Frightened: "#7A2418",
  Paralyzed: "#6A5ACD",
  Stunned: "#6A5ACD",
  Unconscious: "#3A2E24",
  Concentration: "#A07A2C",
  Prone: "#8A7D6D",
};

type Entity = typeof schema.entities.$inferSelect;
type Attrs = Record<string, unknown>;

type TrackerEntry = Entity & {
  currentHp: number;
  maxHp: number;
  ac: number;
  initiative: number | null;
  conditions: string[];
};

export default function TrackerScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [sortByInit, setSortByInit] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const [conditionTarget, setConditionTarget] = useState<TrackerEntry | null>(null);
  const [round, setRound] = useState(1);

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
        const conditions = Array.isArray(attrs?.["conditions"]) ? attrs["conditions"] as string[] : [];
        return { ...e, currentHp, maxHp, ac, initiative, conditions };
      });
    setEntries(entities);
    const savedRound = getKv(`tracker_round_${campaignId}`);
    setRound(savedRound ? parseInt(savedRound, 10) || 1 : 1);
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

  const toggleCondition = (entity: TrackerEntry, condition: string) => {
    const current = entity.conditions;
    const next = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    const attrs = { ...(entity.attrs as Attrs | null ?? {}), conditions: next.length > 0 ? next : undefined };
    db.update(schema.entities)
      .set({ attrs })
      .where(eq(schema.entities.id, entity.id))
      .run();
    setEntries((prev) =>
      prev.map((e) => (e.id === entity.id ? { ...e, conditions: next } : e)),
    );
    if (conditionTarget?.id === entity.id) {
      setConditionTarget((t) => t ? { ...t, conditions: next } : t);
    }
  };

  const changeRound = (delta: number) => {
    const next = Math.max(1, round + delta);
    setRound(next);
    setKv(`tracker_round_${campaignId}`, String(next));
  };

  const resetAll = () => {
    Alert.alert("Reset Combat", "Restore all combatants to full HP and reset round counter?", [
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
          setRound(1);
          setKv(`tracker_round_${campaignId}`, "1");
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
            {/* Round counter + sort toggle */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: "#A07A2C15" }}>
              {/* Round counter row */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#7A241820", backgroundColor: "#7A241806" }}>
                <Pressable onPress={() => changeRound(-1)} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 18, color: "#7A2418" }}>−</Text>
                </Pressable>
                <View style={{ alignItems: "center", minWidth: 80 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#7A241870", textTransform: "uppercase", letterSpacing: 1.5 }}>Round</Text>
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: "#7A2418", lineHeight: 34 }}>{round}</Text>
                </View>
                <Pressable onPress={() => changeRound(1)} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 18, color: "#7A2418" }}>+</Text>
                </Pressable>
              </View>
              {/* Sort + count row */}
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 }}>
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
            </View>

            <FlatList
              data={sorted}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => <CombatantRow entry={item} onAdjust={adjustHp} onSetHp={setHpDirect} onNavigate={() => router.push(`/campaign/${campaignId}/entity/${item.id}`)} onOpenConditions={() => setConditionTarget(item)} onToggleCondition={(c) => toggleCondition(item, c)} />}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          </>
        )}
      </ParchmentScreen>

      <DiceRoller visible={showDice} onClose={() => setShowDice(false)} />

      {/* Condition picker modal */}
      <Modal
        visible={conditionTarget != null}
        transparent
        animationType="fade"
        onRequestClose={() => setConditionTarget(null)}
      >
        <Pressable
          onPress={() => setConditionTarget(null)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 24 }}
        >
          <Pressable onPress={() => {}} style={{ backgroundColor: "#FAF5EA", borderRadius: 4, borderWidth: 1, borderColor: "#A07A2C30", padding: 20 }}>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: "#2C2014", marginBottom: 4 }}>
              {conditionTarget?.name}
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
              Conditions — tap to toggle
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CONDITIONS.map((c) => {
                  const active = conditionTarget?.conditions.includes(c) ?? false;
                  const color = CONDITION_COLORS[c] ?? "#5A4D3E";
                  return (
                    <Pressable
                      key={c}
                      onPress={() => conditionTarget && toggleCondition(conditionTarget, c)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 2,
                        borderWidth: 1,
                        borderColor: active ? color : "#A07A2C30",
                        backgroundColor: active ? `${color}20` : "transparent",
                      }}
                    >
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: active ? color : "#5A4D3E" }}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable onPress={() => setConditionTarget(null)} style={{ marginTop: 16, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function CombatantRow({
  entry,
  onAdjust,
  onSetHp,
  onNavigate,
  onOpenConditions,
  onToggleCondition,
}: {
  entry: TrackerEntry;
  onAdjust: (e: TrackerEntry, delta: number) => void;
  onSetHp: (e: TrackerEntry, v: string) => void;
  onNavigate: () => void;
  onOpenConditions: () => void;
  onToggleCondition: (condition: string) => void;
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

      {/* Conditions row */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8, alignItems: "center" }}>
        {entry.conditions.map((c) => {
          const color = CONDITION_COLORS[c] ?? "#5A4D3E";
          return (
            <Pressable
              key={c}
              onPress={() => onToggleCondition(c)}
              style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: color, backgroundColor: `${color}18` }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color }}>{c}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onOpenConditions}
          style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: "#A07A2C40", backgroundColor: "transparent" }}
        >
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#A07A2C80" }}>
            {entry.conditions.length === 0 ? "+ Condition" : "+"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
