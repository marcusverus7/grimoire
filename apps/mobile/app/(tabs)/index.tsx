import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useState, useCallback } from "react";
import { eq, sql } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { WaxSeal } from "@/components/WaxSeal";
import { GoldRule } from "@/components/GoldRule";
import { schema } from "@grimoire/core";

type CampaignRow = typeof schema.campaigns.$inferSelect & {
  entityCount: number;
  sessionCount: number;
};

export default function CampaignsScreen() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSystem, setNewSystem] = useState("");
  const router = useRouter();

  const loadCampaigns = useCallback(() => {
    const rows = db
      .select()
      .from(schema.campaigns)
      .orderBy(schema.campaigns.createdAt)
      .all();

    const enriched: CampaignRow[] = rows.map((c) => {
      const entityCount = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.entities)
        .where(eq(schema.entities.campaignId, c.id))
        .get()?.count ?? 0;
      const sessionCount = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.sessions)
        .where(eq(schema.sessions.campaignId, c.id))
        .get()?.count ?? 0;
      return { ...c, entityCount, sessionCount };
    });
    setCampaigns(enriched);
  }, []);

  useFocusEffect(loadCampaigns);

  const createCampaign = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      const now = Date.now();
      const id = newId();
      db.insert(schema.campaigns)
        .values({
          id,
          name: trimmed,
          systemTag: newSystem.trim() || null,
          status: "active",
          createdAt: new Date(now),
        })
        .run();

      const profileId = newId();
      const existing = db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.username, "local_gm"))
        .get();

      const userId = existing?.id ?? profileId;
      if (!existing) {
        db.insert(schema.profiles)
          .values({
            id: profileId,
            username: "local_gm",
            displayName: "Game Master",
            createdAt: new Date(now),
          })
          .run();
      }

      db.insert(schema.memberships)
        .values({
          id: newId(),
          campaignId: id,
          userId,
          role: "gm",
          joinedAt: new Date(now),
        })
        .run();

      setShowCreate(false);
      setNewName("");
      setNewSystem("");
      router.push(`/campaign/${id}`);
    } catch (e) {
      Alert.alert("Create Failed", e instanceof Error ? e.message : "An unexpected error occurred");
    }
  };

  const openCreate = () => {
    setNewName("");
    setNewSystem("");
    setShowCreate(true);
  };

  return (
    <View className="flex-1 bg-leather">
      {campaigns.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <WaxSeal size={80} />
          <Text className="font-cinzel text-parchment text-lg mt-6 text-center">
            Your Grimoire Awaits
          </Text>
          <Text className="font-cormorant text-parchment/70 text-base mt-3 text-center leading-6">
            Every great campaign begins with a single page. Create your first
            campaign and start building your world.
          </Text>
          <Pressable
            onPress={openCreate}
            className="mt-8 bg-oxblood px-8 py-3 rounded-sm border border-gold/30"
          >
            <Text className="font-inter-semibold text-parchment text-sm tracking-wider uppercase">
              Begin
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <GoldRule className="my-3" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/campaign/${item.id}`)}
              className="py-3 px-2"
            >
              <Text className="font-cormorant-semibold text-parchment text-lg">
                {item.name}
              </Text>
              {item.systemTag ? (
                <Text className="font-inter text-gold-muted text-xs mt-1">
                  {item.systemTag}
                </Text>
              ) : null}
              <Text
                className="font-inter text-parchment/40 text-xs mt-1"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                {item.entityCount} {item.entityCount === 1 ? "entity" : "entities"}
                {" · "}
                {item.sessionCount} {item.sessionCount === 1 ? "session" : "sessions"}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable
              onPress={openCreate}
              className="mt-4 items-center py-3 border border-gold/20 rounded-sm"
            >
              <Text className="font-inter-medium text-gold text-sm tracking-wider uppercase">
                + New Campaign
              </Text>
            </Pressable>
          }
        />
      )}

      {/* Create Campaign Modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <Pressable
            onPress={() => setShowCreate(false)}
            className="flex-1 bg-black/60 justify-center px-6"
          >
            <Pressable
              onPress={() => {}}
              className="bg-leather-light rounded-sm border border-gold/20 p-5"
            >
              <Text
                className="text-parchment text-lg text-center mb-5"
                style={{ fontFamily: "CormorantGaramond_700Bold" }}
              >
                New Campaign
              </Text>

              <Text
                className="text-gold/70 text-xs uppercase tracking-wider mb-1.5"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                Campaign Name
              </Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. The Sunken Throne"
                placeholderTextColor="#ECE3CF40"
                autoFocus
                className="border-b border-gold/20 pb-2 mb-5"
                style={{
                  fontFamily: "CormorantGaramond_600SemiBold",
                  fontSize: 18,
                  color: "#ECE3CF",
                }}
              />

              <Text
                className="text-gold/70 text-xs uppercase tracking-wider mb-1.5"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                System (optional)
              </Text>
              <TextInput
                value={newSystem}
                onChangeText={setNewSystem}
                placeholder="e.g. D&D 5e, Pathfinder 2e"
                placeholderTextColor="#ECE3CF40"
                className="border-b border-gold/20 pb-2 mb-6"
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: "#ECE3CF",
                }}
                onSubmitEditing={createCampaign}
              />

              <View className="flex-row justify-end">
                <Pressable
                  onPress={() => setShowCreate(false)}
                  className="px-5 py-2.5 mr-3"
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      color: "#ECE3CF60",
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={createCampaign}
                  disabled={!newName.trim()}
                  className={`px-5 py-2.5 rounded-sm border ${
                    newName.trim()
                      ? "bg-oxblood border-gold/30"
                      : "bg-oxblood/30 border-parchment/10"
                  }`}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                      color: newName.trim() ? "#ECE3CF" : "#ECE3CF40",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Create
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
