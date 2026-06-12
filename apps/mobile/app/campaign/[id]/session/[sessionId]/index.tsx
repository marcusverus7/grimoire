import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { schema, nodeText } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";

type Session = typeof schema.sessions.$inferSelect;

export default function SessionDetailScreen() {
  const { id: campaignId, sessionId } = useLocalSearchParams<{
    id: string;
    sessionId: string;
  }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [linkedEntities, setLinkedEntities] = useState<
    { id: string; name: string; kind: string }[]
  >([]);

  const load = useCallback(() => {
    const s = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .get();
    setSession(s ?? null);

    if (s) {
      const links = db
        .select({ toEntityId: schema.entityLinks.toEntityId })
        .from(schema.entityLinks)
        .where(eq(schema.entityLinks.fromId, sessionId))
        .all();

      const entities = links
        .map((l) =>
          db
            .select({
              id: schema.entities.id,
              name: schema.entities.name,
              kind: schema.entities.kind,
            })
            .from(schema.entities)
            .where(eq(schema.entities.id, l.toEntityId))
            .get(),
        )
        .filter((e): e is NonNullable<typeof e> => e != null)
        .sort((a, b) => a.name.localeCompare(b.name));

      setLinkedEntities(entities);
    }
  }, [sessionId]);

  useFocusEffect(load);

  if (!session) {
    return (
      <View className="flex-1 bg-leather items-center justify-center">
        <Text className="text-parchment/50 font-inter text-sm">
          Session not found
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Session ${session.number}`,
          headerRight: () => (
            <Pressable
              onPress={() =>
                router.push(
                  `/campaign/${campaignId}/session/${sessionId}/edit`,
                )
              }
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  color: "#A07A2C",
                  marginRight: 8,
                }}
              >
                Edit
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-parchment-deep"
        contentContainerStyle={{ padding: 20 }}
      >
        {/* Header */}
        <Text
          className="text-ink text-2xl mb-1"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          Session {session.number}
          {session.title ? `: ${session.title}` : ""}
        </Text>
        <View className="flex-row items-center mb-4">
          <Text
            className="text-xs uppercase tracking-wider"
            style={{
              fontFamily: "Inter_500Medium",
              color: session.status === "played" ? "#A07A2C" : "#4A3F32",
            }}
          >
            {session.status}
          </Text>
          {session.playedOn ? (
            <Text
              className="text-ink-soft/50 text-xs ml-3"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {session.playedOn}
            </Text>
          ) : null}
        </View>

        <GoldRule />

        {/* Body */}
        {session.body ? (
          <View className="mt-4 mb-6">
            {renderBody(session.body as RichTextNode)}
          </View>
        ) : null}

        {/* Linked entities */}
        {linkedEntities.length > 0 && (
          <>
            <GoldRule />
            <View className="mt-4">
              <Text
                className="text-ink-soft text-xs uppercase tracking-wider mb-3"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                Entities in This Session
              </Text>
              {linkedEntities.map((entity) => (
                <Pressable
                  key={entity.id}
                  onPress={() =>
                    router.push(
                      `/campaign/${campaignId}/entity/${entity.id}`,
                    )
                  }
                  className="py-2 px-2 mb-1"
                >
                  <View className="flex-row items-center">
                    <Text
                      className="text-xs uppercase tracking-wider mr-2"
                      style={{
                        fontFamily: "Inter_500Medium",
                        color: "#4A3F32",
                      }}
                    >
                      {entity.kind}
                    </Text>
                    <Text
                      className="text-ink text-base flex-1"
                      style={{ fontFamily: "CormorantGaramond_600SemiBold" }}
                    >
                      {entity.name}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View className="h-20" />
      </ScrollView>
    </>
  );
}

function renderBody(body: RichTextNode): React.ReactNode {
  if (!body.content) return null;
  return body.content.map((block, i) => {
    const text = nodeText(block);
    if (!text.trim()) return null;

    if (block.type === "heading") {
      const level = (block.attrs?.["level"] as number) ?? 2;
      return (
        <Text
          key={i}
          className="text-ink mb-2"
          style={{
            fontFamily: "CormorantGaramond_700Bold",
            fontSize: level === 1 ? 22 : level === 2 ? 19 : 17,
          }}
        >
          {renderInline(block)}
        </Text>
      );
    }

    if (block.type === "blockquote") {
      return (
        <View key={i} className="border-l-2 border-gold/40 pl-3 mb-2">
          <Text
            className="text-ink/70 italic text-base leading-6"
            style={{ fontFamily: "CormorantGaramond_400Regular_Italic" }}
          >
            {renderInline(block)}
          </Text>
        </View>
      );
    }

    if (block.type === "bulletList" || block.type === "orderedList") {
      return (
        <View key={i} className="mb-2 pl-2">
          {(block.content ?? []).map((li, j) => (
            <View key={j} className="flex-row mb-1">
              <Text
                className="text-gold mr-2"
                style={{ fontFamily: "Inter_400Regular", fontSize: 14 }}
              >
                {block.type === "orderedList" ? `${j + 1}.` : "•"}
              </Text>
              <Text
                className="text-ink/80 text-base flex-1 leading-6"
                style={{ fontFamily: "CormorantGaramond_400Regular" }}
              >
                {renderInline(li)}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    return (
      <Text
        key={i}
        className="text-ink/80 text-base mb-2 leading-6"
        style={{ fontFamily: "CormorantGaramond_400Regular" }}
      >
        {renderInline(block)}
      </Text>
    );
  });
}

function renderInline(node: RichTextNode): string {
  if (node.text != null) return node.text;
  if (node.type === "mention") return `@${node.attrs?.["label"] ?? ""}`;
  return (node.content ?? []).map(renderInline).join("");
}
