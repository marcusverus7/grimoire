import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

interface GoldRuleProps {
  className?: string;
  double?: boolean;
  ornament?: boolean;
}

export function GoldRule({ className, double = false, ornament = false }: GoldRuleProps) {
  useThemeTick();
  if (ornament) {
    return (
      <View className={className} style={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
          <View style={{ flex: 1, height: 0.8, backgroundColor: color.goldDeep }} />
          <Svg width={24} height={12} viewBox="0 0 24 12" style={{ marginHorizontal: 8 }}>
            <Path d="M12 1 L17 6 L12 11 L7 6 Z" fill="none" stroke={color.goldDeep} strokeWidth={0.8} />
            <Path d="M12 3.5 L14.5 6 L12 8.5 L9.5 6 Z" fill={withAlpha("goldDeep", 0x40 / 255)} />
          </Svg>
          <View style={{ flex: 1, height: 0.8, backgroundColor: color.goldDeep }} />
        </View>
        {double && (
          <View style={{ flexDirection: "row", alignItems: "center", width: "100%", marginTop: 2 }}>
            <View style={{ flex: 1, height: 0.4, backgroundColor: withAlpha("goldDeep", 0x60 / 255) }} />
            <View style={{ width: 40 }} />
            <View style={{ flex: 1, height: 0.4, backgroundColor: withAlpha("goldDeep", 0x60 / 255) }} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View className={className}>
      <View className="h-[0.8px] bg-gold dark:bg-night-gold" />
      {double && <View className="mt-[2px] h-[0.4px] bg-gold/60 dark:bg-night-gold/60" />}
    </View>
  );
}
