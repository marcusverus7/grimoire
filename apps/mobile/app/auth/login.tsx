import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { ParchmentScreen } from '@/components/ParchmentScreen';
import { GoldRule } from '@/components/GoldRule';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
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
        <Text style={{ fontFamily: 'CinzelDecorative_400Regular', fontSize: 24, color: '#2C2014', textAlign: 'center', marginBottom: 4 }}>
          Grimoire
        </Text>
        <Text style={{ fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 14, color: '#8A7D6D', textAlign: 'center', marginBottom: 24 }}>
          Campaign Memory System
        </Text>
        <GoldRule />

        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#8A7D6D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>
          Email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor="#8A7D6D80"
          editable={!loading}
          style={{ borderWidth: 1, borderColor: '#C4B49A', borderRadius: 2, padding: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#2C2014', marginBottom: 16 }}
        />

        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#8A7D6D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Password
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#8A7D6D80"
          secureTextEntry
          editable={!loading}
          style={{ borderWidth: 1, borderColor: '#C4B49A', borderRadius: 2, padding: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#2C2014', marginBottom: 12 }}
        />

        <Pressable onPress={() => Alert.alert('Forgot Password', 'Password reset via email is coming soon. For now, please contact support.')} disabled={loading} style={{ alignSelf: 'flex-end', marginBottom: 24 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#A07A2C' }}>
            Forgot password?
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSignIn}
          disabled={loading}
          style={{ backgroundColor: '#2C2014', borderRadius: 2, padding: 14, alignItems: 'center', marginBottom: 12, opacity: loading ? 0.6 : 1 }}
        >
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#C9A24A' }}>
            {loading ? 'Signing In...' : 'Sign In'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('./signup')} disabled={loading}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#A07A2C', textAlign: 'center' }}>
            Don't have an account? <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Sign up</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </ParchmentScreen>
  );
}
