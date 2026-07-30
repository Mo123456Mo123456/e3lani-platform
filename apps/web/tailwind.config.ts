import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        e3: {
          yellow: "#FFC400",
          black: "#111111",
          gray: "#F7F7F7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
