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
          DEFAULT: "#ECE3CF",
          deep: "#E0D4BC",
          light: "#F5EFDE",
        },
        gold: {
          DEFAULT: "#A07A2C",
          muted: "#C9A24A",
          bright: "#D4A843",
        },
        oxblood: {
          DEFAULT: "#7A2418",
          light: "#9A3428",
        },
        ink: {
          DEFAULT: "#2A2118",
          soft: "#4A3F32",
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
