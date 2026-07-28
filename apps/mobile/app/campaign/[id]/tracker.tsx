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
import { color, withAlpha, useThemeTick } from "@/lib/theme";

const CONDITIONS = [
  "Blinded", "Charmed", "Concentration", "Deafened", "Exhausted",
  "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed",
  "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
];

const CONDITION_COLORS: Record<string, string> = {
  get Poisoned() { return color.green; },
  get Frightened() { return color.oxblood; },
  get Paralyzed() { return color.arcane; },
  get Stunned() { return color.arcane; },
  get Unconscious() { return color.inkBark; },
  get Concentration() { return color.gold; },
  get Prone() { return color.inkFaint; }};

const CONDITION_DESC: Record<string, string> = {
  Blinded: "Auto-fail sight checks. Attack rolls have disadvantage; attacks against have advantage.",
  Charmed: "Can't attack the charmer. Charmer has advantage on social checks against target.",
  Concentration: "Maintaining a spell. Taking damage requires a Con save (DC 10 or half damage) to keep.",
  Deafened: "Auto-fail hearing checks. Can't cast spells with verbal components.",
  Exhausted: "Stacks 1–6: 1=disadv checks, 2=halved speed, 3=disadv attacks & saves, 4=halved HP max, 5=speed 0, 6=death.",
  Frightened: "Disadvantage on checks/attacks while source is in sight. Can't move closer to source.",
  Grappled: "Speed becomes 0. Ends if grappler is incapacitated or moved out of reach.",
  Incapacitated: "Can't take actions or reactions.",
  Invisible: "Impossible to see without magic. Attack rolls have advantage; attacks against have disadvantage.",
  Paralyzed: "Incapacitated + can't move or speak. Auto-fail Str/Dex saves. Attacks within 5ft auto-crit.",
  Petrified: "Turned to stone. Incapacitated, weight×10, immune to poison+disease. Resist all damage.",
  Poisoned: "Disadvantage on attack rolls and ability checks.",
  Prone: "Melee attacks against have advantage. Ranged attacks have disadvantage. Move costs doubled.",
  Restrained: "Speed 0. Attack rolls have disadvantage. Attacks against have advantage. Dex saves: disadvantage.",
  Stunned: "Incapacitated. Auto-fail Str/Dex saves. Attacks against have advantage.",
  Unconscious: "Incapacitated + prone. Auto-fail Str/Dex saves. Attacks within 5ft auto-crit.",
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
  useThemeTick();
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  type TempCombatant = { id: string; name: string; hp: number; ac: number };
  type EncounterState = { entityIds: string[]; temps: TempCombatant[] };

  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [tempCombatants, setTempCombatants] = useState<TempCombatant[]>([]);
  const [encounterEntityIds, setEncounterEntityIds] = useState<Set<string> | null>(null);
  const [sortByInit, setSortByInit] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const [conditionTarget, setConditionTarget] = useState<TrackerEntry | null>(null);
  const [descCondition, setDescCondition] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const [hideDead, setHideDead] = useState(true);
  const [activeTurnIndex, setActiveTurnIndex] = useState<number | null>(null);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(() => {
    // Load encounter filter if set
    let encounterIds: Set<string> | null = null;
    let temps: TempCombatant[] = [];
    const encounterRaw = getKv(`encounter_${campaignId}`);
    if (encounterRaw) {
      try {
        const enc = JSON.parse(encounterRaw) as EncounterState;
        if (enc.entityIds?.length > 0 || enc.temps?.length > 0) {
          encounterIds = new Set(enc.entityIds ?? []);
          temps = enc.temps ?? [];
        }
      } catch { /* ignore */ }
    }
    setEncounterEntityIds(encounterIds);
    setTempCombatants(temps);

    const entities = db
      .select()
      .from(schema.entities)
      .where(
        and(
          eq(schema.entities.campaignId, campaignId),
        ),
      )
      .all()
      .filter((e) => {
        const attrs = e.attrs as Attrs | null;
        if (!((e.kind === "npc" || e.kind === "pc") && attrs?.["hp"] != null)) return false;
        // If encounter filter active, only show selected entities
        if (encounterIds !== null) return encounterIds.has(e.id);
        return true;
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
    setRound((r) => {
      const sign = delta > 0 ? "+" : "";
      const entry = newHp === 0
        ? `R${r}: ${entity.name} ☠ fell (${sign}${delta})`
        : `R${r}: ${entity.name} ${sign}${delta} HP → ${newHp}/${entity.maxHp}`;
      setCombatLog((log) => [entry, ...log].slice(0, 40));
      return r;
    });
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
          setActiveTurnIndex(null);
          setCombatLog([]);
          setKv(`tracker_round_${campaignId}`, "1");
        },
      },
    ]);
  };

  const setInitiative = (entity: TrackerEntry, value: number | null) => {
    const attrs: Attrs = { ...(entity.attrs as Attrs | null ?? {}) };
    if (value != null) attrs["initiative"] = value; else delete attrs["initiative"];
    db.update(schema.entities).set({ attrs }).where(eq(schema.entities.id, entity.id)).run();
    setEntries((prev) => prev.map((e) => e.id === entity.id ? { ...e, initiative: value } : e));
  };

  const rollAllInitiative = () => {
    const updMap = new Map<string, number>();
    entries.forEach((e) => {
      const roll = Math.floor(Math.random() * 20) + 1;
      updMap.set(e.id, roll);
      const attrs: Attrs = { ...(e.attrs as Attrs | null ?? {}), initiative: roll };
      db.update(schema.entities).set({ attrs }).where(eq(schema.entities.id, e.id)).run();
    });
    setEntries((prev) => prev.map((e) => ({ ...e, initiative: updMap.get(e.id) ?? e.initiative })));
    setSortByInit(true);
  };

  const visible = hideDead
    ? entries.filter((e) => {
        const st = (e.attrs as Attrs | null)?.["npcStatus"];
        return st !== "dead";
      })
    : entries;

  const sorted = sortByInit
    ? [...visible].sort((a, b) => (b.initiative ?? -1) - (a.initiative ?? -1))
    : visible;

  const deadCount = entries.length - visible.length;

  const advanceTurn = () => {
    if (sorted.length === 0) return;
    if (activeTurnIndex === null) {
      setActiveTurnIndex(0);
    } else {
      const next = activeTurnIndex + 1;
      if (next >= sorted.length) {
        // New round
        setActiveTurnIndex(0);
        changeRound(1);
      } else {
        setActiveTurnIndex(next);
      }
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: encounterEntityIds !== null ? "Encounter" : "Combat Tracker",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                onPress={() => router.push(`/campaign/${campaignId}/encounter` as Parameters<typeof router.push>[0])}
                style={{ marginRight: 14 }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: encounterEntityIds !== null ? color.oxblood : withAlpha("gold", 0x80 / 255) }}>
                  {encounterEntityIds !== null ? "⚔ Enc" : "⚔"}
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowDice(true)} style={{ marginRight: 14 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.gold }}>Dice</Text>
              </Pressable>
              <Pressable onPress={() => router.push(`/campaign/${campaignId}/reference` as Parameters<typeof router.push>[0])} style={{ marginRight: 14 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.gold }}>Ref</Text>
              </Pressable>
              <Pressable onPress={resetAll} style={{ marginRight: 8 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.gold }}>Reset</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        {entries.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.ink, marginBottom: 8, textAlign: "center" }}>
              No Combatants
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.inkFaint, textAlign: "center", lineHeight: 20 }}>
              Add HP to NPC or PC entities to track them here. Edit any character and fill in their HP stat.
            </Text>
            <Pressable
              onPress={() => router.push(`/campaign/${campaignId}/entity/new/edit` as Parameters<typeof router.push>[0])}
              style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255), borderRadius: 2 }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.gold, textTransform: "uppercase", letterSpacing: 1 }}>
                Add Entity
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Round counter + sort toggle */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: withAlpha("gold", 0x15 / 255) }}>
              {/* Round counter row */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: withAlpha("oxblood", 0x20 / 255), backgroundColor: withAlpha("oxblood", 0x06 / 255) }}>
                <Pressable onPress={() => changeRound(-1)} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 18, color: color.oxblood }}>−</Text>
                </Pressable>
                <View style={{ alignItems: "center", minWidth: 80 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: withAlpha("oxblood", 0x70 / 255), textTransform: "uppercase", letterSpacing: 1.5 }}>Round</Text>
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: color.oxblood, lineHeight: 34 }}>{round}</Text>
                </View>
                <Pressable onPress={() => changeRound(1)} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 18, color: color.oxblood }}>+</Text>
                </Pressable>
              </View>
              {/* Turn order bar */}
              <Pressable
                onPress={advanceTurn}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  backgroundColor: activeTurnIndex !== null ? withAlpha("oxblood", 0x15 / 255) : "transparent",
                  borderBottomWidth: 0.5,
                  borderBottomColor: withAlpha("oxblood", 0x20 / 255),
                }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: withAlpha("oxblood", 0x90 / 255), textTransform: "uppercase", letterSpacing: 1.2, flex: 1 }}>
                  {activeTurnIndex === null
                    ? "Tap to start turn order"
                    : `Turn: ${sorted[activeTurnIndex]?.name ?? "—"}`}
                </Text>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.oxblood }}>
                  {activeTurnIndex === null ? "▶ Start" : `Next ▶`}
                </Text>
              </Pressable>
              {/* Sort + count row */}
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.inkFaint, flex: 1 }}>
                  {sorted.length} combatant{sorted.length !== 1 ? "s" : ""}{deadCount > 0 ? ` · ${deadCount} dead` : ""}
                </Text>
                {deadCount > 0 && (
                  <Pressable
                    onPress={() => setHideDead((v) => !v)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
                      borderColor: hideDead ? color.oxblood : withAlpha("oxblood", 0x40 / 255),
                      borderRadius: 10,
                      backgroundColor: hideDead ? withAlpha("oxblood", 0x12 / 255) : "transparent",
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: color.oxblood }}>
                      {hideDead ? "☠ Hidden" : "Show Dead"}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={rollAllInitiative}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: withAlpha("purpleDeep", 0x40 / 255),
                    borderRadius: 10,
                    backgroundColor: "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: color.purpleDeep }}>⚄ Roll All</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSortByInit((v) => !v)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: sortByInit ? color.gold : withAlpha("gold", 0x40 / 255),
                    borderRadius: 10,
                    backgroundColor: sortByInit ? withAlpha("gold", 0x15 / 255) : "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: color.gold }}>
                    {sortByInit ? "Initiative Order" : "Sort by Init"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <FlatList
              data={sorted}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item, index }) => <CombatantRow entry={item} isActive={activeTurnIndex === index} onAdjust={adjustHp} onSetHp={setHpDirect} onSetInitiative={(v) => setInitiative(item, v)} onNavigate={() => router.push(`/campaign/${campaignId}/entity/${item.id}`)} onOpenConditions={() => setConditionTarget(item)} onToggleCondition={(c) => toggleCondition(item, c)} />}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListFooterComponent={(
                <>
                  {tempCombatants.length > 0 && (
                    <View style={{ paddingTop: 12 }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: color.oxblood, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 }}>
                        Temporary
                      </Text>
                      {tempCombatants.map((t) => (
                        <TempCombatantRow
                          key={t.id}
                          combatant={t}
                          onAdjust={(delta) => {
                            const newHp = Math.max(0, t.hp + delta);
                            const sign = delta > 0 ? "+" : "";
                            const logEntry = newHp === 0
                              ? `R${round}: ${t.name} ☠ fell (${sign}${delta})`
                              : `R${round}: ${t.name} ${sign}${delta} HP → ${newHp}`;
                            setCombatLog((log) => [logEntry, ...log].slice(0, 40));
                            setTempCombatants((prev) =>
                              prev.map((c) => c.id === t.id ? { ...c, hp: newHp } : c)
                            );
                          }}
                        />
                      ))}
                    </View>
                  )}

                  {/* Combat Log */}
                  {combatLog.length > 0 && (
                    <View style={{ paddingTop: 16, paddingHorizontal: 4 }}>
                      <Pressable
                        onPress={() => setShowLog((v) => !v)}
                        style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}
                      >
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: withAlpha("inkSoft", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                          {showLog ? "▼" : "▶"} Combat Log ({combatLog.length})
                        </Text>
                        {showLog && (
                          <Pressable onPress={() => setCombatLog([])}>
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("oxblood", 0x70 / 255) }}>Clear</Text>
                          </Pressable>
                        )}
                      </Pressable>
                      {showLog && combatLog.map((entry, i) => (
                        <Text key={i} style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: entry.includes("☠") ? color.oxblood : color.inkSoft, lineHeight: 18, paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: withAlpha("gold", 0x08 / 255) }}>
                          {entry}
                        </Text>
                      ))}
                    </View>
                  )}
                </>
              )}
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
          <Pressable onPress={() => {}} style={{ backgroundColor: color.parchment, borderRadius: 4, borderWidth: 1, borderColor: withAlpha("gold", 0x30 / 255), padding: 20 }}>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: color.ink, marginBottom: 4 }}>
              {conditionTarget?.name}
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.inkFaint, marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
              Conditions — tap to toggle
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 240 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CONDITIONS.map((c) => {
                  const active = conditionTarget?.conditions.includes(c) ?? false;
                  const condColor = CONDITION_COLORS[c] ?? color.inkSoft;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => conditionTarget && toggleCondition(conditionTarget, c)}
                      onLongPress={() => setDescCondition(descCondition === c ? null : c)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 2,
                        borderWidth: 1,
                        borderColor: active ? condColor : withAlpha("gold", 0x30 / 255),
                        backgroundColor: active ? `${condColor}20` : "transparent",
                      }}
                    >
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: active ? condColor : color.inkSoft }}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            {descCondition && CONDITION_DESC[descCondition] ? (
              <View style={{ marginTop: 12, padding: 10, backgroundColor: withAlpha("gold", 0x08 / 255), borderRadius: 2, borderWidth: 1, borderColor: withAlpha("gold", 0x20 / 255) }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{descCondition}</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.ink, lineHeight: 18 }}>{CONDITION_DESC[descCondition]}</Text>
              </View>
            ) : (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkFaint", 0x60 / 255), textAlign: "center", marginTop: 8 }}>Long press a condition for details</Text>
            )}
            <Pressable onPress={() => { setConditionTarget(null); setDescCondition(null); }} style={{ marginTop: 12, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: color.gold, textTransform: "uppercase", letterSpacing: 1 }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function CombatantRow({
  entry,
  isActive,
  onAdjust,
  onSetHp,
  onSetInitiative,
  onNavigate,
  onOpenConditions,
  onToggleCondition,
}: {
  entry: TrackerEntry;
  isActive: boolean;
  onAdjust: (e: TrackerEntry, delta: number) => void;
  onSetHp: (e: TrackerEntry, v: string) => void;
  onSetInitiative: (v: number | null) => void;
  onNavigate: () => void;
  onOpenConditions: () => void;
  onToggleCondition: (condition: string) => void;
}) {
  const [editingInit, setEditingInit] = useState(false);
  const [initInput, setInitInput] = useState("");
  const pct = entry.maxHp > 0 ? entry.currentHp / entry.maxHp : 1;
  const barColor = pct > 0.5 ? color.green : pct > 0.25 ? color.gold : color.oxblood;
  const isDead = entry.currentHp === 0;

  const confirmInit = () => {
    const v = parseInt(initInput, 10);
    onSetInitiative(isNaN(v) ? null : v);
    setEditingInit(false);
  };

  return (
    <View
      style={{
        backgroundColor: isActive ? withAlpha("oxblood", 0x12 / 255) : isDead ? withAlpha("oxblood", 0x08 / 255) : color.parchment,
        borderWidth: isActive ? 2 : 1,
        borderColor: isActive ? color.oxblood : isDead ? withAlpha("oxblood", 0x30 / 255) : withAlpha("gold", 0x20 / 255),
        borderRadius: 4,
        padding: 12,
        opacity: isDead ? 0.7 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        {/* Name + kind */}
        <Pressable style={{ flex: 1 }} onPress={onNavigate}>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 17, color: isDead ? color.inkFaint : isActive ? color.oxblood : color.ink }}>
            {isActive ? "▶ " : ""}{entry.name}
            {isDead ? " ✝" : ""}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: color.inkFaint, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {entry.kind}{entry.ac > 0 ? ` · AC ${entry.ac}` : ""}{" · "}
            </Text>
            {editingInit ? (
              <TextInput
                value={initInput}
                onChangeText={setInitInput}
                onBlur={confirmInit}
                onSubmitEditing={confirmInit}
                keyboardType="number-pad"
                selectTextOnFocus
                autoFocus
                style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: color.gold, width: 36, padding: 0 }}
              />
            ) : (
              <Pressable onPress={() => { setInitInput(entry.initiative != null ? String(entry.initiative) : ""); setEditingInit(true); }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: entry.initiative != null ? color.gold : withAlpha("inkFaint", 0x50 / 255), textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {entry.initiative != null ? `Init ${entry.initiative}` : "Init —"}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>

        {/* HP controls */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => onAdjust(entry, -1)}
            onLongPress={() => onAdjust(entry, -5)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha("oxblood", 0x15 / 255), borderWidth: 1, borderColor: withAlpha("oxblood", 0x30 / 255), alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: color.oxblood, fontSize: 20, lineHeight: 22 }}>−</Text>
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
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha("green", 0x15 / 255), borderWidth: 1, borderColor: withAlpha("green", 0x30 / 255), alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: color.green, fontSize: 20, lineHeight: 22 }}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* HP bar */}
      <View style={{ height: 3, backgroundColor: withAlpha("gold", 0x15 / 255), borderRadius: 2 }}>
        <View style={{ height: 3, width: `${Math.round(pct * 100)}%`, backgroundColor: barColor, borderRadius: 2 }} />
      </View>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: color.inkFaint, textAlign: "right", marginTop: 2 }}>
        {entry.currentHp} / {entry.maxHp} HP
      </Text>

      {/* Conditions row */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8, alignItems: "center" }}>
        {entry.conditions.map((c) => {
          const condColor = CONDITION_COLORS[c] ?? color.inkSoft;
          return (
            <Pressable
              key={c}
              onPress={() => onToggleCondition(c)}
              style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: condColor, backgroundColor: `${condColor}18` }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: condColor }}>{c}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onOpenConditions}
          style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255), backgroundColor: "transparent" }}
        >
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: withAlpha("gold", 0x80 / 255) }}>
            {entry.conditions.length === 0 ? "+ Condition" : "+"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TempCombatantRow({ combatant, onAdjust }: { combatant: { id: string; name: string; hp: number; ac: number }; onAdjust: (delta: number) => void }) {
  const maxHp = combatant.hp;
  const pct = maxHp > 0 ? combatant.hp / maxHp : 1;
  const barColor = pct > 0.5 ? color.green : pct > 0.25 ? color.gold : color.oxblood;
  const isDead = combatant.hp <= 0;

  return (
    <View
      style={{
        backgroundColor: isDead ? withAlpha("oxblood", 0x08 / 255) : color.parchment,
        borderWidth: 1,
        borderColor: withAlpha("oxblood", 0x30 / 255),
        borderRadius: 4,
        padding: 12,
        marginBottom: 8,
        opacity: isDead ? 0.7 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 17, color: isDead ? color.inkFaint : color.ink }}>
            {combatant.name}{isDead ? " ✝" : ""}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: color.inkFaint, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Temp{combatant.ac > 0 ? ` · AC ${combatant.ac}` : ""}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => onAdjust(-1)}
            onLongPress={() => onAdjust(-5)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha("oxblood", 0x15 / 255), borderWidth: 1, borderColor: withAlpha("oxblood", 0x30 / 255), alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: color.oxblood, fontSize: 20, lineHeight: 22 }}>−</Text>
          </Pressable>
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: barColor, textAlign: "center", width: 52, marginHorizontal: 6 }}>
            {combatant.hp}
          </Text>
          <Pressable
            onPress={() => onAdjust(1)}
            onLongPress={() => onAdjust(5)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha("green", 0x15 / 255), borderWidth: 1, borderColor: withAlpha("green", 0x30 / 255), alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: color.green, fontSize: 20, lineHeight: 22 }}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
