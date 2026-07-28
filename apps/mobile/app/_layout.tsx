import "../global.css";
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  CinzelDecorative_400Regular,
  CinzelDecorative_700Bold,
} from "@expo-google-fonts/cinzel-decorative";
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { applyMigrations, getKv } from "@/lib/db";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import {
  applyScheme,
  color,
  parseScheme,
  THEME_KV_KEY,
  useIsCandlelit,
} from "@/lib/theme";
import type { Scheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    CinzelDecorative_400Regular,
    CinzelDecorative_700Bold,
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const { session, loading: authLoading } = useAuth();
  const candlelit = useIsCandlelit();

  useEffect(() => {
    (async () => {
      try {
        await applyMigrations();
        // Restore the chosen theme before the first screen paints, so a GM who
        // picked candlelit never gets a flash of parchment on launch. Applied
        // unconditionally: it also pins NativeWind's colour scheme, which would
        // otherwise drift to whatever the OS is set to.
        let saved: Scheme = "parchment";
        try {
          saved = parseScheme(getKv(THEME_KV_KEY));
        } catch {
          // kv unavailable this early — parchment is the right default
        }
        applyScheme(saved);
        setDbReady(true);
      } catch (e) {
        console.error("Migration failed:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && dbReady && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, dbReady, authLoading]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!dbReady || authLoading) {
    return (
      <View className="flex-1 bg-parchment dark:bg-night-bg items-center justify-center">
        <Text className="text-ink dark:text-night-ink font-inter text-sm">
          Preparing your grimoire…
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={candlelit ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.parchmentBase },
        }}
      >
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="campaign/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}
