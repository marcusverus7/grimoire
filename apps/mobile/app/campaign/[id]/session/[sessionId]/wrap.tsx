import { View, Text, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type Attrs = Record<string, unknown>;
type Resource = { name: string; max: number; current: number };

type PCEntry = {
  id: string;
  name: string;
  currentHp: string;
  maxHp: number | null;
  resources: Resource[];
};
type QuestEntry = { id: string; name: string; status: string };

export default function SessionWrapScreen() {
  const { id: campaignId, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const router = useRouter();
  const [pcs, setPcs] = useState<PCEntry[]>([]);
  const [quests, setQuests] = useState<QuestEntry[]>([]);
  const [xpGained, setXpGained] = useState("");
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  // resourceResets[pcId][resourceIndex] = true means reset that resource to max
  const [resourceResets, setResourceResets] = useState<Record<string, boolean[]>>({});

  const load = useCallback(() => {
    const session = db.select({ number: schema.sessions.number }).from(schema.sessions).where(eq(schema.sessions.id, sessionId)).get();
    setSessionNumber(session?.number ?? null);

    const pcEntities = db.select().from(schema.entities)
      .where(and(eq(schema.entities.campaignId, campaignId), eq(schema.entities.kind, "pc")))
      .all()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => {
        const attrs = e.attrs as Attrs | null;
        const maxHp = attrs?.["hp"] != null ? Number(attrs["hp"]) : null;
        const current = attrs?.["currentHp"] != null ? String(attrs["currentHp"]) : (maxHp != null ? String(maxHp) : "");
        const resources = Array.isArray(attrs?.["resources"])
          ? (attrs!["resources"] as Resource[])
          : [];
        return { id: e.id, name: e.name, currentHp: current, maxHp, resources };
      });
    setPcs(pcEntities);

    // Default all resources to "reset" (checked)
    const initial: Record<string, boolean[]> = {};
    for (const pc of pcEntities) {
      if (pc.resources.length > 0) {
        initial[pc.id] = pc.resources.map(() => true);
      }
    }
    setResourceResets(initial);

    const questEntities = db.select().from(schema.entities)
      .where(and(eq(schema.entities.campaignId, campaignId), eq(schema.entities.kind, "quest")))
      .all()
      .filter((q) => {
        const status = (q.attrs as Attrs | null)?.["questStatus"];
        return status === "active" || status === "rumoured";
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((q) => ({
        id: q.id,
        name: q.name,
        status: String((q.attrs as Attrs | null)?.["questStatus"] ?? "active"),
      }));
    setQuests(questEntities);
  }, [campaignId, sessionId]);

  useFocusEffect(load);

  const updatePcHp = (pcId: string, hp: string) => {
    setPcs((prev) => prev.map((p) => p.id === pcId ? { ...p, currentHp: hp } : p));
  };

  const updateQuestStatus = (questId: string, status: string) => {
    setQuests((prev) => prev.map((q) => q.id === questId ? { ...q, status } : q));
  };

  const toggleResourceReset = (pcId: string, idx: number) => {
    setResourceResets((prev) => {
      const arr = [...(prev[pcId] ?? [])];
      arr[idx] = !arr[idx];
      return { ...prev, [pcId]: arr };
    });
  };

  const pcsWithResources = pcs.filter((p) => p.resources.length > 0);

  const wrap = () => {
    const resetsDesc = pcsWithResources
      .map((pc) => {
        const resets = resourceResets[pc.id] ?? [];
        const names = pc.resources.filter((_, i) => resets[i]).map((r) => r.name);
        return names.length > 0 ? `${pc.name}: ${names.join(", ")}` : null;
      })
      .filter(Boolean);

    const resourceNote = resetsDesc.length > 0
      ? `\n\nResources restored:\n${resetsDesc.join("\n")}`
      : "";

    Alert.alert(
      "Wrap Session",
      `Save HP, quest changes, and XP, then mark session as played?${resourceNote}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Wrap Up",
          onPress: () => {
            // Save PC HP
            for (const pc of pcs) {
              const parsed = parseInt(pc.currentHp, 10);
              if (!isNaN(parsed)) {
                const e = db.select().from(schema.entities).where(eq(schema.entities.id, pc.id)).get();
                if (e) {
                  const attrs = { ...(e.attrs as Attrs | null ?? {}), currentHp: parsed };
                  db.update(schema.entities).set({ attrs, updatedAt: new Date() }).where(eq(schema.entities.id, pc.id)).run();
                }
              }
            }

            // Reset selected resources
            for (const pc of pcs) {
              if (pc.resources.length === 0) continue;
              const resets = resourceResets[pc.id] ?? [];
              if (!resets.some(Boolean)) continue;
              const e = db.select().from(schema.entities).where(eq(schema.entities.id, pc.id)).get();
              if (e) {
                const attrs = e.attrs as Attrs | null ?? {};
                const res = Array.isArray(attrs["resources"])
                  ? (attrs["resources"] as Resource[]).map((r, i) => resets[i] ? { ...r, current: r.max } : r)
                  : [];
                db.update(schema.entities).set({ attrs: { ...attrs, resources: res }, updatedAt: new Date() }).where(eq(schema.entities.id, pc.id)).run();
              }
            }

            // Save quest statuses
            for (const q of quests) {
              const e = db.select().from(schema.entities).where(eq(schema.entities.id, q.id)).get();
              if (e) {
                const attrs = { ...(e.attrs as Attrs | null ?? {}), questStatus: q.status };
                db.update(schema.entities).set({ attrs, updatedAt: new Date() }).where(eq(schema.entities.id, q.id)).run();
              }
            }

            // Apply XP to all PCs
            const xpNum = parseInt(xpGained, 10);
            if (!isNaN(xpNum) && xpNum > 0) {
              for (const pc of pcs) {
                const e = db.select().from(schema.entities).where(eq(schema.entities.id, pc.id)).get();
                if (e) {
                  const attrs = e.attrs as Attrs | null ?? {};
                  const current = attrs["xp"] != null ? Number(attrs["xp"]) : 0;
                  db.update(schema.entities).set({ attrs: { ...attrs, xp: String(current + xpNum) }, updatedAt: new Date() }).where(eq(schema.entities.id, pc.id)).run();
                }
              }
            }

            // Mark session played
            db.update(schema.sessions).set({ status: "played" }).where(eq(schema.sessions.id, sessionId)).run();

            router.replace(`/campaign/${campaignId}/session/${sessionId}` as Parameters<typeof router.replace>[0]);
          },
        },
      ],
    );
  };

  const QUEST_STATUSES = ["rumoured", "active", "complete", "failed"] as const;
  const STATUS_COLORS: Record<string, string> = { rumoured: "#5A4D3E", active: "#A07A2C", complete: "#4A8060", failed: "#7A2418" };

  return (
    <>
      <Stack.Screen options={{ title: sessionNumber != null ? `Wrap — Session ${sessionNumber}` : "Session Wrap" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: "#2C2014", marginBottom: 4 }}>
            End of Session
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", marginBottom: 20, lineHeight: 19 }}>
            Update HP, quest progress, and distribute XP before closing out.
          </Text>

          <GoldRule />

          {/* XP section */}
          <View style={{ marginTop: 16, marginBottom: 20 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#C9A24A", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
              XP Gained This Session
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TextInput
                value={xpGained}
                onChangeText={setXpGained}
                placeholder="0"
                placeholderTextColor="#2C201440"
                keyboardType="numeric"
                style={{
                  fontFamily: "CormorantGaramond_700Bold",
                  fontSize: 24,
                  color: "#C9A24A",
                  borderBottomWidth: 1,
                  borderBottomColor: "#C9A24A30",
                  paddingBottom: 4,
                  width: 80,
                  textAlign: "center",
                  marginRight: 12,
                }}
              />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#5A4D3E80" }}>
                XP → added to each PC
              </Text>
            </View>
          </View>

          {/* PC HP section */}
          {pcs.length > 0 ? (
            <>
              <GoldRule />
              <View style={{ marginTop: 16, marginBottom: 20 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
                  End-of-Session HP
                </Text>
                {pcs.map((pc) => {
                  const pct = pc.maxHp && pc.maxHp > 0 && pc.currentHp ? parseInt(pc.currentHp, 10) / pc.maxHp : null;
                  const barColor = pct == null ? "#A07A2C" : pct === 0 ? "#7A2418" : pct < 0.5 ? "#A07A2C" : "#4A8060";
                  return (
                    <View key={pc.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>{pc.name}</Text>
                      {pc.maxHp != null ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E60", marginRight: 8 }}>/ {pc.maxHp}</Text>
                      ) : null}
                      <TextInput
                        value={pc.currentHp}
                        onChangeText={(v) => updatePcHp(pc.id, v)}
                        keyboardType="numeric"
                        selectTextOnFocus
                        style={{
                          fontFamily: "CormorantGaramond_700Bold",
                          fontSize: 20,
                          color: barColor,
                          width: 56,
                          textAlign: "center",
                          borderBottomWidth: 1,
                          borderBottomColor: `${barColor}50`,
                          paddingBottom: 2,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* Resource reset section */}
          {pcsWithResources.length > 0 ? (
            <>
              <GoldRule />
              <View style={{ marginTop: 16, marginBottom: 20 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#6A5ACD", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
                  Resource Reset
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#8A7D6D", marginBottom: 12 }}>
                  Select resources to restore (e.g. long rest).
                </Text>
                {pcsWithResources.map((pc) => (
                  <View key={pc.id} style={{ marginBottom: 14 }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 14, color: "#2C2014", marginBottom: 8 }}>{pc.name}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {pc.resources.map((res, i) => {
                        const checked = resourceResets[pc.id]?.[i] ?? true;
                        return (
                          <Pressable
                            key={i}
                            onPress={() => toggleResourceReset(pc.id, i)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 2,
                              borderWidth: 1,
                              borderColor: checked ? "#6A5ACD60" : "#5A4D3E30",
                              backgroundColor: checked ? "#6A5ACD12" : "transparent",
                            }}
                          >
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: checked ? "#6A5ACD" : "#5A4D3E60", marginRight: 6 }}>
                              {checked ? "✓" : "○"}
                            </Text>
                            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: checked ? "#2C2014" : "#8A7D6D" }}>
                              {res.name}
                            </Text>
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E60", marginLeft: 4 }}>
                              → {res.max}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Quest progress section */}
          {quests.length > 0 ? (
            <>
              <GoldRule />
              <View style={{ marginTop: 16, marginBottom: 20 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#D4A843", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
                  Quest Progress
                </Text>
                {quests.map((q) => (
                  <View key={q.id} style={{ marginBottom: 14 }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", marginBottom: 8 }}>{q.name}</Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {QUEST_STATUSES.map((s) => {
                        const color = STATUS_COLORS[s] ?? "#5A4D3E";
                        const active = q.status === s;
                        return (
                          <Pressable
                            key={s}
                            onPress={() => updateQuestStatus(q.id, s)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 2,
                              borderWidth: 1,
                              borderColor: active ? color : `${color}40`,
                              backgroundColor: active ? `${color}15` : "transparent",
                            }}
                          >
                            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: active ? color : `${color}80`, textTransform: "capitalize" }}>
                              {s}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <GoldRule />

          {/* Wrap button */}
          <Pressable
            onPress={wrap}
            style={{
              marginTop: 20,
              backgroundColor: "#7A2418",
              borderWidth: 1,
              borderColor: "#C9A24A40",
              borderRadius: 2,
              paddingVertical: 16,
              alignItems: "center",
              marginBottom: 40,
            }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 2 }}>
              Wrap Session {sessionNumber}
            </Text>
          </Pressable>
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
