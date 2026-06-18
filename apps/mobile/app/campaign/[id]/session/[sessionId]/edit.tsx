import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import RichTextEditor from "@/components/RichTextEditor";
import { schema, computeLinkChanges } from "@grimoire/core";
import type { RichTextNode, EntityLinkRow } from "@grimoire/core";
import type { EditorBridge } from "@10play/tentap-editor";

type Session = typeof schema.sessions.$inferSelect;
type Entity = typeof schema.entities.$inferSelect;
type AttendanceStatus = "yes" | "no" | "maybe";
type AttendeeRecord = { entityId: string; name: string; status: AttendanceStatus };

const ATTEND_LABELS: Record<AttendanceStatus, string> = { yes: "✓", no: "✗", maybe: "?" };
const ATTEND_COLORS: Record<AttendanceStatus, string> = { yes: "#4A8060", no: "#7A2418", maybe: "#A07A2C" };

export default function SessionFormScreen() {
  const { id: campaignId, sessionId } = useLocalSearchParams<{
    id: string;
    sessionId: string;
  }>();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [number, setNumber] = useState(1);
  const [playedOn, setPlayedOn] = useState("");
  const [body, setBody] = useState<RichTextNode | null>(null);
  const [status, setStatus] = useState<"planned" | "in_progress" | "played">("planned");
  const [loaded, setLoaded] = useState(false);
  const [existingAttrs, setExistingAttrs] = useState<Record<string, unknown>>({});
  const [pcs, setPcs] = useState<Entity[]>([]);
  const [attendance, setAttendance] = useState<AttendeeRecord[]>([]);
  const [rating, setRating] = useState<number>(0);
  const editorRef = useRef<EditorBridge | null>(null);

  useEffect(() => {
    const session = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .get();
    if (!session) {
      Alert.alert("Error", "Session not found");
      router.back();
      return;
    }
    setTitle(session.title ?? "");
    setNumber(session.number);
    setPlayedOn(session.playedOn ?? "");
    setBody(session.body as RichTextNode | null);
    setStatus(session.status);
    const attrs = (session.attrs ?? {}) as Record<string, unknown>;
    setExistingAttrs(attrs);
    setRating(typeof attrs.rating === "number" ? attrs.rating : 0);
    setLoaded(true);

    // Load PC entities for attendance
    const campaignPcs = db
      .select()
      .from(schema.entities)
      .where(and(eq(schema.entities.campaignId, campaignId), eq(schema.entities.kind, "pc")))
      .all();
    setPcs(campaignPcs);

    // Hydrate attendance from saved attrs
    const saved = (attrs.attendance ?? []) as AttendeeRecord[];
    // Merge: keep saved statuses; add PCs not yet in list as "maybe"
    const merged: AttendeeRecord[] = campaignPcs.map((pc) => {
      const found = saved.find((a) => a.entityId === pc.id);
      return { entityId: pc.id, name: pc.name, status: found?.status ?? "maybe" };
    });
    setAttendance(merged);
  }, [sessionId, campaignId]);

  const save = async () => {
    let editorBody: RichTextNode | null = null;
    if (editorRef.current) {
      const json = await editorRef.current.getJSON();
      const doc = json as RichTextNode;
      const hasContent = doc.content?.some(
        (n) => n.type !== "paragraph" || (n.content && n.content.length > 0),
      );
      editorBody = hasContent ? doc : null;
    }

    try {
      db.update(schema.sessions)
        .set({
          title: title.trim() || null,
          playedOn: playedOn.trim() || null,
          body: editorBody,
          status,
          attrs: { ...existingAttrs, attendance: attendance.length > 0 ? attendance : undefined, rating: rating > 0 ? rating : undefined },
        })
        .where(eq(schema.sessions.id, sessionId))
        .run();

      if (editorBody) {
        const existing = db
          .select()
          .from(schema.entityLinks)
          .where(
            and(
              eq(schema.entityLinks.fromType, "session"),
              eq(schema.entityLinks.fromId, sessionId),
            ),
          )
          .all() as EntityLinkRow[];

        const changes = computeLinkChanges({
          campaignId,
          fromType: "session",
          fromId: sessionId,
          body: editorBody,
          existing,
        });

        for (const ins of changes.inserts) {
          db.insert(schema.entityLinks)
            .values({ id: newId(), ...ins })
            .run();
        }
        for (const delId of changes.deleteIds) {
          db.delete(schema.entityLinks)
            .where(eq(schema.entityLinks.id, delId))
            .run();
        }
        for (const upd of changes.snippetUpdates) {
          db.update(schema.entityLinks)
            .set({ contextSnippet: upd.contextSnippet })
            .where(eq(schema.entityLinks.id, upd.id))
            .run();
        }
      }

      router.back();
    } catch (e) {
      Alert.alert("Save Failed", e instanceof Error ? e.message : "An unexpected error occurred");
    }
  };

  const deleteSession = () => {
    Alert.alert("Delete Session", `Remove Session ${number} permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          try {
            db.delete(schema.sessions)
              .where(eq(schema.sessions.id, sessionId))
              .run();
            router.back();
          } catch (e) {
            Alert.alert("Delete Failed", e instanceof Error ? e.message : "An unexpected error occurred");
          }
        },
      },
    ]);
  };

  if (!loaded) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: `Session ${number}`,
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        className="flex-1 bg-parchment"
        contentContainerStyle={{ padding: 16 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Session number (read-only) */}
        <Label text="Session Number" />
        <Text
          className="text-ink text-xl mb-5"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          {number}
        </Text>

        {/* Title */}
        <Label text="Title (optional)" />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. The Siege of Ashford"
          placeholderTextColor="#2C201440"
          className="border-b border-gold/20 pb-2 mb-5 text-lg"
          style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: "#2C2014" }}
        />

        {/* Played on */}
        <Label text="Played On (YYYY-MM-DD)" />
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TextInput
            value={playedOn}
            onChangeText={setPlayedOn}
            placeholder="2025-06-10"
            placeholderTextColor="#2C201440"
            style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", flex: 1, borderBottomWidth: 1, borderBottomColor: "#A07A2C20", paddingBottom: 8 }}
          />
          <Pressable
            onPress={() => {
              const now = new Date();
              const y = now.getFullYear();
              const m = String(now.getMonth() + 1).padStart(2, "0");
              const d = String(now.getDate()).padStart(2, "0");
              setPlayedOn(`${y}-${m}-${d}`);
            }}
            style={{ marginLeft: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2 }}
          >
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C" }}>Today</Text>
          </Pressable>
        </View>

        {/* Status */}
        <Label text="Status" />
        <View className="flex-row mb-6">
          {(["planned", "in_progress", "played"] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={{
                marginRight: 8,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 2,
                borderWidth: 1,
                borderColor: status === s ? "#A07A2C" : "#A07A2C25",
                backgroundColor: status === s ? "#A07A2C15" : "transparent",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: status === s ? "#A07A2C" : "#5A4D3E",
                  textTransform: "capitalize",
                }}
              >
                {s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Session Rating — only for played sessions */}
        {status === "played" ? (
          <View style={{ marginBottom: 20 }}>
            <Label text="Session Rating (optional)" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setRating(rating === star ? 0 : star)}>
                  <Text style={{ fontSize: 24, color: star <= rating ? "#A07A2C" : "#A07A2C30" }}>★</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Attendance — only show when there are PC entities */}
        {pcs.length > 0 ? (
          <View style={{ marginBottom: 20 }}>
            <Label text="Attendance" />
            {attendance.map((rec) => (
              <View key={rec.entityId} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", flex: 1 }}>
                  {rec.name}
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(["yes", "no", "maybe"] as AttendanceStatus[]).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setAttendance(attendance.map((a) => a.entityId === rec.entityId ? { ...a, status: s } : a))}
                      style={{
                        width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: rec.status === s ? ATTEND_COLORS[s] : "#A07A2C20",
                        backgroundColor: rec.status === s ? ATTEND_COLORS[s] + "20" : "transparent",
                      }}
                    >
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: rec.status === s ? ATTEND_COLORS[s] : "#A07A2C50" }}>
                        {ATTEND_LABELS[s]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Session Notes */}
        <Label text="Session Notes" />
        <View style={{ height: 300, marginBottom: 20 }}>
          <RichTextEditor
            initialContent={body}
            editorRef={editorRef}
            minHeight={300}
          />
        </View>

        <GoldRule />

        {/* Save */}
        <Pressable
          onPress={save}
          className="mt-5 bg-oxblood py-3 rounded-sm border border-gold/30 items-center"
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: "#FAF5EA",
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            Save Session
          </Text>
        </Pressable>

        {/* Delete */}
        <Pressable onPress={deleteSession} className="mt-4 py-3 items-center">
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: "#7A241880",
            }}
          >
            Delete Session
          </Text>
        </Pressable>

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text
      className="text-gold/70 text-xs uppercase tracking-wider mb-2"
      style={{ fontFamily: "Inter_600SemiBold" }}
    >
      {text}
    </Text>
  );
}
