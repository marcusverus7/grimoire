import { View, Text, Pressable, ScrollView, Alert, Share, Platform } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useState } from "react";
import { eq } from "drizzle-orm";
import { Paths, File, Directory } from "expo-file-system";
import { db, getKv } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { WaxSeal } from "@/components/WaxSeal";
import { schema } from "@grimoire/core";
import { exportCampaign, slugify, richTextToMarkdown } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";

export default function ExportScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [result, setResult] = useState<{ fileCount: number; jsonSize: number } | null>(null);

  const doExport = async () => {
    setExporting(true);
    try {
      const campaign = db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaignId))
        .get();
      if (!campaign) {
        Alert.alert("Error", "Campaign not found");
        return;
      }

      const entities = db
        .select()
        .from(schema.entities)
        .where(eq(schema.entities.campaignId, campaignId))
        .all();

      const sessions = db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.campaignId, campaignId))
        .all();

      const quotesData = db
        .select()
        .from(schema.quotes)
        .where(eq(schema.quotes.campaignId, campaignId))
        .all();

      type CampaignSettings = { notes?: string; nextSession?: string; worldNotes?: RichTextNode };
      const settings = (campaign.settings ?? {}) as CampaignSettings;

      const exportData = exportCampaign({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          systemTag: campaign.systemTag ?? undefined,
          status: campaign.status,
        },
        entities: entities.map((e) => ({
          id: e.id,
          kind: e.kind,
          name: e.name,
          summary: e.summary,
          body: e.body as RichTextNode | null,
          attrs: e.attrs as Record<string, unknown> | null,
          visibility: e.visibility as "gm_only" | "table",
        })),
        sessions: sessions.map((s) => ({
          id: s.id,
          number: s.number,
          title: s.title,
          playedOn: s.playedOn,
          body: s.body as RichTextNode | null,
          status: s.status as "planned" | "in_progress" | "played",
        })),
        quotes: quotesData.map((q) => ({
          id: q.id,
          attribution: q.attribution,
          text: q.text,
        })),
        worldNotes: settings.worldNotes ?? null,
        includeGmOnly: true,
      });

      const dirName = `grimoire-export-${slugify(campaign.name)}`;
      const exportDir = new Directory(Paths.document, dirName);
      exportDir.create();

      const jsonFile = new File(exportDir, "campaign.json");
      jsonFile.create();
      jsonFile.write(exportData.json);

      for (const f of exportData.files) {
        const parts = f.path.split("/");
        const fileName = parts.pop();
        if (!fileName) continue;
        let parent: Directory = exportDir;
        for (const part of parts) {
          parent = new Directory(parent, part);
          parent.create();
        }
        const outFile = new File(parent, fileName);
        outFile.create();
        outFile.write(f.content);
      }

      // Scene notes per session
      let notesFileCount = 0;
      const notesDir = new Directory(exportDir, "scene-notes");
      for (const s of sessions) {
        const raw = getKv(`session_notes_${s.id}`);
        if (!raw) continue;
        try {
          const notes = JSON.parse(raw) as { id: string; text: string; ts: number }[];
          if (notes.length === 0) continue;
          if (notesFileCount === 0) notesDir.create();
          const lines = notes.map((n) => `- ${n.text}`).join("\n");
          const md = `# Session ${s.number}${s.title ? `: ${s.title}` : ""} — Scene Notes\n\n${lines}\n`;
          const f = new File(notesDir, `session-${s.number}-notes.md`);
          f.create();
          f.write(md);
          notesFileCount++;
        } catch { /* skip malformed */ }
      }

      setResult({
        fileCount: exportData.files.length + 1 + notesFileCount,
        jsonSize: Math.round(exportData.json.length / 1024),
      });

      if (Platform.OS !== "web") {
        await Share.share({
          title: `${campaign.name} — Grimoire Export`,
          message: `Campaign exported: ${exportData.files.length + 1} files`,
          url: jsonFile.uri,
        });
      }
    } catch (e) {
      Alert.alert("Export Failed", e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setExporting(false);
    }
  };

  const doShare = async () => {
    setSharing(true);
    try {
      const campaign = db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId)).get();
      if (!campaign) return;

      const entities = db.select().from(schema.entities).where(eq(schema.entities.campaignId, campaignId)).all();
      const sessions = db.select().from(schema.sessions).where(eq(schema.sessions.campaignId, campaignId)).all();
      const quotesData = db.select().from(schema.quotes).where(eq(schema.quotes.campaignId, campaignId)).all();

      type CampaignSettings = { notes?: string; nextSession?: string; worldNotes?: RichTextNode };
      const settings = (campaign.settings ?? {}) as CampaignSettings;

      const exportData = exportCampaign({
        campaign: { id: campaign.id, name: campaign.name, systemTag: campaign.systemTag ?? undefined, status: campaign.status },
        entities: entities.map((e) => ({ id: e.id, kind: e.kind, name: e.name, summary: e.summary, body: e.body as RichTextNode | null, attrs: e.attrs as Record<string, unknown> | null, visibility: e.visibility as "gm_only" | "table" })),
        sessions: sessions.map((s) => ({ id: s.id, number: s.number, title: s.title, playedOn: s.playedOn, body: s.body as RichTextNode | null, status: s.status as "planned" | "in_progress" | "played" })),
        quotes: quotesData.map((q) => ({ id: q.id, attribution: q.attribution, text: q.text })),
        worldNotes: settings.worldNotes ?? null,
        includeGmOnly: true,
      });

      const indexFile = exportData.files.find((f) => f.path === "index.md");
      let text = indexFile?.content ?? exportData.json;

      // Append character journals for PC entities in this campaign
      const pcEntities = entities.filter((e) => e.kind === "pc" && e.characterProfileId);
      if (pcEntities.length > 0) {
        const journalSections: string[] = [];
        for (const pc of pcEntities) {
          const profile = db
            .select({ name: schema.characterProfiles.name })
            .from(schema.characterProfiles)
            .where(eq(schema.characterProfiles.id, pc.characterProfileId!))
            .get();
          const journals = db
            .select()
            .from(schema.journals)
            .where(eq(schema.journals.characterProfileId, pc.characterProfileId!))
            .all();
          if (profile && journals.length > 0) {
            const entryTexts = journals.map((j) => {
              const date = j.createdAt instanceof Date ? j.createdAt.toISOString().slice(0, 10) : String(j.createdAt);
              const body = j.body ? richTextToMarkdown(j.body as RichTextNode) : "";
              return `_${date}_\n\n${body}`;
            });
            journalSections.push(`## ${profile.name}\n\n${entryTexts.join("\n\n---\n\n")}`);
          }
        }
        if (journalSections.length > 0) {
          text += `\n\n---\n\n# Character Journals\n\n${journalSections.join("\n\n")}`;
        }
      }

      // Append scene notes for sessions that have them
      const noteSections: string[] = [];
      for (const s of sessions) {
        const raw = getKv(`session_notes_${s.id}`);
        if (!raw) continue;
        try {
          const notes = JSON.parse(raw) as { id: string; text: string; ts: number }[];
          if (notes.length === 0) continue;
          const lines = notes.map((n) => `- ${n.text}`).join("\n");
          noteSections.push(`### Session ${s.number}${s.title ? `: ${s.title}` : ""}\n\n${lines}`);
        } catch { /* skip */ }
      }
      if (noteSections.length > 0) {
        text += `\n\n---\n\n# Scene Notes\n\n${noteSections.join("\n\n")}`;
      }

      await Share.share({
        title: `${campaign.name} — Grimoire Summary`,
        message: text,
      });
    } catch (e) {
      Alert.alert("Share Failed", e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Export" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        className="flex-1 bg-parchment"
        contentContainerStyle={{ padding: 20, alignItems: "center" }}
      >
        <View className="mt-8 mb-6">
          <WaxSeal size={60} />
        </View>

        <Text
          className="text-ink text-xl text-center mb-2"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          Export Your Campaign
        </Text>
        <Text
          className="text-ink-soft text-sm text-center mb-8 px-4 leading-5"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          Export as Markdown files with [[wiki-links]] (Obsidian-compatible) and
          a full JSON backup. Your data is always yours.
        </Text>

        <GoldRule />

        <View className="mt-6 w-full px-4">
          <Text
            className="text-gold/70 text-xs uppercase tracking-wider mb-3"
            style={{ fontFamily: "Inter_600SemiBold" }}
          >
            Includes
          </Text>
          <BulletItem text="All entities (NPCs, locations, factions, items, quests)" />
          <BulletItem text="All sessions with notes" />
          <BulletItem text="Memorable quotes (quotes.md)" />
          <BulletItem text="World Notes (world-notes.md) if present" />
          <BulletItem text="GM-only content included" />
          <BulletItem text="Frontmatter metadata for each file" />
          <BulletItem text="Full JSON backup (campaign.json)" />
        </View>

        <Pressable
          onPress={doExport}
          disabled={exporting}
          className={`mt-8 px-10 py-3.5 rounded-sm border border-gold/30 ${
            exporting ? "bg-oxblood/50" : "bg-oxblood"
          }`}
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
            {exporting ? "Exporting…" : "Export Campaign"}
          </Text>
        </Pressable>

        <Pressable
          onPress={doShare}
          disabled={sharing}
          style={{
            marginTop: 12,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: "#A07A2C50",
            borderRadius: 2,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              color: "#A07A2C",
              textTransform: "uppercase",
              letterSpacing: 1,
              textAlign: "center",
            }}
          >
            {sharing ? "Preparing…" : "Share as Text"}
          </Text>
        </Pressable>

        {result && (
          <View className="mt-6 p-4 bg-parchment/5 rounded-sm border border-gold/10">
            <Text
              className="text-gold text-sm text-center"
              style={{ fontFamily: "Inter_500Medium" }}
            >
              Exported {result.fileCount} files ({result.jsonSize} KB JSON)
            </Text>
          </View>
        )}

        <View className="h-20" />
      </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function BulletItem({ text }: { text: string }) {
  return (
    <View className="flex-row mb-2">
      <Text className="text-gold mr-2" style={{ fontFamily: "Inter_400Regular", fontSize: 12 }}>
        •
      </Text>
      <Text
        className="text-ink-soft text-sm flex-1"
        style={{ fontFamily: "Inter_400Regular" }}
      >
        {text}
      </Text>
    </View>
  );
}
