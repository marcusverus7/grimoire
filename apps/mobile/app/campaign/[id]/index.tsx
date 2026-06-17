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
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq, asc } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { DiceRoller } from "@/components/DiceRoller";
import { schema, nodeText } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";

type Campaign = typeof schema.campaigns.$inferSelect;
type Entity = typeof schema.entities.$inferSelect;
type Session = typeof schema.sessions.$inferSelect;
type CampaignSettings = { notes?: string; nextSession?: string; worldNotes?: RichTextNode };

const ENTITY_KINDS = ["npc", "pc", "location", "faction", "item", "quest", "custom"] as const;
const KIND_LABELS: Record<string, string> = {
  npc: "NPCs",
  pc: "Player Characters",
  location: "Locations",
  faction: "Factions",
  item: "Items",
  quest: "Quests",
  custom: "Custom",
};
const KIND_COLORS: Record<string, string> = {
  npc: "#A07A2C",
  pc: "#C9A24A",
  location: "#4A8060",
  faction: "#7A2418",
  item: "#6A5ACD",
  quest: "#D4A843",
  custom: "#4A3F32",
};

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [nextPlannedSessionId, setNextPlannedSessionId] = useState<string | null>(null);
  const [lastPlayedSession, setLastPlayedSession] = useState<Session | null>(null);
  const [stats, setStats] = useState({ sessionsPlayed: 0, sessionsTotal: 0, entityCount: 0, quoteCount: 0, totalPlayMs: 0 });
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [showDice, setShowDice] = useState(false);
  const [entitySort, setEntitySort] = useState<"name" | "updated" | "kind">("name");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddKind, setQuickAddKind] = useState<string>("npc");
  const [quickAddName, setQuickAddName] = useState("");
  const [recentlyRevealed, setRecentlyRevealed] = useState<{ entityId: string; name: string; revealedAt: number }[]>([]);
  const [showGmOnly, setShowGmOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [inProgressSession, setInProgressSession] = useState<Session | null>(null);

  const load = useCallback(() => {
    const c = db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .get();
    setCampaign(c ?? null);
    if (c) {
      setNameInput(c.name);
      setEntities(
        db
          .select()
          .from(schema.entities)
          .where(eq(schema.entities.campaignId, id))
          .orderBy(asc(schema.entities.name))
          .all(),
      );
      const allSessions = db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.campaignId, id))
        .orderBy(asc(schema.sessions.number))
        .all();
      setSessions(allSessions);
      const nextPlanned = allSessions.find(
        (s) => s.status === "planned" || s.status === "in_progress",
      );
      setNextPlannedSessionId(nextPlanned?.id ?? null);
      const active = allSessions.find((s) => s.status === "in_progress");
      setInProgressSession(active ?? null);
      const lastPlayed = [...allSessions].reverse().find((s) => s.status === "played");
      setLastPlayedSession(lastPlayed ?? null);
      const allEntities = db.select().from(schema.entities).where(eq(schema.entities.campaignId, id)).all();
      const allQuotes = db.select().from(schema.quotes).where(eq(schema.quotes.campaignId, id)).all();
      const totalPlayMs = allSessions.reduce((acc, s) => {
        const a = (s.attrs ?? {}) as { startedAt?: number; endedAt?: number };
        return a.startedAt && a.endedAt ? acc + (a.endedAt - a.startedAt) : acc;
      }, 0);
      setStats({
        sessionsPlayed: allSessions.filter((s) => s.status === "played").length,
        sessionsTotal: allSessions.length,
        entityCount: allEntities.length,
        quoteCount: allQuotes.length,
        totalPlayMs,
      });

      // Load recently revealed entities (table-wide, last 5)
      const campaignEntityIds = allEntities.map((e) => e.id);
      if (campaignEntityIds.length > 0) {
        const allReveals = db
          .select({ entityId: schema.reveals.entityId, revealedAt: schema.reveals.revealedAt })
          .from(schema.reveals)
          .where(eq(schema.reveals.revealedTo, "table"))
          .all();
        const campaignReveals = allReveals
          .filter((r) => campaignEntityIds.includes(r.entityId))
          .sort((a, b) => (b.revealedAt instanceof Date ? b.revealedAt.getTime() : b.revealedAt) - (a.revealedAt instanceof Date ? a.revealedAt.getTime() : a.revealedAt))
          .slice(0, 5);
        const enrichedReveals = campaignReveals.map((r) => {
          const ent = allEntities.find((e) => e.id === r.entityId);
          const ts = r.revealedAt instanceof Date ? r.revealedAt.getTime() : r.revealedAt;
          return { entityId: r.entityId, name: ent?.name ?? "Unknown", revealedAt: ts };
        });
        setRecentlyRevealed(enrichedReveals);
      } else {
        setRecentlyRevealed([]);
      }
    }
  }, [id]);

  useFocusEffect(load);

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !campaign) return;
    db.update(schema.campaigns)
      .set({ name: trimmed })
      .where(eq(schema.campaigns.id, campaign.id))
      .run();
    setCampaign({ ...campaign, name: trimmed });
    setEditing(false);
  };

  const createSession = () => {
    const maxNum = sessions.reduce((m, s) => Math.max(m, s.number), 0);
    const sessionId = newId();
    db.insert(schema.sessions)
      .values({
        id: sessionId,
        campaignId: id,
        number: maxNum + 1,
        status: "planned",
      })
      .run();
    router.push(`/campaign/${id}/session/${sessionId}/edit`);
  };

  const quickAddEntity = () => {
    const trimmed = quickAddName.trim();
    if (!trimmed) return;
    const entityId = newId();
    const now = new Date();
    db.insert(schema.entities)
      .values({
        id: entityId,
        campaignId: id,
        kind: quickAddKind as "npc" | "pc" | "location" | "faction" | "item" | "quest" | "custom",
        name: trimmed,
        visibility: "table",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    setShowQuickAdd(false);
    setQuickAddName("");
    setQuickAddKind("npc");
    router.push(`/campaign/${id}/entity/${entityId}/edit`);
  };

  if (!campaign) {
    return (
      <View className="flex-1 bg-parchment items-center justify-center">
        <Text className="text-ink/50 font-inter text-sm">
          Campaign not found
        </Text>
      </View>
    );
  }

  const q = search.toLowerCase().trim();
  const sortedEntities = [...entities].sort((a, b) => {
    const aPinned = (a.attrs as Record<string, unknown> | null)?.pinned === true;
    const bPinned = (b.attrs as Record<string, unknown> | null)?.pinned === true;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (entitySort === "updated") {
      const ta = a.updatedAt instanceof Date ? a.updatedAt.getTime() : a.updatedAt;
      const tb = b.updatedAt instanceof Date ? b.updatedAt.getTime() : b.updatedAt;
      return tb - ta;
    }
    if (entitySort === "kind") {
      const ki = ENTITY_KINDS.indexOf(a.kind as typeof ENTITY_KINDS[number]);
      const kj = ENTITY_KINDS.indexOf(b.kind as typeof ENTITY_KINDS[number]);
      if (ki !== kj) return ki - kj;
    }
    return a.name.localeCompare(b.name);
  });
  const filtered = sortedEntities
    .filter((e) => !kindFilter || e.kind === kindFilter)
    .filter((e) => !showGmOnly || e.visibility === "gm_only")
    .filter((e) => {
      if (!tagFilter) return true;
      const tags = (e.attrs as Record<string, unknown> | null)?.["tags"];
      return Array.isArray(tags) && (tags as string[]).includes(tagFilter);
    })
    .filter((e) => !q || e.name.toLowerCase().includes(q));

  const allTags = Array.from(new Set(
    entities.flatMap((e) => {
      const tags = (e.attrs as Record<string, unknown> | null)?.["tags"];
      return Array.isArray(tags) ? (tags as string[]) : [];
    })
  )).sort();

  const entitiesByKind = (kindFilter
    ? [{ kind: kindFilter, label: KIND_LABELS[kindFilter] ?? kindFilter, items: filtered }]
    : ENTITY_KINDS.map((kind) => ({
        kind,
        label: KIND_LABELS[kind] ?? kind,
        items: filtered.filter((e) => e.kind === kind),
      }))
  ).filter((g) => g.items.length > 0);

  const presentKinds = ENTITY_KINDS.filter((k) => entities.some((e) => e.kind === k));

  // Days until next session
  const nextSessionDays = (() => {
    const s = (campaign.settings ?? {}) as CampaignSettings;
    if (!s.nextSession) return null;
    const diff = Math.ceil((new Date(s.nextSession).getTime() - Date.now()) / 86400000);
    return diff;
  })();

  return (
    <>
      <Stack.Screen
        options={{
          title: campaign.name,
          headerLeft: () => (
            <Pressable
              onPress={() => router.push("/")}
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  color: "#A07A2C",
                }}
              >
                ‹ Campaigns
              </Text>
            </Pressable>
          ),
        }}
      />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView className="flex-1 bg-parchment" contentContainerStyle={{ padding: 16 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        {/* In-Play bar — shown when a session is in progress */}
        {inProgressSession ? (
          <View style={{ marginBottom: 16, borderRadius: 2, overflow: "hidden", borderWidth: 1, borderColor: "#7A241840" }}>
            <View style={{ backgroundColor: "#7A2418", paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FAF5EA", marginRight: 8, opacity: 0.8 }} />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                Session {inProgressSession.number}{inProgressSession.title ? ` · ${inProgressSession.title}` : ""} — In Play
              </Text>
              <Pressable
                onPress={() => router.push(`/campaign/${id}/session/${inProgressSession.id}` as Parameters<typeof router.push>[0])}
                style={{ paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#FAF5EA40", borderRadius: 2 }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1 }}>Open</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: "#7A241808", paddingVertical: 8, paddingHorizontal: 14, gap: 16 }}>
              {[
                { label: "Tracker", path: `/campaign/${id}/tracker` },
                { label: "Tables", path: `/campaign/${id}/tables` },
                { label: "Party", path: `/campaign/${id}/party` },
                { label: "Notes", path: `/campaign/${id}/session/${inProgressSession.id}/notes` },
              ].map((btn) => (
                <Pressable
                  key={btn.label}
                  onPress={() => router.push(btn.path as Parameters<typeof router.push>[0])}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#7A2418" }}>{btn.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setShowDice(true)}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: "#7A2418" }}>Dice</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Campaign name — tap to edit */}
        {editing ? (
          <View className="flex-row items-center mb-4">
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              onBlur={saveName}
              onSubmitEditing={saveName}
              autoFocus
              className="flex-1 text-ink font-cormorant-bold text-2xl border-b border-gold/30 pb-1"
              style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 24, color: "#2C2014" }}
              placeholderTextColor="#8A7D6D"
            />
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)} className="mb-4">
            <Text
              className="text-ink text-2xl"
              style={{ fontFamily: "CormorantGaramond_700Bold" }}
            >
              {campaign.name}
            </Text>
            {campaign.systemTag ? (
              <Text className="text-gold-muted text-xs mt-1" style={{ fontFamily: "Inter_400Regular" }}>
                {campaign.systemTag}
              </Text>
            ) : null}
          </Pressable>
        )}

        <GoldRule ornament />

        {/* Stats bar */}
        {(stats.sessionsTotal > 0 || stats.entityCount > 0) ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              paddingVertical: 10,
              marginBottom: 4,
              borderBottomWidth: 1,
              borderBottomColor: "#A07A2C12",
            }}
          >
            <StatPill label="Sessions" value={`${stats.sessionsPlayed}/${stats.sessionsTotal}`} />
            <StatPill label="Entities" value={String(stats.entityCount)} />
            {stats.totalPlayMs > 0 && (
              <StatPill label="Play Time" value={fmtDuration(stats.totalPlayMs)} />
            )}
            {stats.quoteCount > 0 && (
              <StatPill label="Quotes" value={String(stats.quoteCount)} />
            )}
          </View>
        ) : null}

        {/* Next Session countdown + GM Notes */}
        {(nextSessionDays !== null || (campaign.settings as CampaignSettings)?.notes) ? (
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            {nextSessionDays !== null ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#A07A2C12",
                  borderWidth: 1,
                  borderColor: "#A07A2C25",
                  borderRadius: 2,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.2, marginRight: 8 }}>
                  Next Session
                </Text>
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 17, color: "#2C2014", flex: 1 }}>
                  {(campaign.settings as CampaignSettings).nextSession}
                </Text>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: nextSessionDays <= 0 ? "#7A2418" : nextSessionDays <= 3 ? "#A07A2C" : "#5A4D3E", marginRight: 8 }}>
                  {nextSessionDays <= 0 ? "Today!" : nextSessionDays === 1 ? "Tomorrow" : `${nextSessionDays}d`}
                </Text>
                {nextPlannedSessionId ? (
                  <Pressable
                    onPress={() => router.push(`/campaign/${id}/session/${nextPlannedSessionId}/prep` as Parameters<typeof router.push>[0])}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#7A2418", borderRadius: 2 }}
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1 }}>
                      Prep
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {(campaign.settings as CampaignSettings)?.notes ? (
              <Pressable onPress={() => router.push(`/campaign/${id}/settings`)}>
                <Text numberOfLines={2} style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#5A4D3E80", fontStyle: "italic", lineHeight: 18 }}>
                  {(campaign.settings as CampaignSettings).notes}
                </Text>
              </Pressable>
            ) : null}
            {(campaign.settings as CampaignSettings)?.worldNotes ? (
              <Pressable
                onPress={() => router.push(`/campaign/${id}/notes` as Parameters<typeof router.push>[0])}
                style={{ marginTop: 6, flexDirection: "row", alignItems: "center" }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1, marginRight: 6 }}>
                  World Notes
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E60", flex: 1 }}>
                  {nodeText((campaign.settings as CampaignSettings).worldNotes!).slice(0, 80)}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#A07A2C60" }}>›</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Last Played Session preview */}
        {lastPlayedSession && !nextPlannedSessionId ? (
          <Pressable
            onPress={() => router.push(`/campaign/${id}/session/${lastPlayedSession.id}` as Parameters<typeof router.push>[0])}
            style={{
              marginTop: 16,
              padding: 12,
              borderWidth: 1,
              borderColor: "#A07A2C20",
              borderRadius: 2,
              backgroundColor: "#A07A2C06",
            }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
              Previously on…
            </Text>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", marginBottom: 4 }}>
              Session {lastPlayedSession.number}{lastPlayedSession.title ? `: ${lastPlayedSession.title}` : ""}
            </Text>
            {lastPlayedSession.body ? (
              <Text
                numberOfLines={3}
                style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 14, color: "#5A4D3E", lineHeight: 20, fontStyle: "italic" }}
              >
                {nodeText(lastPlayedSession.body as RichTextNode).slice(0, 200)}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        {/* Recently Revealed */}
        {recentlyRevealed.length > 0 ? (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#4A806080", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
              Recently Revealed
            </Text>
            {recentlyRevealed.map((r) => (
              <Pressable
                key={r.entityId}
                onPress={() => router.push(`/campaign/${id}/entity/${r.entityId}` as Parameters<typeof router.push>[0])}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#4A806020" }}
              >
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#4A8060", marginRight: 6 }}>↗</Text>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", flex: 1 }}>{r.name}</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E60" }}>
                  {new Date(r.revealedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Sessions */}
        <View className="mt-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-gold text-xs uppercase tracking-widest"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Sessions
            </Text>
            <View className="flex-row items-center">
              <Pressable onPress={() => router.push(`/campaign/${id}/timeline`)}>
                <Text className="text-ink-faint text-xs mr-4" style={{ fontFamily: "Inter_500Medium" }}>
                  Timeline
                </Text>
              </Pressable>
              <Pressable onPress={createSession}>
                <Text className="text-gold text-xs" style={{ fontFamily: "Inter_500Medium" }}>
                  + New
                </Text>
              </Pressable>
            </View>
          </View>
          {sessions.length === 0 ? (
            <Text className="text-ink-faint text-sm mb-4" style={{ fontFamily: "Inter_400Regular" }}>
              No sessions yet
            </Text>
          ) : (
            sessions.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/campaign/${id}/session/${s.id}`)}
                onLongPress={() => {
                  if (s.status === "played") return;
                  Alert.alert(
                    "Mark as Played?",
                    `Mark Session ${s.number}${s.title ? `: ${s.title}` : ""} as played?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Mark Played",
                        onPress: () => {
                          const today = new Date().toISOString().slice(0, 10);
                          db.update(schema.sessions)
                            .set({ status: "played", playedOn: today })
                            .where(eq(schema.sessions.id, s.id))
                            .run();
                          load();
                        },
                      },
                    ],
                  );
                }}
                className="py-2.5 px-2 mb-1"
              >
                <Text className="text-ink text-base" style={{ fontFamily: "CormorantGaramond_600SemiBold" }}>
                  Session {s.number}
                  {s.title ? `: ${s.title}` : ""}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Text
                    className="text-xs uppercase tracking-wider"
                    style={{
                      fontFamily: "Inter_400Regular",
                      color: s.status === "played" ? "#A07A2C" : s.status === "in_progress" ? "#7A2418" : "#5A4D3E",
                    }}
                  >
                    {s.status}
                  </Text>
                  {s.playedOn ? (
                    <Text className="text-ink/30 text-xs ml-2" style={{ fontFamily: "Inter_400Regular" }}>
                      {s.playedOn}
                    </Text>
                  ) : null}
                  {(() => {
                    const a = (s.attrs ?? {}) as { startedAt?: number; endedAt?: number };
                    if (!a.startedAt || !a.endedAt) return null;
                    return (
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A4D3E50", marginLeft: 6 }}>
                        ⏱ {fmtDuration(a.endedAt - a.startedAt)}
                      </Text>
                    );
                  })()}
                  {s.status !== "played" ? (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#2C201425", marginLeft: 6 }}>
                      long press to mark played
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </View>

        <GoldRule className="my-3" />

        {/* Entities */}
        <View className="mt-2">
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-gold text-xs uppercase tracking-widest"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Entities
            </Text>
            <Pressable onPress={() => { setQuickAddName(""); setQuickAddKind("npc"); setShowQuickAdd(true); }}>
              <Text className="text-gold text-xs" style={{ fontFamily: "Inter_500Medium" }}>
                + New
              </Text>
            </Pressable>
          </View>
          {/* Kind filter pills — only when there are multiple kinds */}
          {presentKinds.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ paddingBottom: 2 }}>
              <Pressable
                onPress={() => setKindFilter(null)}
                style={{
                  marginRight: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: kindFilter === null ? "#A07A2C" : "transparent",
                  borderWidth: 1,
                  borderColor: kindFilter === null ? "#A07A2C" : "#A07A2C40",
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: kindFilter === null ? "#FAF5EA" : "#A07A2C" }}>
                  All
                </Text>
              </Pressable>
              {presentKinds.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setKindFilter(kindFilter === k ? null : k)}
                  style={{
                    marginRight: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: kindFilter === k ? "#A07A2C" : "transparent",
                    borderWidth: 1,
                    borderColor: kindFilter === k ? "#A07A2C" : "#A07A2C40",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: kindFilter === k ? "#FAF5EA" : "#A07A2C" }}>
                    {KIND_LABELS[k]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ paddingBottom: 2 }}>
              {allTags.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => setTagFilter(tagFilter === tag ? null : tag)}
                  style={{
                    marginRight: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: tagFilter === tag ? "#A07A2C" : "#A07A2C40",
                    backgroundColor: tagFilter === tag ? "#A07A2C15" : "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: tagFilter === tag ? "#A07A2C" : "#A07A2C80" }}>
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {entities.length > 5 && (
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search entities…"
              placeholderTextColor="#8A7D6D"
              className="border border-ink/10 rounded-sm px-3 py-2 mb-2"
              style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#2C2014" }}
            />
          )}
          {entities.length > 0 && (
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {(["name", "updated", "kind"] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setEntitySort(s)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 2,
                    borderWidth: 1,
                    borderColor: entitySort === s ? "#A07A2C60" : "#2C201415",
                    backgroundColor: entitySort === s ? "#A07A2C10" : "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: entitySort === s ? "#A07A2C" : "#5A4D3E60", textTransform: "capitalize" }}>
                    {s === "updated" ? "Recent" : s}
                  </Text>
                </Pressable>
              ))}
              {entities.some((e) => e.visibility === "gm_only") && (
                <Pressable
                  onPress={() => setShowGmOnly((v) => !v)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 2,
                    borderWidth: 1,
                    borderColor: showGmOnly ? "#7A241860" : "#2C201415",
                    backgroundColor: showGmOnly ? "#7A241810" : "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: showGmOnly ? "#7A2418" : "#5A4D3E60" }}>
                    GM Only
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          {entitiesByKind.length === 0 && sessions.length === 0 ? (
            <View style={{ marginTop: 8, padding: 16, borderWidth: 1, borderColor: "#A07A2C20", borderRadius: 2, backgroundColor: "#A07A2C05" }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: "#2C2014", marginBottom: 12 }}>
                First steps
              </Text>
              {[
                { label: "Add your first character or NPC", icon: "👤", action: () => router.push(`/campaign/${id}/entity/new/edit` as Parameters<typeof router.push>[0]) },
                { label: "Plan Session 1", icon: "📅", action: createSession },
                { label: "Write world notes", icon: "🗺️", action: () => router.push(`/campaign/${id}/notes` as Parameters<typeof router.push>[0]) },
              ].map((step, i) => (
                <Pressable
                  key={i}
                  onPress={step.action}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: i < 2 ? 0.5 : 0, borderBottomColor: "#A07A2C15" }}
                >
                  <Text style={{ fontSize: 18, marginRight: 12 }}>{step.icon}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "#2C2014", flex: 1 }}>{step.label}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 16, color: "#A07A2C60" }}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : entitiesByKind.length === 0 ? (
            <Text className="text-ink-faint text-sm" style={{ fontFamily: "Inter_400Regular" }}>
              No entities match filters
            </Text>
          ) : (
            entitiesByKind.map((group) => (
              <View key={group.kind} className="mb-4">
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: KIND_COLORS[group.kind] ?? "#4A3F32", marginRight: 6 }} />
                  <Text
                    className="text-ink/50 text-xs uppercase tracking-wider"
                    style={{ fontFamily: "Inter_500Medium" }}
                  >
                    {group.label}
                  </Text>
                </View>
                {group.items.map((entity) => {
                  const isPinned = (entity.attrs as Record<string, unknown> | null)?.pinned === true;
                  return (
                    <Pressable
                      key={entity.id}
                      onPress={() =>
                        router.push(`/campaign/${id}/entity/${entity.id}`)
                      }
                      onLongPress={() => {
                        Alert.alert(entity.name, undefined, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: isPinned ? "Unpin" : "Pin to top",
                            onPress: () => {
                              const current = (entity.attrs ?? {}) as Record<string, unknown>;
                              db.update(schema.entities)
                                .set({ attrs: { ...current, pinned: !isPinned }, updatedAt: new Date() })
                                .where(eq(schema.entities.id, entity.id))
                                .run();
                              load();
                            },
                          },
                        ]);
                      }}
                      className="py-2 px-2 mb-0.5"
                    >
                      <View className="flex-row items-center">
                        {isPinned && (
                          <Text style={{ fontSize: 10, color: "#A07A2C80", marginRight: 4 }}>★</Text>
                        )}
                        <Text
                          className="text-ink text-base flex-1"
                          style={{ fontFamily: "CormorantGaramond_600SemiBold" }}
                        >
                          {entity.name}
                        </Text>
                        {entity.kind === "pc" && (entity.attrs as Record<string, unknown> | null)?.["level"] ? (
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#C9A24A", marginLeft: 6 }}>
                            Lv {String((entity.attrs as Record<string, unknown>)["level"])}
                          </Text>
                        ) : null}
                        {entity.visibility === "gm_only" && (
                          <Text
                            className="text-oxblood text-xs ml-2"
                            style={{ fontFamily: "Inter_500Medium" }}
                          >
                            GM
                          </Text>
                        )}
                      </View>
                      {entity.summary ? (
                        <Text
                          className="text-ink/50 text-sm mt-0.5"
                          style={{ fontFamily: "Inter_400Regular" }}
                          numberOfLines={1}
                        >
                          {entity.summary}
                        </Text>
                      ) : (entity.attrs as Record<string, unknown> | null)?.["role"] ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E60", marginTop: 1 }} numberOfLines={1}>
                          {String((entity.attrs as Record<string, unknown>)["role"])}
                        </Text>
                      ) : null}
                      {(() => {
                        const tags = (entity.attrs as Record<string, unknown> | null)?.["tags"];
                        if (!Array.isArray(tags) || tags.length === 0) return null;
                        return (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                            {(tags as string[]).map((tag, ti) => (
                              <View key={ti} style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1, borderColor: "#A07A2C30", backgroundColor: "#A07A2C08" }}>
                                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80" }}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        );
                      })()}
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </View>

        <GoldRule className="my-4" />

        {/* Actions */}
        <View className="flex-row flex-wrap">
          {[
            { label: "Party", path: `/campaign/${id}/party`, gold: true },
            { label: "NPC Gen", path: `/campaign/${id}/npcgen`, gold: true },
            { label: "Search", path: `/campaign/${id}/search`, gold: true },
            { label: "Notes", path: `/campaign/${id}/notes`, gold: true },
            { label: "Quests", path: `/campaign/${id}/quests`, gold: true },
            { label: "Quotes", path: `/campaign/${id}/quotes`, gold: true },
            { label: "Tracker", path: `/campaign/${id}/tracker`, gold: true },
            { label: "Tables", path: `/campaign/${id}/tables`, gold: true },
            { label: "Locations", path: `/campaign/${id}/locations`, gold: true },
            { label: "Map", path: `/campaign/${id}/graph`, gold: true },
            { label: "Export", path: `/campaign/${id}/export`, gold: true },
            { label: "Settings", path: `/campaign/${id}/settings`, gold: false },
          ].map((btn) => (
            <Pressable
              key={btn.label}
              onPress={() => router.push(btn.path as Parameters<typeof router.push>[0])}
              className="mb-2 mr-2 px-4 py-2.5 border rounded-sm items-center"
              style={{
                borderColor: btn.gold ? "#A07A2C40" : "#8A7D6D30",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  color: btn.gold ? "#A07A2C" : "#5A4D3E",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {btn.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setShowDice(true)}
            className="mb-2 mr-2 px-4 py-2.5 border rounded-sm items-center"
            style={{ borderColor: "#A07A2C40" }}
          >
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1 }}>
              Dice
            </Text>
          </Pressable>
        </View>

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>

      <DiceRoller visible={showDice} onClose={() => setShowDice(false)} />

      {/* Quick-add entity modal */}
      <Modal
        visible={showQuickAdd}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuickAdd(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable
            onPress={() => setShowQuickAdd(false)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 24 }}
          >
            <Pressable onPress={() => {}} style={{ backgroundColor: "#FAF5EA", borderRadius: 4, borderWidth: 1, borderColor: "#A07A2C30", padding: 20 }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: "#2C2014", textAlign: "center", marginBottom: 16 }}>
                Add Entity
              </Text>

              {/* Kind picker */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {ENTITY_KINDS.map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setQuickAddKind(k)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 2,
                      borderWidth: 1,
                      borderColor: quickAddKind === k ? "#A07A2C" : "#A07A2C30",
                      backgroundColor: quickAddKind === k ? "#A07A2C15" : "transparent",
                    }}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: quickAddKind === k ? "#A07A2C" : "#5A4D3E", textTransform: "capitalize" }}>
                      {KIND_LABELS[k] ?? k}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={quickAddName}
                onChangeText={setQuickAddName}
                placeholder="Name"
                placeholderTextColor="#2C201440"
                autoFocus
                style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: "#2C2014", borderBottomWidth: 1, borderBottomColor: "#A07A2C30", paddingBottom: 8, marginBottom: 20 }}
                onSubmitEditing={quickAddEntity}
                returnKeyType="done"
              />

              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                <Pressable onPress={() => setShowQuickAdd(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#5A4D3E" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={quickAddEntity}
                  disabled={!quickAddName.trim()}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 2,
                    backgroundColor: quickAddName.trim() ? "#7A2418" : "#7A241830",
                    borderWidth: 1,
                    borderColor: "#A07A2C30",
                  }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: quickAddName.trim() ? "#FAF5EA" : "#FAF5EA60", textTransform: "uppercase", letterSpacing: 1 }}>
                    Create
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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: "#2C2014" }}>
        {value}
      </Text>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#8A7D6D", textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </Text>
    </View>
  );
}
