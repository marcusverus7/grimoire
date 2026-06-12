import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import RichTextEditor from "@/components/RichTextEditor";
import { schema, computeLinkChanges } from "@grimoire/core";
import type { RichTextNode, EntityLinkRow } from "@grimoire/core";
import type { EditorBridge } from "@10play/tentap-editor";

type Session = typeof schema.sessions.$inferSelect;

export default function SessionFormScreen() {
  const { id: campaignId, sessionId } = useLocalSearchParams<{
    id: string;
    sessionId: string;
  }>();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [number, setNumber] = useState(1);
  const [playedOn, setPlayedOn] = useState("");
  const [body, setBody] = useState<RichTextNode | null>(null);
  const [status, setStatus] = useState<"planned" | "played">("planned");
  const [loaded, setLoaded] = useState(false);
  const editorRef = useRef<EditorBridge | null>(null);

  useEffect(() => {
    const session = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .get();
    if (!session) {
      Alert.alert("Error", "Session not found");
      router.back();
      return;
    }
    setTitle(session.title ?? "");
    setNumber(session.number);
    setPlayedOn(session.playedOn ?? "");
    setBody(session.body as RichTextNode | null);
    setStatus(session.status);
    setLoaded(true);
  }, [sessionId]);

  const save = async () => {
    let editorBody: RichTextNode | null = null;
    if (editorRef.current) {
      const json = await editorRef.current.getJSON();
      const doc = json as RichTextNode;
      const hasContent = doc.content?.some(
        (n) => n.type !== "paragraph" || (n.content && n.content.length > 0),
      );
      editorBody = hasContent ? doc : null;
    }

    try {
      db.update(schema.sessions)
        .set({
          title: title.trim() || null,
          playedOn: playedOn.trim() || null,
          body: editorBody,
          status,
        })
        .where(eq(schema.sessions.id, sessionId))
        .run();

      if (editorBody) {
        const existing = db
          .select()
          .from(schema.entityLinks)
          .where(
            and(
              eq(schema.entityLinks.fromType, "session"),
              eq(schema.entityLinks.fromId, sessionId),
            ),
          )
          .all() as EntityLinkRow[];

        const changes = computeLinkChanges({
          campaignId,
          fromType: "session",
          fromId: sessionId,
          body: editorBody,
          existing,
        });

        for (const ins of changes.inserts) {
          db.insert(schema.entityLinks)
            .values({ id: newId(), ...ins })
            .run();
        }
        for (const delId of changes.deleteIds) {
          db.delete(schema.entityLinks)
            .where(eq(schema.entityLinks.id, delId))
            .run();
        }
        for (const upd of changes.snippetUpdates) {
          db.update(schema.entityLinks)
            .set({ contextSnippet: upd.contextSnippet })
            .where(eq(schema.entityLinks.id, upd.id))
            .run();
        }
      }

      router.back();
    } catch (e) {
      Alert.alert("Save Failed", e instanceof Error ? e.message : "An unexpected error occurred");
    }
  };

  const deleteSession = () => {
    Alert.alert("Delete Session", `Remove Session ${number} permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          try {
            db.delete(schema.sessions)
              .where(eq(schema.sessions.id, sessionId))
              .run();
            router.back();
          } catch (e) {
            Alert.alert("Delete Failed", e instanceof Error ? e.message : "An unexpected error occurred");
          }
        },
      },
    ]);
  };

  if (!loaded) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: `Session ${number}`,
        }}
      />
      <ScrollView
        className="flex-1 bg-leather"
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Session number (read-only) */}
        <Label text="Session Number" />
        <Text
          className="text-parchment text-xl mb-5"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          {number}
        </Text>

        {/* Title */}
        <Label text="Title (optional)" />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. The Siege of Ashford"
          placeholderTextColor="#ECE3CF40"
          className="border-b border-gold/20 pb-2 mb-5 text-lg"
          style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: "#ECE3CF" }}
        />

        {/* Played on */}
        <Label text="Played On (YYYY-MM-DD)" />
        <TextInput
          value={playedOn}
          onChangeText={setPlayedOn}
          placeholder="2025-06-10"
          placeholderTextColor="#ECE3CF40"
          className="border-b border-gold/20 pb-2 mb-5"
          style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#ECE3CF" }}
        />

        {/* Status */}
        <Label text="Status" />
        <View className="flex-row mb-6">
          <Pressable
            onPress={() => setStatus("planned")}
            className={`mr-3 px-4 py-2 rounded-sm border ${
              status === "planned"
                ? "border-parchment/40 bg-parchment/5"
                : "border-parchment/20"
            }`}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: status === "planned" ? "#ECE3CF" : "#ECE3CF60",
              }}
            >
              Planned
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStatus("played")}
            className={`px-4 py-2 rounded-sm border ${
              status === "played"
                ? "border-gold bg-gold/10"
                : "border-parchment/20"
            }`}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: status === "played" ? "#A07A2C" : "#ECE3CF60",
              }}
            >
              Played
            </Text>
          </Pressable>
        </View>

        {/* Session Notes */}
        <Label text="Session Notes" />
        <View style={{ height: 300, marginBottom: 20 }}>
          <RichTextEditor
            initialContent={body}
            editorRef={editorRef}
            minHeight={300}
          />
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
            Save Session
          </Text>
        </Pressable>

        {/* Delete */}
        <Pressable onPress={deleteSession} className="mt-4 py-3 items-center">
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: "#7A241880",
            }}
          >
            Delete Session
          </Text>
        </Pressable>

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
