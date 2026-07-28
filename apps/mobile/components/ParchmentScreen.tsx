import { View, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { color, useIsCandlelit } from "@/lib/theme";

interface Props {
  children: ReactNode;
  edges?: ("top" | "bottom" | "left" | "right")[];
  /**
   * Render the aged-parchment paper texture as the base layer. Default true.
   * Screens whose content sits on an opaque background won't show it through —
   * make the content container transparent to reveal the texture. Capture-heavy
   * screens (editors/forms) can pass `texture={false}` for a flatter surface.
   */
  texture?: boolean;
}

export function ParchmentScreen({ children, edges = ["top", "bottom"], texture = true }: Props) {
  const candlelit = useIsCandlelit();

  /**
   * The texture is a light paper scan. Laid over dark leather at full strength
   * it reads as a lit page, which is exactly wrong for the candlelit theme — so
   * it drops to a whisper and becomes grain in the leather instead of paper.
   */
  const textureOpacity = candlelit ? 0.05 : 1;
  // Vignette: warm shadow on parchment, a fainter gold bloom on leather.
  const edgeTint = candlelit ? "rgba(120,95,55,0.20)" : "rgba(180,160,130,0.18)";
  const edgeFade = candlelit ? "rgba(22,17,13,0)" : "rgba(242,232,213,0)";
  const edgeTintSide = candlelit ? "rgba(120,95,55,0.16)" : "rgba(180,160,130,0.14)";

  return (
    <View style={[styles.container, { backgroundColor: color.canvas }]}>
      {texture && (
        <Image
          source={require("../assets/textures/parchment-bg.png")}
          style={[StyleSheet.absoluteFill, { opacity: textureOpacity }]}
          resizeMode="cover"
        />
      )}
      {children}
      {edges.includes("top") && (
        <LinearGradient
          colors={[edgeTint, edgeFade]}
          style={styles.top}
          pointerEvents="none"
        />
      )}
      {edges.includes("bottom") && (
        <LinearGradient
          colors={[edgeFade, edgeTint]}
          style={styles.bottom}
          pointerEvents="none"
        />
      )}
      {edges.includes("left") && (
        <LinearGradient
          colors={[edgeTintSide, edgeFade]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.left}
          pointerEvents="none"
        />
      )}
      {edges.includes("right") && (
        <LinearGradient
          colors={[edgeFade, edgeTintSide]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.right}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative" },
  top: { position: "absolute", top: 0, left: 0, right: 0, height: 60 },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 60 },
  left: { position: "absolute", top: 0, bottom: 0, left: 0, width: 24 },
  right: { position: "absolute", top: 0, bottom: 0, right: 0, width: 24 },
});
