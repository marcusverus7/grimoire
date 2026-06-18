import { Tabs } from "expo-router";
import { Text, Pressable, Alert } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/lib/theme";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text
      style={{
        color: focused ? colors.gold.DEFAULT : colors.ink.faint,
        fontSize: 10,
        fontFamily: "Inter_500Medium",
        marginTop: 2,
      }}
    >
      {name}
    </Text>
  );
}

function HeaderActions() {
  const { session, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (error: any) {
            Alert.alert("Sign Out Failed", error.message || "An error occurred");
          }
        },
      },
    ]);
  };

  return (
    <Pressable
      onPress={() => {
        const email = session?.user?.email || "User";
        Alert.alert(
          "Account & Info",
          `Signed in as: ${email}\n\nVersion 1.10.0 · Beta\n\nAll your campaign data is stored locally. Export any campaign to back it up.\n\nFeedback:\nmarkloughran7@gmail.com`,
          [
            { text: "Sign Out", style: "destructive", onPress: handleSignOut },
            { text: "OK", style: "cancel" },
          ],
        );
      }}
      style={{ marginRight: 16 }}
    >
      <Text style={{ color: colors.gold.DEFAULT, fontFamily: "Inter_400Regular", fontSize: 18 }}>
        👤
      </Text>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.leather.DEFAULT,
          borderBottomWidth: 0.8,
          borderBottomColor: colors.gold.DEFAULT,
        } as Record<string, unknown>,
        headerTitleStyle: {
          fontFamily: "CinzelDecorative_400Regular",
          fontSize: 16,
          color: colors.parchment.DEFAULT,
        },
        headerTintColor: colors.gold.DEFAULT,
        tabBarStyle: {
          backgroundColor: colors.leather.DEFAULT,
          borderTopWidth: 0.8,
          borderTopColor: colors.gold.DEFAULT,
        },
        tabBarActiveTintColor: colors.gold.bright,
        tabBarInactiveTintColor: colors.parchment.deep,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Campaigns",
          tabBarLabel: "Campaigns",
          headerRight: () => <HeaderActions />,
        }}
      />
      <Tabs.Screen
        name="characters"
        options={{
          title: "Characters",
          tabBarLabel: "Characters",
        }}
      />
      <Tabs.Screen
        name="design"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
