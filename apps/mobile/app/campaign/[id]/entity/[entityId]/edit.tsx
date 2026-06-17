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

const NPC_GIVEN = ["Aldric","Mirra","Tavorn","Sela","Karath","Vessa","Dunn","Orwyn","Thessa","Bren","Isolde","Maren","Cael","Rynn","Doreth","Lira","Oswin","Thal","Vera","Grim","Nessa","Ulrik","Petra","Corvin","Sira","Halek","Mira","Fenwick","Aella","Rudgar","Tyra","Caspian","Lysa","Darak","Solene"];
const NPC_FAMILY = ["Stone","Mire","Ashford","Vale","Crowe","Blackwood","Wren","Fell","Marsh","Dunmore","Hollowell","Crag","Thorn","Greaves","Harwick","Moon","Dusk","Ivry","Colm","Steele","Vane","Holt","Brooke","Sallow","Fenn"];
function randomName(): string {
  const g = NPC_GIVEN[Math.floor(Math.random() * NPC_GIVEN.length)] ?? "Aldric";
  const f = NPC_FAMILY[Math.floor(Math.random() * NPC_FAMILY.length)] ?? "Stone";
  return `${g} ${f}`;
}

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
  const [interestedEntityIds, setInterestedEntityIds] = useState<string[]>([]);
  const [campaignCharacters, setCampaignCharacters] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [factionRelationships, setFactionRelationships] = useState<{ factionId: string; type: string }[]>([]);
  const [campaignFactions, setCampaignFactions] = useState<{ id: string; name: string }[]>([]);
  const [heldBy, setHeldBy] = useState<string | null>(null);
  const [campaignPCs, setCampaignPCs] = useState<{ id: string; name: string }[]>([]);
  const [role, setRole] = useState("");
  const [factionId, setFactionId] = useState<string | null>(null);
  const [level, setLevel] = useState("");
  const [xp, setXp] = useState("");
  const [maxXp, setMaxXp] = useState("");
  const [hp, setHp] = useState("");
  const [ac, setAc] = useState("");
  const [initiative, setInitiative] = useState("");
  const [gmSecret, setGmSecret] = useState("");
  const [existingAttrs, setExistingAttrs] = useState<Record<string, unknown>>({});
  const [characterProfileId, setCharacterProfileId] = useState<string | null>(null);
  const [characterProfiles, setCharacterProfiles] = useState<{ id: string; name: string }[]>([]);
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
      setExistingAttrs(attrs ?? {});
      if (attrs?.["questStatus"]) setQuestStatus(String(attrs["questStatus"]));
      if (Array.isArray(attrs?.["interestedEntityIds"])) setInterestedEntityIds(attrs["interestedEntityIds"] as string[]);
      if (Array.isArray(attrs?.["relationships"])) setFactionRelationships(attrs["relationships"] as { factionId: string; type: string }[]);
      if (typeof attrs?.["heldBy"] === "string") setHeldBy(attrs["heldBy"]);
      if (typeof attrs?.["role"] === "string") setRole(attrs["role"]);
      if (typeof attrs?.["factionId"] === "string") setFactionId(attrs["factionId"]);
      if (attrs?.["level"]) setLevel(String(attrs["level"]));
      if (attrs?.["xp"]) setXp(String(attrs["xp"]));
      if (attrs?.["maxXp"]) setMaxXp(String(attrs["maxXp"]));
      if (attrs?.["hp"]) setHp(String(attrs["hp"]));
      if (attrs?.["ac"]) setAc(String(attrs["ac"]));
      if (attrs?.["initiative"]) setInitiative(String(attrs["initiative"]));
      if (attrs?.["gmSecret"]) setGmSecret(String(attrs["gmSecret"]));
      if (entity.characterProfileId) setCharacterProfileId(entity.characterProfileId);
    }
    // Load all character profiles for the PC picker
    const profiles = db.select({ id: schema.characterProfiles.id, name: schema.characterProfiles.name })
      .from(schema.characterProfiles)
      .all();
    setCharacterProfiles(profiles);
    // Load campaign PC/NPC entities for quest interest picker
    const chars = db.select({ id: schema.entities.id, name: schema.entities.name, kind: schema.entities.kind })
      .from(schema.entities)
      .where(eq(schema.entities.campaignId, campaignId))
      .all()
      .filter((e) => e.kind === "pc" || e.kind === "npc")
      .sort((a, b) => a.name.localeCompare(b.name));
    setCampaignCharacters(chars);
    // Load campaign faction entities for relationship picker
    const factions = db.select({ id: schema.entities.id, name: schema.entities.name, kind: schema.entities.kind })
      .from(schema.entities)
      .where(eq(schema.entities.campaignId, campaignId))
      .all()
      .filter((e) => e.kind === "faction" && e.id !== entityId)
      .sort((a, b) => a.name.localeCompare(b.name));
    setCampaignFactions(factions);
    // Load PC/NPC entities for item "held by" picker
    const pcs = db.select({ id: schema.entities.id, name: schema.entities.name, kind: schema.entities.kind })
      .from(schema.entities)
      .where(eq(schema.entities.campaignId, campaignId))
      .all()
      .filter((e) => e.kind === "pc" || e.kind === "npc")
      .sort((a, b) => { if (a.kind !== b.kind) return a.kind === "pc" ? -1 : 1; return a.name.localeCompare(b.name); });
    setCampaignPCs(pcs);
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
      // Start from existing attrs to preserve pinned and other flags set elsewhere
      const attrs: Record<string, unknown> = { ...existingAttrs };
      if (kind === "quest") {
        attrs["questStatus"] = questStatus;
        if (interestedEntityIds.length > 0) attrs["interestedEntityIds"] = interestedEntityIds;
        else delete attrs["interestedEntityIds"];
      } else {
        delete attrs["questStatus"];
        delete attrs["interestedEntityIds"];
      }
      if (kind === "faction") {
        if (factionRelationships.length > 0) attrs["relationships"] = factionRelationships;
        else delete attrs["relationships"];
      } else {
        delete attrs["relationships"];
      }
      if (kind === "item") {
        if (heldBy) attrs["heldBy"] = heldBy;
        else delete attrs["heldBy"];
      } else {
        delete attrs["heldBy"];
      }
      if ((kind === "npc" || kind === "pc" || kind === "custom" || kind === "faction") && role.trim()) {
        attrs["role"] = role.trim();
      } else {
        delete attrs["role"];
      }
      if ((kind === "npc" || kind === "pc") && factionId) {
        attrs["factionId"] = factionId;
      } else {
        delete attrs["factionId"];
      }
      if (kind === "npc" || kind === "pc") {
        if (hp.trim()) attrs["hp"] = hp.trim(); else delete attrs["hp"];
        if (ac.trim()) attrs["ac"] = ac.trim(); else delete attrs["ac"];
        if (initiative.trim()) attrs["initiative"] = initiative.trim(); else delete attrs["initiative"];
      } else {
        delete attrs["hp"];
        delete attrs["ac"];
        delete attrs["initiative"];
      }
      if (kind === "pc") {
        if (level.trim()) attrs["level"] = level.trim(); else delete attrs["level"];
        if (xp.trim()) attrs["xp"] = xp.trim(); else delete attrs["xp"];
        if (maxXp.trim()) attrs["maxXp"] = maxXp.trim(); else delete attrs["maxXp"];
      } else {
        delete attrs["level"];
        delete attrs["xp"];
        delete attrs["maxXp"];
      }
      if (gmSecret.trim()) attrs["gmSecret"] = gmSecret.trim(); else delete attrs["gmSecret"];

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
            characterProfileId: kind === "pc" ? characterProfileId : null,
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
            characterProfileId: kind === "pc" ? characterProfileId : null,
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
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter name…"
            placeholderTextColor="#2C201440"
            style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: "#2C2014", flex: 1, borderBottomWidth: 1, borderBottomColor: "#A07A2C20", paddingBottom: 8 }}
          />
          {(kind === "npc" || kind === "pc" || kind === "custom") && (
            <Pressable
              onPress={() => setName(randomName())}
              style={{ marginLeft: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#A07A2C40", borderRadius: 2 }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C" }}>⚄ Gen</Text>
            </Pressable>
          )}
        </View>

        {/* Role/Title — shown for NPC/PC/faction/custom */}
        {(kind === "npc" || kind === "pc" || kind === "custom" || kind === "faction") && (
          <>
            <Label text="Role / Title (optional)" />
            <TextInput
              value={role}
              onChangeText={setRole}
              placeholder="e.g. Village Blacksmith, Queen's Hand, Guild Master"
              placeholderTextColor="#2C201440"
              style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C20", paddingBottom: 8, marginBottom: 20 }}
            />
          </>
        )}

        {/* Faction membership — shown for NPC/PC */}
        {(kind === "npc" || kind === "pc") && campaignFactions.length > 0 && (
          <>
            <Label text="Faction (optional)" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
              {campaignFactions.map((f) => {
                const selected = factionId === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFactionId(selected ? null : f.id)}
                    style={{
                      marginRight: 8,
                      marginBottom: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 2,
                      borderWidth: 1,
                      borderColor: selected ? "#7A2418" : "#2C201425",
                      backgroundColor: selected ? "#7A241810" : "transparent",
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: selected ? "#7A2418" : "#5A4D3E60" }}>
                      {f.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

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

            {/* Interested Characters */}
            {campaignCharacters.length > 0 && (
              <>
                <Label text="Interested Characters" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
                  {campaignCharacters.map((c) => {
                    const selected = interestedEntityIds.includes(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() =>
                          setInterestedEntityIds((prev) =>
                            prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                          )
                        }
                        style={{
                          marginRight: 8,
                          marginBottom: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 2,
                          borderWidth: 1,
                          borderColor: selected ? "#A07A2C" : "#2C201430",
                          backgroundColor: selected ? "#A07A2C12" : "transparent",
                        }}
                      >
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: selected ? "#A07A2C" : "#5A4D3E" }}>
                          {c.kind === "pc" ? "★ " : ""}{c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}

        {/* Faction relationships */}
        {kind === "faction" && campaignFactions.length > 0 && (
          <>
            <Label text="Faction Relationships (optional)" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
              {campaignFactions.map((f) => {
                const rel = factionRelationships.find((r) => r.factionId === f.id);
                const relColors: Record<string, string> = { ally: "#4A8060", enemy: "#7A2418", rival: "#A07A2C", neutral: "#5A4D3E" };
                const color = rel ? (relColors[rel.type] ?? "#5A4D3E") : "#2C201420";
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      if (!rel) {
                        Alert.alert(f.name, "Set relationship type:", [
                          { text: "Ally", onPress: () => setFactionRelationships((p) => [...p, { factionId: f.id, type: "ally" }]) },
                          { text: "Enemy", onPress: () => setFactionRelationships((p) => [...p, { factionId: f.id, type: "enemy" }]) },
                          { text: "Rival", onPress: () => setFactionRelationships((p) => [...p, { factionId: f.id, type: "rival" }]) },
                          { text: "Neutral", onPress: () => setFactionRelationships((p) => [...p, { factionId: f.id, type: "neutral" }]) },
                          { text: "Cancel", style: "cancel" },
                        ]);
                      } else {
                        const types = ["ally", "enemy", "rival", "neutral"];
                        const next = types[(types.indexOf(rel.type) + 1) % types.length];
                        if (next === "ally" && rel.type === "neutral") {
                          setFactionRelationships((p) => p.filter((r) => r.factionId !== f.id));
                        } else {
                          setFactionRelationships((p) => p.map((r) => r.factionId === f.id ? { ...r, type: next } : r));
                        }
                      }
                    }}
                    onLongPress={() => setFactionRelationships((p) => p.filter((r) => r.factionId !== f.id))}
                    style={{
                      marginRight: 8,
                      marginBottom: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 2,
                      borderWidth: 1,
                      borderColor: rel ? color : "#2C201425",
                      backgroundColor: rel ? `${color}12` : "transparent",
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: rel ? color : "#5A4D3E60" }}>
                      {f.name}{rel ? ` · ${rel.type}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Item holder */}
        {kind === "item" && campaignPCs.length > 0 && (
          <>
            <Label text="Held By (optional)" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
              {campaignPCs.map((pc) => {
                const selected = heldBy === pc.id;
                return (
                  <Pressable
                    key={pc.id}
                    onPress={() => setHeldBy(selected ? null : pc.id)}
                    style={{
                      marginRight: 8,
                      marginBottom: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 2,
                      borderWidth: 1,
                      borderColor: selected ? "#6A5ACD" : "#2C201425",
                      backgroundColor: selected ? "#6A5ACD12" : "transparent",
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: selected ? "#6A5ACD" : "#5A4D3E60" }}>
                      {pc.name}
                    </Text>
                  </Pressable>
                );
              })}
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

        {/* PC Level & XP */}
        {kind === "pc" && (
          <>
            <Label text="Level & XP (optional)" />
            <View style={{ flexDirection: "row", marginBottom: 20 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#C9A24A80", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Level</Text>
                <TextInput value={level} onChangeText={setLevel} placeholder="5" placeholderTextColor="#2C201440" keyboardType="numeric" style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#C9A24A20", paddingBottom: 6, textAlign: "center" }} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#C9A24A80", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>XP</Text>
                <TextInput value={xp} onChangeText={setXp} placeholder="3200" placeholderTextColor="#2C201440" keyboardType="numeric" style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#C9A24A20", paddingBottom: 6, textAlign: "center" }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#C9A24A80", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Max XP</Text>
                <TextInput value={maxXp} onChangeText={setMaxXp} placeholder="6500" placeholderTextColor="#2C201440" keyboardType="numeric" style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#C9A24A20", paddingBottom: 6, textAlign: "center" }} />
              </View>
            </View>
          </>
        )}

        {/* Character Passport link (PC only) */}
        {kind === "pc" && (
          <>
            <Label text="Character Passport" />
            {characterProfiles.length === 0 ? (
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: "#8A7D6D",
                  fontStyle: "italic",
                  marginBottom: 20,
                }}
              >
                No character passports yet — create one in the Characters tab.
              </Text>
            ) : (
              <View style={{ marginBottom: 20 }}>
                <Pressable
                  onPress={() => setCharacterProfileId(null)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: "#A07A2C15",
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderColor: characterProfileId === null ? "#A07A2C" : "#A07A2C40",
                      backgroundColor: characterProfileId === null ? "#A07A2C" : "transparent",
                      marginRight: 10,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                      color: characterProfileId === null ? "#A07A2C" : "#5A4D3E",
                    }}
                  >
                    None
                  </Text>
                </Pressable>
                {characterProfiles.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setCharacterProfileId(p.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: "#A07A2C15",
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: characterProfileId === p.id ? "#A07A2C" : "#A07A2C40",
                        backgroundColor: characterProfileId === p.id ? "#A07A2C" : "transparent",
                        marginRight: 10,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: "CormorantGaramond_600SemiBold",
                        fontSize: 16,
                        color: characterProfileId === p.id ? "#A07A2C" : "#2C2014",
                      }}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
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
