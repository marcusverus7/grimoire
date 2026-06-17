import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getKv, setKv } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";

type RandTable = { id: string; name: string; items: string[] };

function loadTables(campaignId: string): RandTable[] {
  const raw = getKv(`rtables_${campaignId}`);
  if (!raw) return [];
  try { return JSON.parse(raw) as RandTable[]; } catch { return []; }
}

function saveTables(campaignId: string, tables: RandTable[]): void {
  setKv(`rtables_${campaignId}`, JSON.stringify(tables));
}

export default function TablesScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const [tables, setTables] = useState<RandTable[]>([]);
  const [lastRoll, setLastRoll] = useState<{ tableName: string; result: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<RandTable | null>(null);
  const [formName, setFormName] = useState("");
  const [formItems, setFormItems] = useState("");

  useFocusEffect(useCallback(() => {
    setTables(loadTables(campaignId));
  }, [campaignId]));

  const roll = (table: RandTable) => {
    if (table.items.length === 0) return;
    const result = table.items[Math.floor(Math.random() * table.items.length)]!;
    setLastRoll({ tableName: table.name, result });
  };

  const openCreate = () => {
    setEditTarget(null);
    setFormName("");
    setFormItems("");
    setShowCreate(true);
  };

  const openEdit = (table: RandTable) => {
    setEditTarget(table);
    setFormName(table.name);
    setFormItems(table.items.join("\n"));
    setShowCreate(true);
  };

  const saveTable = () => {
    const name = formName.trim();
    if (!name) return;
    const items = formItems
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const next = editTarget
      ? tables.map((t) => (t.id === editTarget.id ? { ...t, name, items } : t))
      : [...tables, { id: newId(), name, items }];
    saveTables(campaignId, next);
    setTables(next);
    setShowCreate(false);
  };

  const deleteTable = (table: RandTable) => {
    Alert.alert("Delete Table", `Remove "${table.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const next = tables.filter((t) => t.id !== table.id);
          saveTables(campaignId, next);
          setTables(next);
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Random Tables",
          headerRight: () => (
            <Pressable onPress={openCreate} style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 22, color: "#A07A2C", lineHeight: 28 }}>+</Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* Last roll banner */}
          {lastRoll ? (
            <View style={{ backgroundColor: "#7A241810", borderWidth: 1, borderColor: "#7A241830", borderRadius: 2, padding: 16, marginBottom: 20, alignItems: "center" }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#7A241880", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
                {lastRoll.tableName}
              </Text>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 24, color: "#2C2014", textAlign: "center" }}>
                {lastRoll.result}
              </Text>
            </View>
          ) : null}

          {tables.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014", marginBottom: 8 }}>
                No tables yet
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", textAlign: "center", lineHeight: 20, maxWidth: 260 }}>
                Create encounter tables, loot tables, weather tables, or any other random prompt list.
              </Text>
              <Pressable
                onPress={openCreate}
                style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2 }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
                  Create First Table
                </Text>
              </Pressable>
            </View>
          ) : (
            tables.map((table, i) => (
              <View key={table.id}>
                {i > 0 ? <GoldRule className="my-4" /> : null}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: "#2C2014", flex: 1 }}>
                    {table.name}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", marginRight: 12 }}>
                    d{table.items.length}
                  </Text>
                  <Pressable
                    onPress={() => openEdit(table)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C80" }}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => deleteTable(table)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#7A241860" }}>✕</Text>
                  </Pressable>
                </View>

                {/* Items list */}
                <View style={{ marginBottom: 12 }}>
                  {table.items.slice(0, 6).map((item, j) => (
                    <View key={j} style={{ flexDirection: "row", paddingVertical: 3, borderBottomWidth: j < Math.min(table.items.length, 6) - 1 ? 0.5 : 0, borderBottomColor: "#A07A2C12" }}>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D", width: 24 }}>{j + 1}.</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#3A2E24", flex: 1 }}>{item}</Text>
                    </View>
                  ))}
                  {table.items.length > 6 ? (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D80", marginTop: 4 }}>
                      +{table.items.length - 6} more entries
                    </Text>
                  ) : null}
                </View>

                {/* Roll button */}
                <Pressable
                  onPress={() => roll(table)}
                  disabled={table.items.length === 0}
                  style={{
                    backgroundColor: "#7A2418",
                    borderWidth: 1,
                    borderColor: "#C9A24A40",
                    borderRadius: 2,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1.5 }}>
                    Roll d{table.items.length}
                  </Text>
                </Pressable>
              </View>
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>

      {/* Create / Edit Table Modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable
            onPress={() => setShowCreate(false)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          >
            <Pressable
              onPress={() => {}}
              style={{ backgroundColor: "#FAF5EA", borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderColor: "#A07A2C30", padding: 20, maxHeight: "80%" }}
            >
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014", textAlign: "center", marginBottom: 16 }}>
                {editTarget ? "Edit Table" : "New Table"}
              </Text>

              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>
                Table Name
              </Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Random Encounters"
                placeholderTextColor="#2C201440"
                autoFocus
                style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 18, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 8, marginBottom: 16 }}
              />

              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>
                Entries (one per line)
              </Text>
              <TextInput
                value={formItems}
                onChangeText={setFormItems}
                placeholder={"Goblin ambush\nAncient ruins\nMerchant caravan"}
                placeholderTextColor="#2C201440"
                multiline
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: "#2C2014",
                  borderWidth: 1,
                  borderColor: "#A07A2C25",
                  borderRadius: 2,
                  padding: 12,
                  minHeight: 140,
                  textAlignVertical: "top",
                  lineHeight: 22,
                  marginBottom: 20,
                }}
              />

              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                <Pressable onPress={() => setShowCreate(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#5A4D3E" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveTable}
                  disabled={!formName.trim()}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 2,
                    backgroundColor: formName.trim() ? "#7A2418" : "#7A241830",
                    borderWidth: 1,
                    borderColor: "#A07A2C30",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: formName.trim() ? "#FAF5EA" : "#FAF5EA60", textTransform: "uppercase", letterSpacing: 1 }}>
                    Save
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
