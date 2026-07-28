import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

type CampaignSettings = {
  notes?: string;
  nextSession?: string;
  sessionZero?: {
    xCardConfirmed?: boolean;
    lines?: string;
    veils?: string;
    tone?: string;
    safetyNotes?: string;
  };
};

const TONES = ["Light-hearted", "Balanced", "Gritty", "Horror"] as const;

export default function SessionZeroScreen() {
  useThemeTick();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [xCard, setXCard] = useState(false);
  const [lines, setLines] = useState("");
  const [veils, setVeils] = useState("");
  const [tone, setTone] = useState("");
  const [safetyNotes, setSafetyNotes] = useState("");

  useEffect(() => {
    const c = db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .get();
    if (c) {
      const s = (c.settings ?? {}) as CampaignSettings;
      const sz = s.sessionZero ?? {};
      setXCard(sz.xCardConfirmed ?? false);
      setLines(sz.lines ?? "");
      setVeils(sz.veils ?? "");
      setTone(sz.tone ?? "");
      setSafetyNotes(sz.safetyNotes ?? "");
    }
  }, [id]);

  const save = () => {
    try {
      const c = db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, id))
        .get();
      if (!c) return;

      const existing = (c.settings ?? {}) as CampaignSettings;
      db.update(schema.campaigns)
        .set({
          settings: {
            ...existing,
            sessionZero: {
              xCardConfirmed: xCard,
              lines: lines.trim() || undefined,
              veils: veils.trim() || undefined,
              tone: tone || undefined,
              safetyNotes: safetyNotes.trim() || undefined,
            },
          },
        })
        .where(eq(schema.campaigns.id, id))
        .run();
      router.back();
    } catch (e) {
      Alert.alert("Save Failed", e instanceof Error ? e.message : "An unexpected error occurred");
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Session Zero" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              fontFamily: "CormorantGaramond_700Bold",
              fontSize: 22,
              color: color.ink,
              marginBottom: 6,
            }}
          >
            Session Zero
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: color.inkSoft,
              lineHeight: 20,
              marginBottom: 20,
            }}
          >
            Agree on tone, safety tools, and limits before play begins. These notes
            are GM-only and stay on this device.
          </Text>

          <GoldRule ornament />

          {/* X-Card */}
          <View style={{ marginTop: 20, marginBottom: 20 }}>
            <Label text="X-Card" />
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: withAlpha("inkSoft", 0x80 / 255),
                lineHeight: 18,
                marginBottom: 10,
              }}
            >
              The X-Card lets anyone stop, skip, or rewind content at the table
              without explanation. Tap a card (physical or virtual) labelled "X" to
              use it.
            </Text>
            <Pressable
              onPress={() => setXCard((v) => !v)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: xCard ? color.gold : withAlpha("inkSoft", 0x30 / 255),
                borderRadius: 2,
                backgroundColor: xCard ? withAlpha("gold", 0x10 / 255) : "transparent",
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderWidth: 1.5,
                  borderColor: xCard ? color.gold : withAlpha("inkSoft", 0x50 / 255),
                  borderRadius: 2,
                  backgroundColor: xCard ? color.gold : "transparent",
                  marginRight: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {xCard ? (
                  <Text style={{ color: color.onAccent, fontSize: 12, fontFamily: "Inter_700Bold" }}>
                    ✓
                  </Text>
                ) : null}
              </View>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  color: xCard ? color.gold : color.inkSoft,
                }}
              >
                X-Card confirmed with group
              </Text>
            </Pressable>
          </View>

          {/* Tone */}
          <Label text="Campaign Tone" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
            {TONES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTone(tone === t ? "" : t)}
                style={{
                  marginRight: 8,
                  marginBottom: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: tone === t ? color.gold : withAlpha("inkSoft", 0x30 / 255),
                  borderRadius: 2,
                  backgroundColor: tone === t ? withAlpha("gold", 0x10 / 255) : "transparent",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    color: tone === t ? color.gold : color.inkSoft,
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Lines */}
          <Label text="Lines (hard limits — never go here)" />
          <TextInput
            value={lines}
            onChangeText={setLines}
            placeholder="e.g. Sexual violence, harm to children"
            placeholderTextColor={withAlpha("ink", 0x40 / 255)}
            multiline
            numberOfLines={3}
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: color.ink,
              borderWidth: 1,
              borderColor: withAlpha("gold", 0x20 / 255),
              borderRadius: 2,
              padding: 10,
              minHeight: 72,
              textAlignVertical: "top",
              marginBottom: 20,
            }}
          />

          {/* Veils */}
          <Label text="Veils (fade to black — skip the detail)" />
          <TextInput
            value={veils}
            onChangeText={setVeils}
            placeholder="e.g. Graphic torture, explicit romance"
            placeholderTextColor={withAlpha("ink", 0x40 / 255)}
            multiline
            numberOfLines={3}
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: color.ink,
              borderWidth: 1,
              borderColor: withAlpha("gold", 0x20 / 255),
              borderRadius: 2,
              padding: 10,
              minHeight: 72,
              textAlignVertical: "top",
              marginBottom: 20,
            }}
          />

          {/* Safety notes */}
          <Label text="Other Safety Notes" />
          <TextInput
            value={safetyNotes}
            onChangeText={setSafetyNotes}
            placeholder="Calibration tools, player expectations, house rules…"
            placeholderTextColor={withAlpha("ink", 0x40 / 255)}
            multiline
            numberOfLines={4}
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: color.ink,
              borderWidth: 1,
              borderColor: withAlpha("gold", 0x20 / 255),
              borderRadius: 2,
              padding: 10,
              minHeight: 90,
              textAlignVertical: "top",
              marginBottom: 24,
            }}
          />

          <GoldRule />

          <Pressable
            onPress={save}
            style={{
              marginTop: 20,
              backgroundColor: color.oxblood,
              paddingVertical: 12,
              borderRadius: 2,
              borderWidth: 1,
              borderColor: withAlpha("gold", 0x40 / 255),
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: color.onAccent,
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              Save
            </Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text
      style={{
        fontFamily: "Inter_600SemiBold",
        fontSize: 10,
        color: color.gold,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        marginBottom: 8,
      }}
    >
      {text}
    </Text>
  );
}
