import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        leather: {
          DEFAULT: "#1A1410",
          light: "#2A2118",
        },
        parchment: {
          DEFAULT: "#F2E8D5",
          deep: "#E8DBBF",
          light: "#FAF5EA",
          warm: "#EDE0C8",
        },
        gold: {
          DEFAULT: "#8B6914",
          muted: "#A68530",
          bright: "#C49A2C",
        },
        oxblood: {
          DEFAULT: "#7A2418",
          light: "#9A3428",
        },
        ink: {
          DEFAULT: "#2C2014",
          soft: "#5A4D3E",
          faint: "#8A7D6D",
        },
      },
      fontFamily: {
        cinzel: ["CinzelDecorative_400Regular"],
        "cinzel-bold": ["CinzelDecorative_700Bold"],
        cormorant: ["CormorantGaramond_400Regular"],
        "cormorant-italic": ["CormorantGaramond_400Regular_Italic"],
        "cormorant-semibold": ["CormorantGaramond_600SemiBold"],
        "cormorant-bold": ["CormorantGaramond_700Bold"],
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
      },
    },
  },
  plugins: [],
} satisfies Config;
