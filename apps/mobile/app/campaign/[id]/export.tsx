import { View, Text, Pressable, ScrollView, Alert, Share, Platform } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useState } from "react";
import { eq } from "drizzle-orm";
import { Paths, File, Directory } from "expo-file-system";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { WaxSeal } from "@/components/WaxSeal";
import { schema } from "@grimoire/core";
import { exportCampaign, slugify } from "@grimoire/core";
import type { RichTextNode } from "@grimoire/core";

export default function ExportScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const [exporting, setExporting] = useState(false);
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
          status: s.status as "planned" | "played",
        })),
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
        const fileName = parts.pop()!;
        let parent: Directory = exportDir;
        for (const part of parts) {
          parent = new Directory(parent, part);
          parent.create();
        }
        const outFile = new File(parent, fileName);
        outFile.create();
        outFile.write(f.content);
      }

      setResult({
        fileCount: exportData.files.length + 1,
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

  return (
    <>
      <Stack.Screen options={{ title: "Export" }} />
      <ScrollView
        className="flex-1 bg-leather"
        contentContainerStyle={{ padding: 20, alignItems: "center" }}
      >
        <View className="mt-8 mb-6">
          <WaxSeal size={60} />
        </View>

        <Text
          className="text-parchment text-xl text-center mb-2"
          style={{ fontFamily: "CormorantGaramond_700Bold" }}
        >
          Export Your Campaign
        </Text>
        <Text
          className="text-parchment/60 text-sm text-center mb-8 px-4 leading-5"
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
              color: "#ECE3CF",
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            {exporting ? "Exporting…" : "Export Campaign"}
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
        className="text-parchment/70 text-sm flex-1"
        style={{ fontFamily: "Inter_400Regular" }}
      >
        {text}
      </Text>
    </View>
  );
}
