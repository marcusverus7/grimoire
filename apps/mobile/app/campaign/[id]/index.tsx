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
  Image,
  Share,
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
type CampaignSettings = { notes?: string; nextSession?: string; worldNotes?: RichTextNode; coverImageUri?: string; logline?: string };

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
  const [stats, setStats] = useState({ sessionsPlayed: 0, sessionsTotal: 0, entityCount: 0, quoteCount: 0, totalPlayMs: 0, avgRating: 0 });
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
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [allCampaigns, setAllCampaigns] = useState<{ id: string; name: string; status: string }[]>([]);
  const [nextSessionAttendance, setNextSessionAttendance] = useState<{ yes: number; total: number } | null>(null);
  const [lastRecapText, setLastRecapText] = useState<string | null>(null);
  const [campaignArcs, setCampaignArcs] = useState<{ id: string; name: string }[]>([]);
  const [showSessions, setShowSessions] = useState(true);
  const [showEntities, setShowEntities] = useState(true);

  const load = useCallback(() => {
    const c = db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .get();
    setCampaign(c ?? null);
    if (c) {
      setNameInput(c.name);
      setCampaignArcs(((c.settings as Record<string, unknown> | null)?.arcs ?? []) as { id: string; name: string }[]);
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
      // Attendance summary for the next planned session
      if (nextPlanned) {
        const att = ((nextPlanned.attrs as Record<string, unknown> | null)?.attendance ?? []) as { status: string }[];
        if (att.length > 0) {
          setNextSessionAttendance({ yes: att.filter((a) => a.status === "yes").length, total: att.length });
        } else {
          setNextSessionAttendance(null);
        }
      } else {
        setNextSessionAttendance(null);
      }
      const active = allSessions.find((s) => s.status === "in_progress");
      setInProgressSession(active ?? null);
      const lastPlayed = [...allSessions].reverse().find((s) => s.status === "played");
      setLastPlayedSession(lastPlayed ?? null);
      // Load the most recent recap for the last played session (for "Previously on…" card)
      if (lastPlayed) {
        const latestRecap = db
          .select()
          .from(schema.recaps)
          .where(eq(schema.recaps.sessionId, lastPlayed.id))
          .all()
          .sort((a, b) => {
            const ta = a.publishedAt instanceof Date ? a.publishedAt.getTime() : (a.publishedAt ?? 0);
            const tb = b.publishedAt instanceof Date ? b.publishedAt.getTime() : (b.publishedAt ?? 0);
            return tb - ta;
          })[0] ?? null;
        if (latestRecap?.body) {
          const bodyText = nodeText(latestRecap.body as RichTextNode).trim().slice(0, 250);
          setLastRecapText(bodyText || null);
        } else {
          setLastRecapText(null);
        }
      } else {
        setLastRecapText(null);
      }
      const allEntities = db.select().from(schema.entities).where(eq(schema.entities.campaignId, id)).all();
      const allQuotes = db.select().from(schema.quotes).where(eq(schema.quotes.campaignId, id)).all();
      const totalPlayMs = allSessions.reduce((acc, s) => {
        const a = (s.attrs ?? {}) as { startedAt?: number; endedAt?: number };
        return a.startedAt && a.endedAt ? acc + (a.endedAt - a.startedAt) : acc;
      }, 0);
      const ratedSessions = allSessions.filter((s) => {
        const r = (s.attrs as Record<string, unknown> | null)?.rating;
        return typeof r === "number" && r >= 1 && r <= 5;
      });
      const avgRating = ratedSessions.length > 0
        ? ratedSessions.reduce((sum, s) => sum + ((s.attrs as Record<string, unknown>).rating as number), 0) / ratedSessions.length
        : 0;
      setStats({
        sessionsPlayed: allSessions.filter((s) => s.status === "played").length,
        sessionsTotal: allSessions.length,
        entityCount: allEntities.length,
        quoteCount: allQuotes.length,
        totalPlayMs,
        avgRating,
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

  const shareBriefing = async () => {
    const s = (campaign.settings ?? {}) as CampaignSettings;
    const lines: string[] = [];
    lines.push(`# ${campaign.name}`);
    if (s.logline) lines.push(`*${s.logline}*`);
    if (campaign.systemTag) lines.push(`**System:** ${campaign.systemTag}`);
    if (s.nextSession) {
      const diff = Math.ceil((new Date(s.nextSession).getTime() - Date.now()) / 86400000);
      const when = diff <= 0 ? "Today!" : diff === 1 ? "Tomorrow" : `in ${diff} days`;
      lines.push(`**Next Session:** ${s.nextSession} (${when})`);
    }

    const pcs = entities.filter((e) => e.kind === "pc");
    if (pcs.length > 0) {
      lines.push("\n---\n## Player Characters");
      for (const pc of pcs) {
        const a = (pc.attrs ?? {}) as Record<string, unknown>;
        const parts: string[] = [];
        if (a.level) parts.push(`Lv ${a.level}`);
        if (a.class) parts.push(String(a.class));
        if (a.raceOrSpecies) parts.push(String(a.raceOrSpecies));
        const sub = parts.join(" ");
        lines.push(`- **${pc.name}**${sub ? ` (${sub})` : ""}${pc.summary ? ` — ${pc.summary}` : ""}`);
      }
    }

    const openQuests = entities.filter((e) => {
      if (e.kind !== "quest") return false;
      const st = (e.attrs as Record<string, unknown> | null)?.questStatus;
      return st !== "completed" && st !== "failed";
    });
    if (openQuests.length > 0) {
      lines.push("\n---\n## Open Quests");
      for (const q of openQuests) {
        lines.push(`- **${q.name}**${q.summary ? ` — ${q.summary}` : ""}`);
      }
    }

    if (s.worldNotes) {
      const wn = nodeText(s.worldNotes).trim().slice(0, 400);
      if (wn) {
        lines.push("\n---\n## The World So Far");
        lines.push(wn + (wn.length === 400 ? "…" : ""));
      }
    }

    lines.push("\n---\n*Shared from Grimoire*");
    await Share.share({ message: lines.join("\n"), title: `${campaign.name} — Briefing` });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: campaign.name,
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(tabs)" as Parameters<typeof router.replace>[0]);
                }
              }}
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
          headerRight: () => (
            <Pressable
              onPress={() => {
                const rows = db.select({ id: schema.campaigns.id, name: schema.campaigns.name, status: schema.campaigns.status })
                  .from(schema.campaigns)
                  .all()
                  .sort((a, b) => a.name.localeCompare(b.name));
                setAllCampaigns(rows);
                setShowSwitcher(true);
              }}
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 18, color: "#A07A2C" }}>⇄</Text>
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
                { label: "Dash", path: `/campaign/${id}/playview` },
                { label: "Tracker", path: `/campaign/${id}/tracker` },
                { label: "Encounter", path: `/campaign/${id}/encounter` },
                { label: "Cast", path: `/campaign/${id}/cast` },
                { label: "Clocks", path: `/campaign/${id}/clocks` },
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

        {/* Cover image banner */}
        {(campaign.settings as CampaignSettings)?.coverImageUri ? (
          <Pressable onPress={() => router.push(`/campaign/${id}/settings`)} style={{ marginBottom: 16, borderRadius: 3, overflow: "hidden" }}>
            <Image
              source={{ uri: (campaign.settings as CampaignSettings).coverImageUri }}
              style={{ width: "100%", height: 110, borderRadius: 3 }}
              resizeMode="cover"
            />
          </Pressable>
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
            {(campaign.settings as CampaignSettings)?.logline ? (
              <Text style={{ fontFamily: "CormorantGaramond_400Regular_Italic", fontSize: 14, color: "#5A4D3ECC", fontStyle: "italic", marginTop: 4, lineHeight: 20 }}>
                {(campaign.settings as CampaignSettings).logline}
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
            {stats.avgRating > 0 && (
              <StatPill label="Avg Rating" value={`★ ${stats.avgRating.toFixed(1)}`} />
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
                {nextSessionAttendance ? (
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#4A8060", marginRight: 8 }}>
                    {nextSessionAttendance.yes}/{nextSessionAttendance.total}
                  </Text>
                ) : null}
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

        {/* Previously on… — always shown when a played session exists */}
        {lastPlayedSession ? (
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
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1.5, flex: 1 }}>
                Previously on…
              </Text>
              {lastRecapText ? (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#A07A2C60" }}>✦ AI recap</Text>
              ) : null}
            </View>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: "#2C2014", marginBottom: 4 }}>
              Session {lastPlayedSession.number}{lastPlayedSession.title ? `: ${lastPlayedSession.title}` : ""}
            </Text>
            {(lastRecapText ?? (lastPlayedSession.body ? nodeText(lastPlayedSession.body as RichTextNode).slice(0, 200) : null)) ? (
              <Text
                numberOfLines={3}
                style={{ fontFamily: "CormorantGaramond_400Regular", fontSize: 14, color: "#5A4D3E", lineHeight: 20, fontStyle: "italic" }}
              >
                {lastRecapText ?? nodeText(lastPlayedSession.body as RichTextNode).slice(0, 200)}
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
            <Pressable onPress={() => setShowSessions((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                className="text-gold text-xs uppercase tracking-widest"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                Sessions
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C60" }}>
                {showSessions ? "▼" : "▶"}
              </Text>
            </Pressable>
            <View className="flex-row items-center">
              <Pressable onPress={() => router.push(`/campaign/${id}/todos` as Parameters<typeof router.push>[0])}>
                <Text className="text-ink-faint text-xs mr-4" style={{ fontFamily: "Inter_500Medium" }}>
                  To-Do
                </Text>
              </Pressable>
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
          {showSessions && sessions.length === 0 ? (
            <Text className="text-ink-faint text-sm mb-4" style={{ fontFamily: "Inter_400Regular" }}>
              No sessions yet
            </Text>
          ) : null}
          {showSessions && sessions.length > 0 ? (() => {
            // Group sessions by arc if any session has an arcId
            const hasArcs = sessions.some((s) => (s.attrs as Record<string, unknown> | null)?.arcId);
            const arcById = new Map(campaignArcs.map((a) => [a.id, a.name]));

            // Build groups: { arcLabel: string | null, items: Session[] }[]
            type Group = { arcId: string | null; items: typeof sessions };
            const groups: Group[] = [];
            if (hasArcs) {
              for (const s of sessions) {
                const aid = ((s.attrs as Record<string, unknown> | null)?.arcId as string | undefined) ?? null;
                const last = groups[groups.length - 1];
                if (!last || last.arcId !== aid) {
                  groups.push({ arcId: aid, items: [s] });
                } else {
                  last.items.push(s);
                }
              }
            } else {
              groups.push({ arcId: null, items: sessions });
            }

            return groups.map((group, gi) => (
              <View key={gi}>
                {group.arcId ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: gi > 0 ? 12 : 0, marginBottom: 4 }}>
                    <View style={{ flex: 1, height: 0.5, backgroundColor: "#A07A2C30" }} />
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#A07A2C80", textTransform: "uppercase", letterSpacing: 1.2, marginHorizontal: 10 }}>
                      {arcById.get(group.arcId) ?? "Arc"}
                    </Text>
                    <View style={{ flex: 1, height: 0.5, backgroundColor: "#A07A2C30" }} />
                  </View>
                ) : null}
                {group.items.map((s) => (
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
                    {(() => {
                      const summ = (s.attrs as Record<string, unknown> | null)?.summary as string | undefined;
                      if (!summ) return null;
                      return (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A4D3E80", marginTop: 1 }} numberOfLines={1}>
                          {summ}
                        </Text>
                      );
                    })()}
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
                      {s.status === "played" && (() => {
                        const r = (s.attrs as Record<string, unknown> | null)?.rating;
                        if (typeof r !== "number" || r < 1) return null;
                        return (
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C80", marginLeft: 6 }}>
                            {"★".repeat(r)}
                          </Text>
                        );
                      })()}
                      {(() => {
                        const st = (s.attrs as Record<string, unknown> | null)?.sessionType as string | undefined;
                        if (!st) return null;
                        const typeColors: Record<string, string> = {
                          combat: "#8B2020", roleplay: "#1E6B6B", exploration: "#3A6830", downtime: "#5A3A7A", travel: "#2A4080",
                        };
                        const color = typeColors[st] ?? "#5A4D3E";
                        return (
                          <View style={{ marginLeft: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 2, borderWidth: 0.5, borderColor: `${color}60`, backgroundColor: `${color}12` }}>
                            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color, textTransform: "capitalize" }}>{st}</Text>
                          </View>
                        );
                      })()}
                      {s.status !== "played" ? (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: "#2C201425", marginLeft: 6 }}>
                          long press to mark played
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ));
          })() : null}
        </View>

        <GoldRule className="my-3" />

        {/* Entities */}
        <View className="mt-2">
          <View className="flex-row items-center justify-between mb-3">
            <Pressable onPress={() => setShowEntities((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                className="text-gold text-xs uppercase tracking-widest"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                Entities
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#A07A2C60" }}>
                {showEntities ? "▼" : "▶"}
              </Text>
            </Pressable>
            <Pressable onPress={() => { setQuickAddName(""); setQuickAddKind("npc"); setShowQuickAdd(true); }}>
              <Text className="text-gold text-xs" style={{ fontFamily: "Inter_500Medium" }}>
                + New
              </Text>
            </Pressable>
          </View>
          {showEntities && <>
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
                        {(entity.attrs as Record<string, unknown> | null)?.["imageUri"] ? (
                          <Image
                            source={{ uri: String((entity.attrs as Record<string, unknown>)["imageUri"]) }}
                            style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: "#A07A2C30" }}
                          />
                        ) : null}
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
                        {(entity.kind === "npc" || entity.kind === "pc") && (() => {
                          const st = (entity.attrs as Record<string, unknown> | null)?.["npcStatus"];
                          if (st === "dead") return (
                            <View style={{ marginLeft: 6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2, backgroundColor: "#7A241810", borderWidth: 1, borderColor: "#7A241840" }}>
                              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#7A2418" }}>☠ Dead</Text>
                            </View>
                          );
                          if (st === "missing") return (
                            <View style={{ marginLeft: 6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2, backgroundColor: "#A07A2C10", borderWidth: 1, borderColor: "#A07A2C40" }}>
                              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#A07A2C" }}>? Missing</Text>
                            </View>
                          );
                          return null;
                        })()}
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
          </>}
        </View>

        <GoldRule className="my-4" />

        {/* Actions */}
        <View className="flex-row flex-wrap">
          {(
            [
              { label: "Cast", path: `/campaign/${id}/cast`, gold: true },
              { label: "Clocks", path: `/campaign/${id}/clocks`, gold: true },
              { label: "Party", path: `/campaign/${id}/party`, gold: true },
              { label: "Brief", action: shareBriefing, gold: true },
              { label: "NPC Gen", path: `/campaign/${id}/npcgen`, gold: true },
              { label: "Hook Gen", path: `/campaign/${id}/hookgen`, gold: true },
              { label: "Loot", path: `/campaign/${id}/loot`, gold: true },
              { label: "Clues", path: `/campaign/${id}/clues`, gold: true },
              { label: "Rumours", path: `/campaign/${id}/rumours`, gold: true },
              { label: "Reference", path: `/campaign/${id}/reference`, gold: true },
              { label: "Tavern", path: `/campaign/${id}/tavern`, gold: true },
              { label: "Rand Enc", path: `/campaign/${id}/random-encounter`, gold: true },
              { label: "Calendar", path: `/campaign/${id}/calendar`, gold: true },
              { label: "Search", path: `/campaign/${id}/search`, gold: true },
              { label: "Notes", path: `/campaign/${id}/notes`, gold: true },
              { label: "Quests", path: `/campaign/${id}/quests`, gold: true },
              { label: "Quotes", path: `/campaign/${id}/quotes`, gold: true },
              { label: "Encounter", path: `/campaign/${id}/encounter`, gold: true },
              { label: "Tracker", path: `/campaign/${id}/tracker`, gold: true },
              { label: "Tables", path: `/campaign/${id}/tables`, gold: true },
              { label: "Locations", path: `/campaign/${id}/locations`, gold: true },
              { label: "Map", path: `/campaign/${id}/graph`, gold: true },
              { label: "Stats", path: `/campaign/${id}/stats`, gold: true },
              { label: "Recaps", path: `/campaign/${id}/recaps`, gold: true },
              { label: "Export", path: `/campaign/${id}/export`, gold: true },
              { label: "Settings", path: `/campaign/${id}/settings`, gold: false },
            ] as Array<{ label: string; path?: string; action?: () => void; gold: boolean }>
          ).map((btn) => (
            <Pressable
              key={btn.label}
              onPress={() => btn.action ? btn.action() : router.push(btn.path as Parameters<typeof router.push>[0])}
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

      {/* Campaign switcher modal */}
      <Modal
        visible={showSwitcher}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSwitcher(false)}
      >
        <Pressable
          onPress={() => setShowSwitcher(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
        >
          <Pressable onPress={() => {}} style={{ backgroundColor: "#FAF5EA", borderTopLeftRadius: 8, borderTopRightRadius: 8, borderTopWidth: 1, borderColor: "#A07A2C30", paddingBottom: 32 }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: "#A07A2C20", flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontFamily: "CinzelDecorative_400Regular", fontSize: 13, color: "#2C2014", flex: 1 }}>Switch Campaign</Text>
              <Pressable onPress={() => setShowSwitcher(false)}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 18, color: "#A07A2C" }}>✕</Text>
              </Pressable>
            </View>
            {allCampaigns.map((c) => {
              const isCurrent = c.id === id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setShowSwitcher(false);
                    if (!isCurrent) {
                      router.replace(`/campaign/${c.id}` as Parameters<typeof router.replace>[0]);
                    }
                  }}
                  style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: "#A07A2C12", backgroundColor: isCurrent ? "#A07A2C08" : "transparent" }}
                >
                  {isCurrent && (
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#A07A2C", marginRight: 8 }}>●</Text>
                  )}
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 17, color: isCurrent ? "#A07A2C" : "#2C2014", flex: 1 }}>
                    {c.name}
                  </Text>
                  {c.status === "archived" && (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#8A7D6D80", textTransform: "uppercase", letterSpacing: 1 }}>Archived</Text>
                  )}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                setShowSwitcher(false);
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(tabs)" as Parameters<typeof router.replace>[0]);
                }
              }}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, marginTop: 4 }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#A07A2C" }}>← All Campaigns</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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
