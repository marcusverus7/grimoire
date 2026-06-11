import { View } from "react-native";

interface GoldRuleProps {
  className?: string;
  double?: boolean;
}

export function GoldRule({ className, double = false }: GoldRuleProps) {
  return (
    <View className={className}>
      <View className="h-[0.8px] bg-gold" />
      {double && <View className="mt-[2px] h-[0.4px] bg-gold/60" />}
    </View>
  );
}
