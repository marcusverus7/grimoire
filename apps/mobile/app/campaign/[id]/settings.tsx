import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { schema } from "@grimoire/core";

type Campaign = typeof schema.campaigns.$inferSelect;
type Status = "active" | "archived" | "ended";

const STATUSES: Status[] = ["active", "archived", "ended"];

export default function CampaignSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [systemTag, setSystemTag] = useState("");
  const [status, setStatus] = useState<Status>("active");

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
    }
  }, [id]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Your campaign needs a name.");
      return;
    }
    try {
      db.update(schema.campaigns)
        .set({
          name: trimmed,
          systemTag: systemTag.trim() || null,
          status,
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
              db.delete(schema.entityLinks)
                .where(eq(schema.entityLinks.campaignId, id))
                .run();
              db.delete(schema.entities)
                .where(eq(schema.entities.campaignId, id))
                .run();
              db.delete(schema.sessions)
                .where(eq(schema.sessions.campaignId, id))
                .run();
              db.delete(schema.memberships)
                .where(eq(schema.memberships.campaignId, id))
                .run();
              db.delete(schema.campaigns)
                .where(eq(schema.campaigns.id, id))
                .run();
              router.dismissAll();
            } catch (e) {
              Alert.alert("Delete Failed", e instanceof Error ? e.message : "An unexpected error occurred");
            }
          },
        },
      ],
    );
  };

  if (!campaign) return null;

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView
        className="flex-1 bg-leather"
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <Label text="Campaign Name" />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Campaign name"
          placeholderTextColor="#ECE3CF40"
          className="border-b border-gold/20 pb-2 mb-5 text-lg"
          style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: "#ECE3CF" }}
        />

        {/* System Tag */}
        <Label text="System / Game (optional)" />
        <TextInput
          value={systemTag}
          onChangeText={setSystemTag}
          placeholder="e.g. D&D 5e, Pathfinder 2e, Blades in the Dark"
          placeholderTextColor="#ECE3CF40"
          className="border-b border-gold/20 pb-2 mb-5"
          style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#ECE3CF" }}
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
                  : "border-parchment/20"
              }`}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: status === s ? "#A07A2C" : "#ECE3CF60",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>

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
              color: "#ECE3CF",
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            Save Settings
          </Text>
        </Pressable>

        {/* Danger Zone */}
        <View className="mt-10 p-4 border border-oxblood/30 rounded-sm">
          <Text
            className="text-oxblood text-xs uppercase tracking-wider mb-3"
            style={{ fontFamily: "Inter_600SemiBold" }}
          >
            Danger Zone
          </Text>
          <Text
            className="text-parchment/40 text-xs mb-4 leading-4"
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
