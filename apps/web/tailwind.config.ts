import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#FFC400",
        "brand-dark": "#E5B000"
      }
    }
  },
  plugins: []
} satisfies Config;
