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
import { color, withAlpha, useThemeTick } from "@/lib/theme";

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
  useThemeTick();
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
                  borderColor: filter === f ? color.gold : withAlpha("gold", 0x40 / 255),
                  backgroundColor: filter === f ? withAlpha("gold", 0x15 / 255) : "transparent",
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: filter === f ? color.gold : color.inkFaint }}>
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
                placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: color.ink,
                  borderWidth: 1,
                  borderColor: withAlpha("gold", 0x20 / 255),
                  borderRadius: 3,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: color.parchment,
                }}
              />
            </View>
          )}

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {filtered.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 16, color: withAlpha("inkSoft", 0x80 / 255), fontStyle: "italic" }}>
                  No characters found.
                </Text>
              </View>
            ) : (
              <>
                {pcs.length > 0 && (
                  <View style={{ marginTop: 8, marginBottom: 16 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: color.goldBright, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
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
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: color.gold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
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
  const pronouns = attrs.pronouns as string | undefined;
  const level = attrs.level as number | undefined;
  const maxHp = attrs.hp != null ? Number(attrs.hp) : undefined;
  const currentHp = attrs.currentHp != null ? Number(attrs.currentHp) : maxHp;
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
        borderBottomColor: withAlpha("gold", 0x12 / 255),
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
            borderColor: entity.kind === "pc" ? withAlpha("goldBright", 0x60 / 255) : withAlpha("gold", 0x40 / 255),
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
            borderColor: entity.kind === "pc" ? withAlpha("goldBright", 0x40 / 255) : withAlpha("gold", 0x30 / 255),
            backgroundColor: entity.kind === "pc" ? withAlpha("goldBright", 0x10 / 255) : withAlpha("gold", 0x08 / 255),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: entity.kind === "pc" ? withAlpha("goldBright", 0x80 / 255) : withAlpha("gold", 0x80 / 255) }}>
            {entity.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Main info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {isPinned && (
            <Text style={{ fontSize: 10, color: withAlpha("gold", 0x80 / 255) }}>★</Text>
          )}
          <Text
            style={{
              fontFamily: "CormorantGaramond_600SemiBold",
              fontSize: 17,
              color: isDead ? withAlpha("inkSoft", 0x80 / 255) : color.ink,
              textDecorationLine: isDead ? "line-through" : "none",
            }}
            numberOfLines={1}
          >
            {entity.name}
          </Text>
          {isGmOnly && (
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: color.oxblood }}>GM</Text>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {level ? (
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: color.goldBright }}>Lv {level}</Text>
          ) : null}
          {role ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("inkSoft", 0x70 / 255) }} numberOfLines={1}>
              {role}
            </Text>
          ) : entity.summary ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("inkSoft", 0x70 / 255) }} numberOfLines={1}>
              {entity.summary}
            </Text>
          ) : null}
          {pronouns ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkFaint", 0x80 / 255), fontStyle: "italic" }}>
              {pronouns}
            </Text>
          ) : null}
        </View>

        {/* Last seen */}
        {entity.lastSeenSessionNumber !== undefined && isAlive && (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkSoft", 0x50 / 255), marginTop: 2 }}>
            Last seen S{entity.lastSeenSessionNumber}{entity.lastSeenSessionTitle ? ` · ${entity.lastSeenSessionTitle}` : ""}
          </Text>
        )}

        {conditions.length > 0 && isAlive && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
            {conditions.slice(0, 3).map((c, i) => (
              <View key={i} style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, backgroundColor: withAlpha("oxblood", 0x10 / 255), borderWidth: 0.5, borderColor: withAlpha("oxblood", 0x40 / 255) }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: color.oxblood }}>{c}</Text>
              </View>
            ))}
            {conditions.length > 3 && (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: withAlpha("oxblood", 0x60 / 255) }}>+{conditions.length - 3}</Text>
            )}
          </View>
        )}
      </View>

      {/* Right: HP + status */}
      <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
        {maxHp !== undefined && currentHp !== undefined && isAlive ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: currentHp <= maxHp * 0.25 ? color.oxblood : currentHp <= maxHp * 0.5 ? color.gold : color.success }}>
              {currentHp}/{maxHp}
            </Text>
            <View style={{ width: 40, height: 3, backgroundColor: withAlpha("gold", 0x15 / 255), borderRadius: 2, marginTop: 2 }}>
              <View style={{ width: `${Math.round((currentHp / maxHp) * 100)}%`, height: 3, backgroundColor: currentHp <= maxHp * 0.25 ? color.oxblood : currentHp <= maxHp * 0.5 ? color.gold : color.success, borderRadius: 2 }} />
            </View>
          </View>
        ) : null}
        {isDead && (
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, backgroundColor: withAlpha("oxblood", 0x10 / 255), borderWidth: 0.5, borderColor: withAlpha("oxblood", 0x40 / 255) }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: color.oxblood }}>☠ Dead</Text>
          </View>
        )}
        {isMissing && (
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, backgroundColor: withAlpha("gold", 0x10 / 255), borderWidth: 0.5, borderColor: withAlpha("gold", 0x40 / 255) }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: color.gold }}>? Missing</Text>
          </View>
        )}
        {isAlive && maxHp === undefined && (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: withAlpha("gold", 0x60 / 255) }}>›</Text>
        )}
      </View>
    </Pressable>
  );
}
