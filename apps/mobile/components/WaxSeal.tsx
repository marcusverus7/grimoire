import { View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { colors } from "@/lib/theme";

interface WaxSealProps {
  letter?: string;
  size?: number;
  className?: string;
}

export function WaxSeal({ letter = "G", size = 64, className }: WaxSealProps) {
  const outer = size / 2;
  const inner = outer * 0.8;
  const ringWidth = 1.5;

  return (
    <View className={className} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer seal body */}
        <Circle cx={outer} cy={outer} r={outer - 1} fill={colors.oxblood.DEFAULT} />

        {/* Inner ring */}
        <Circle
          cx={outer}
          cy={outer}
          r={inner}
          fill="none"
          stroke={colors.gold.muted}
          strokeWidth={ringWidth}
        />

        {/* Letter */}
        <SvgText
          x={outer}
          y={outer}
          dy={size * 0.15}
          textAnchor="middle"
          fill={colors.parchment.light}
          fontSize={size * 0.42}
          fontWeight="bold"
          fontFamily="serif"
        >
          {letter}
        </SvgText>
      </Svg>
    </View>
  );
}
