import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { colors } from "@/lib/theme";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text
      style={{
        color: focused ? colors.gold.DEFAULT : colors.parchment.deep,
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
        } as any,
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
        tabBarActiveTintColor: colors.gold.DEFAULT,
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
        }}
      />
      <Tabs.Screen
        name="design"
        options={{
          title: "Design",
          tabBarLabel: "Design",
        }}
      />
    </Tabs>
  );
}
