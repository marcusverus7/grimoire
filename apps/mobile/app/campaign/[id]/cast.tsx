import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { schema } from "@grimoire/core";

type Entity = typeof schema.entities.$inferSelect;
type CastFilter = "all" | "pcs" | "npcs" | "alive";

const FILTER_LABELS: Record<CastFilter, string> = {
  all: "All",
  pcs: "PCs",
  npcs: "NPCs",
  alive: "Alive",
};

type EntityWithLastSeen = Entity & { lastSeenSessionNumber?: number; lastSeenSessionTitle?: string | null };

export default function CastScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [entities, setEntities] = useState<EntityWithLastSeen[]>([]);
  const [filter, setFilter] = useState<CastFilter>("all");
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      const allEntities = db
        .select()
        .from(schema.entities)
        .where(eq(schema.entities.campaignId, campaignId))
        .all();

      const castEntities = allEntities.filter(
        (e) => e.kind === "pc" || e.kind === "npc",
      );

      // Load session-type entity_links to compute "last seen"
      const sessionLinks = db
        .select({
          toEntityId: schema.entityLinks.toEntityId,
          fromId: schema.entityLinks.fromId,
        })
        .from(schema.entityLinks)
        .where(eq(schema.entityLinks.campaignId, campaignId))
        .all()
        .filter((l) => l.fromId);

      // Load sessions for this campaign to resolve session numbers
      const sessions = db
        .select({ id: schema.sessions.id, number: schema.sessions.number, title: schema.sessions.title })
        .from(schema.sessions)
        .where(eq(schema.sessions.campaignId, campaignId))
        .all();

      const sessionById = new Map(sessions.map((s) => [s.id, s]));

      // Build a map: entityId → highest session number seen in
      const lastSeenMap = new Map<string, { number: number; title: string | null }>();
      for (const link of sessionLinks) {
        const sess = sessionById.get(link.fromId);
        if (!sess) continue;
        const existing = lastSeenMap.get(link.toEntityId);
        if (!existing || sess.number > existing.number) {
          lastSeenMap.set(link.toEntityId, { number: sess.number, title: sess.title });
        }
      }

      const enriched: EntityWithLastSeen[] = castEntities
        .map((e) => {
          const seen = lastSeenMap.get(e.id);
          return {
            ...e,
            lastSeenSessionNumber: seen?.number,
            lastSeenSessionTitle: seen?.title,
          };
        })
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === "pc" ? -1 : 1;
          const aPinned = (a.attrs as Record<string, unknown> | null)?.pinned === true;
          const bPinned = (b.attrs as Record<string, unknown> | null)?.pinned === true;
          if (aPinned !== bPinned) return aPinned ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      setEntities(enriched);
    }, [campaignId]),
  );

  const q = search.toLowerCase().trim();
  const filtered = entities
    .filter((e) => {
      if (filter === "pcs") return e.kind === "pc";
      if (filter === "npcs") return e.kind === "npc";
      if (filter === "alive") {
        const st = (e.attrs as Record<string, unknown> | null)?.npcStatus;
        return st !== "dead" && st !== "missing";
      }
      return true;
    })
    .filter((e) => !q || e.name.toLowerCase().includes(q));

  const pcs = filtered.filter((e) => e.kind === "pc");
  const npcs = filtered.filter((e) => e.kind === "npc");

  return (
    <>
      <Stack.Screen options={{ title: "Cast of Characters" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <View style={{ flex: 1 }}>
          {/* Filter pills */}
          <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
            {(["all", "pcs", "npcs", "alive"] as CastFilter[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: filter === f ? "#A07A2C" : "#A07A2C40",
                  backgroundColor: filter === f ? "#A07A2C15" : "transparent",
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: filter === f ? "#A07A2C" : "#8A7D6D" }}>
                  {FILTER_LABELS[f]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Search */}
          {entities.length > 8 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search cast…"
                placeholderTextColor="#2C201440"
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: "#2C2014",
                  borderWidth: 1,
                  borderColor: "#A07A2C20",
                  borderRadius: 3,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: "#FAF5EA",
                }}
              />
            </View>
          )}

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {filtered.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 16, color: "#5A4D3E80", fontStyle: "italic" }}>
                  No characters found.
                </Text>
              </View>
            ) : (
              <>
                {pcs.length > 0 && (
                  <View style={{ marginTop: 8, marginBottom: 16 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#C9A24A", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                      Player Characters
                    </Text>
                    {pcs.map((entity) => (
                      <CastRow
                        key={entity.id}
                        entity={entity}
                        onPress={() => router.push(`/campaign/${campaignId}/entity/${entity.id}` as Parameters<typeof router.push>[0])}
                      />
                    ))}
                  </View>
                )}

                {pcs.length > 0 && npcs.length > 0 && <GoldRule />}

                {npcs.length > 0 && (
                  <View style={{ marginTop: pcs.length > 0 ? 12 : 8 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                      NPCs
                    </Text>
                    {npcs.map((entity) => (
                      <CastRow
                        key={entity.id}
                        entity={entity}
                        onPress={() => router.push(`/campaign/${campaignId}/entity/${entity.id}` as Parameters<typeof router.push>[0])}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </ParchmentScreen>
    </>
  );
}

function CastRow({ entity, onPress }: { entity: EntityWithLastSeen; onPress: () => void }) {
  const attrs = (entity.attrs ?? {}) as Record<string, unknown>;
  const imageUri = attrs.imageUri as string | undefined;
  const npcStatus = attrs.npcStatus as string | undefined;
  const role = attrs.role as string | undefined;
  const level = attrs.level as number | undefined;
  const hp = attrs.hp as number | undefined;
  const maxHp = attrs.maxHp as number | undefined;
  const conditions = (attrs.conditions as string[] | undefined) ?? [];
  const isPinned = attrs.pinned === true;
  const isGmOnly = entity.visibility === "gm_only";

  const isDead = npcStatus === "dead";
  const isMissing = npcStatus === "missing";
  const isAlive = !isDead && !isMissing;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: "#A07A2C12",
        opacity: isDead ? 0.5 : 1,
      }}
    >
      {/* Portrait */}
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            marginRight: 12,
            borderWidth: 1.5,
            borderColor: entity.kind === "pc" ? "#C9A24A60" : "#A07A2C40",
          }}
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            marginRight: 12,
            borderWidth: 1.5,
            borderColor: entity.kind === "pc" ? "#C9A24A40" : "#A07A2C30",
            backgroundColor: entity.kind === "pc" ? "#C9A24A10" : "#A07A2C08",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: entity.kind === "pc" ? "#C9A24A80" : "#A07A2C80" }}>
            {entity.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Main info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {isPinned && (
            <Text style={{ fontSize: 10, color: "#A07A2C80" }}>★</Text>
          )}
          <Text
            style={{
              fontFamily: "CormorantGaramond_600SemiBold",
              fontSize: 17,
              color: isDead ? "#5A4D3E80" : "#2C2014",
              textDecorationLine: isDead ? "line-through" : "none",
            }}
            numberOfLines={1}
          >
            {entity.name}
          </Text>
          {isGmOnly && (
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#7A2418" }}>GM</Text>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {level ? (
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#C9A24A" }}>Lv {level}</Text>
          ) : null}
          {role ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E70" }} numberOfLines={1}>
              {role}
            </Text>
          ) : entity.summary ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E70" }} numberOfLines={1}>
              {entity.summary}
            </Text>
          ) : null}
        </View>

        {/* Last seen */}
        {entity.lastSeenSessionNumber !== undefined && isAlive && (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E50", marginTop: 2 }}>
            Last seen S{entity.lastSeenSessionNumber}{entity.lastSeenSessionTitle ? ` · ${entity.lastSeenSessionTitle}` : ""}
          </Text>
        )}

        {conditions.length > 0 && isAlive && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
            {conditions.slice(0, 3).map((c, i) => (
              <View key={i} style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, backgroundColor: "#7A241810", borderWidth: 0.5, borderColor: "#7A241840" }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#7A2418" }}>{c}</Text>
              </View>
            ))}
            {conditions.length > 3 && (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#7A241860" }}>+{conditions.length - 3}</Text>
            )}
          </View>
        )}
      </View>

      {/* Right: HP + status */}
      <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
        {hp !== undefined && maxHp !== undefined && isAlive ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: hp <= maxHp * 0.25 ? "#7A2418" : hp <= maxHp * 0.5 ? "#A07A2C" : "#4A8060" }}>
              {hp}/{maxHp}
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 8, color: "#5A4D3E50", textTransform: "uppercase", letterSpacing: 1 }}>HP</Text>
          </View>
        ) : null}
        {isDead && (
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, backgroundColor: "#7A241810", borderWidth: 0.5, borderColor: "#7A241840" }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#7A2418" }}>☠ Dead</Text>
          </View>
        )}
        {isMissing && (
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, backgroundColor: "#A07A2C10", borderWidth: 0.5, borderColor: "#A07A2C40" }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#A07A2C" }}>? Missing</Text>
          </View>
        )}
        {isAlive && hp === undefined && (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#A07A2C60" }}>›</Text>
        )}
      </View>
    </Pressable>
  );
}
