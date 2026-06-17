import { View, Text, Pressable, ScrollView, Alert } from "react-native";
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
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [linkedCampaigns, setLinkedCampaigns] = useState<{ id: string; name: string }[]>([]);

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
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#5A4D3E80" }}>Character not found</Text>
      </View>
    );
  }

  const attrs = (profile.attrs as Record<string, string> | null) ?? {};
  const classParts = [attrs["race"], attrs["class"], attrs["level"] ? `Level ${attrs["level"]}` : ""]
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
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#A07A2C" }}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {/* Header */}
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: "#2C2014", marginBottom: 4 }}>
            {profile.name}
          </Text>
          {classParts ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#A07A2C", marginBottom: 8 }}>
              {classParts}
            </Text>
          ) : null}
          {profile.summary ? (
            <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: "#5A4D3E", lineHeight: 24, marginBottom: 12 }}>
              {profile.summary}
            </Text>
          ) : null}

          {/* Linked Campaigns */}
          {linkedCampaigns.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
                Playing In
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {linkedCampaigns.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/campaign/${c.id}` as Parameters<typeof router.push>[0])}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#A07A2C30", borderRadius: 2, backgroundColor: "#A07A2C08" }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C" }}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <GoldRule />

          {/* Journal */}
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#5A4D3E80", textTransform: "uppercase", letterSpacing: 1.5 }}>
                Journal
              </Text>
              <Pressable
                onPress={() => router.push(`/character/${profileId}/journal/new` as Parameters<typeof router.push>[0])}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C" }}>+ New Entry</Text>
              </Pressable>
            </View>

            {journals.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: "#5A4D3E60", textAlign: "center" }}>
                  No journal entries yet.{"\n"}Record your character's thoughts after each session.
                </Text>
                <Pressable
                  onPress={() => router.push(`/character/${profileId}/journal/new` as Parameters<typeof router.push>[0])}
                  style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderColor: "#A07A2C30", borderRadius: 2 }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
                    Write First Entry
                  </Text>
                </Pressable>
              </View>
            ) : (
              journals.map((j, idx) => {
                const preview = journalPreview(j.body);
                return (
                  <View key={j.id}>
                    {idx > 0 ? <View style={{ height: 1, backgroundColor: "#A07A2C15", marginVertical: 12 }} /> : null}
                    <Pressable
                      onPress={() => router.push(`/character/${profileId}/journal/${j.id}` as Parameters<typeof router.push>[0])}
                      onLongPress={() => handleDeleteJournal(j)}
                      style={{ paddingVertical: 4 }}
                    >
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80", marginBottom: 4 }}>
                        {formatDate(j.createdAt)}
                      </Text>
                      {preview ? (
                        <Text
                          style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 15, color: "#2C2014", lineHeight: 22 }}
                          numberOfLines={3}
                        >
                          {preview}
                        </Text>
                      ) : (
                        <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#5A4D3E60" }}>
                          (empty entry)
                        </Text>
                      )}
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D40", marginTop: 4 }}>
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
