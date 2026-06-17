import { View, Text, ScrollView, Alert, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { RichTextRenderer } from "@/components/RichTextRenderer";
import { schema } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";

type Journal = typeof schema.journals.$inferSelect;

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function JournalEntryScreen() {
  const { profileId, journalId } = useLocalSearchParams<{ profileId: string; journalId: string }>();
  const router = useRouter();
  const [journal, setJournal] = useState<Journal | null>(null);

  const load = useCallback(() => {
    const j = db
      .select()
      .from(schema.journals)
      .where(eq(schema.journals.id, journalId))
      .get();
    setJournal(j ?? null);
  }, [journalId]);

  useFocusEffect(load);

  const handleDelete = () => {
    Alert.alert("Delete Entry", "Remove this journal entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          db.delete(schema.journals).where(eq(schema.journals.id, journalId)).run();
          router.back();
        },
      },
    ]);
  };

  if (!journal) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#5A4D3E80" }}>Entry not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Journal Entry",
          headerRight: () => (
            <Pressable onPress={handleDelete} style={{ marginRight: 8 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#7A241880" }}>Delete</Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C80", marginBottom: 16, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>
            {formatDate(journal.createdAt)}
          </Text>
          {journal.body ? (
            <RichTextRenderer body={journal.body as RichTextNode} />
          ) : (
            <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: "#5A4D3E60", textAlign: "center" }}>
              (empty entry)
            </Text>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}
