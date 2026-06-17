import { Tabs } from "expo-router";
import { Text, Pressable, Alert } from "react-native";
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
          headerRight: () => (
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Grimoire TTRPG",
                  "Version 1.1.0 · Beta\n\nAll your campaign data is stored locally on this device. Export any campaign to back it up.\n\nFeedback & bugs:\nmarkloughran7@gmail.com",
                  [{ text: "OK" }],
                )
              }
              style={{ marginRight: 16 }}
            >
              <Text style={{ color: colors.gold.DEFAULT, fontFamily: "Inter_400Regular", fontSize: 18 }}>
                ℹ
              </Text>
            </Pressable>
          ),
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
