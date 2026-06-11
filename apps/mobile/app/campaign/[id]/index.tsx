import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, and, asc, desc } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { schema } from "@grimoire/core";

type Campaign = typeof schema.campaigns.$inferSelect;
type Entity = typeof schema.entities.$inferSelect;
type Session = typeof schema.sessions.$inferSelect;

const ENTITY_KINDS = ["npc", "pc", "location", "faction", "item", "quest", "custom"] as const;
const KIND_LABELS: Record<string, string> = {
  npc: "NPCs",
  pc: "Player Characters",
  location: "Locations",
  faction: "Factions",
  item: "Items",
  quest: "Quests",
  custom: "Custom",
};

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    const c = db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .get();
    setCampaign(c ?? null);
    if (c) {
      setNameInput(c.name);
      setEntities(
        db
          .select()
          .from(schema.entities)
          .where(eq(schema.entities.campaignId, id))
          .orderBy(asc(schema.entities.name))
          .all(),
      );
      setSessions(
        db
          .select()
          .from(schema.sessions)
          .where(eq(schema.sessions.campaignId, id))
          .orderBy(asc(schema.sessions.number))
          .all(),
      );
    }
  }, [id]);

  useFocusEffect(load);

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !campaign) return;
    db.update(schema.campaigns)
      .set({ name: trimmed })
      .where(eq(schema.campaigns.id, campaign.id))
      .run();
    setCampaign({ ...campaign, name: trimmed });
    setEditing(false);
  };

  const createSession = () => {
    const maxNum = sessions.reduce((m, s) => Math.max(m, s.number), 0);
    const sessionId = newId();
    db.insert(schema.sessions)
      .values({
        id: sessionId,
        campaignId: id,
        number: maxNum + 1,
        status: "planned",
      })
      .run();
    router.push(`/campaign/${id}/session/${sessionId}/edit`);
  };

  if (!campaign) {
    return (
      <View className="flex-1 bg-leather items-center justify-center">
        <Text className="text-parchment/50 font-inter text-sm">
          Campaign not found
        </Text>
      </View>
    );
  }

  const q = search.toLowerCase().trim();
  const filtered = q
    ? entities.filter((e) => e.name.toLowerCase().includes(q))
    : entities;

  const entitiesByKind = ENTITY_KINDS
    .map((kind) => ({
      kind,
      label: KIND_LABELS[kind] ?? kind,
      items: filtered.filter((e) => e.kind === kind),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <Stack.Screen options={{ title: campaign.name }} />
      <ScrollView className="flex-1 bg-leather" contentContainerStyle={{ padding: 16 }}>
        {/* Campaign name — tap to edit */}
        {editing ? (
          <View className="flex-row items-center mb-4">
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              onBlur={saveName}
              onSubmitEditing={saveName}
              autoFocus
              className="flex-1 text-parchment font-cormorant-bold text-2xl border-b border-gold/30 pb-1"
              style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 24, color: "#ECE3CF" }}
              placeholderTextColor="#ECE3CF50"
            />
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)} className="mb-4">
            <Text
              className="text-parchment text-2xl"
              style={{ fontFamily: "CormorantGaramond_700Bold" }}
            >
              {campaign.name}
            </Text>
            {campaign.systemTag ? (
              <Text className="text-gold-muted text-xs mt-1" style={{ fontFamily: "Inter_400Regular" }}>
                {campaign.systemTag}
              </Text>
            ) : null}
          </Pressable>
        )}

        <GoldRule />

        {/* Sessions */}
        <View className="mt-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-gold text-xs uppercase tracking-widest"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Sessions
            </Text>
            <Pressable onPress={createSession}>
              <Text className="text-gold text-xs" style={{ fontFamily: "Inter_500Medium" }}>
                + New
              </Text>
            </Pressable>
          </View>
          {sessions.length === 0 ? (
            <Text className="text-parchment/40 text-sm mb-4" style={{ fontFamily: "Inter_400Regular" }}>
              No sessions yet
            </Text>
          ) : (
            sessions.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/campaign/${id}/session/${s.id}`)}
                className="py-2.5 px-2 mb-1"
              >
                <Text className="text-parchment text-base" style={{ fontFamily: "CormorantGaramond_600SemiBold" }}>
                  Session {s.number}
                  {s.title ? `: ${s.title}` : ""}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Text
                    className="text-xs uppercase tracking-wider"
                    style={{
                      fontFamily: "Inter_400Regular",
                      color: s.status === "played" ? "#A07A2C" : "#ECE3CF60",
                    }}
                  >
                    {s.status}
                  </Text>
                  {s.playedOn ? (
                    <Text className="text-parchment/30 text-xs ml-2" style={{ fontFamily: "Inter_400Regular" }}>
                      {s.playedOn}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </View>

        <GoldRule className="my-3" />

        {/* Entities */}
        <View className="mt-2">
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-gold text-xs uppercase tracking-widest"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Entities
            </Text>
            <Pressable onPress={() => router.push(`/campaign/${id}/entity/new/edit`)}>
              <Text className="text-gold text-xs" style={{ fontFamily: "Inter_500Medium" }}>
                + New
              </Text>
            </Pressable>
          </View>
          {entities.length > 5 && (
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search entities…"
              placeholderTextColor="#ECE3CF30"
              className="border border-parchment/10 rounded-sm px-3 py-2 mb-3"
              style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#ECE3CF" }}
            />
          )}
          {entitiesByKind.length === 0 ? (
            <Text className="text-parchment/40 text-sm" style={{ fontFamily: "Inter_400Regular" }}>
              No entities yet — create NPCs, locations, factions, and more
            </Text>
          ) : (
            entitiesByKind.map((group) => (
              <View key={group.kind} className="mb-4">
                <Text
                  className="text-parchment/50 text-xs uppercase tracking-wider mb-2"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  {group.label}
                </Text>
                {group.items.map((entity) => (
                  <Pressable
                    key={entity.id}
                    onPress={() =>
                      router.push(`/campaign/${id}/entity/${entity.id}`)
                    }
                    className="py-2 px-2 mb-0.5"
                  >
                    <View className="flex-row items-center">
                      <Text
                        className="text-parchment text-base flex-1"
                        style={{ fontFamily: "CormorantGaramond_600SemiBold" }}
                      >
                        {entity.name}
                      </Text>
                      {entity.visibility === "gm_only" && (
                        <Text
                          className="text-oxblood text-xs ml-2"
                          style={{ fontFamily: "Inter_500Medium" }}
                        >
                          GM
                        </Text>
                      )}
                    </View>
                    {entity.summary ? (
                      <Text
                        className="text-parchment/50 text-sm mt-0.5"
                        style={{ fontFamily: "Inter_400Regular" }}
                        numberOfLines={1}
                      >
                        {entity.summary}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </View>

        <GoldRule className="my-4" />

        {/* Actions */}
        <View className="flex-row justify-between">
          <Pressable
            onPress={() => router.push(`/campaign/${id}/graph`)}
            className="flex-1 mr-1.5 py-2.5 border border-gold/20 rounded-sm items-center"
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 11,
                color: "#A07A2C",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Map
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/campaign/${id}/export`)}
            className="flex-1 mx-1.5 py-2.5 border border-gold/20 rounded-sm items-center"
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 11,
                color: "#A07A2C",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Export
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/campaign/${id}/settings`)}
            className="flex-1 ml-1.5 py-2.5 border border-parchment/15 rounded-sm items-center"
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 11,
                color: "#ECE3CF80",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Settings
            </Text>
          </Pressable>
        </View>

        <View className="h-20" />
      </ScrollView>
    </>
  );
}
