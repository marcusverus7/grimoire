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
import { applyMigrations } from "@/lib/db";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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

  useEffect(() => {
    try {
      applyMigrations();
      setDbReady(true);
    } catch (e) {
      console.error("Migration failed:", e);
    }
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, dbReady]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!dbReady) {
    return (
      <View className="flex-1 bg-leather items-center justify-center">
        <Text className="text-parchment font-inter text-sm">
          Preparing your grimoire…
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#1A1410" },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="campaign/[id]" />
      </Stack>
    </>
  );
}
