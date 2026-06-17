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
import { useState, useCallback, useEffect } from "react";
import { eq, sql } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { db, getKv, setKv } from "@/lib/db";
import { newId } from "@/lib/id";
import { WaxSeal } from "@/components/WaxSeal";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { OnboardingModal } from "@/components/OnboardingModal";
import { schema } from "@grimoire/core";
import { seedSampleCampaign } from "@/lib/sampleData";

type CampaignRow = typeof schema.campaigns.$inferSelect & {
  entityCount: number;
  sessionCount: number;
  quoteCount: number;
  logline?: string;
};

function remapMentionIds(node: unknown, idMap: Map<string, string>): unknown {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => remapMentionIds(n, idMap));
  const obj = node as Record<string, unknown>;
  if (obj.type === "mention" && obj.attrs && typeof obj.attrs === "object") {
    const attrs = obj.attrs as Record<string, unknown>;
    const mapped = idMap.get(attrs.id as string);
    if (mapped) return { ...obj, attrs: { ...attrs, id: mapped } };
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = remapMentionIds(v, idMap);
  }
  return result;
}

export default function CampaignsScreen() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSystem, setNewSystem] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CampaignRow | null>(null);
  const [renameName, setRenameName] = useState("");
  const router = useRouter();

  useEffect(() => {
    const done = getKv("onboarding_done");
    if (!done) setShowOnboarding(true);
  }, []);

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
      const quoteCount = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.quotes)
        .where(eq(schema.quotes.campaignId, c.id))
        .get()?.count ?? 0;
      const logline = (c.settings as { logline?: string } | null)?.logline;
      return { ...c, entityCount, sessionCount, quoteCount, logline };
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

  const renameCampaign = () => {
    const trimmed = renameName.trim();
    if (!trimmed || !renameTarget) return;
    db.update(schema.campaigns)
      .set({ name: trimmed })
      .where(eq(schema.campaigns.id, renameTarget.id))
      .run();
    setShowRename(false);
    setRenameTarget(null);
    loadCampaigns();
  };

  const duplicateCampaign = (campaign: CampaignRow) => {
    try {
      const now = new Date();
      const newCampaignId = newId();

      const entities = db.select().from(schema.entities).where(eq(schema.entities.campaignId, campaign.id)).all();
      const sessions = db.select().from(schema.sessions).where(eq(schema.sessions.campaignId, campaign.id)).all();
      const quotesData = db.select().from(schema.quotes).where(eq(schema.quotes.campaignId, campaign.id)).all();

      const entityIdMap = new Map<string, string>();
      for (const e of entities) entityIdMap.set(e.id, newId());

      const sessionIdMap = new Map<string, string>();
      for (const s of sessions) sessionIdMap.set(s.id, newId());

      db.insert(schema.campaigns).values({
        id: newCampaignId,
        name: `${campaign.name} (Copy)`,
        systemTag: campaign.systemTag,
        settings: campaign.settings as Record<string, unknown> | null,
        status: "active",
        createdAt: now,
      }).run();

      const gm = db.select().from(schema.profiles).where(eq(schema.profiles.username, "local_gm")).get();
      if (gm) {
        db.insert(schema.memberships).values({
          id: newId(),
          campaignId: newCampaignId,
          userId: gm.id,
          role: "gm",
          joinedAt: now,
        }).run();
      }

      for (const e of entities) {
        db.insert(schema.entities).values({
          id: entityIdMap.get(e.id)!,
          campaignId: newCampaignId,
          kind: e.kind as "npc" | "pc" | "location" | "faction" | "item" | "quest" | "custom",
          name: e.name,
          summary: e.summary,
          body: e.body ? remapMentionIds(e.body, entityIdMap) as Record<string, unknown> : null,
          attrs: e.attrs as Record<string, unknown> | null,
          visibility: e.visibility as "gm_only" | "table",
          characterProfileId: e.characterProfileId,
          createdAt: now,
          updatedAt: now,
        }).run();
      }

      for (const s of sessions) {
        db.insert(schema.sessions).values({
          id: sessionIdMap.get(s.id)!,
          campaignId: newCampaignId,
          number: s.number,
          title: s.title,
          playedOn: s.playedOn,
          body: s.body ? remapMentionIds(s.body, entityIdMap) as Record<string, unknown> : null,
          status: s.status as "planned" | "in_progress" | "played",
        }).run();
      }

      for (const q of quotesData) {
        db.insert(schema.quotes).values({
          id: newId(),
          campaignId: newCampaignId,
          sessionId: q.sessionId ? (sessionIdMap.get(q.sessionId) ?? null) : null,
          attribution: q.attribution,
          text: q.text,
          createdAt: now,
        }).run();
      }

      loadCampaigns();
    } catch (e) {
      Alert.alert("Duplicate Failed", e instanceof Error ? e.message : "An unexpected error occurred");
    }
  };

  const finishOnboarding = (action: "create" | "sample") => {
    setKv("onboarding_done", "1");
    setShowOnboarding(false);
    if (action === "sample") {
      try {
        const id = seedSampleCampaign();
        loadCampaigns();
        router.push(`/campaign/${id}`);
      } catch (e) {
        Alert.alert("Error", e instanceof Error ? e.message : "Could not load sample");
      }
    } else {
      openCreate();
    }
  };

  return (
    <>
    <OnboardingModal visible={showOnboarding} onDone={finishOnboarding} />
    <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
    <View className="flex-1 bg-parchment">
      {campaigns.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <WaxSeal size={80} />
          <Text className="font-cinzel text-ink text-lg mt-6 text-center">
            Your Grimoire Awaits
          </Text>
          <Text className="font-cormorant text-ink-soft text-base mt-3 text-center leading-6">
            Every great campaign begins with a single page. Create your first
            campaign and start building your world.
          </Text>
          <Pressable
            onPress={openCreate}
            className="mt-8 bg-oxblood px-8 py-3 rounded-sm border border-gold/30"
          >
            <Text className="font-inter-semibold text-ink-light text-sm tracking-wider uppercase">
              Begin
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              try {
                const id = seedSampleCampaign();
                loadCampaigns();
                router.push(`/campaign/${id}`);
              } catch (e) {
                Alert.alert("Error", e instanceof Error ? e.message : "Could not load sample");
              }
            }}
            style={{ marginTop: 20 }}
          >
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#A07A2C", textDecorationLine: "underline" }}>
              Explore a sample campaign →
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={campaigns.filter((c) => showArchived || c.status === "active")}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={
            campaigns.some((c) => c.status !== "active") ? (
              <Pressable onPress={() => setShowArchived((v) => !v)} style={{ marginBottom: 12, alignSelf: "flex-end" }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E60" }}>
                  {showArchived ? "Hide archived" : "Show archived"}
                </Text>
              </Pressable>
            ) : null
          }
          ItemSeparatorComponent={() => <GoldRule className="my-3" ornament />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/campaign/${item.id}`)}
              onLongPress={() => {
                const isArchived = item.status === "archived";
                Alert.alert(
                  item.name,
                  "Campaign actions",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Rename…",
                      onPress: () => {
                        setRenameTarget(item);
                        setRenameName(item.name);
                        setShowRename(true);
                      },
                    },
                    {
                      text: "Duplicate",
                      onPress: () => duplicateCampaign(item),
                    },
                    {
                      text: isArchived ? "Restore" : "Archive",
                      style: "destructive",
                      onPress: () => {
                        db.update(schema.campaigns)
                          .set({ status: isArchived ? "active" : "archived" })
                          .where(eq(schema.campaigns.id, item.id))
                          .run();
                        loadCampaigns();
                      },
                    },
                  ],
                );
              }}
              className="py-3 px-2"
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text className="font-cormorant-semibold text-ink text-lg" style={{ flex: 1 }}>
                  {item.name}
                </Text>
                {item.status !== "active" ? (
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E60", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {item.status}
                  </Text>
                ) : null}
              </View>
              {item.logline ? (
                <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#4A3F3280", marginTop: 2, fontStyle: "italic" }} numberOfLines={2}>
                  {item.logline}
                </Text>
              ) : null}
              {item.systemTag ? (
                <Text className="font-inter text-gold text-xs mt-1">
                  {item.systemTag}
                </Text>
              ) : null}
              <Text
                className="font-inter text-ink-faint text-xs mt-1"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                {item.entityCount} {item.entityCount === 1 ? "entity" : "entities"}
                {" · "}
                {item.sessionCount} {item.sessionCount === 1 ? "session" : "sessions"}
                {item.quoteCount > 0 ? ` · ${item.quoteCount} ${item.quoteCount === 1 ? "quote" : "quotes"}` : ""}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable
              onPress={openCreate}
              className="mt-4 items-center py-3 border border-gold/30 rounded-sm"
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
            className="flex-1 bg-black/50 justify-center px-6"
          >
            <Pressable
              onPress={() => {}}
              className="bg-parchment-warm rounded-sm border border-gold/30 p-5"
            >
              <Text
                className="text-ink text-lg text-center mb-5"
                style={{ fontFamily: "CormorantGaramond_700Bold" }}
              >
                New Campaign
              </Text>

              <Text
                className="text-gold text-xs uppercase tracking-wider mb-1.5"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                Campaign Name
              </Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. The Sunken Throne"
                placeholderTextColor="#2C201440"
                autoFocus
                className="border-b border-gold/30 pb-2 mb-5"
                style={{
                  fontFamily: "CormorantGaramond_600SemiBold",
                  fontSize: 18,
                  color: "#2C2014",
                }}
              />

              <Text
                className="text-gold text-xs uppercase tracking-wider mb-1.5"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                System (optional)
              </Text>
              <TextInput
                value={newSystem}
                onChangeText={setNewSystem}
                placeholder="e.g. D&D 5e, Pathfinder 2e"
                placeholderTextColor="#2C201440"
                className="border-b border-gold/30 pb-2 mb-6"
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: "#2C2014",
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
                      color: "#5A4D3E",
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
                      : "bg-oxblood/30 border-ink/10"
                  }`}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                      color: newName.trim() ? "#FAF5EA" : "#FAF5EA60",
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

      {/* Rename Campaign Modal */}
      <Modal
        visible={showRename}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRename(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <Pressable
            onPress={() => setShowRename(false)}
            className="flex-1 bg-black/50 justify-center px-6"
          >
            <Pressable
              onPress={() => {}}
              className="bg-parchment-warm rounded-sm border border-gold/30 p-5"
            >
              <Text
                className="text-ink text-lg text-center mb-5"
                style={{ fontFamily: "CormorantGaramond_700Bold" }}
              >
                Rename Campaign
              </Text>

              <Text
                className="text-gold text-xs uppercase tracking-wider mb-1.5"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                Campaign Name
              </Text>
              <TextInput
                value={renameName}
                onChangeText={setRenameName}
                autoFocus
                className="border-b border-gold/30 pb-2 mb-6"
                style={{
                  fontFamily: "CormorantGaramond_600SemiBold",
                  fontSize: 18,
                  color: "#2C2014",
                }}
                onSubmitEditing={renameCampaign}
              />

              <View className="flex-row justify-end">
                <Pressable
                  onPress={() => setShowRename(false)}
                  className="px-5 py-2.5 mr-3"
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      color: "#5A4D3E",
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={renameCampaign}
                  disabled={!renameName.trim()}
                  className={`px-5 py-2.5 rounded-sm border ${
                    renameName.trim()
                      ? "bg-oxblood border-gold/30"
                      : "bg-oxblood/30 border-ink/10"
                  }`}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                      color: renameName.trim() ? "#FAF5EA" : "#FAF5EA60",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Save
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
    </ParchmentScreen>
    </>
  );
}
