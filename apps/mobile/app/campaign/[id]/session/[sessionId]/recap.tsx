import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { WaxSeal } from "@/components/WaxSeal";
import {
  schema,
  nodeText,
  buildManualRecapDoc,
  buildAiRecapPrompt,
  richTextToMarkdown,
  generateShareSlug,
} from "@grimoire/core";
import type { RichTextNode, RichTextDoc, RecapTone, Beat, AiRecapInput } from "@grimoire/core";

const RECAP_API = "https://grimoire-recap-web.vercel.app/api/generate-recap";

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
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [editedAiText, setEditedAiText] = useState("");

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

  const manualRecapDoc = buildManualRecapDoc({
    campaignName,
    sessionNumber: session?.number ?? 0,
    sessionTitle: session?.title,
    beats: selectedBeats,
  });

  const manualRecapText = (manualRecapDoc.content ?? [])
    .slice(1)
    .map((n) => nodeText(n))
    .filter(Boolean)
    .join("\n\n");

  const recapText = aiText !== null ? editedAiText : manualRecapText;

  const toggleBlock = (index: number) => {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, selected: !b.selected } : b)),
    );
  };

  const generateAiRecap = async () => {
    if (!session?.body) return;
    setAiGenerating(true);
    setAiText(null);
    try {
      const notesMarkdown = richTextToMarkdown(session.body as RichTextNode);

      const pcEntities = db
        .select({ name: schema.entities.name })
        .from(schema.entities)
        .where(and(eq(schema.entities.campaignId, campaignId), eq(schema.entities.kind, "pc")))
        .all();

      const input: AiRecapInput = {
        campaignName,
        sessionNumber: session.number,
        sessionTitle: session.title,
        tone,
        sessionNotesMarkdown: notesMarkdown,
        beats: selectedBeats.length > 0 ? selectedBeats : undefined,
        characterNames: pcEntities.map((e) => e.name),
      };

      const res = await fetch(RECAP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { recapText?: string; error?: string };
      if (!data.recapText) throw new Error(data.error ?? "No recap text returned");

      setAiText(data.recapText);
      setEditedAiText(data.recapText);
      setPreview(true);
    } catch (e) {
      Alert.alert(
        "AI Generation Failed",
        e instanceof Error ? e.message : "Could not reach the AI service. Check your connection.",
      );
    } finally {
      setAiGenerating(false);
    }
  };

  const buildSaveDoc = (): RichTextDoc => {
    if (aiText !== null) {
      const paragraphs = editedAiText.split(/\n\n+/).filter(Boolean);
      return {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: `Previously on ${campaignName} — Session ${session?.number ?? 0}${session?.title ? `: ${session.title}` : ""}` }],
          },
          ...paragraphs.map((p) => ({
            type: "paragraph",
            content: [{ type: "text", text: p }],
          })),
        ],
      };
    }
    return manualRecapDoc;
  };

  const saveRecap = async () => {
    if (aiText === null && selectedBeats.length === 0) {
      Alert.alert("No beats selected", "Select at least one paragraph for the recap.");
      return;
    }

    setSaving(true);
    try {
      const now = Date.now();
      const saveDoc = buildSaveDoc();

      if (existingRecap) {
        db.update(schema.recaps)
          .set({ body: saveDoc, tone, publishedAt: new Date(now) })
          .where(eq(schema.recaps.id, existingRecap.id))
          .run();

        Alert.alert(
          "Recap Updated",
          `Share link: grimoire-recap-web.vercel.app/r/${existingRecap.shareSlug}`,
          [{ text: "OK", onPress: () => router.back() }],
        );
      } else {
        const recapId = newId();
        const slug = generateShareSlug();
        db.insert(schema.recaps)
          .values({ id: recapId, sessionId, body: saveDoc, tone, shareSlug: slug, publishedAt: new Date(now) })
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

            {/* AI Generate button */}
            <Pressable
              onPress={generateAiRecap}
              disabled={aiGenerating || blocks.length === 0}
              className={`mt-5 py-3 rounded-sm border items-center flex-row justify-center ${
                aiGenerating || blocks.length === 0
                  ? "border-ink/10 bg-parchment/5"
                  : "border-gold/40 bg-gold/8"
              }`}
            >
              {aiGenerating ? (
                <>
                  <ActivityIndicator size="small" color="#A07A2C" />
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      color: "#A07A2C",
                      marginLeft: 8,
                    }}
                  >
                    Generating…
                  </Text>
                </>
              ) : (
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: blocks.length === 0 ? "#8A7D6D" : "#A07A2C",
                  }}
                >
                  ✦ Generate with AI
                </Text>
              )}
            </Pressable>

            {/* Manual preview button */}
            <Pressable
              onPress={() => setPreview(true)}
              disabled={selectedBeats.length === 0}
              className={`mt-3 py-3 rounded-sm border items-center ${
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
              {aiText !== null ? "AI Recap — Edit before saving" : "Preview"}
            </Text>

            {aiText !== null ? (
              <TextInput
                value={editedAiText}
                onChangeText={setEditedAiText}
                multiline
                style={{
                  fontFamily: "CormorantGaramond_400Regular",
                  fontSize: 16,
                  lineHeight: 26,
                  color: "#2C2014",
                  backgroundColor: "rgba(236, 227, 207, 0.3)",
                  borderWidth: 1,
                  borderColor: "rgba(160, 122, 44, 0.2)",
                  borderRadius: 2,
                  padding: 12,
                  marginBottom: 16,
                  minHeight: 200,
                  textAlignVertical: "top",
                }}
              />
            ) : (
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
            )}

            <View className="mb-3 p-2 bg-parchment/5 rounded-sm border border-gold/10">
              <Text
                className="text-ink-faint text-xs text-center"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                Tone: {TONES.find((t) => t.value === tone)?.label ?? tone}
                {aiText !== null ? " · AI-generated" : ""}
              </Text>
            </View>

            <GoldRule />

            {/* Back / Save buttons */}
            <View className="flex-row mt-5">
              <Pressable
                onPress={() => {
                  setPreview(false);
                  if (aiText !== null) {
                    setAiText(null);
                    setEditedAiText("");
                  }
                }}
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
