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

type Entity = typeof schema.entities.$inferSelect;

const KINDS = ["npc", "pc", "location", "faction", "item", "quest", "custom"] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABELS: Record<Kind, string> = {
  npc: "NPC",
  pc: "Player Character",
  location: "Location",
  faction: "Faction",
  item: "Item",
  quest: "Quest",
  custom: "Custom",
};

const QUEST_STATUSES = ["rumoured", "active", "complete", "failed"] as const;

export default function EntityFormScreen() {
  const { id: campaignId, entityId } = useLocalSearchParams<{
    id: string;
    entityId: string;
  }>();
  const router = useRouter();
  const isNew = entityId === "new";

  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("npc");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState<RichTextNode | null>(null);
  const [visibility, setVisibility] = useState<"table" | "gm_only">("table");
  const [questStatus, setQuestStatus] = useState<string>("rumoured");
  const [hp, setHp] = useState("");
  const [ac, setAc] = useState("");
  const [initiative, setInitiative] = useState("");
  const [gmSecret, setGmSecret] = useState("");
  const [loaded, setLoaded] = useState(false);
  const editorRef = useRef<EditorBridge | null>(null);

  useEffect(() => {
    if (!isNew) {
      const entity = db
        .select()
        .from(schema.entities)
        .where(eq(schema.entities.id, entityId))
        .get();
      if (!entity) {
        Alert.alert("Error", "Entity not found");
        router.back();
        return;
      }
      setName(entity.name);
      setKind(entity.kind as Kind);
      setSummary(entity.summary ?? "");
      setBody(entity.body as RichTextNode | null);
      setVisibility(entity.visibility);
      const attrs = entity.attrs as Record<string, unknown> | null;
      if (attrs?.["questStatus"]) setQuestStatus(String(attrs["questStatus"]));
      if (attrs?.["hp"]) setHp(String(attrs["hp"]));
      if (attrs?.["ac"]) setAc(String(attrs["ac"]));
      if (attrs?.["initiative"]) setInitiative(String(attrs["initiative"]));
      if (attrs?.["gmSecret"]) setGmSecret(String(attrs["gmSecret"]));
    }
    setLoaded(true);
  }, [entityId, isNew]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Every entity needs a name.");
      return;
    }

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
      const now = Date.now();
      const attrs: Record<string, unknown> = {};
      if (kind === "quest") attrs["questStatus"] = questStatus;
      if ((kind === "npc" || kind === "pc") && (hp || ac || initiative)) {
        if (hp.trim()) attrs["hp"] = hp.trim();
        if (ac.trim()) attrs["ac"] = ac.trim();
        if (initiative.trim()) attrs["initiative"] = initiative.trim();
      }
      if (gmSecret.trim()) attrs["gmSecret"] = gmSecret.trim();

      let savedId = entityId;
      if (isNew) {
        savedId = newId();
        db.insert(schema.entities)
          .values({
            id: savedId,
            campaignId,
            kind,
            name: trimmed,
            summary: summary.trim() || null,
            body: editorBody,
            visibility,
            attrs: Object.keys(attrs).length > 0 ? attrs : null,
            createdAt: new Date(now),
            updatedAt: new Date(now),
          })
          .run();
      } else {
        db.update(schema.entities)
          .set({
            name: trimmed,
            kind,
            summary: summary.trim() || null,
            body: editorBody,
            visibility,
            attrs: Object.keys(attrs).length > 0 ? attrs : null,
            updatedAt: new Date(now),
          })
          .where(eq(schema.entities.id, entityId))
          .run();
      }

      if (editorBody) {
        const existing = db
          .select()
          .from(schema.entityLinks)
          .where(
            and(
              eq(schema.entityLinks.fromType, "entity"),
              eq(schema.entityLinks.fromId, savedId),
            ),
          )
          .all() as EntityLinkRow[];

        const changes = computeLinkChanges({
          campaignId,
          fromType: "entity",
          fromId: savedId,
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

  const deleteEntity = () => {
    Alert.alert("Delete Entity", `Remove "${name}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          try {
            db.delete(schema.entityLinks)
              .where(eq(schema.entityLinks.toEntityId, entityId))
              .run();
            db.delete(schema.entities)
              .where(eq(schema.entities.id, entityId))
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
        options={{ title: isNew ? "New Entity" : "Edit Entity" }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        className="flex-1 bg-parchment"
        contentContainerStyle={{ padding: 16 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <Label text="Name" />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter name…"
          placeholderTextColor="#2C201440"
          className="border-b border-gold/20 pb-2 mb-5 text-lg"
          style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: "#2C2014" }}
        />

        {/* Kind */}
        <Label text="Kind" />
        <View className="flex-row flex-wrap mb-5">
          {KINDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              className={`mr-2 mb-2 px-3 py-1.5 rounded-sm border ${
                kind === k ? "border-gold bg-gold/10" : "border-ink/20"
              }`}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: kind === k ? "#A07A2C" : "#5A4D3E",
                }}
              >
                {KIND_LABELS[k]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Quest-specific attrs */}
        {kind === "quest" && (
          <>
            <Label text="Quest Status" />
            <View className="flex-row flex-wrap mb-5">
              {QUEST_STATUSES.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setQuestStatus(s)}
                  className={`mr-2 mb-2 px-3 py-1.5 rounded-sm border ${
                    questStatus === s
                      ? "border-gold bg-gold/10"
                      : "border-ink/20"
                  }`}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 12,
                      color: questStatus === s ? "#A07A2C" : "#5A4D3E",
                      textTransform: "capitalize",
                    }}
                  >
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* NPC/PC quick stats */}
        {(kind === "npc" || kind === "pc") && (
          <>
            <Label text="Quick Stats (optional)" />
            <View style={{ flexDirection: "row", marginBottom: 20 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                  HP
                </Text>
                <TextInput
                  value={hp}
                  onChangeText={setHp}
                  placeholder="30"
                  placeholderTextColor="#2C201440"
                  keyboardType="default"
                  style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C20", paddingBottom: 6, textAlign: "center" }}
                />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                  AC
                </Text>
                <TextInput
                  value={ac}
                  onChangeText={setAc}
                  placeholder="14"
                  placeholderTextColor="#2C201440"
                  keyboardType="default"
                  style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C20", paddingBottom: 6, textAlign: "center" }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                  Initiative
                </Text>
                <TextInput
                  value={initiative}
                  onChangeText={setInitiative}
                  placeholder="+2"
                  placeholderTextColor="#2C201440"
                  style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C20", paddingBottom: 6, textAlign: "center" }}
                />
              </View>
            </View>
          </>
        )}

        {/* Summary */}
        <Label text="Summary" />
        <TextInput
          value={summary}
          onChangeText={setSummary}
          placeholder="Brief description…"
          placeholderTextColor="#2C201440"
          multiline
          numberOfLines={3}
          className="border border-parchment/15 rounded-sm p-3 mb-5"
          style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", textAlignVertical: "top", minHeight: 80 }}
        />

        {/* Body */}
        <Label text="Body" />
        <View style={{ height: 300, marginBottom: 20 }}>
          <RichTextEditor
            initialContent={body}
            editorRef={editorRef}
            minHeight={300}
          />
        </View>

        {/* GM Secret Notes */}
        <Label text="GM Secret Notes" />
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            color: "#7A241860",
            marginBottom: 6,
          }}
        >
          Only visible in the GM view — never exported to players.
        </Text>
        <TextInput
          value={gmSecret}
          onChangeText={setGmSecret}
          placeholder="Hidden motivations, secret identity, twist…"
          placeholderTextColor="#2C201440"
          multiline
          numberOfLines={4}
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: "#2C2014",
            minHeight: 90,
            textAlignVertical: "top",
            backgroundColor: "#7A241806",
            borderWidth: 1,
            borderColor: "#7A241825",
            borderRadius: 2,
            padding: 10,
            marginBottom: 20,
          }}
        />

        {/* Visibility */}
        <Label text="Visibility" />
        <View className="flex-row mb-6">
          <Pressable
            onPress={() => setVisibility("table")}
            className={`mr-3 px-4 py-2 rounded-sm border ${
              visibility === "table"
                ? "border-gold bg-gold/10"
                : "border-ink/20"
            }`}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: visibility === "table" ? "#A07A2C" : "#5A4D3E",
              }}
            >
              Whole Table
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setVisibility("gm_only")}
            className={`px-4 py-2 rounded-sm border ${
              visibility === "gm_only"
                ? "border-oxblood bg-oxblood/10"
                : "border-ink/20"
            }`}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: visibility === "gm_only" ? "#7A2418" : "#5A4D3E",
              }}
            >
              GM Only
            </Text>
          </Pressable>
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
            {isNew ? "Create Entity" : "Save Changes"}
          </Text>
        </Pressable>

        {/* Delete */}
        {!isNew && (
          <Pressable onPress={deleteEntity} className="mt-4 py-3 items-center">
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: "#7A241880",
              }}
            >
              Delete Entity
            </Text>
          </Pressable>
        )}

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
