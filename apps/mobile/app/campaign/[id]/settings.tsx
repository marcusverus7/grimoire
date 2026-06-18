import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type Campaign = typeof schema.campaigns.$inferSelect;
type Status = "active" | "archived" | "ended";
type CampaignSettings = { notes?: string; nextSession?: string; logline?: string; coverImageUri?: string };

const STATUSES: Status[] = ["active", "archived", "ended"];

export default function CampaignSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [systemTag, setSystemTag] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [notes, setNotes] = useState("");
  const [nextSession, setNextSession] = useState("");
  const [logline, setLogline] = useState("");
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);

  useEffect(() => {
    const c = db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .get();
    if (c) {
      setCampaign(c);
      setName(c.name);
      setSystemTag(c.systemTag ?? "");
      setStatus(c.status as Status);
      const s = (c.settings ?? {}) as CampaignSettings;
      setNotes(s.notes ?? "");
      setNextSession(s.nextSession ?? "");
      setLogline(s.logline ?? "");
      setCoverImageUri(s.coverImageUri ?? null);
    }
  }, [id]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Your campaign needs a name.");
      return;
    }
    try {
      const existing = (campaign?.settings ?? {}) as CampaignSettings;
      db.update(schema.campaigns)
        .set({
          name: trimmed,
          systemTag: systemTag.trim() || null,
          status,
          settings: {
            ...existing,
            logline: logline.trim() || undefined,
            notes: notes.trim() || undefined,
            nextSession: nextSession.trim() || undefined,
            coverImageUri: coverImageUri ?? undefined,
          },
        })
        .where(eq(schema.campaigns.id, id))
        .run();
      router.back();
    } catch (e) {
      Alert.alert("Save Failed", e instanceof Error ? e.message : "An unexpected error occurred");
    }
  };

  const deleteCampaign = () => {
    Alert.alert(
      "Delete Campaign",
      "This will permanently delete the campaign and all its entities, sessions, and links. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => {
            try {
              // reveals → entities; recapEvents → recaps → sessions; delete in dependency order
              const entityIds = db.select({ id: schema.entities.id }).from(schema.entities).where(eq(schema.entities.campaignId, id)).all().map((e) => e.id);
              for (const eid of entityIds) {
                db.delete(schema.reveals).where(eq(schema.reveals.entityId, eid)).run();
              }
              const sessionIds = db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.campaignId, id)).all().map((s) => s.id);
              for (const sid of sessionIds) {
                const recapIds = db.select({ id: schema.recaps.id }).from(schema.recaps).where(eq(schema.recaps.sessionId, sid)).all().map((r) => r.id);
                for (const rid of recapIds) {
                  db.delete(schema.recapEvents).where(eq(schema.recapEvents.recapId, rid)).run();
                }
                db.delete(schema.recaps).where(eq(schema.recaps.sessionId, sid)).run();
              }
              db.delete(schema.entityLinks).where(eq(schema.entityLinks.campaignId, id)).run();
              db.delete(schema.entities).where(eq(schema.entities.campaignId, id)).run();
              db.delete(schema.sessions).where(eq(schema.sessions.campaignId, id)).run();
              db.delete(schema.quotes).where(eq(schema.quotes.campaignId, id)).run();
              db.delete(schema.memberships).where(eq(schema.memberships.campaignId, id)).run();
              db.delete(schema.campaigns).where(eq(schema.campaigns.id, id)).run();
              router.replace("/");
            } catch (e) {
              Alert.alert("Delete Failed", e instanceof Error ? e.message : "An unexpected error occurred");
            }
          },
        },
      ],
    );
  };

  const pickCoverImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to set a campaign cover.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverImageUri(result.assets[0].uri);
    }
  };

  if (!campaign) return null;

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        className="flex-1 bg-parchment"
        contentContainerStyle={{ padding: 16 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover Image */}
        <Pressable onPress={pickCoverImage} style={{ marginBottom: 20, borderRadius: 4, overflow: "hidden" }}>
          {coverImageUri ? (
            <View>
              <Image
                source={{ uri: coverImageUri }}
                style={{ width: "100%", height: 120, borderRadius: 4 }}
                resizeMode="cover"
              />
              <View style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(26,20,16,0.7)", borderRadius: 3, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#FAF5EA" }}>Change cover</Text>
              </View>
            </View>
          ) : (
            <View style={{ height: 80, borderWidth: 1, borderStyle: "dashed", borderColor: "#A07A2C40", borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#ECE3CF30" }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#A07A2C80" }}>+ Add campaign cover image</Text>
            </View>
          )}
        </Pressable>
        {coverImageUri && (
          <Pressable onPress={() => setCoverImageUri(null)} style={{ marginTop: -14, marginBottom: 16, alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D" }}>Remove cover</Text>
          </Pressable>
        )}

        {/* Name */}
        <Label text="Campaign Name" />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Campaign name"
          placeholderTextColor="#2C201440"
          className="border-b border-gold/20 pb-2 mb-5 text-lg"
          style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: "#2C2014" }}
        />

        {/* System Tag */}
        <Label text="System / Game (optional)" />
        <TextInput
          value={systemTag}
          onChangeText={setSystemTag}
          placeholder="e.g. D&D 5e, Pathfinder 2e, Blades in the Dark"
          placeholderTextColor="#2C201440"
          className="border-b border-gold/20 pb-2 mb-5"
          style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014" }}
        />

        {/* Logline */}
        <Label text="Campaign Logline (optional)" />
        <TextInput
          value={logline}
          onChangeText={setLogline}
          placeholder="One-sentence hook: e.g. A band of outlaws chase a sunken treasure"
          placeholderTextColor="#2C201440"
          className="border-b border-gold/20 pb-2 mb-5"
          style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 15, color: "#2C2014", fontStyle: "italic" }}
        />

        {/* Status */}
        <Label text="Status" />
        <View className="flex-row flex-wrap mb-6">
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              className={`mr-2 mb-2 px-4 py-2 rounded-sm border ${
                status === s
                  ? "border-gold bg-gold/10"
                  : "border-ink/20"
              }`}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: status === s ? "#A07A2C" : "#5A4D3E",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Next Session */}
        <Label text="Next Session (YYYY-MM-DD, optional)" />
        <TextInput
          value={nextSession}
          onChangeText={setNextSession}
          placeholder="2025-07-10"
          placeholderTextColor="#2C201440"
          className="border-b border-gold/20 pb-2 mb-5"
          style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014" }}
        />

        {/* Campaign Notes */}
        <Label text="GM Notes (optional)" />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="House rules, lore reminders, player briefs…"
          placeholderTextColor="#2C201440"
          multiline
          numberOfLines={4}
          className="border border-gold/20 rounded-sm p-3 mb-5"
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: "#2C2014",
            minHeight: 90,
            textAlignVertical: "top",
          }}
        />

        <GoldRule />

        {/* Save */}
        <Pressable
          onPress={save}
          className="mt-5 bg-oxblood py-3 rounded-sm border border-gold/30 items-center"
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: "#FAF5EA",
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            Save Settings
          </Text>
        </Pressable>

        {/* Session Zero link */}
        <Pressable
          onPress={() => router.push(`/campaign/${id}/session-zero`)}
          className="mt-4 mb-6 py-3 px-4 border border-gold/20 rounded-sm flex-row items-center justify-between"
        >
          <View>
            <Text
              style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#2C2014" }}
            >
              Session Zero & Safety Tools
            </Text>
            <Text
              style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E80", marginTop: 2 }}
            >
              X-Card, Lines & Veils, tone
            </Text>
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#A07A2C" }}>›</Text>
        </Pressable>

        {/* Danger Zone */}
        <View className="mt-4 p-4 border border-oxblood/30 rounded-sm">
          <Text
            className="text-oxblood text-xs uppercase tracking-wider mb-3"
            style={{ fontFamily: "Inter_600SemiBold" }}
          >
            Danger Zone
          </Text>
          <Text
            className="text-ink-faint text-xs mb-4 leading-4"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            Deleting a campaign removes all entities, sessions, links, and
            memberships permanently. Export first if you want a backup.
          </Text>
          <Pressable
            onPress={deleteCampaign}
            className="py-2.5 border border-oxblood/40 rounded-sm items-center"
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: "#7A2418",
              }}
            >
              Delete Campaign
            </Text>
          </Pressable>
        </View>

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text
      className="text-gold/70 text-xs uppercase tracking-wider mb-2"
      style={{ fontFamily: "Inter_600SemiBold" }}
    >
      {text}
    </Text>
  );
}
