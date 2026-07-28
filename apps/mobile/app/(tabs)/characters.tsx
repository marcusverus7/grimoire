import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useState, useCallback } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { schema } from "@grimoire/core";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

type CharacterProfile = typeof schema.characterProfiles.$inferSelect;

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  retired: "Retired",
  archived: "Archived",
};
const STATUS_COLORS: Record<string, string> = {
  get active() { return color.success; },
  get retired() { return color.gold; },
  get archived() { return color.inkSoft; },
};

function getOrCreateGmId(): string {
  const existing = db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.username, "local_gm"))
    .get();
  if (existing) return existing.id;
  const id = newId();
  db.insert(schema.profiles)
    .values({ id, username: "local_gm", displayName: "Game Master", createdAt: new Date() })
    .run();
  return id;
}

export default function CharactersScreen() {
  useThemeTick();
  const router = useRouter();
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<CharacterProfile | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Create/edit form state
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [charClass, setCharClass] = useState("");
  const [race, setRace] = useState("");
  const [level, setLevel] = useState("");

  const load = useCallback(() => {
    const gmId = getOrCreateGmId();
    const rows = db
      .select()
      .from(schema.characterProfiles)
      .where(eq(schema.characterProfiles.ownerUserId, gmId))
      .all();
    setCharacters(rows);
  }, []);

  useFocusEffect(load);

  const openCreate = () => {
    setName("");
    setSummary("");
    setCharClass("");
    setRace("");
    setLevel("");
    setShowCreate(true);
  };

  const openEdit = (char: CharacterProfile) => {
    const attrs = (char.attrs as Record<string, unknown> | null) ?? {};
    setName(char.name);
    setSummary(char.summary ?? "");
    setCharClass(String(attrs["class"] ?? ""));
    setRace(String(attrs["race"] ?? ""));
    setLevel(String(attrs["level"] ?? ""));
    setShowEdit(char);
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const gmId = getOrCreateGmId();
    const attrs: Record<string, string> = {};
    if (charClass.trim()) attrs["class"] = charClass.trim();
    if (race.trim()) attrs["race"] = race.trim();
    if (level.trim()) attrs["level"] = level.trim();
    try {
      db.insert(schema.characterProfiles)
        .values({
          id: newId(),
          ownerUserId: gmId,
          name: trimmed,
          summary: summary.trim() || null,
          attrs: Object.keys(attrs).length > 0 ? attrs : null,
          status: "active",
          createdAt: new Date(),
        })
        .run();
      setShowCreate(false);
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not create character");
    }
  };

  const handleSave = () => {
    if (!showEdit) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const attrs: Record<string, string> = {};
    if (charClass.trim()) attrs["class"] = charClass.trim();
    if (race.trim()) attrs["race"] = race.trim();
    if (level.trim()) attrs["level"] = level.trim();
    try {
      db.update(schema.characterProfiles)
        .set({
          name: trimmed,
          summary: summary.trim() || null,
          attrs: Object.keys(attrs).length > 0 ? attrs : null,
        })
        .where(eq(schema.characterProfiles.id, showEdit.id))
        .run();
      setShowEdit(null);
      load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    }
  };

  const handleArchive = (char: CharacterProfile) => {
    const isArchived = char.status === "archived";
    const newStatus = isArchived ? "active" : "archived";
    Alert.alert(
      isArchived ? "Restore Character?" : "Archive Character?",
      `${isArchived ? "Restore" : "Archive"} ${char.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isArchived ? "Restore" : "Archive",
          onPress: () => {
            db.update(schema.characterProfiles)
              .set({ status: newStatus })
              .where(eq(schema.characterProfiles.id, char.id))
              .run();
            load();
          },
        },
      ],
    );
  };

  const visible = showArchived ? characters : characters.filter((c) => c.status !== "archived");
  const hasArchived = characters.some((c) => c.status === "archived");

  const CharacterForm = (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <Pressable
        onPress={() => { setShowCreate(false); setShowEdit(null); }}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 24 }}
      >
        <Pressable onPress={() => {}}>
          <ScrollView
            style={{ backgroundColor: color.paperCream, borderRadius: 4, borderWidth: 1, borderColor: withAlpha("gold", 0x30 / 255) }}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.ink, textAlign: "center", marginBottom: 20 }}>
              {showEdit ? "Edit Character" : "New Character"}
            </Text>

            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Character Name *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Kira Ashwood"
              placeholderTextColor={withAlpha("ink", 0x40 / 255)}
              autoFocus
              style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 18, color: color.ink, borderBottomWidth: 1, borderBottomColor: withAlpha("gold", 0x30 / 255), paddingBottom: 8, marginBottom: 16 }}
            />

            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              One-line Description
            </Text>
            <TextInput
              value={summary}
              onChangeText={setSummary}
              placeholder="e.g. Rogue, former Tidewarden courier"
              placeholderTextColor={withAlpha("ink", 0x40 / 255)}
              style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, borderBottomWidth: 1, borderBottomColor: withAlpha("gold", 0x30 / 255), paddingBottom: 8, marginBottom: 16 }}
            />

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 2 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Class</Text>
                <TextInput
                  value={charClass}
                  onChangeText={setCharClass}
                  placeholder="Rogue"
                  placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                  style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, borderBottomWidth: 1, borderBottomColor: withAlpha("gold", 0x30 / 255), paddingBottom: 8 }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Level</Text>
                <TextInput
                  value={level}
                  onChangeText={setLevel}
                  placeholder="3"
                  placeholderTextColor={withAlpha("ink", 0x40 / 255)}
                  keyboardType="numeric"
                  style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, borderBottomWidth: 1, borderBottomColor: withAlpha("gold", 0x30 / 255), paddingBottom: 8 }}
                />
              </View>
            </View>

            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: color.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Race / Ancestry
            </Text>
            <TextInput
              value={race}
              onChangeText={setRace}
              placeholder="e.g. Half-Elf"
              placeholderTextColor={withAlpha("ink", 0x40 / 255)}
              style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.ink, borderBottomWidth: 1, borderBottomColor: withAlpha("gold", 0x30 / 255), paddingBottom: 8, marginBottom: 24 }}
              onSubmitEditing={showEdit ? handleSave : handleCreate}
            />

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
              <Pressable onPress={() => { setShowCreate(false); setShowEdit(null); }} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.inkSoft }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={showEdit ? handleSave : handleCreate}
                disabled={!name.trim()}
                style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: name.trim() ? color.oxblood : withAlpha("oxblood", 0x30 / 255), borderRadius: 2, borderWidth: 1, borderColor: withAlpha("gold", 0x30 / 255) }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: name.trim() ? color.onAccent : withAlpha("parchment", 0x60 / 255), textTransform: "uppercase", letterSpacing: 1 }}>
                  {showEdit ? "Save" : "Create"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );

  return (
    <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <View style={{ flex: 1 }}>
        {visible.length === 0 && !hasArchived ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
            <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 32, color: color.gold, marginBottom: 16 }}>⚔</Text>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: color.ink, marginBottom: 8, textAlign: "center" }}>
              Your Characters Await
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.inkFaint, textAlign: "center", lineHeight: 20, marginBottom: 32 }}>
              Character passports travel with you across campaigns. Create one for each player at your table.
            </Text>
            <Pressable
              onPress={openCreate}
              style={{ backgroundColor: color.oxblood, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 2, borderWidth: 1, borderColor: withAlpha("gold", 0x30 / 255) }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: color.onAccent, textTransform: "uppercase", letterSpacing: 1 }}>
                Add Character
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <GoldRule ornament className="my-2" />}
            ListHeaderComponent={
              <View>
                {hasArchived && (
                  <Pressable onPress={() => setShowArchived((v) => !v)} style={{ alignSelf: "flex-end", marginBottom: 12 }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("inkSoft", 0x60 / 255) }}>
                      {showArchived ? "Hide archived" : "Show archived"}
                    </Text>
                  </Pressable>
                )}
              </View>
            }
            renderItem={({ item }) => {
              const attrs = (item.attrs as Record<string, string> | null) ?? {};
              const statusColor = STATUS_COLORS[item.status] ?? color.inkSoft;
              const classParts = [attrs["race"], attrs["class"], attrs["level"] ? `Lv ${attrs["level"]}` : ""].filter(Boolean).join(" · ");
              return (
                <Pressable
                  onPress={() => router.push(`/character/${item.id}` as Parameters<typeof router.push>[0])}
                  onLongPress={() => handleArchive(item)}
                  style={{ paddingVertical: 12, paddingHorizontal: 4 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 18, color: color.ink, flex: 1 }}>
                      {item.name}
                    </Text>
                    {item.status !== "active" && (
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: statusColor, textTransform: "uppercase", letterSpacing: 0.8 }}>
                        {STATUS_LABELS[item.status]}
                      </Text>
                    )}
                  </View>
                  {classParts ? (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.gold, marginTop: 2 }}>
                      {classParts}
                    </Text>
                  ) : null}
                  {item.summary ? (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.inkSoft, marginTop: 2 }} numberOfLines={2}>
                      {item.summary}
                    </Text>
                  ) : null}
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: withAlpha("inkFaint", 0x50 / 255), marginTop: 4 }}>
                    Tap to view · Long press to archive
                  </Text>
                </Pressable>
              );
            }}
            ListFooterComponent={
              <Pressable
                onPress={openCreate}
                style={{ marginTop: 12, paddingVertical: 12, borderWidth: 1, borderColor: withAlpha("gold", 0x30 / 255), borderRadius: 2, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.gold, textTransform: "uppercase", letterSpacing: 1 }}>
                  + Add Character
                </Text>
              </Pressable>
            }
          />
        )}
      </View>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        {CharacterForm}
      </Modal>
      <Modal visible={showEdit != null} transparent animationType="fade" onRequestClose={() => setShowEdit(null)}>
        {CharacterForm}
      </Modal>
    </ParchmentScreen>
  );
}
