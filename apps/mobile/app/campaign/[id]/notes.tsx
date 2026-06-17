import { View, Text, Pressable, Alert } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import RichTextEditor from "@/components/RichTextEditor";
import { schema } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";
import type { EditorBridge } from "@10play/tentap-editor";

type CampaignSettings = {
  notes?: string;
  nextSession?: string;
  worldNotes?: RichTextNode;
};

export default function WorldNotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const editorRef = useRef<EditorBridge | null>(null);
  const [initialContent, setInitialContent] = useState<RichTextNode | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const campaign = db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .get();
    if (campaign) {
      const s = (campaign.settings ?? {}) as CampaignSettings;
      setInitialContent((s.worldNotes ?? null) as RichTextNode | null);
    }
    setLoaded(true);
  }, [id]);

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
      const campaign = db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, id))
        .get();

      const existing = (campaign?.settings ?? {}) as CampaignSettings;
      db.update(schema.campaigns)
        .set({
          settings: {
            ...existing,
            worldNotes: editorBody ?? undefined,
          },
        })
        .where(eq(schema.campaigns.id, id))
        .run();
      router.back();
    } catch (e) {
      Alert.alert(
        "Save Failed",
        e instanceof Error ? e.message : "An unexpected error occurred",
      );
    }
  };

  if (!loaded) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: "World Notes",
          headerRight: () => (
            <Pressable
              onPress={save}
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: "#A07A2C",
                }}
              >
                Save
              </Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <View style={{ flex: 1, padding: 16 }}>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: "#8A7D6D",
              marginBottom: 12,
              lineHeight: 18,
            }}
          >
            Campaign lore, house rules, backstory, and anything the GM needs at a glance. Supports @-mentions to link entities.
          </Text>
          <View style={{ flex: 1 }}>
            <RichTextEditor
              initialContent={initialContent}
              editorRef={editorRef}
              minHeight={520}
            />
          </View>
        </View>
      </ParchmentScreen>
    </>
  );
}
