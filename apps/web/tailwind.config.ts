import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        elevated: "var(--bg-elevated)",
        cyan: "var(--cyan)",
        green: "var(--green)",
        gold: "var(--gold)",
        purple: "var(--purple)",
        red: "var(--red)",
        orange: "var(--orange)",
        ink: "var(--text)",
        muted: "var(--muted)",
      },
      fontFamily: {
        arabic: ["var(--font-arabic)", "sans-serif"],
        latin: ["var(--font-latin)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(34, 211, 238, 0.25)",
        "glow-green": "0 0 20px rgba(52, 211, 153, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
