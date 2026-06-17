import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type CharacterProfile = typeof schema.characterProfiles.$inferSelect;

const LABEL = (s: string) => (
  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
    {s}
  </Text>
);

export default function CharacterEditScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [charClass, setCharClass] = useState("");
  const [race, setRace] = useState("");
  const [level, setLevel] = useState("");

  const load = useCallback(() => {
    const p = db.select().from(schema.characterProfiles).where(eq(schema.characterProfiles.id, profileId)).get();
    if (p) {
      setProfile(p);
      setName(p.name);
      setSummary(p.summary ?? "");
      const attrs = (p.attrs as Record<string, string> | null) ?? {};
      setCharClass(attrs["class"] ?? "");
      setRace(attrs["race"] ?? "");
      setLevel(attrs["level"] ?? "");
    }
  }, [profileId]);

  useFocusEffect(load);

  const handleSave = () => {
    if (!profile) return;
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
        .where(eq(schema.characterProfiles.id, profileId))
        .run();
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    }
  };

  const handleDelete = () => {
    if (!profile) return;
    Alert.alert(
      "Delete Character",
      `Permanently delete "${profile.name}"? Journal entries will also be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            db.delete(schema.journals).where(eq(schema.journals.characterProfileId, profileId)).run();
            db.delete(schema.characterProfiles).where(eq(schema.characterProfiles.id, profileId)).run();
            router.dismiss(2);
          },
        },
      ],
    );
  };

  if (!profile) return null;

  return (
    <>
      <Stack.Screen options={{ title: "Edit Character" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {LABEL("Character Name")}
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Kira Ashwood"
              placeholderTextColor="#2C201440"
              autoFocus
              style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 22, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 8, marginBottom: 20 }}
            />

            {LABEL("One-line Description")}
            <TextInput
              value={summary}
              onChangeText={setSummary}
              placeholder="A halfling rogue with a complicated past"
              placeholderTextColor="#2C201440"
              style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 8, marginBottom: 20 }}
            />

            {LABEL("Class")}
            <TextInput
              value={charClass}
              onChangeText={setCharClass}
              placeholder="e.g. Ranger"
              placeholderTextColor="#2C201440"
              style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 8, marginBottom: 20 }}
            />

            {LABEL("Race / Ancestry")}
            <TextInput
              value={race}
              onChangeText={setRace}
              placeholder="e.g. Half-elf"
              placeholderTextColor="#2C201440"
              style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 8, marginBottom: 20 }}
            />

            {LABEL("Level")}
            <TextInput
              value={level}
              onChangeText={setLevel}
              placeholder="e.g. 5"
              placeholderTextColor="#2C201440"
              keyboardType="numeric"
              style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 8, marginBottom: 28 }}
            />

            <Pressable
              onPress={handleSave}
              disabled={!name.trim()}
              style={{
                backgroundColor: name.trim() ? "#7A2418" : "#7A241830",
                paddingVertical: 14,
                borderRadius: 2,
                alignItems: "center",
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#A07A2C30",
              }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: name.trim() ? "#FAF5EA" : "#FAF5EA60", textTransform: "uppercase", letterSpacing: 1 }}>
                Save
              </Text>
            </Pressable>

            <Pressable onPress={handleDelete} style={{ alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#7A241860" }}>Delete Character</Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </ParchmentScreen>
    </>
  );
}
