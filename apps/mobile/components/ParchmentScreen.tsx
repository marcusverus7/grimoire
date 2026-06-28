import { View, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";

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
  return (
    <View style={styles.container}>
      {texture && (
        <Image
          source={require("../assets/textures/parchment-bg.png")}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      {children}
      {edges.includes("top") && (
        <LinearGradient
          colors={["rgba(180,160,130,0.18)", "rgba(242,232,213,0)"]}
          style={styles.top}
          pointerEvents="none"
        />
      )}
      {edges.includes("bottom") && (
        <LinearGradient
          colors={["rgba(242,232,213,0)", "rgba(180,160,130,0.18)"]}
          style={styles.bottom}
          pointerEvents="none"
        />
      )}
      {edges.includes("left") && (
        <LinearGradient
          colors={["rgba(180,160,130,0.14)", "rgba(242,232,213,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.left}
          pointerEvents="none"
        />
      )}
      {edges.includes("right") && (
        <LinearGradient
          colors={["rgba(242,232,213,0)", "rgba(180,160,130,0.14)"]}
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
  container: { flex: 1, position: "relative", backgroundColor: "#EAD9B0" },
  top: { position: "absolute", top: 0, left: 0, right: 0, height: 60 },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 60 },
  left: { position: "absolute", top: 0, bottom: 0, left: 0, width: 24 },
  right: { position: "absolute", top: 0, bottom: 0, right: 0, width: 24 },
});
