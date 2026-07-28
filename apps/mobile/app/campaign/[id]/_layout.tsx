import { Stack } from "expo-router";
import { color, colors, useThemeTick } from "@/lib/theme";

export default function CampaignLayout() {
  useThemeTick();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.leather.DEFAULT,
        },
        headerTitleStyle: {
          fontFamily: "CinzelDecorative_400Regular",
          fontSize: 14,
          color: color.onAccentBase,
        },
        headerTintColor: colors.gold.DEFAULT,
        contentStyle: { backgroundColor: colors.parchment.DEFAULT },
      }}
    />
  );
}
