import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth-context";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { GoldRule } from "@/components/GoldRule";
import { WaxSeal } from "@/components/WaxSeal";
import { newId } from "@/lib/id";
import { color, withAlpha, useThemeTick } from "@/lib/theme";
import { pushBackup, listBackups, deleteBackup, type CloudBackupRow } from "@/lib/backup";

/**
 * Cloud backup — real snapshots to Supabase, owned by the signed-in user.
 *
 * This screen previously console.logged the payload and reported "backed up to
 * cloud" without uploading anything (and claimed automatic backups existed).
 * It now actually uploads, lists and deletes snapshots; everything it claims
 * happened, happened.
 */
export default function BackupScreen() {
  useThemeTick();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [backing, setBacking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CloudBackupRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!id || !session) return;
    setLoading(true);
    listBackups(id)
      .then((r) => {
        if (r.ok) {
          setRows(r.data ?? []);
          setListError(null);
        } else {
          setRows(null);
          setListError(r.error ?? "Couldn't load backups");
        }
      })
      .finally(() => setLoading(false));
  }, [id, session]);

  useFocusEffect(refresh);

  if (!id) return null;

  const handleBackup = async () => {
    setBacking(true);
    try {
      const version = Constants.expoConfig?.version ?? "dev";
      const result = await pushBackup(id, newId(), version);
      if (result.ok) {
        Alert.alert("Backed Up", "A full snapshot of this campaign is now stored in your cloud archive.");
        refresh();
      } else {
        Alert.alert("Backup Failed", result.error ?? "Unknown error");
      }
    } finally {
      setBacking(false);
    }
  };

  const handleDelete = (row: CloudBackupRow) => {
    Alert.alert(
      "Delete Backup",
      `Remove the snapshot from ${formatDate(row.created_at)}? This only deletes the cloud copy.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const r = await deleteBackup(row.id);
            if (r.ok) refresh();
            else Alert.alert("Delete Failed", r.error ?? "Unknown error");
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Cloud Backup" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView className="flex-1 bg-parchment dark:bg-night-bg" contentContainerStyle={{ padding: 20 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: color.gold, marginBottom: 16 }}>
              ‹ Back
            </Text>
          </Pressable>

          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <WaxSeal size={52} />
          </View>
          <Text
            style={{
              fontFamily: "CormorantGaramond_700Bold",
              fontSize: 20,
              color: color.ink,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            Cloud Backup
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: color.inkFaint,
              textAlign: "center",
              lineHeight: 18,
              marginBottom: 16,
            }}
          >
            Stores a complete snapshot — entities, sessions, quotes, world notes
            and every GM tool — in your private archive. Only your account can
            read it.
          </Text>

          <GoldRule />

          {!session ? (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: color.inkSoft,
                textAlign: "center",
                marginTop: 24,
              }}
            >
              Sign in with an account to back up this campaign.
            </Text>
          ) : (
            <>
              <Pressable
                onPress={handleBackup}
                disabled={backing}
                style={{
                  marginTop: 20,
                  alignSelf: "center",
                  paddingHorizontal: 28,
                  paddingVertical: 13,
                  backgroundColor: backing ? withAlpha("oxblood", 0x80 / 255) : color.oxblood,
                  borderRadius: 2,
                  borderWidth: 1,
                  borderColor: withAlpha("goldBright", 0x40 / 255),
                }}
              >
                {backing ? (
                  <ActivityIndicator color={color.parchment} />
                ) : (
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                      color: color.onAccent,
                      textTransform: "uppercase",
                      letterSpacing: 1.5,
                    }}
                  >
                    Back Up Now
                  </Text>
                )}
              </Pressable>

              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                  color: withAlpha("gold", 0xb0 / 255),
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginTop: 28,
                  marginBottom: 10,
                }}
              >
                Your Snapshots
              </Text>

              {loading && rows === null ? (
                <ActivityIndicator color={color.gold} style={{ marginTop: 12 }} />
              ) : listError ? (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.oxblood }}>
                  {listError}
                </Text>
              ) : rows && rows.length === 0 ? (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: color.inkFaint }}>
                  No cloud backups yet.
                </Text>
              ) : (
                rows?.map((row) => (
                  <Pressable
                    key={row.id}
                    onLongPress={() => handleDelete(row)}
                    style={{
                      borderWidth: 1,
                      borderColor: withAlpha("gold", 0x30 / 255),
                      borderRadius: 2,
                      padding: 12,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: color.ink }}>
                      {formatDate(row.created_at)}
                    </Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: color.inkFaint, marginTop: 2 }}>
                      {Math.max(1, Math.round(row.size_bytes / 1024))} KB · long-press to delete
                    </Text>
                  </Pressable>
                ))
              )}

              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: withAlpha("inkFaint", 0xa0 / 255),
                  marginTop: 16,
                  lineHeight: 16,
                }}
              >
                Restore-from-backup arrives in a future update. Until then a
                snapshot is your safety net — support can recover your campaign
                from one if a device is lost.
              </Text>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return (
    d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}
