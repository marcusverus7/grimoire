import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, desc } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

type Quote = typeof schema.quotes.$inferSelect;

export default function QuotesScreen() {
  useThemeTick();
  const { id: campaignId, sessionId: sessionFilter } = useLocalSearchParams<{
    id: string;
    sessionId?: string;
  }>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [text, setText] = useState("");
  const [attribution, setAttribution] = useState("");

  const load = useCallback(() => {
    const rows = db
      .select()
      .from(schema.quotes)
      .where(eq(schema.quotes.campaignId, campaignId))
      .orderBy(desc(schema.quotes.createdAt))
      .all();
    setQuotes(rows);
  }, [campaignId]);

  useFocusEffect(load);

  const openAdd = () => {
    setEditQuote(null);
    setText("");
    setAttribution("");
    setShowAdd(true);
  };

  const openEdit = (q: Quote) => {
    setEditQuote(q);
    setText(q.text);
    setAttribution(q.attribution ?? "");
    setShowAdd(true);
  };

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editQuote) {
      db.update(schema.quotes)
        .set({ text: trimmed, attribution: attribution.trim() || null })
        .where(eq(schema.quotes.id, editQuote.id))
        .run();
    } else {
      db.insert(schema.quotes)
        .values({
          id: newId(),
          campaignId,
          sessionId: sessionFilter ?? null,
          text: trimmed,
          attribution: attribution.trim() || null,
          createdAt: new Date(Date.now()),
        })
        .run();
    }

    setShowAdd(false);
    load();
  };

  const deleteQuote = (q: Quote) => {
    Alert.alert("Delete Quote", "Remove this quote permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          db.delete(schema.quotes).where(eq(schema.quotes.id, q.id)).run();
          load();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Quotes & Moments",
          headerRight: () => (
            <Pressable onPress={openAdd} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  color: color.gold,
                }}
              >
                + Add
              </Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <FlatList
          data={quotes}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <GoldRule className="my-4" ornament />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
              <Text
                style={{
                  fontFamily: "CormorantGaramond_700Bold",
                  fontSize: 20,
                  color: color.ink,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                No quotes yet
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: withAlpha("inkSoft", 0x80 / 255),
                  textAlign: "center",
                  lineHeight: 20,
                  paddingHorizontal: 24,
                }}
              >
                Capture the lines that made your table laugh, gasp, or go quiet.
              </Text>
              <Pressable
                onPress={openAdd}
                style={{
                  marginTop: 24,
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: withAlpha("gold", 0x50 / 255),
                  borderRadius: 2,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                    color: color.gold,
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                  }}
                >
                  Add First Quote
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onLongPress={() => openEdit(item)} onPress={() => openEdit(item)}>
              <Text
                style={{
                  fontFamily: "CormorantGaramond_600SemiBold",
                  fontSize: 19,
                  color: color.ink,
                  fontStyle: "italic",
                  lineHeight: 28,
                  marginBottom: 6,
                }}
              >
                "{item.text}"
              </Text>
              {item.attribution ? (
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    color: color.gold,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  — {item.attribution}
                </Text>
              ) : null}
            </Pressable>
          )}
        />

        <Modal
          visible={showAdd}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAdd(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <Pressable
              onPress={() => setShowAdd(false)}
              style={{ flex: 1, backgroundColor: withAlpha("shadow", 0x88 / 255), justifyContent: "center", padding: 20 }}
            >
              <Pressable onPress={() => {}}>
                <View
                  style={{
                    backgroundColor: color.parchment,
                    borderRadius: 2,
                    borderWidth: 1,
                    borderColor: withAlpha("gold", 0x40 / 255),
                    padding: 20,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "CormorantGaramond_700Bold",
                      fontSize: 18,
                      color: color.ink,
                      textAlign: "center",
                      marginBottom: 16,
                    }}
                  >
                    {editQuote ? "Edit Quote" : "New Quote"}
                  </Text>

                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 10,
                      color: color.gold,
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                      marginBottom: 6,
                    }}
                  >
                    The Quote
                  </Text>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="What did they say?"
                    placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                    multiline
                    autoFocus
                    style={{
                      fontFamily: "CormorantGaramond_600SemiBold",
                      fontSize: 18,
                      color: color.ink,
                      fontStyle: "italic",
                      borderBottomWidth: 1,
                      borderBottomColor: withAlpha("gold", 0x30 / 255),
                      paddingBottom: 8,
                      marginBottom: 16,
                      minHeight: 60,
                    }}
                  />

                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 10,
                      color: color.gold,
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                      marginBottom: 6,
                    }}
                  >
                    Who said it (optional)
                  </Text>
                  <TextInput
                    value={attribution}
                    onChangeText={setAttribution}
                    placeholder="e.g. Thorin, or 'The whole table'"
                    placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                      color: color.ink,
                      borderBottomWidth: 1,
                      borderBottomColor: withAlpha("gold", 0x30 / 255),
                      paddingBottom: 8,
                      marginBottom: 20,
                    }}
                  />

                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    {editQuote ? (
                      <Pressable
                        onPress={() => {
                          setShowAdd(false);
                          deleteQuote(editQuote);
                        }}
                        style={{ paddingHorizontal: 4, paddingVertical: 10 }}
                      >
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 12,
                            color: withAlpha("oxblood", 0x80 / 255),
                          }}
                        >
                          Delete
                        </Text>
                      </Pressable>
                    ) : (
                      <View />
                    )}
                    <View style={{ flexDirection: "row" }}>
                      <Pressable
                        onPress={() => setShowAdd(false)}
                        style={{ paddingHorizontal: 16, paddingVertical: 10, marginRight: 8 }}
                      >
                        <Text
                          style={{
                            fontFamily: "Inter_500Medium",
                            fontSize: 13,
                            color: color.inkSoft,
                          }}
                        >
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={save}
                        disabled={!text.trim()}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                          backgroundColor: text.trim() ? color.oxblood : withAlpha("oxblood", 0x40 / 255),
                          borderRadius: 2,
                          borderWidth: 1,
                          borderColor: withAlpha("gold", 0x40 / 255),
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 12,
                            color: color.onAccent,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          Save
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </ParchmentScreen>
    </>
  );
}
