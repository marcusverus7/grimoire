import { View, Text, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useRef } from "react";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import RichTextEditor from "@/components/RichTextEditor";
import { schema } from "@grimoire/core";
import type { EditorBridge } from "@10play/tentap-editor";

export default function NewJournalEntryScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const router = useRouter();
  const editorRef = useRef<EditorBridge | null>(null);

  const handleSave = async () => {
    if (!editorRef.current) return;
    try {
      const json = await editorRef.current.getJSON();
      db.insert(schema.journals)
        .values({
          id: newId(),
          characterProfileId: profileId,
          campaignId: null,
          body: json,
          createdAt: new Date(),
        })
        .run();
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save journal entry");
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "New Journal Entry",
          headerRight: () => (
            <Pressable onPress={handleSave} style={{ marginRight: 8 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#A07A2C" }}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#5A4D3E80", marginBottom: 12, textAlign: "center" }}>
            Write in your character's voice
          </Text>
          <RichTextEditor editorRef={editorRef} minHeight={400} />
        </View>
      </ParchmentScreen>
    </>
  );
}
