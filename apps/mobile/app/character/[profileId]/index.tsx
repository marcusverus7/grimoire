import { View, Text, Pressable, ScrollView, Alert, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, desc } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";
import { richTextToMarkdown } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

type CharacterProfile = typeof schema.characterProfiles.$inferSelect;
type Journal = typeof schema.journals.$inferSelect;

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function journalPreview(body: unknown): string {
  if (!body) return "";
  try {
    return richTextToMarkdown(body as RichTextNode).replace(/#+\s*/g, "").slice(0, 120).trim();
  } catch {
    return "";
  }
}

export default function CharacterDetailScreen() {
  useThemeTick();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [linkedCampaigns, setLinkedCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [goalInput, setGoalInput] = useState("");

  const load = useCallback(() => {
    const p = db
      .select()
      .from(schema.characterProfiles)
      .where(eq(schema.characterProfiles.id, profileId))
      .get();
    setProfile(p ?? null);

    const jrnls = db
      .select()
      .from(schema.journals)
      .where(eq(schema.journals.characterProfileId, profileId))
      .orderBy(desc(schema.journals.createdAt))
      .all();
    setJournals(jrnls);

    const entities = db
      .select({ campaignId: schema.entities.campaignId })
      .from(schema.entities)
      .where(eq(schema.entities.characterProfileId, profileId))
      .all();
    const campaignIds = [...new Set(entities.map((e) => e.campaignId))];
    const campaigns = campaignIds
      .map((cid) =>
        db.select({ id: schema.campaigns.id, name: schema.campaigns.name })
          .from(schema.campaigns)
          .where(eq(schema.campaigns.id, cid))
          .get(),
      )
      .filter((c): c is { id: string; name: string } => c != null);
    setLinkedCampaigns(campaigns);
  }, [profileId]);

  useFocusEffect(load);

  if (!profile) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: withAlpha("inkSoft", 0x80 / 255) }}>Character not found</Text>
      </View>
    );
  }

  const attrs = (profile.attrs as Record<string, unknown> | null) ?? {};
  const goals = Array.isArray(attrs["goals"]) ? (attrs["goals"] as string[]) : [];

  const saveGoals = (updated: string[]) => {
    const next = { ...attrs, goals: updated };
    db.update(schema.characterProfiles).set({ attrs: next }).where(eq(schema.characterProfiles.id, profileId)).run();
    setProfile((prev) => prev ? { ...prev, attrs: next } : prev);
  };

  const addGoal = () => {
    const trimmed = goalInput.trim();
    if (!trimmed) return;
    saveGoals([...goals, trimmed]);
    setGoalInput("");
  };

  const deleteGoal = (idx: number) => {
    Alert.alert("Remove Goal", "Delete this goal?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => saveGoals(goals.filter((_, i) => i !== idx)) },
    ]);
  };
  const classParts = [attrs["race"] as string | undefined, attrs["class"] as string | undefined, attrs["level"] ? `Level ${String(attrs["level"])}` : ""]
    .filter(Boolean)
    .join(" · ");

  const handleDeleteJournal = (j: Journal) => {
    Alert.alert("Delete Entry", "Remove this journal entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          db.delete(schema.journals).where(eq(schema.journals.id, j.id)).run();
          load();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: profile.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/character/${profileId}/edit` as Parameters<typeof router.push>[0])}
              style={{ marginRight: 8 }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: color.gold }}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {/* Header */}
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: color.ink, marginBottom: 4 }}>
            {profile.name}
          </Text>
          {classParts ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.gold, marginBottom: 8 }}>
              {classParts}
            </Text>
          ) : null}
          {profile.summary ? (
            <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: color.inkSoft, lineHeight: 24, marginBottom: 12 }}>
              {profile.summary}
            </Text>
          ) : null}

          {/* Linked Campaigns */}
          {linkedCampaigns.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
                Playing In
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {linkedCampaigns.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/campaign/${c.id}` as Parameters<typeof router.push>[0])}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: withAlpha("gold", 0x30 / 255), borderRadius: 2, backgroundColor: withAlpha("gold", 0x08 / 255) }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.gold }}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* Goals */}
          <View style={{ marginTop: 16, marginBottom: 16 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: color.success, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
              Character Goals
            </Text>
            {goals.map((g, i) => (
              <Pressable
                key={i}
                onLongPress={() => deleteGoal(i)}
                style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: withAlpha("gold", 0x10 / 255) }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.success, marginRight: 8, marginTop: 1 }}>◇</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, flex: 1, lineHeight: 20 }}>{g}</Text>
              </Pressable>
            ))}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: goals.length > 0 ? 10 : 0 }}>
              <TextInput
                value={goalInput}
                onChangeText={setGoalInput}
                placeholder="Add a goal…"
                placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                onSubmitEditing={addGoal}
                returnKeyType="done"
                blurOnSubmit={false}
                style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, flex: 1, borderBottomWidth: 1, borderBottomColor: withAlpha("success", 0x30 / 255), paddingBottom: 4 }}
              />
              <Pressable onPress={addGoal} style={{ marginLeft: 8, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: withAlpha("success", 0x40 / 255), borderRadius: 2 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.success }}>Add</Text>
              </Pressable>
            </View>
            {goals.length > 0 && (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkFaint", 0x50 / 255), marginTop: 6 }}>Long press a goal to remove it</Text>
            )}
          </View>

          <GoldRule />

          {/* Journal */}
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: withAlpha("inkSoft", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1.5 }}>
                Journal
              </Text>
              <Pressable
                onPress={() => router.push(`/character/${profileId}/journal/new` as Parameters<typeof router.push>[0])}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.gold }}>+ New Entry</Text>
              </Pressable>
            </View>

            {journals.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: withAlpha("inkSoft", 0x60 / 255), textAlign: "center" }}>
                  No journal entries yet.{"\n"}Record your character's thoughts after each session.
                </Text>
                <Pressable
                  onPress={() => router.push(`/character/${profileId}/journal/new` as Parameters<typeof router.push>[0])}
                  style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderColor: withAlpha("gold", 0x30 / 255), borderRadius: 2 }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: color.gold, textTransform: "uppercase", letterSpacing: 1 }}>
                    Write First Entry
                  </Text>
                </Pressable>
              </View>
            ) : (
              journals.map((j, idx) => {
                const preview = journalPreview(j.body);
                return (
                  <View key={j.id}>
                    {idx > 0 ? <View style={{ height: 1, backgroundColor: withAlpha("gold", 0x15 / 255), marginVertical: 12 }} /> : null}
                    <Pressable
                      onPress={() => router.push(`/character/${profileId}/journal/${j.id}` as Parameters<typeof router.push>[0])}
                      onLongPress={() => handleDeleteJournal(j)}
                      style={{ paddingVertical: 4 }}
                    >
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("gold", 0x80 / 255), marginBottom: 4 }}>
                        {formatDate(j.createdAt)}
                      </Text>
                      {preview ? (
                        <Text
                          style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 15, color: color.ink, lineHeight: 22 }}
                          numberOfLines={3}
                        >
                          {preview}
                        </Text>
                      ) : (
                        <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: withAlpha("inkSoft", 0x60 / 255) }}>
                          (empty entry)
                        </Text>
                      )}
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkFaint", 0x40 / 255), marginTop: 4 }}>
                        Long press to delete
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
