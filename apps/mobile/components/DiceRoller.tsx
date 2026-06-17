import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { useState, useRef, useEffect } from "react";

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
type Die = (typeof DICE)[number];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function DiceRoller({ visible, onClose }: Props) {
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
            backgroundColor: "#2C2014",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTopWidth: 1,
            borderColor: "#A07A2C40",
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 40,
          }}
        >
          {/* Handle */}
          <View style={{ width: 40, height: 4, backgroundColor: "#A07A2C40", borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />

          <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#F5EFDE", textAlign: "center", marginBottom: 16 }}>
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
                  backgroundColor: selectedDie === d ? "#A07A2C" : "transparent",
                  borderColor: selectedDie === d ? "#C9A24A" : "#A07A2C40",
                }}
              >
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: d === 100 ? 11 : 14, color: selectedDie === d ? "#FAF5EA" : "#A07A2C" }}>
                  d{d}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Modifier */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#8A7D6D", marginRight: 12 }}>Modifier</Text>
            <Pressable
              onPress={() => setModifier((v) => v - 1)}
              style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "#A07A2C40", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#A07A2C", fontSize: 18, lineHeight: 20 }}>−</Text>
            </Pressable>
            <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 20, color: "#F5EFDE", marginHorizontal: 16, minWidth: 32, textAlign: "center" }}>
              {modifier >= 0 ? "+" : ""}{modifier}
            </Text>
            <Pressable
              onPress={() => setModifier((v) => v + 1)}
              style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "#A07A2C40", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#A07A2C", fontSize: 18, lineHeight: 20 }}>+</Text>
            </Pressable>
            {modifier !== 0 && (
              <Pressable onPress={() => setModifier(0)} style={{ marginLeft: 12 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#8A7D6D50" }}>reset</Text>
              </Pressable>
            )}
          </View>

          {/* Result */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <Pressable
              onPress={roll}
              style={{
                backgroundColor: "#7A2418",
                borderWidth: 1,
                borderColor: isCrit ? "#C9A24A" : isFumble ? "#7A2418" : "#A07A2C40",
                borderRadius: 4,
                paddingVertical: 24,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              {result !== null ? (
                <>
                  <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 56, color: isCrit ? "#C9A24A" : isFumble ? "#F5EFDE60" : "#F5EFDE", lineHeight: 64 }}>
                    {total}
                  </Text>
                  {modifier !== 0 && (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#F5EFDE50" }}>
                      {result} {modifier > 0 ? "+" : ""}{modifier}
                    </Text>
                  )}
                  {isCrit && (
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#C9A24A", textTransform: "uppercase", letterSpacing: 2, marginTop: 4 }}>
                      Natural {selectedDie}!
                    </Text>
                  )}
                  {isFumble && (
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#F5EFDE60", textTransform: "uppercase", letterSpacing: 2, marginTop: 4 }}>
                      Fumble
                    </Text>
                  )}
                </>
              ) : (
                <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: "#F5EFDE50" }}>
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
                    color: i === 0 ? "#A07A2C" : "#8A7D6D50",
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
