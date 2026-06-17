import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface Props {
  width?: number;
  color?: string;
  flipped?: boolean;
}

export function ScrollFlourish({ width = 200, color = "#A68530", flipped }: Props) {
  const h = 16;
  return (
    <View style={{ alignItems: "center", transform: flipped ? [{ scaleY: -1 }] : [] }}>
      <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
        <Path
          d={`M0 ${h / 2} Q${width * 0.15} 0, ${width * 0.3} ${h / 2} T${width * 0.5} ${h * 0.35} T${width * 0.7} ${h / 2} Q${width * 0.85} ${h}, ${width} ${h / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={0.8}
          opacity={0.5}
        />
        <Path
          d={`M${width * 0.45} ${h * 0.3} L${width * 0.5} 2 L${width * 0.55} ${h * 0.3}`}
          fill={color}
          opacity={0.4}
        />
      </Svg>
    </View>
  );
}
