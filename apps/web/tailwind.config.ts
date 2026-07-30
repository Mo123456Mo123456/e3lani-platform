import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: "#FFC400",
        ink: "#111111",
        muted: "#F7F7F7"
      }
    }
  },
  plugins: []
} satisfies Config;
