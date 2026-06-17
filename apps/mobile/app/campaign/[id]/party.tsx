import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

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

export default function PartyScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [party, setParty] = useState<PCEntry[]>([]);

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
  }, [campaignId]);

  useFocusEffect(load);

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
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014", marginBottom: 8 }}>
                No Player Characters
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", textAlign: "center", lineHeight: 20, maxWidth: 260 }}>
                Add PC entities to this campaign to see the party overview here.
              </Text>
              <Pressable
                onPress={() => router.push(`/campaign/${campaignId}/entity/new/edit` as Parameters<typeof router.push>[0])}
                style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2 }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
                  Add Character
                </Text>
              </Pressable>
            </View>
          ) : (
            party.map((pc, i) => {
              const hpCurrent = pc.currentHp ?? pc.hp;
              const hpMax = pc.hp;
              const hpPct = hpMax && hpMax > 0 && hpCurrent != null ? hpCurrent / hpMax : null;
              const hpColor = hpPct == null ? "#2C2014" : hpPct === 0 ? "#7A2418" : hpPct < 0.25 ? "#7A2418" : hpPct < 0.5 ? "#A07A2C" : "#2C2014";

              return (
                <View key={pc.id}>
                  {i > 0 ? <GoldRule className="my-4" /> : null}
                  <Pressable
                    onPress={() => router.push(`/campaign/${campaignId}/entity/${pc.id}`)}
                    style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014" }}>
                        {pc.name}
                      </Text>
                      {pc.role || pc.passportName ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E80", marginTop: 1 }}>
                          {pc.role ?? pc.passportName}
                        </Text>
                      ) : null}
                    </View>
                    {pc.level ? (
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: "#C9A24A50", backgroundColor: "#C9A24A10", marginLeft: 8 }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#C9A24A" }}>Lv {pc.level}</Text>
                      </View>
                    ) : null}
                    {pc.npcStatus === "dead" ? (
                      <View style={{ marginLeft: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 2, backgroundColor: "#7A241810", borderWidth: 1, borderColor: "#7A241840" }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#7A2418" }}>☠ Dead</Text>
                      </View>
                    ) : pc.npcStatus === "missing" ? (
                      <View style={{ marginLeft: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 2, backgroundColor: "#A07A2C10", borderWidth: 1, borderColor: "#A07A2C40" }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#A07A2C" }}>? Missing</Text>
                      </View>
                    ) : null}
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#A07A2C80", marginLeft: 8, paddingTop: 4 }}>›</Text>
                  </Pressable>

                  {/* Stat row: HP, AC */}
                  {(pc.hp != null || pc.ac != null) ? (
                    <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
                      {pc.hp != null ? (
                        <View style={{ alignItems: "center", minWidth: 52 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>HP</Text>
                          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: hpColor }}>
                            {hpCurrent ?? pc.hp}
                            {hpMax != null && hpCurrent !== hpMax ? (
                              <Text style={{ fontSize: 13, color: "#5A4D3E60" }}>/{hpMax}</Text>
                            ) : null}
                          </Text>
                        </View>
                      ) : null}
                      {pc.ac != null ? (
                        <View style={{ alignItems: "center", minWidth: 36 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>AC</Text>
                          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: "#2C2014" }}>{pc.ac}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* HP bar */}
                  {hpPct != null ? (
                    <View style={{ height: 3, backgroundColor: "#A07A2C12", borderRadius: 2, marginBottom: 10 }}>
                      <View style={{ height: 3, backgroundColor: hpColor, borderRadius: 2, width: `${Math.round(hpPct * 100)}%` }} />
                    </View>
                  ) : null}

                  {/* XP bar */}
                  {pc.xp && pc.maxXp ? (
                    <View style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#C9A24A80", textTransform: "uppercase", letterSpacing: 1 }}>XP</Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E60" }}>{pc.xp} / {pc.maxXp}</Text>
                      </View>
                      <View style={{ height: 3, backgroundColor: "#C9A24A15", borderRadius: 2 }}>
                        <View style={{ height: 3, backgroundColor: "#C9A24A", borderRadius: 2, width: `${Math.min(100, Math.round(Number(pc.xp) / Number(pc.maxXp) * 100))}%` }} />
                      </View>
                    </View>
                  ) : null}

                  {/* Active conditions */}
                  {pc.conditions.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {pc.conditions.map((c) => (
                        <View key={c} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: "#7A241850", backgroundColor: "#7A241810" }}>
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#7A2418" }}>{c}</Text>
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
                          style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1, borderColor: "#6A5ACD30", backgroundColor: "#6A5ACD08" }}
                        >
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#6A5ACD" }}>{item.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  {/* Resources */}
                  {pc.resources.length > 0 ? (
                    <View style={{ marginTop: pc.items.length > 0 ? 0 : 4 }}>
                      {pc.resources.map((res, ri) => {
                        const pct = res.max > 0 ? res.current / res.max : 0;
                        const barColor = res.current === 0 ? "#7A2418" : res.current < res.max / 2 ? "#A07A2C" : "#4A8060";
                        return (
                          <View key={ri} style={{ marginBottom: 6 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#5A4D3E", flex: 1 }}>{res.name}</Text>
                              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 13, color: barColor }}>
                                {res.current}<Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E50" }}>/{res.max}</Text>
                              </Text>
                            </View>
                            <View style={{ height: 3, backgroundColor: "#2C201415", borderRadius: 2, overflow: "hidden" }}>
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

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
