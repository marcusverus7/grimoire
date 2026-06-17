import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface GoldRuleProps {
  className?: string;
  double?: boolean;
  ornament?: boolean;
}

export function GoldRule({ className, double = false, ornament = false }: GoldRuleProps) {
  if (ornament) {
    return (
      <View className={className} style={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
          <View style={{ flex: 1, height: 0.8, backgroundColor: "#8B6914" }} />
          <Svg width={24} height={12} viewBox="0 0 24 12" style={{ marginHorizontal: 8 }}>
            <Path d="M12 1 L17 6 L12 11 L7 6 Z" fill="none" stroke="#8B6914" strokeWidth={0.8} />
            <Path d="M12 3.5 L14.5 6 L12 8.5 L9.5 6 Z" fill="#8B691440" />
          </Svg>
          <View style={{ flex: 1, height: 0.8, backgroundColor: "#8B6914" }} />
        </View>
        {double && (
          <View style={{ flexDirection: "row", alignItems: "center", width: "100%", marginTop: 2 }}>
            <View style={{ flex: 1, height: 0.4, backgroundColor: "#8B691460" }} />
            <View style={{ width: 40 }} />
            <View style={{ flex: 1, height: 0.4, backgroundColor: "#8B691460" }} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View className={className}>
      <View className="h-[0.8px] bg-gold" />
      {double && <View className="mt-[2px] h-[0.4px] bg-gold/60" />}
    </View>
  );
}
