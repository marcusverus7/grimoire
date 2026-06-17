import { View, Text, Pressable, ScrollView, Share, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { RichTextRenderer } from "@/components/RichTextRenderer";
import { schema } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";

type RecapRow = {
  id: string;
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string | null;
  tone: string;
  shareSlug: string;
  publishedAt: number | null;
  body: RichTextNode | null;
};

export default function RecapsScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [recaps, setRecaps] = useState<RecapRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    const sessions = db
      .select({ id: schema.sessions.id, number: schema.sessions.number, title: schema.sessions.title })
      .from(schema.sessions)
      .where(eq(schema.sessions.campaignId, campaignId))
      .all();

    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    const rows = db
      .select()
      .from(schema.recaps)
      .all()
      .filter((r) => sessionMap.has(r.sessionId))
      .map((r): RecapRow => {
        const s = sessionMap.get(r.sessionId)!;
        return {
          id: r.id,
          sessionId: r.sessionId,
          sessionNumber: s.number,
          sessionTitle: s.title,
          tone: r.tone,
          shareSlug: r.shareSlug,
          publishedAt: r.publishedAt instanceof Date ? r.publishedAt.getTime() : (r.publishedAt as number | null),
          body: r.body as RichTextNode | null,
        };
      })
      .sort((a, b) => b.sessionNumber - a.sessionNumber);

    setRecaps(rows);
  }, [campaignId]);

  useFocusEffect(load);

  const shareRecap = async (r: RecapRow) => {
    const url = `https://grimoire-recap-web.vercel.app/r/${r.shareSlug}`;
    await Share.share({
      title: `Session ${r.sessionNumber} Recap`,
      message: url,
      url,
    });
  };

  const deleteRecap = (r: RecapRow) => {
    Alert.alert(
      "Delete Recap",
      `Remove the Session ${r.sessionNumber} recap? The share link will stop working.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            db.delete(schema.recaps).where(eq(schema.recaps.id, r.id)).run();
            setRecaps((prev) => prev.filter((x) => x.id !== r.id));
            if (expanded === r.id) setExpanded(null);
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Recaps" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {recaps.length === 0 ? (
            <View style={{ paddingTop: 40, alignItems: "center" }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014", marginBottom: 8 }}>
                No recaps yet
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", textAlign: "center", lineHeight: 20 }}>
                Mark a session as played, write session notes, then create a recap from the session detail screen.
              </Text>
            </View>
          ) : (
            <>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
                {recaps.length} recap{recaps.length !== 1 ? "s" : ""}
              </Text>
              {recaps.map((r) => (
                <View key={r.id} style={{ marginBottom: 16, borderWidth: 1, borderColor: "#A07A2C25", borderRadius: 2 }}>
                  {/* Header */}
                  <Pressable
                    onPress={() => setExpanded(expanded === r.id ? null : r.id)}
                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: "#2C2014" }}>
                        Session {r.sessionNumber}{r.sessionTitle ? `: ${r.sessionTitle}` : ""}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8 }}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80", textTransform: "capitalize" }}>
                          {r.tone}
                        </Text>
                        {r.publishedAt ? (
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E60" }}>
                            {new Date(r.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#A07A2C60", marginLeft: 8 }}>
                      {expanded === r.id ? "∧" : "∨"}
                    </Text>
                  </Pressable>

                  {/* Expanded body */}
                  {expanded === r.id ? (
                    <>
                      <GoldRule />
                      {r.body ? (
                        <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                          <RichTextRenderer body={r.body} campaignId={campaignId} />
                        </View>
                      ) : (
                        <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 15, color: "#2C201450", paddingHorizontal: 14, paddingVertical: 12, fontStyle: "italic" }}>
                          No body text
                        </Text>
                      )}
                      {/* Action buttons */}
                      <View style={{ flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#A07A2C20", paddingHorizontal: 14, paddingVertical: 10, gap: 12 }}>
                        <Pressable
                          onPress={() => shareRecap(r)}
                          style={{ flex: 1, paddingVertical: 8, borderRadius: 2, borderWidth: 1, borderColor: "#A07A2C40", backgroundColor: "#A07A2C08", alignItems: "center" }}
                        >
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
                            Share Link ↗
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => router.push(`/campaign/${campaignId}/session/${r.sessionId}/recap` as Parameters<typeof router.push>[0])}
                          style={{ flex: 1, paddingVertical: 8, borderRadius: 2, borderWidth: 1, borderColor: "#A07A2C40", backgroundColor: "#A07A2C08", alignItems: "center" }}
                        >
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
                            Edit
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => deleteRecap(r)}
                          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 2, borderWidth: 1, borderColor: "#7A241830", alignItems: "center" }}
                        >
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#7A241870", textTransform: "uppercase", letterSpacing: 1 }}>
                            Delete
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                </View>
              ))}
              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
