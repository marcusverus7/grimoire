import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function SessionLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.leather.DEFAULT },
        headerTitleStyle: {
          fontFamily: "CinzelDecorative_400Regular",
          fontSize: 14,
          color: colors.parchment.DEFAULT,
        },
        headerTintColor: colors.gold.DEFAULT,
        contentStyle: { backgroundColor: colors.leather.DEFAULT },
      }}
    />
  );
}
