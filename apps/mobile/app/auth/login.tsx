import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ParchmentScreen } from '@/components/ParchmentScreen';
import { GoldRule } from '@/components/GoldRule';
import { color, withAlpha, useThemeTick } from "@/lib/theme";

export default function LoginScreen() {
  useThemeTick();
  const router = useRouter();
  const { signIn, continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ParchmentScreen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, justifyContent: 'center', minHeight: '100%' }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: 'CinzelDecorative_400Regular', fontSize: 24, color: color.ink, textAlign: 'center', marginBottom: 4 }}>
          Grimoire
        </Text>
        <Text style={{ fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 14, color: color.inkFaint, textAlign: 'center', marginBottom: 24 }}>
          Campaign Memory System
        </Text>
        <GoldRule />

        {!isSupabaseConfigured && (
          <View style={{ marginTop: 20, padding: 12, borderWidth: 1, borderColor: withAlpha('gold', 0x40 / 255), borderRadius: 2, backgroundColor: withAlpha('gold', 0x0a / 255) }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: color.goldText, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Accounts coming soon
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: color.inkSoft, lineHeight: 18 }}>
              Cloud accounts aren&apos;t switched on for this build yet. Continue
              without an account below — every campaign is stored on your device
              and can be exported at any time.
            </Text>
          </View>
        )}

        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>
          Email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor={withAlpha('inkFaint', 0.5)}
          editable={!loading}
          style={{ borderWidth: 1, borderColor: color.border, borderRadius: 2, padding: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: color.ink, marginBottom: 16 }}
        />

        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Password
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={withAlpha('inkFaint', 0.5)}
          secureTextEntry
          editable={!loading}
          style={{ borderWidth: 1, borderColor: color.border, borderRadius: 2, padding: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: color.ink, marginBottom: 12 }}
        />

        <Pressable onPress={() => Alert.alert('Forgot Password', 'Password reset via email is coming soon. For now, please contact support.')} disabled={loading} style={{ alignSelf: 'flex-end', marginBottom: 24 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: color.gold }}>
            Forgot password?
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSignIn}
          disabled={loading}
          style={{ backgroundColor: color.panelInk, borderRadius: 2, padding: 14, alignItems: 'center', marginBottom: 12, opacity: loading ? 0.6 : 1 }}
        >
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: color.goldBright }}>
            {loading ? 'Signing In...' : 'Sign In'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('./signup')} disabled={loading}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: color.gold, textAlign: 'center' }}>
            Don't have an account? <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Sign up</Text>
          </Text>
        </Pressable>

        <View style={{ marginTop: 28 }}>
          <GoldRule />
          <Pressable
            onPress={() => { continueAsGuest(); router.replace('/(tabs)'); }}
            disabled={loading}
            style={{ borderWidth: 1, borderColor: color.border, borderRadius: 2, padding: 13, alignItems: 'center', marginTop: 20 }}
          >
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: color.ink }}>
              Continue without an account
            </Text>
          </Pressable>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: color.inkFaint, textAlign: 'center', marginTop: 8 }}>
            Everything is stored on your device. You can sign in later to back up.
          </Text>
        </View>
      </ScrollView>
    </ParchmentScreen>
  );
}
