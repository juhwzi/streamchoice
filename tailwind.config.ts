import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0E0F",
        panel: "#121619",
        raise: "#1A2024",
        line: "#242C31",
        mute: "#98A4AA",
        kick: "#53FC18",
        emerald: "#10B981",
        gold: "#F59E0B",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
