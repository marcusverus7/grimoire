import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db, getKv, setKv } from "@/lib/db";
import { newId } from "@/lib/id";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

type NoteEntry = { id: string; text: string; ts: number };

const NOTE_KEY = (sessionId: string) => `session_notes_${sessionId}`;

function loadNotes(sessionId: string): NoteEntry[] {
  const val = getKv(NOTE_KEY(sessionId));
  if (!val) return [];
  try { return JSON.parse(val) as NoteEntry[]; } catch { return []; }
}

function saveNotes(sessionId: string, notes: NoteEntry[]) {
  setKv(NOTE_KEY(sessionId), JSON.stringify(notes));
}

export default function SessionNotesScreen() {
  useThemeTick();
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
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: withAlpha("oxblood", 0x80 / 255) }}>Clear</Text>
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
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: withAlpha("gold", 0x80 / 255), textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
              Quick scene notes
            </Text>

            {/* Input */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, borderBottomWidth: 1, borderBottomColor: withAlpha("gold", 0x25 / 255) }}>
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder="Jot a note…"
                placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                multiline
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  color: color.ink,
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
                  backgroundColor: input.trim() ? color.gold : withAlpha("gold", 0x30 / 255),
                  borderRadius: 2,
                  alignSelf: "flex-end",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: input.trim() ? color.onAccent : withAlpha("onAccent", 0x80 / 255) }}>Add</Text>
              </Pressable>
            </View>

            {/* Notes list */}
            {notes.length === 0 ? (
              <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 16, color: withAlpha("ink", 0x40 / 255), textAlign: "center", marginTop: 24 }}>
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
                    borderBottomColor: withAlpha("gold", 0x15 / 255),
                  }}
                >
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: withAlpha("gold", 0x60 / 255), marginTop: 9, marginRight: 12 }} />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: color.ink, flex: 1, lineHeight: 22 }}>
                    {note.text}
                  </Text>
                  <Pressable
                    onPress={() => deleteNote(note.id)}
                    style={{ paddingLeft: 12, paddingTop: 4 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: withAlpha("ink", 0x30 / 255) }}>✕</Text>
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
