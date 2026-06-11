import { View, Text, Pressable, FlatList } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { WaxSeal } from "@/components/WaxSeal";
import { GoldRule } from "@/components/GoldRule";
import { schema } from "@grimoire/core";

type Campaign = typeof schema.campaigns.$inferSelect;

export default function CampaignsScreen() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const router = useRouter();

  const loadCampaigns = useCallback(() => {
    const rows = db
      .select()
      .from(schema.campaigns)
      .orderBy(schema.campaigns.createdAt)
      .all();
    setCampaigns(rows);
  }, []);

  useFocusEffect(loadCampaigns);

  const createCampaign = () => {
    const now = Date.now();
    const id = newId();
    db.insert(schema.campaigns)
      .values({
        id,
        name: `New Campaign`,
        status: "active",
        createdAt: new Date(now),
      })
      .run();

    const profileId = newId();
    // Ensure a local profile exists for the solo GM (pre-auth placeholder)
    const existing = db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.username, "local_gm"))
      .get();

    const userId = existing?.id ?? profileId;
    if (!existing) {
      db.insert(schema.profiles)
        .values({
          id: profileId,
          username: "local_gm",
          displayName: "Game Master",
          createdAt: new Date(now),
        })
        .run();
    }

    db.insert(schema.memberships)
      .values({
        id: newId(),
        campaignId: id,
        userId,
        role: "gm",
        joinedAt: new Date(now),
      })
      .run();

    router.push(`/campaign/${id}`);
  };

  return (
    <View className="flex-1 bg-leather">
      {campaigns.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <WaxSeal size={80} />
          <Text className="font-cinzel text-parchment text-lg mt-6 text-center">
            Your Grimoire Awaits
          </Text>
          <Text className="font-cormorant text-parchment/70 text-base mt-3 text-center leading-6">
            Every great campaign begins with a single page. Create your first
            campaign and start building your world.
          </Text>
          <Pressable
            onPress={createCampaign}
            className="mt-8 bg-oxblood px-8 py-3 rounded-sm border border-gold/30"
          >
            <Text className="font-inter-semibold text-parchment text-sm tracking-wider uppercase">
              Begin
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <GoldRule className="my-3" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/campaign/${item.id}`)}
              className="py-3 px-2"
            >
              <Text className="font-cormorant-semibold text-parchment text-lg">
                {item.name}
              </Text>
              {item.systemTag && (
                <Text className="font-inter text-gold-muted text-xs mt-1">
                  {item.systemTag}
                </Text>
              )}
              <Text className="font-inter text-parchment/40 text-xs mt-1 uppercase tracking-wider">
                {item.status}
              </Text>
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable
              onPress={createCampaign}
              className="mt-4 items-center py-3 border border-gold/20 rounded-sm"
            >
              <Text className="font-inter-medium text-gold text-sm tracking-wider uppercase">
                + New Campaign
              </Text>
            </Pressable>
          }
        />
      )}
    </View>
  );
}
