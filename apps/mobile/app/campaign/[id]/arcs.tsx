import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { schema } from "@grimoire/core";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

type Campaign = typeof schema.campaigns.$inferSelect;
type CampaignArc = { id: string; name: string };
type CampaignSettings = { arcs?: CampaignArc[] } & Record<string, unknown>;

export default function ArcsScreen() {
  useThemeTick();
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [arcs, setArcs] = useState<CampaignArc[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");

  useFocusEffect(
    useCallback(() => {
      const c = db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaignId))
        .get();
      if (c) {
        setCampaign(c);
        setArcs(((c.settings as CampaignSettings)?.arcs ?? []) as CampaignArc[]);
      }
    }, [campaignId]),
  );

  const save = (newArcs: CampaignArc[]) => {
    if (!campaign) return;
    const existing = (campaign.settings ?? {}) as CampaignSettings;
    db.update(schema.campaigns)
      .set({ settings: { ...existing, arcs: newArcs } })
      .where(eq(schema.campaigns.id, campaignId))
      .run();
    setArcs(newArcs);
    setCampaign({ ...campaign, settings: { ...existing, arcs: newArcs } });
  };

  const addArc = () => {
    const name = input.trim();
    if (!name) return;
    const next: CampaignArc[] = [...arcs, { id: newId(), name }];
    save(next);
    setInput("");
  };

  const deleteArc = (arcId: string) => {
    Alert.alert(
      "Delete Arc",
      "Sessions assigned to this arc will become unassigned, but won't be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => save(arcs.filter((a) => a.id !== arcId)),
        },
      ],
    );
  };

  const startEdit = (arc: CampaignArc) => {
    setEditingId(arc.id);
    setEditInput(arc.name);
  };

  const commitEdit = (arcId: string) => {
    const name = editInput.trim();
    if (name) {
      save(arcs.map((a) => (a.id === arcId ? { ...a, name } : a)));
    }
    setEditingId(null);
    setEditInput("");
  };

  return (
    <>
      <Stack.Screen options={{ title: "Story Arcs" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

          <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 14, color: withAlpha("inkSoft", 0x80 / 255), fontStyle: "italic", marginBottom: 20, lineHeight: 20 }}>
            Group your sessions into story arcs or chapters. Assign an arc when editing a session.
          </Text>

          {/* Add */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={addArc}
              placeholder="New arc name…"
              placeholderTextColor={withAlpha("ink", 0x40 / 255)}
              returnKeyType="done"
              style={{
                flex: 1,
                fontFamily: "CormorantGaramond_600SemiBold",
                fontSize: 17,
                color: color.ink,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha("gold", 0x40 / 255),
                paddingBottom: 6,
              }}
            />
            <Pressable
              onPress={addArc}
              style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: color.oxblood, borderRadius: 2 }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.onAccent }}>Add</Text>
            </Pressable>
          </View>

          {arcs.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 16, color: withAlpha("inkSoft", 0x50 / 255), fontStyle: "italic" }}>
                No arcs yet.
              </Text>
            </View>
          ) : (
            <>
              <GoldRule />
              {arcs.map((arc, idx) => (
                <View
                  key={arc.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 0.5,
                    borderBottomColor: withAlpha("gold", 0x15 / 255),
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: withAlpha("gold", 0x60 / 255), marginRight: 12, width: 20, textAlign: "right" }}>
                    {idx + 1}
                  </Text>
                  {editingId === arc.id ? (
                    <TextInput
                      value={editInput}
                      onChangeText={setEditInput}
                      onBlur={() => commitEdit(arc.id)}
                      onSubmitEditing={() => commitEdit(arc.id)}
                      autoFocus
                      style={{
                        flex: 1,
                        fontFamily: "CormorantGaramond_600SemiBold",
                        fontSize: 17,
                        color: color.ink,
                        borderBottomWidth: 1,
                        borderBottomColor: withAlpha("gold", 0x40 / 255),
                      }}
                    />
                  ) : (
                    <Pressable onPress={() => startEdit(arc)} style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 17, color: color.ink }}>
                        {arc.name}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => deleteArc(arc.id)}
                    style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: withAlpha("oxblood", 0x50 / 255) }}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
