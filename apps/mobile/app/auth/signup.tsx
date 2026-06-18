import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { ParchmentScreen } from '@/components/ParchmentScreen';
import { GoldRule } from '@/components/GoldRule';

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
      Alert.alert('Success', 'Check your email to confirm your account', [
        { text: 'OK', onPress: () => router.replace('./login') }
      ]);
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'An error occurred');
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
          Create Account
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
          style={{ borderWidth: 1, borderColor: '#C4B49A', borderRadius: 2, padding: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#2C2014', marginBottom: 16 }}
        />

        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#8A7D6D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Confirm Password
        </Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          placeholderTextColor="#8A7D6D80"
          secureTextEntry
          editable={!loading}
          style={{ borderWidth: 1, borderColor: '#C4B49A', borderRadius: 2, padding: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#2C2014', marginBottom: 24 }}
        />

        <Pressable
          onPress={handleSignUp}
          disabled={loading}
          style={{ backgroundColor: '#2C2014', borderRadius: 2, padding: 14, alignItems: 'center', marginBottom: 12, opacity: loading ? 0.6 : 1 }}
        >
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#C9A24A' }}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} disabled={loading}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#A07A2C', textAlign: 'center' }}>
            Already have an account? <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </ParchmentScreen>
  );
}
