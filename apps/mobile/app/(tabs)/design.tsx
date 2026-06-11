import { View, Text, ScrollView } from "react-native";
import { WaxSeal } from "@/components/WaxSeal";
import { GoldRule } from "@/components/GoldRule";

const PALETTE = [
  { name: "Leather (Chrome)", hex: "#1A1410", text: "light" },
  { name: "Leather Light", hex: "#2A2118", text: "light" },
  { name: "Parchment", hex: "#ECE3CF", text: "dark" },
  { name: "Parchment Deep", hex: "#E0D4BC", text: "dark" },
  { name: "Parchment Light", hex: "#F5EFDE", text: "dark" },
  { name: "Antique Gold", hex: "#A07A2C", text: "light" },
  { name: "Gold Muted", hex: "#C9A24A", text: "dark" },
  { name: "Oxblood", hex: "#7A2418", text: "light" },
  { name: "Ink", hex: "#2A2118", text: "light" },
  { name: "Ink Soft", hex: "#4A3F32", text: "light" },
] as const;

function Swatch({ name, hex, text }: (typeof PALETTE)[number]) {
  const textColor = text === "light" ? "#ECE3CF" : "#2A2118";
  return (
    <View
      className="rounded-sm mr-3 mb-3 px-3 py-3 border border-gold/20"
      style={{ backgroundColor: hex, width: 140 }}
    >
      <Text
        style={{ color: textColor, fontFamily: "Inter_500Medium", fontSize: 10 }}
      >
        {name}
      </Text>
      <Text
        style={{
          color: textColor,
          fontFamily: "Inter_400Regular",
          fontSize: 9,
          opacity: 0.7,
          marginTop: 2,
        }}
      >
        {hex}
      </Text>
    </View>
  );
}

export default function DesignScreen() {
  return (
    <ScrollView className="flex-1 bg-leather" contentContainerStyle={{ padding: 20 }}>
      {/* ---- Wax Seal ---- */}
      <View className="items-center mb-6">
        <WaxSeal size={96} />
        <Text className="font-cinzel text-gold text-xs mt-3 tracking-[4px] uppercase">
          The Grimoire Archive
        </Text>
      </View>

      <GoldRule double className="mb-6" />

      {/* ---- Colour Palette ---- */}
      <Text className="font-cinzel text-parchment text-base mb-4">
        Colour Palette
      </Text>
      <View className="flex-row flex-wrap mb-6">
        {PALETTE.map((s) => (
          <Swatch key={s.hex + s.name} {...s} />
        ))}
      </View>

      <GoldRule className="mb-6" />

      {/* ---- Typography ---- */}
      <Text className="font-cinzel text-parchment text-base mb-4">
        Type Scale
      </Text>

      <View className="bg-parchment rounded-sm p-4 mb-4">
        <Text className="font-cinzel text-ink text-xl mb-1">
          Cinzel Decorative
        </Text>
        <Text className="font-inter text-ink-soft text-xs mb-3">
          Display &amp; titles only — never body or form labels
        </Text>

        <Text className="font-cormorant-bold text-ink text-2xl mb-0">
          Cormorant Garamond Bold
        </Text>
        <Text className="font-cormorant-semibold text-ink text-xl mb-0">
          Cormorant Garamond Semibold
        </Text>
        <Text className="font-cormorant text-ink text-lg mb-0">
          Cormorant Garamond Regular — long-form reading
        </Text>
        <Text className="font-cormorant-italic text-ink text-lg mb-3">
          Cormorant Garamond Italic — flavour text, quotes
        </Text>

        <Text className="font-inter-semibold text-ink text-sm mb-0">
          Inter Semibold — labels, buttons
        </Text>
        <Text className="font-inter-medium text-ink text-sm mb-0">
          Inter Medium — form fields, meta
        </Text>
        <Text className="font-inter text-ink text-xs">
          Inter Regular — captions, timestamps, numerals
        </Text>
      </View>

      <GoldRule className="mb-6" />

      {/* ---- Components ---- */}
      <Text className="font-cinzel text-parchment text-base mb-4">
        Components
      </Text>

      {/* Seal sizes */}
      <View className="flex-row items-end gap-4 mb-4">
        <WaxSeal size={32} />
        <WaxSeal size={48} />
        <WaxSeal size={64} />
        <WaxSeal size={96} />
      </View>

      {/* Gold rules */}
      <View className="mb-4">
        <Text className="font-inter text-parchment/60 text-xs mb-2">
          Single rule
        </Text>
        <GoldRule />
        <Text className="font-inter text-parchment/60 text-xs mt-3 mb-2">
          Double rule (heading accent)
        </Text>
        <GoldRule double />
      </View>

      <GoldRule className="mb-6" />

      {/* ---- Surface Contrast ---- */}
      <Text className="font-cinzel text-parchment text-base mb-4">
        Surface Contrast
      </Text>

      {/* Dark (capture surface) */}
      <View className="bg-leather-light border border-gold/20 rounded-sm p-4 mb-3">
        <Text className="font-inter-medium text-parchment text-sm mb-1">
          Capture Surface (Dark)
        </Text>
        <Text className="font-inter text-parchment/60 text-xs">
          Plain, fast, one-handed — functional screens are simpler than showcase
          screens.
        </Text>
      </View>

      {/* Light (reading surface) */}
      <View className="bg-parchment border border-gold/30 rounded-sm p-4 mb-3">
        <Text className="font-cormorant-semibold text-ink text-lg mb-1">
          Reading Surface (Parchment)
        </Text>
        <Text className="font-cormorant text-ink-soft text-base leading-6">
          Ceremony on the reading and sharing surfaces — entity records read
          like grimoire entries, not database rows. The parchment content stays
          legible; the dark leather frame is easy on the eyes in a dim room.
        </Text>
      </View>

      {/* Oxblood CTA */}
      <View className="bg-oxblood border border-gold/30 rounded-sm p-4 mb-6 items-center">
        <Text className="font-inter-semibold text-parchment text-sm tracking-wider uppercase">
          Primary Action
        </Text>
        <Text className="font-inter text-parchment/60 text-xs mt-1">
          Oxblood accent — wax seals, CTAs, page markers
        </Text>
      </View>

      <GoldRule double className="mb-4" />

      <Text className="font-inter text-parchment/30 text-xs text-center mb-8">
        The Grimoire Archive Design System · v0.1
      </Text>
    </ScrollView>
  );
}
