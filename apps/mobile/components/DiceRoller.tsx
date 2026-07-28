import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { color, withAlpha, useThemeTick } from "@/lib/theme";

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
type Die = (typeof DICE)[number];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function DiceRoller({ visible, onClose }: Props) {
  useThemeTick();
  const [selectedDie, setSelectedDie] = useState<Die>(20);
  const [result, setResult] = useState<number | null>(null);
  const [modifier, setModifier] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const roll = () => {
    const r = Math.floor(Math.random() * selectedDie) + 1;
    setResult(r);

    // Shake animation
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, easing: Easing.linear, useNativeDriver: true }),
    ]).start();

    const total = r + modifier;
    const label = modifier !== 0
      ? `d${selectedDie}: ${r} ${modifier > 0 ? "+" : ""}${modifier} = ${total}`
      : `d${selectedDie}: ${r}`;
    setHistory((prev) => [label, ...prev].slice(0, 6));
  };

  // Reset result when die changes
  useEffect(() => { setResult(null); }, [selectedDie]);

  const isCrit = result === selectedDie;
  const isFumble = result === 1;
  const total = result !== null ? result + modifier : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: color.panelInk,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTopWidth: 1,
            borderColor: withAlpha("gold", 0x40 / 255),
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 40,
          }}
        >
          {/* Handle */}
          <View style={{ width: 40, height: 4, backgroundColor: withAlpha("gold", 0x40 / 255), borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />

          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.onAccentSoft, textAlign: "center", marginBottom: 16 }}>
            Dice Vault
          </Text>

          {/* Die selector */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
            {DICE.map((d) => (
              <Pressable
                key={d}
                onPress={() => setSelectedDie(d)}
                style={{
                  flex: 1,
                  marginHorizontal: 3,
                  paddingVertical: 8,
                  borderRadius: 4,
                  borderWidth: 1,
                  alignItems: "center",
                  backgroundColor: selectedDie === d ? color.gold : "transparent",
                  borderColor: selectedDie === d ? color.goldBright : withAlpha("gold", 0x40 / 255),
                }}
              >
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: d === 100 ? 11 : 14, color: selectedDie === d ? color.onAccent : color.gold }}>
                  d{d}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Modifier */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: color.inkFaint, marginRight: 12 }}>Modifier</Text>
            <Pressable
              onPress={() => setModifier((v) => v - 1)}
              style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255), alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: color.gold, fontSize: 18, lineHeight: 20 }}>−</Text>
            </Pressable>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: color.onAccentSoft, marginHorizontal: 16, minWidth: 32, textAlign: "center" }}>
              {modifier >= 0 ? "+" : ""}{modifier}
            </Text>
            <Pressable
              onPress={() => setModifier((v) => v + 1)}
              style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: withAlpha("gold", 0x40 / 255), alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: color.gold, fontSize: 18, lineHeight: 20 }}>+</Text>
            </Pressable>
            {modifier !== 0 && (
              <Pressable onPress={() => setModifier(0)} style={{ marginLeft: 12 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: withAlpha("inkFaint", 0x50 / 255) }}>reset</Text>
              </Pressable>
            )}
          </View>

          {/* Result */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <Pressable
              onPress={roll}
              style={{
                backgroundColor: color.oxblood,
                borderWidth: 1,
                borderColor: isCrit ? color.goldBright : isFumble ? color.oxblood : withAlpha("gold", 0x40 / 255),
                borderRadius: 4,
                paddingVertical: 24,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              {result !== null ? (
                <>
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 56, color: isCrit ? color.goldBright : isFumble ? withAlpha("onAccentSoft", 0x60 / 255) : color.onAccentSoft, lineHeight: 64 }}>
                    {total}
                  </Text>
                  {modifier !== 0 && (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: withAlpha("onAccentSoft", 0x50 / 255) }}>
                      {result} {modifier > 0 ? "+" : ""}{modifier}
                    </Text>
                  )}
                  {isCrit && (
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: color.goldBright, textTransform: "uppercase", letterSpacing: 2, marginTop: 4 }}>
                      Natural {selectedDie}!
                    </Text>
                  )}
                  {isFumble && (
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: withAlpha("onAccentSoft", 0x60 / 255), textTransform: "uppercase", letterSpacing: 2, marginTop: 4 }}>
                      Fumble
                    </Text>
                  )}
                </>
              ) : (
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: withAlpha("onAccentSoft", 0x50 / 255) }}>
                  Roll d{selectedDie}
                </Text>
              )}
            </Pressable>
          </Animated.View>

          {/* History */}
          {history.length > 0 && (
            <View>
              {history.map((entry, i) => (
                <Text
                  key={i}
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: i === 0 ? color.gold : withAlpha("inkFaint", 0x50 / 255),
                    textAlign: "center",
                    marginBottom: 2,
                  }}
                >
                  {entry}
                </Text>
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
