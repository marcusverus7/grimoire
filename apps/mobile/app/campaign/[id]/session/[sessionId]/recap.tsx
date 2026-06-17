import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { WaxSeal } from "@/components/WaxSeal";
import {
  schema,
  nodeText,
  buildManualRecapDoc,
  generateShareSlug,
} from "@grimoire/core";
import type { RichTextNode, RecapTone, Beat } from "@grimoire/core";

type Session = typeof schema.sessions.$inferSelect;

const TONES: { value: RecapTone; label: string; desc: string }[] = [
  { value: "plain", label: "Plain", desc: "Clear, warm, neutral" },
  { value: "epic", label: "Epic", desc: "Mythic, sweeping, momentous" },
  { value: "noir", label: "Noir", desc: "Terse, atmospheric, wry" },
  { value: "comedy", label: "Comedy", desc: "Dry, affectionate, chaotic" },
];

export default function RecapScreen() {
  const { id: campaignId, sessionId } = useLocalSearchParams<{
    id: string;
    sessionId: string;
  }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [campaignName, setCampaignName] = useState("Unknown Campaign");
  const [blocks, setBlocks] = useState<{ text: string; selected: boolean }[]>([]);
  const [tone, setTone] = useState<RecapTone>("plain");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingRecap, setExistingRecap] = useState<{ id: string; shareSlug: string } | null>(null);

  useEffect(() => {
    const s = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .get();
    setSession(s ?? null);

    const c = db
      .select({ name: schema.campaigns.name })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .get();
    setCampaignName(c?.name ?? "Unknown Campaign");

    const existing = db
      .select({ id: schema.recaps.id, shareSlug: schema.recaps.shareSlug })
      .from(schema.recaps)
      .where(eq(schema.recaps.sessionId, sessionId))
      .get();
    if (existing) setExistingRecap(existing);

    if (s?.body) {
      const body = s.body as RichTextNode;
      const paragraphs = extractParagraphs(body);
      setBlocks(paragraphs.map((text) => ({ text, selected: true })));
    }
  }, [sessionId, campaignId]);

  const selectedBeats: Beat[] = blocks
    .filter((b) => b.selected)
    .map((b) => ({ blockRef: null, text: b.text }));

  const recapDoc = buildManualRecapDoc({
    campaignName,
    sessionNumber: session?.number ?? 0,
    sessionTitle: session?.title,
    beats: selectedBeats,
  });

  const recapText = (recapDoc.content ?? [])
    .slice(1)
    .map((n) => nodeText(n))
    .filter(Boolean)
    .join("\n\n");

  const toggleBlock = (index: number) => {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, selected: !b.selected } : b)),
    );
  };

  const saveRecap = async () => {
    if (selectedBeats.length === 0) {
      Alert.alert("No beats selected", "Select at least one paragraph for the recap.");
      return;
    }

    setSaving(true);
    try {
      const now = Date.now();
      const slug = generateShareSlug();

      if (existingRecap) {
        db.update(schema.recaps)
          .set({
            body: recapDoc,
            tone,
            publishedAt: new Date(now),
          })
          .where(eq(schema.recaps.id, existingRecap.id))
          .run();

        Alert.alert(
          "Recap Updated",
          `Share link: grimoire-recap-web.vercel.app/r/${existingRecap.shareSlug}`,
          [{ text: "OK", onPress: () => router.back() }],
        );
      } else {
        const recapId = newId();
        db.insert(schema.recaps)
          .values({
            id: recapId,
            sessionId,
            body: recapDoc,
            tone,
            shareSlug: slug,
            publishedAt: new Date(now),
          })
          .run();

        setExistingRecap({ id: recapId, shareSlug: slug });
        Alert.alert(
          "Recap Created",
          `Share link: grimoire-recap-web.vercel.app/r/${slug}`,
          [{ text: "OK", onPress: () => router.back() }],
        );
      }
    } catch (e) {
      Alert.alert("Save Failed", e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return (
      <View className="flex-1 bg-parchment items-center justify-center">
        <Text className="text-ink/50 text-sm" style={{ fontFamily: "Inter_400Regular" }}>
          Session not found
        </Text>
      </View>
    );
  }

  if (!session.body) {
    return (
      <>
        <Stack.Screen options={{ title: "Create Recap" }} />
        <View className="flex-1 bg-parchment items-center justify-center px-8">
          <WaxSeal size={48} />
          <Text
            className="text-ink text-center mt-4 text-lg"
            style={{ fontFamily: "CormorantGaramond_600SemiBold" }}
          >
            No session notes yet
          </Text>
          <Text
            className="text-ink/50 text-center mt-2 text-sm leading-5"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            Write session notes first, then return here to create a recap.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Create Recap" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        className="flex-1 bg-parchment"
        contentContainerStyle={{ padding: 20 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-4">
          <WaxSeal size={48} />
        </View>

        <Text
          className="text-ink text-xl text-center mb-1"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          Session {session.number} Recap
        </Text>
        {session.title && (
          <Text
            className="text-ink-soft text-sm text-center mb-4"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            {session.title}
          </Text>
        )}

        <GoldRule />

        {!preview ? (
          <>
            {/* Tone selector */}
            <Text
              className="text-gold/70 text-xs uppercase tracking-wider mt-5 mb-3"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Tone
            </Text>
            <View className="flex-row flex-wrap mb-5">
              {TONES.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => setTone(t.value)}
                  className={`mr-2 mb-2 px-3 py-2 rounded-sm border ${
                    tone === t.value ? "border-gold bg-gold/10" : "border-ink/20"
                  }`}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 12,
                      color: tone === t.value ? "#A07A2C" : "#5A4D3E",
                    }}
                  >
                    {t.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 10,
                      color: tone === t.value ? "#A07A2C80" : "#8A7D6D",
                      marginTop: 2,
                    }}
                  >
                    {t.desc}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Beat selector */}
            <Text
              className="text-gold/70 text-xs uppercase tracking-wider mb-3"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Select Beats ({selectedBeats.length}/{blocks.length})
            </Text>
            <Text
              className="text-ink-faint text-xs mb-4"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              Tap paragraphs to include or exclude them from the recap.
            </Text>

            {blocks.map((block, i) => (
              <Pressable
                key={i}
                onPress={() => toggleBlock(i)}
                className={`mb-2 p-3 rounded-sm border ${
                  block.selected
                    ? "border-gold/30 bg-gold/5"
                    : "border-ink/10 bg-parchment/3"
                }`}
              >
                <View className="flex-row">
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: block.selected ? "#A07A2C" : "#8A7D6D",
                      marginRight: 8,
                      marginTop: 1,
                    }}
                  >
                    {block.selected ? "✓" : "○"}
                  </Text>
                  <Text
                    className="flex-1"
                    style={{
                      fontFamily: "CormorantGaramond_400Regular",
                      fontSize: 15,
                      lineHeight: 22,
                      color: block.selected ? "#2C2014" : "#8A7D6D",
                    }}
                    numberOfLines={4}
                  >
                    {block.text}
                  </Text>
                </View>
              </Pressable>
            ))}

            <GoldRule />

            {/* Preview button */}
            <Pressable
              onPress={() => setPreview(true)}
              disabled={selectedBeats.length === 0}
              className={`mt-5 py-3 rounded-sm border items-center ${
                selectedBeats.length === 0
                  ? "border-ink/10 bg-parchment/5"
                  : "border-gold/30 bg-oxblood"
              }`}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: selectedBeats.length === 0 ? "#8A7D6D" : "#FAF5EA",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                }}
              >
                Preview Recap
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Preview mode */}
            <Text
              className="text-gold/70 text-xs uppercase tracking-wider mt-5 mb-3"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Preview
            </Text>

            <View className="p-4 bg-parchment/5 rounded-sm border border-gold/10 mb-4">
              <Text
                className="text-ink text-base mb-3"
                style={{
                  fontFamily: "CormorantGaramond_700Bold",
                  fontSize: 18,
                }}
              >
                Previously on {campaignName}
              </Text>
              <Text
                className="text-ink/80 text-base leading-7"
                style={{ fontFamily: "CormorantGaramond_400Regular" }}
              >
                {recapText}
              </Text>
            </View>

            <View className="mb-3 p-2 bg-parchment/5 rounded-sm border border-gold/10">
              <Text
                className="text-ink-faint text-xs text-center"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                Tone: {TONES.find((t) => t.value === tone)?.label ?? tone}
              </Text>
            </View>

            <GoldRule />

            {/* Back / Save buttons */}
            <View className="flex-row mt-5">
              <Pressable
                onPress={() => setPreview(false)}
                className="flex-1 mr-2 py-3 rounded-sm border border-ink/20 items-center"
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: "#5A4D3E",
                  }}
                >
                  Back to Edit
                </Text>
              </Pressable>
              <Pressable
                onPress={saveRecap}
                disabled={saving}
                className={`flex-1 ml-2 py-3 rounded-sm border border-gold/30 items-center ${
                  saving ? "bg-oxblood/50" : "bg-oxblood"
                }`}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                    color: "#FAF5EA",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {saving
                    ? "Saving…"
                    : existingRecap
                      ? "Update Recap"
                      : "Publish Recap"}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function extractParagraphs(body: RichTextNode): string[] {
  const paragraphs: string[] = [];
  for (const block of body.content ?? []) {
    const text = nodeText(block).replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}
