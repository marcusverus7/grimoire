import { View, Text, TextInput, Pressable, ScrollView, Modal } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { db, getKv, setKv } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

type TodoItem = { id: string; text: string; done: boolean; ts: number };

const PREP_TEMPLATES: { label: string; tasks: string[] }[] = [
  {
    label: "Standard Prep",
    tasks: ["Review last session notes", "Check open quests", "Plan 3 scene hooks", "Stat up new NPCs", "Prepare opening scene"],
  },
  {
    label: "Arc Climax Prep",
    tasks: ["Review arc goals + progress", "Set up climax encounter", "Plan fallout of major decision", "Update faction states", "Prepare dramatic NPC reveal"],
  },
  {
    label: "Combat Session",
    tasks: ["Balance encounter CR", "Prepare battle map description", "Set up initiative tracker", "Plan monster tactics", "Prepare loot + XP reward"],
  },
  {
    label: "Roleplay Session",
    tasks: ["Write NPC motivations + hooks", "Prepare 2 rumours to drop", "Plan a moral dilemma scene", "Update faction relationships", "Identify PC spotlight moment"],
  },
];

function kvKey(campaignId: string) { return `todos_${campaignId}`; }

function loadTodos(campaignId: string): TodoItem[] {
  const raw = getKv(kvKey(campaignId));
  if (!raw) return [];
  try { return JSON.parse(raw) as TodoItem[]; } catch { return []; }
}

function saveTodos(campaignId: string, todos: TodoItem[]) {
  setKv(kvKey(campaignId), JSON.stringify(todos));
}

export default function TodosScreen() {
  useThemeTick();
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [input, setInput] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setTodos(loadTodos(campaignId));
    }, [campaignId]),
  );

  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    const next = [{ id: newId(), text, done: false, ts: Date.now() }, ...todos];
    setTodos(next);
    saveTodos(campaignId, next);
    setInput("");
  };

  const toggle = (id: string) => {
    const next = todos.map((t) => t.id === id ? { ...t, done: !t.done } : t);
    setTodos(next);
    saveTodos(campaignId, next);
  };

  const deleteDone = () => {
    const next = todos.filter((t) => !t.done);
    setTodos(next);
    saveTodos(campaignId, next);
  };

  const applyTemplate = (tasks: string[]) => {
    const newItems: TodoItem[] = tasks.map((text, i) => ({ id: newId(), text, done: false, ts: Date.now() + i }));
    const next = [...newItems, ...todos];
    setTodos(next);
    saveTodos(campaignId, next);
    setShowTemplates(false);
  };

  const deleteTodo = (id: string) => {
    const next = todos.filter((t) => t.id !== id);
    setTodos(next);
    saveTodos(campaignId, next);
  };

  const pending = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <>
      <Stack.Screen options={{ title: "Prep To-Do", headerRight: () => (
        <Pressable onPress={() => setShowTemplates(true)} style={{ marginRight: 8 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.gold }}>Templates</Text>
        </Pressable>
      ) }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

          {/* Add input */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={addTodo}
              placeholder="Add a prep task…"
              placeholderTextColor={withAlpha("ink", 0x40 / 255)}
              returnKeyType="done"
              style={{
                flex: 1,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: color.ink,
                borderBottomWidth: 1,
                borderBottomColor: withAlpha("gold", 0x40 / 255),
                paddingBottom: 6,
              }}
            />
            <Pressable
              onPress={addTodo}
              style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: color.oxblood, borderRadius: 2 }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.onAccent }}>Add</Text>
            </Pressable>
          </View>

          {/* Pending */}
          {pending.length === 0 && done.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <Text style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 16, color: withAlpha("inkSoft", 0x80 / 255), fontStyle: "italic" }}>
                No prep tasks yet.
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("inkSoft", 0x50 / 255), marginTop: 6 }}>
                Add tasks above — stat up NPCs, plan scenes, write hooks.
              </Text>
            </View>
          ) : null}

          {pending.map((todo) => (
            <Pressable
              key={todo.id}
              onPress={() => toggle(todo.id)}
              onLongPress={() => deleteTodo(todo.id)}
              style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: withAlpha("gold", 0x15 / 255) }}
            >
              <View style={{
                width: 20, height: 20, borderRadius: 2, borderWidth: 1.5,
                borderColor: withAlpha("gold", 0x60 / 255), marginRight: 12, marginTop: 2, alignItems: "center", justifyContent: "center",
              }} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, flex: 1, lineHeight: 22 }}>
                {todo.text}
              </Text>
            </Pressable>
          ))}

          {/* Done section */}
          {done.length > 0 ? (
            <View style={{ marginTop: 20 }}>
              <GoldRule />
              <Pressable
                onPress={() => setShowDone((v) => !v)}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: withAlpha("gold", 0x60 / 255), textTransform: "uppercase", letterSpacing: 1.2, flex: 1 }}>
                  Done ({done.length})
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("gold", 0x80 / 255) }}>
                  {showDone ? "▲" : "▼"}
                </Text>
              </Pressable>
              {showDone ? (
                <>
                  {done.map((todo) => (
                    <Pressable
                      key={todo.id}
                      onPress={() => toggle(todo.id)}
                      onLongPress={() => deleteTodo(todo.id)}
                      style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: withAlpha("gold", 0x10 / 255) }}
                    >
                      <View style={{
                        width: 20, height: 20, borderRadius: 2, borderWidth: 1.5,
                        borderColor: withAlpha("success", 0x60 / 255), backgroundColor: withAlpha("success", 0x20 / 255),
                        marginRight: 12, marginTop: 2, alignItems: "center", justifyContent: "center",
                      }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.success }}>✓</Text>
                      </View>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: withAlpha("inkSoft", 0x60 / 255), flex: 1, lineHeight: 22, textDecorationLine: "line-through" }}>
                        {todo.text}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={deleteDone}
                    style={{ paddingVertical: 10, alignItems: "center" }}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("oxblood", 0x70 / 255) }}>
                      Clear completed
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>

      {/* Templates modal */}
      <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
        <Pressable style={{ flex: 1, backgroundColor: withAlpha("shadow", 0x40 / 255), justifyContent: "flex-end" }} onPress={() => setShowTemplates(false)}>
          <Pressable style={{ backgroundColor: color.parchment, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20, paddingBottom: 36 }} onPress={() => {}}>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.ink, marginBottom: 16 }}>Prep Templates</Text>
            {PREP_TEMPLATES.map((t) => (
              <Pressable
                key={t.label}
                onPress={() => applyTemplate(t.tasks)}
                style={{ paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: withAlpha("gold", 0x20 / 255) }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: color.ink, marginBottom: 4 }}>{t.label}</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.inkFaint }} numberOfLines={2}>
                  {t.tasks.join(" · ")}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
