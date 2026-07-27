import { View, Text, Pressable, ScrollView, TextInput, Modal, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db, getKv, setKv } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";
import { color, withAlpha } from "@/lib/theme";

type Entity = typeof schema.entities.$inferSelect;
type Attrs = Record<string, unknown>;

type PCEntry = Entity & {
  level: string | null;
  xp: string | null;
  maxXp: string | null;
  hp: number | null;
  currentHp: number | null;
  ac: number | null;
  role: string | null;
  passportName: string | null;
  conditions: string[];
  items: { id: string; name: string }[];
  resources: { name: string; max: number; current: number }[];
  npcStatus: string | null;
};

type Bond = { id: string; from: string; to: string; note: string };

function bondsKey(campaignId: string) { return `bonds_${campaignId}`; }
function loadBonds(campaignId: string): Bond[] {
  try { return JSON.parse(getKv(bondsKey(campaignId)) ?? "[]") as Bond[]; } catch { return []; }
}

export default function PartyScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [party, setParty] = useState<PCEntry[]>([]);
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [showBondModal, setShowBondModal] = useState(false);
  const [bondFrom, setBondFrom] = useState("");
  const [bondTo, setBondTo] = useState("");
  const [bondNote, setBondNote] = useState("");

  const load = useCallback(() => {
    const pcs = db.select().from(schema.entities)
      .where(and(eq(schema.entities.campaignId, campaignId), eq(schema.entities.kind, "pc")))
      .all()
      .sort((a, b) => a.name.localeCompare(b.name));

    const allItems = db.select().from(schema.entities)
      .where(and(eq(schema.entities.campaignId, campaignId), eq(schema.entities.kind, "item")))
      .all();

    const enriched: PCEntry[] = pcs.map((pc) => {
      const attrs = pc.attrs as Attrs | null;
      const hp = attrs?.["hp"] != null ? Number(attrs["hp"]) : null;
      const currentHp = attrs?.["currentHp"] != null ? Number(attrs["currentHp"]) : null;
      const passportName = pc.characterProfileId
        ? (db.select({ name: schema.characterProfiles.name }).from(schema.characterProfiles).where(eq(schema.characterProfiles.id, pc.characterProfileId)).get()?.name ?? null)
        : null;
      const inventory = allItems.filter((i) => (i.attrs as Attrs | null)?.["heldBy"] === pc.id).map((i) => ({ id: i.id, name: i.name }));
      const conditions = Array.isArray(attrs?.["conditions"]) ? attrs["conditions"] as string[] : [];
      const resources = Array.isArray(attrs?.["resources"])
        ? (attrs["resources"] as { name: string; max: number; current: number }[])
        : [];
      return {
        ...pc,
        level: attrs?.["level"] != null ? String(attrs["level"]) : null,
        xp: attrs?.["xp"] != null ? String(attrs["xp"]) : null,
        maxXp: attrs?.["maxXp"] != null ? String(attrs["maxXp"]) : null,
        hp,
        currentHp,
        ac: attrs?.["ac"] != null ? Number(attrs["ac"]) : null,
        role: attrs?.["role"] != null ? String(attrs["role"]) : null,
        passportName,
        conditions,
        items: inventory,
        resources,
        npcStatus: attrs?.["npcStatus"] != null ? String(attrs["npcStatus"]) : null,
      };
    });
    setParty(enriched);
    setBonds(loadBonds(campaignId));
  }, [campaignId]);

  useFocusEffect(load);

  const addBond = () => {
    const note = bondNote.trim();
    const from = bondFrom.trim();
    const to = bondTo.trim();
    if (!note || !from || !to) return;
    const next = [...bonds, { id: newId(), from, to, note }];
    setBonds(next);
    setKv(bondsKey(campaignId), JSON.stringify(next));
    setBondFrom(""); setBondTo(""); setBondNote("");
    setShowBondModal(false);
  };

  const deleteBond = (id: string) => {
    Alert.alert("Delete Bond?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        const next = bonds.filter((b) => b.id !== id);
        setBonds(next);
        setKv(bondsKey(campaignId), JSON.stringify(next));
      }},
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Party Overview" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20 }}
        >
          {party.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.ink, marginBottom: 8 }}>
                No Player Characters
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.inkFaint, textAlign: "center", lineHeight: 20, maxWidth: 260 }}>
                Add PC entities to this campaign to see the party overview here.
              </Text>
              <Pressable
                onPress={() => router.push(`/campaign/${campaignId}/entity/new/edit` as Parameters<typeof router.push>[0])}
                style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255), borderRadius: 2 }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.gold, textTransform: "uppercase", letterSpacing: 1 }}>
                  Add Character
                </Text>
              </Pressable>
            </View>
          ) : (
            party.map((pc, i) => {
              const hpCurrent = pc.currentHp ?? pc.hp;
              const hpMax = pc.hp;
              const hpPct = hpMax && hpMax > 0 && hpCurrent != null ? hpCurrent / hpMax : null;
              const hpColor = hpPct == null ? color.ink : hpPct === 0 ? color.oxblood : hpPct < 0.25 ? color.oxblood : hpPct < 0.5 ? color.gold : color.ink;

              return (
                <View key={pc.id}>
                  {i > 0 ? <GoldRule className="my-4" /> : null}
                  <Pressable
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${pc.id}`)}
                    style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.ink }}>
                        {pc.name}
                      </Text>
                      {pc.role || pc.passportName ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("inkSoft", 0x80 / 255), marginTop: 1 }}>
                          {pc.role ?? pc.passportName}
                        </Text>
                      ) : null}
                    </View>
                    {pc.level ? (
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("goldBright", 0x50 / 255), backgroundColor: withAlpha("goldBright", 0x10 / 255), marginLeft: 8 }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: color.goldBright }}>Lv {pc.level}</Text>
                      </View>
                    ) : null}
                    {pc.npcStatus === "dead" ? (
                      <View style={{ marginLeft: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 2, backgroundColor: withAlpha("oxblood", 0x10 / 255), borderWidth: 1, borderColor: withAlpha("oxblood", 0x40 / 255) }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: color.oxblood }}>☠ Dead</Text>
                      </View>
                    ) : pc.npcStatus === "missing" ? (
                      <View style={{ marginLeft: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 2, backgroundColor: withAlpha("gold", 0x10 / 255), borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255) }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: color.gold }}>? Missing</Text>
                      </View>
                    ) : null}
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("gold", 0x80 / 255), marginLeft: 8, paddingTop: 4 }}>›</Text>
                  </Pressable>

                  {/* Stat row: HP, AC */}
                  {(pc.hp != null || pc.ac != null) ? (
                    <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
                      {pc.hp != null ? (
                        <View style={{ alignItems: "center", minWidth: 52 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>HP</Text>
                          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: hpColor }}>
                            {hpCurrent ?? pc.hp}
                            {hpMax != null && hpCurrent !== hpMax ? (
                              <Text style={{ fontSize: 13, color: withAlpha("inkSoft", 0x60 / 255) }}>/{hpMax}</Text>
                            ) : null}
                          </Text>
                        </View>
                      ) : null}
                      {pc.ac != null ? (
                        <View style={{ alignItems: "center", minWidth: 36 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>AC</Text>
                          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: color.ink }}>{pc.ac}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* HP bar */}
                  {hpPct != null ? (
                    <View style={{ height: 3, backgroundColor: withAlpha("gold", 0x12 / 255), borderRadius: 2, marginBottom: 10 }}>
                      <View style={{ height: 3, backgroundColor: hpColor, borderRadius: 2, width: `${Math.round(hpPct * 100)}%` }} />
                    </View>
                  ) : null}

                  {/* XP bar */}
                  {pc.xp && pc.maxXp ? (
                    <View style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: withAlpha("goldBright", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1 }}>XP</Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkSoft", 0x60 / 255) }}>{pc.xp} / {pc.maxXp}</Text>
                      </View>
                      <View style={{ height: 3, backgroundColor: withAlpha("goldBright", 0x15 / 255), borderRadius: 2 }}>
                        <View style={{ height: 3, backgroundColor: color.goldBright, borderRadius: 2, width: `${Math.min(100, Math.round(Number(pc.xp) / Number(pc.maxXp) * 100))}%` }} />
                      </View>
                    </View>
                  ) : null}

                  {/* Active conditions */}
                  {pc.conditions.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {pc.conditions.map((c) => (
                        <View key={c} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("oxblood", 0x50 / 255), backgroundColor: withAlpha("oxblood", 0x10 / 255) }}>
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: color.oxblood }}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Inventory */}
                  {pc.items.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: pc.resources.length > 0 ? 10 : 0 }}>
                      {pc.items.map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => router.push(`/campaign/${campaignId}/entity/${item.id}`)}
                          style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("arcane", 0x30 / 255), backgroundColor: withAlpha("arcane", 0x08 / 255) }}
                        >
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.arcane }}>{item.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  {/* Resources */}
                  {pc.resources.length > 0 ? (
                    <View style={{ marginTop: pc.items.length > 0 ? 0 : 4 }}>
                      {pc.resources.map((res, ri) => {
                        const pct = res.max > 0 ? res.current / res.max : 0;
                        const barColor = res.current === 0 ? color.oxblood : res.current < res.max / 2 ? color.gold : color.success;
                        return (
                          <View key={ri} style={{ marginBottom: 6 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: color.inkSoft, flex: 1 }}>{res.name}</Text>
                              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 13, color: barColor }}>
                                {res.current}<Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkSoft", 0x50 / 255) }}>/{res.max}</Text>
                              </Text>
                            </View>
                            <View style={{ height: 3, backgroundColor: withAlpha("ink", 0x15 / 255), borderRadius: 2, overflow: "hidden" }}>
                              <View style={{ height: 3, backgroundColor: barColor, borderRadius: 2, width: `${Math.round(pct * 100)}%` as `${number}%` }} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {/* Party Bonds */}
          {party.length >= 2 && (
            <>
              <GoldRule className="my-4" />
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: color.gold, textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                  Party Bonds
                </Text>
                <Pressable onPress={() => setShowBondModal(true)}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.gold }}>+ Add</Text>
                </Pressable>
              </View>
              {bonds.length === 0 ? (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: withAlpha("inkFaint", 0x80 / 255), fontStyle: "italic" }}>
                  Record inter-party relationships and history here.
                </Text>
              ) : (
                bonds.map((b) => (
                  <Pressable key={b.id} onLongPress={() => deleteBond(b.id)} style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: withAlpha("gold", 0x12 / 255) }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
                      {b.from} → {b.to}
                    </Text>
                    <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 15, color: withAlpha("ink", 0xCC / 255), lineHeight: 22 }}>{b.note}</Text>
                  </Pressable>
                ))
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Add Bond Modal */}
        <Modal visible={showBondModal} transparent animationType="fade" onRequestClose={() => setShowBondModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: withAlpha("shadow", 0x60 / 255), justifyContent: "center", alignItems: "center" }} onPress={() => setShowBondModal(false)}>
            <Pressable style={{ width: "88%", backgroundColor: color.parchment, borderRadius: 4, padding: 20, borderWidth: 1, borderColor: withAlpha("goldBright", 0x30 / 255) }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: color.ink, marginBottom: 14 }}>Add Party Bond</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>From</Text>
              <TextInput
                value={bondFrom}
                onChangeText={setBondFrom}
                placeholder={party[0]?.name ?? "PC name…"}
                placeholderTextColor={withAlpha("inkFaint", 0x60 / 255)}
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, borderBottomWidth: 1, borderBottomColor: withAlpha("gold", 0x20 / 255), paddingBottom: 6, marginBottom: 12 }}
              />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>To</Text>
              <TextInput
                value={bondTo}
                onChangeText={setBondTo}
                placeholder={party[1]?.name ?? "PC name…"}
                placeholderTextColor={withAlpha("inkFaint", 0x60 / 255)}
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, borderBottomWidth: 1, borderBottomColor: withAlpha("gold", 0x20 / 255), paddingBottom: 6, marginBottom: 12 }}
              />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Relationship Note</Text>
              <TextInput
                value={bondNote}
                onChangeText={setBondNote}
                placeholder="They grew up in the same village…"
                placeholderTextColor={withAlpha("inkFaint", 0x60 / 255)}
                multiline
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, borderWidth: 1, borderColor: withAlpha("gold", 0x20 / 255), borderRadius: 2, padding: 10, minHeight: 60, textAlignVertical: "top", marginBottom: 16 }}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable onPress={() => setShowBondModal(false)} style={{ flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: withAlpha("gold", 0x20 / 255), borderRadius: 2, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.inkFaint }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={addBond} style={{ flex: 1, paddingVertical: 10, backgroundColor: color.oxblood, borderRadius: 2, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.parchment }}>Save Bond</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </ParchmentScreen>
    </>
  );
}
