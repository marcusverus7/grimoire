import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { GoldRule } from "@/components/GoldRule";
import { ParchmentScreen } from "@/components/ParchmentScreen";
import { schema } from "@grimoire/core";

type LocationNode = {
  id: string;
  name: string;
  summary: string | null;
  visibility: string;
  children: LocationNode[];
  residents: { id: string; name: string; kind: string }[];
};

function buildTree(
  locs: { id: string; name: string; summary: string | null; parentId: string | null; visibility: string }[],
  residents: { id: string; name: string; kind: string; locationId: string | null }[],
  parentId: string | null,
): LocationNode[] {
  return locs
    .filter((l) => l.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((l) => ({
      id: l.id,
      name: l.name,
      summary: l.summary,
      visibility: l.visibility,
      residents: residents.filter((r) => r.locationId === l.id),
      children: buildTree(locs, residents, l.id),
    }));
}

export default function LocationsScreen() {
  const { id: campaignId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tree, setTree] = useState<LocationNode[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    const allEntities = db
      .select()
      .from(schema.entities)
      .where(eq(schema.entities.campaignId, campaignId))
      .all();
    const locs = allEntities
      .filter((e) => e.kind === "location")
      .map((e) => ({
        id: e.id,
        name: e.name,
        summary: e.summary,
        visibility: e.visibility,
        parentId: typeof (e.attrs as Record<string, unknown> | null)?.["parentId"] === "string"
          ? String((e.attrs as Record<string, unknown>)["parentId"])
          : null,
      }));
    const residents = allEntities
      .filter((e) => e.kind !== "location")
      .map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        locationId: typeof (e.attrs as Record<string, unknown> | null)?.["locationId"] === "string"
          ? String((e.attrs as Record<string, unknown>)["locationId"])
          : null,
      }))
      .filter((e) => e.locationId !== null);
    setTotal(locs.length);
    setTree(buildTree(locs, residents, null));
  }, [campaignId]);

  useFocusEffect(load);

  return (
    <>
      <Stack.Screen options={{ title: "Locations" }} />
      <ParchmentScreen edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {total === 0 ? (
            <View style={{ paddingTop: 40, alignItems: "center" }}>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#2C2014", marginBottom: 8 }}>No locations yet</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", textAlign: "center", lineHeight: 20 }}>
                Add entities of kind "Location" to build your world map.
              </Text>
              <Pressable
                onPress={() => router.push(`/campaign/${campaignId}/entity/new/edit` as Parameters<typeof router.push>[0])}
                style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#7A2418", borderRadius: 2, borderWidth: 1, borderColor: "#C9A24A40" }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FAF5EA", textTransform: "uppercase", letterSpacing: 1 }}>Add Location</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#A07A2C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
                {total} Location{total !== 1 ? "s" : ""}
              </Text>
              {tree.map((node) => (
                <LocationTreeNode key={node.id} node={node} depth={0} campaignId={campaignId} router={router} />
              ))}
              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
      </ParchmentScreen>
    </>
  );
}

function LocationTreeNode({
  node,
  depth,
  campaignId,
  router,
}: {
  node: LocationNode;
  depth: number;
  campaignId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const indent = depth * 16;
  return (
    <View>
      <Pressable
        onPress={() => router.push(`/campaign/${campaignId}/entity/${node.id}` as Parameters<typeof router.push>[0])}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          paddingVertical: 10,
          paddingLeft: indent,
          borderBottomWidth: 0.5,
          borderBottomColor: "#4A806018",
        }}
      >
        {depth > 0 ? (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#4A806050", marginRight: 8, marginTop: 3 }}>
            {"└ "}
          </Text>
        ) : (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4A8060", marginRight: 10, marginTop: 5 }} />
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 17, color: "#2C2014", flex: 1 }}>
              {node.name}
            </Text>
            {node.visibility === "gm_only" ? (
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, color: "#7A2418", marginLeft: 6 }}>GM</Text>
            ) : null}
            {node.children.length > 0 ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#4A806060", marginLeft: 6 }}>
                {node.children.length} sub
              </Text>
            ) : null}
          </View>
          {node.summary ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#5A4D3E80", marginTop: 2 }} numberOfLines={1}>
              {node.summary}
            </Text>
          ) : null}
          {node.residents.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {node.residents.slice(0, 4).map((r) => (
                <View key={r.id} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, backgroundColor: "#4A806012", borderWidth: 1, borderColor: "#4A806030" }}>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#4A8060" }}>{r.name}</Text>
                </View>
              ))}
              {node.residents.length > 4 ? (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#4A806060", alignSelf: "center" }}>+{node.residents.length - 4}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#4A8060", marginLeft: 8, marginTop: 2 }}>›</Text>
      </Pressable>
      {node.children.map((child) => (
        <LocationTreeNode key={child.id} node={child} depth={depth + 1} campaignId={campaignId} router={router} />
      ))}
    </View>
  );
}
