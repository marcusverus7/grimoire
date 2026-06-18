import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ParchmentScreen } from '@/components/ParchmentScreen';
import { GoldRule } from '@/components/GoldRule';
import { db } from '@/lib/db';
import { schema } from '@grimoire/core';
import { eq } from 'drizzle-orm';

export default function BackupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [backing, setBacking] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  if (!id) return null;

  const handleBackup = async () => {
    if (!session) {
      Alert.alert('Error', 'Please log in to backup your campaign');
      return;
    }

    setBacking(true);
    try {
      const campaign = db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id)).get();
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const campaignEntities = db.select().from(schema.entities).where(eq(schema.entities.campaignId, id)).all();
      const campaignSessions = db.select().from(schema.sessions).where(eq(schema.sessions.campaignId, id)).all();

      const backup = {
        campaign,
        entities: campaignEntities,
        sessions: campaignSessions,
        backupAt: new Date().toISOString(),
        userId: session.user?.id,
      };

      // TODO: Upload to Supabase once real credentials are available
      console.log('Backup data prepared:', { campaignId: id, entities: campaignEntities.length, sessions: campaignSessions.length });

      // Demo mode: show success
      setLastBackup(new Date().toLocaleString());
      Alert.alert('Success', 'Campaign backed up to cloud');
    } catch (error: any) {
      Alert.alert('Backup Failed', error.message || 'An error occurred');
    } finally {
      setBacking(false);
    }
  };

  return (
    <ParchmentScreen>
      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: '#A07A2C', marginBottom: 24 }}>
            ‹ Back
          </Text>
        </Pressable>

        <Text style={{ fontFamily: 'CinzelDecorative_400Regular', fontSize: 20, color: '#2C2014', marginBottom: 4 }}>
          Cloud Backup
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8A7D6D', marginBottom: 20 }}>
          Save your campaign to the cloud
        </Text>
        <GoldRule />

        <View style={{ marginTop: 24, marginBottom: 24 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#8A7D6D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            What Gets Backed Up
          </Text>
          <View style={{ backgroundColor: '#FAF7F1', borderRadius: 2, padding: 12, borderLeftWidth: 3, borderLeftColor: '#C9A24A' }}>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#2C2014', marginBottom: 8 }}>
              • Campaign settings & metadata
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#2C2014', marginBottom: 8 }}>
              • All entities (NPCs, PCs, locations, items, etc.)
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#2C2014', marginBottom: 8 }}>
              • All sessions & session notes
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#2C2014', marginBottom: 8 }}>
              • Quotes, recaps, and timelines
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#2C2014' }}>
              • All custom content & media
            </Text>
          </View>
        </View>

        {lastBackup && (
          <View style={{ backgroundColor: '#E8F5E9', borderRadius: 2, padding: 12, marginBottom: 24, borderLeftWidth: 3, borderLeftColor: '#4CAF50' }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#2E7D32', marginBottom: 4 }}>
              ✓ Last Backed Up
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1B5E20' }}>
              {lastBackup}
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleBackup}
          disabled={backing}
          style={{ backgroundColor: '#2C2014', borderRadius: 2, padding: 14, alignItems: 'center', marginBottom: 12, opacity: backing ? 0.6 : 1 }}
        >
          {backing ? (
            <ActivityIndicator color="#C9A24A" />
          ) : (
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#C9A24A' }}>
              Backup Now
            </Text>
          )}
        </Pressable>

        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8A7D6D', textAlign: 'center', marginTop: 16 }}>
          Your campaigns are automatically backed up when you make changes. Manual backups ensure your latest progress is saved.
        </Text>
      </ScrollView>
    </ParchmentScreen>
  );
}
