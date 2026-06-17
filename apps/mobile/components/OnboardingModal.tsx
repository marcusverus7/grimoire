import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useRef, useState } from "react";
import { WaxSeal } from "@/components/WaxSeal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingModalProps {
  visible: boolean;
  onDone: (action: "create" | "sample") => void;
}

const SLIDES = [
  {
    key: "welcome",
    title: "Your Campaign\nMemory",
    body: "Grimoire remembers everything so you don't have to. Every NPC, location, faction, and moment — in your pocket, offline, always yours.",
    icon: null,
  },
  {
    key: "features",
    title: "Built for the\nTable",
    body: null,
    features: [
      { icon: "📜", label: "Session notes", desc: "Rich-text bodies with @-mentions that link your world together." },
      { icon: "🧩", label: "Entity lore", desc: "NPCs, locations, factions, items, quests — all cross-referenced." },
      { icon: "🎲", label: "In-session tools", desc: "Dice vault, HP tracker, combat order, quote board." },
      { icon: "🔗", label: "Share recaps", desc: "Publish session recaps as a link your players can open in a browser." },
    ],
    icon: null,
  },
  {
    key: "start",
    title: "Ready to\nbegin?",
    body: "Start your own campaign or explore a pre-built example to see how everything fits together.",
    icon: null,
  },
];

export function OnboardingModal({ visible, onDone }: OnboardingModalProps) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index, animated: true });
    setPage(index);
  };

  const next = () => {
    if (page < SLIDES.length - 1) {
      goTo(page + 1);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.root}>
        {/* Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexDirection: "row" }}
        >
          {SLIDES.map((slide, i) => (
            <View key={slide.key} style={[styles.slide, { width: SCREEN_WIDTH }]}>
              {i === 0 && (
                <View style={{ marginBottom: 36 }}>
                  <WaxSeal size={100} />
                </View>
              )}
              {i === 1 && (
                <View style={{ marginBottom: 36 }}>
                  <Text style={{ fontSize: 48 }}>⚔️</Text>
                </View>
              )}
              {i === 2 && (
                <View style={{ marginBottom: 36 }}>
                  <Text style={{ fontSize: 48 }}>🏰</Text>
                </View>
              )}

              <Text style={styles.title}>{slide.title}</Text>

              {slide.body ? (
                <Text style={styles.body}>{slide.body}</Text>
              ) : null}

              {slide.features ? (
                <View style={{ width: "100%", marginTop: 8 }}>
                  {slide.features.map((f) => (
                    <View key={f.label} style={styles.featureRow}>
                      <Text style={styles.featureIcon}>{f.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureLabel}>{f.label}</Text>
                        <Text style={styles.featureDesc}>{f.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {page < SLIDES.length - 1 ? (
            <>
              <Pressable onPress={next} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>Next</Text>
              </Pressable>
              <Pressable onPress={() => goTo(SLIDES.length - 1)} style={styles.btnSkip}>
                <Text style={styles.btnSkipText}>Skip</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => onDone("create")} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>Start a Campaign</Text>
              </Pressable>
              <Pressable onPress={() => onDone("sample")} style={styles.btnSecondary}>
                <Text style={styles.btnSecondaryText}>Try the Sample</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAF5EA",
    alignItems: "center",
    paddingBottom: 48,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 36,
    color: "#2C2014",
    textAlign: "center",
    lineHeight: 42,
    marginBottom: 20,
  },
  body: {
    fontFamily: "CormorantGaramond_400Regular",
    fontSize: 18,
    color: "#5A4D3E",
    textAlign: "center",
    lineHeight: 28,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    gap: 14,
  },
  featureIcon: {
    fontSize: 24,
    marginTop: 1,
  },
  featureLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#2C2014",
    marginBottom: 2,
  },
  featureDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#7A6E60",
    lineHeight: 18,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2C201420",
  },
  dotActive: {
    backgroundColor: "#A07A2C",
    width: 20,
    borderRadius: 3,
  },
  actions: {
    width: "100%",
    paddingHorizontal: 24,
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: "#7A2418",
    paddingVertical: 14,
    borderRadius: 2,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#A07A2C40",
  },
  btnPrimaryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FAF5EA",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  btnSecondary: {
    paddingVertical: 14,
    borderRadius: 2,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#A07A2C50",
  },
  btnSecondaryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#A07A2C",
  },
  btnSkip: {
    alignItems: "center",
    paddingVertical: 10,
  },
  btnSkipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#2C201450",
  },
});
