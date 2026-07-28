import { Stack } from "expo-router";
import { color, useThemeTick } from "@/lib/theme";

export default function AuthLayout() {
  useThemeTick();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.parchmentBase },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
