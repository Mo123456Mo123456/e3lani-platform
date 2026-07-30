import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#050b14",
        panel: "#0a1420",
        panelAlt: "#0d1a2a",
        line: "#1b2b40",
        tech: "#38bdf8",
        nature: "#34d399",
        civ: "#f5c452",
        violet: "#a78bfa",
        war: "#f87171",
        hazard: "#fb923c",
        dim: "#8b98a9",
      },
    },
  },
  plugins: [],
} satisfies Config;
