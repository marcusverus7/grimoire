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
  const [status, setStatus] = useState<"planned" | "played">("planned");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const session = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .get();
    if (session) {
      setTitle(session.title ?? "");
      setNumber(session.number);
      setPlayedOn(session.playedOn ?? "");
      setStatus(session.status);
    }
    setLoaded(true);
  }, [sessionId]);

  const save = () => {
    db.update(schema.sessions)
      .set({
        title: title.trim() || null,
        playedOn: playedOn.trim() || null,
        status,
      })
      .where(eq(schema.sessions.id, sessionId))
      .run();
    router.back();
  };

  const deleteSession = () => {
    Alert.alert("Delete Session", `Remove Session ${number} permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          db.delete(schema.sessions)
            .where(eq(schema.sessions.id, sessionId))
            .run();
          router.back();
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
