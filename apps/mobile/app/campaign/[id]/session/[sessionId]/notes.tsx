import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type NoteEntry = { id: string; text: string; ts: number };

const NOTE_KEY = (sessionId: string) => `session_notes_${sessionId}`;

function loadNotes(sessionId: string): NoteEntry[] {
  const row = db.select().from(schema.appKv).where(eq(schema.appKv.key, NOTE_KEY(sessionId))).get();
  if (!row) return [];
  try { return JSON.parse(row.value as string) as NoteEntry[]; } catch { return []; }
}

function saveNotes(sessionId: string, notes: NoteEntry[]) {
  const key = NOTE_KEY(sessionId);
  const existing = db.select().from(schema.appKv).where(eq(schema.appKv.key, key)).get();
  const val = JSON.stringify(notes);
  if (existing) {
    db.update(schema.appKv).set({ value: val }).where(eq(schema.appKv.key, key)).run();
  } else {
    db.insert(schema.appKv).values({ key, value: val }).run();
  }
}

export default function SessionNotesScreen() {
  const { id: campaignId, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [input, setInput] = useState("");
  const [sessionNum, setSessionNum] = useState<number | null>(null);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(() => {
    const s = db.select({ number: schema.sessions.number }).from(schema.sessions).where(eq(schema.sessions.id, sessionId)).get();
    setSessionNum(s?.number ?? null);
    setNotes(loadNotes(sessionId));
  }, [sessionId]);

  useFocusEffect(load);

  const addNote = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const newNotes = [...notes, { id: newId(), text: trimmed, ts: Date.now() }];
    setNotes(newNotes);
    saveNotes(sessionId, newNotes);
    setInput("");
  };

  const deleteNote = (id: string) => {
    const newNotes = notes.filter((n) => n.id !== id);
    setNotes(newNotes);
    saveNotes(sessionId, newNotes);
  };

  const clearAll = () => {
    Alert.alert("Clear Notes", "Delete all scene notes for this session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setNotes([]);
          saveNotes(sessionId, []);
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: sessionNum != null ? `Session ${sessionNum} Notes` : "Scene Notes",
          headerRight: notes.length > 0 ? () => (
            <Pressable onPress={clearAll} style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#7A241880" }}>Clear</Text>
            </Pressable>
          ) : undefined,
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
              Quick scene notes
            </Text>

            {/* Input */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, borderBottomWidth: 1, borderBottomColor: "#A07A2C25" }}>
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder="Jot a note…"
                placeholderTextColor="#2C201440"
                multiline
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  color: "#2C2014",
                  flex: 1,
                  paddingVertical: 10,
                  paddingRight: 8,
                  lineHeight: 22,
                }}
              />
              <Pressable
                onPress={addNote}
                disabled={!input.trim()}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: input.trim() ? "#A07A2C" : "#A07A2C30",
                  borderRadius: 2,
                  alignSelf: "flex-end",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: input.trim() ? "#FAF5EA" : "#FAF5EA80" }}>Add</Text>
              </Pressable>
            </View>

            {/* Notes list */}
            {notes.length === 0 ? (
              <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: "#2C201440", textAlign: "center", marginTop: 24 }}>
                No notes yet — jot quick scene beats, NPC names, or player moments above.
              </Text>
            ) : (
              [...notes].reverse().map((note) => (
                <View
                  key={note.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    paddingVertical: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: "#A07A2C15",
                  }}
                >
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#A07A2C60", marginTop: 9, marginRight: 12 }} />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: "#2C2014", flex: 1, lineHeight: 22 }}>
                    {note.text}
                  </Text>
                  <Pressable
                    onPress={() => deleteNote(note.id)}
                    style={{ paddingLeft: 12, paddingTop: 4 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C201430" }}>✕</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </ParchmentScreen>
    </>
  );
}
