import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#141313",
        foreground: "#e5e2e1",
        border: "rgba(255,255,255,0.1)",
        card: "rgba(26,26,26,0.8)",
        accent: "#4edea3",
        muted: "#a7a3a1",
        surface: "#0f0f0f",
        surfaceBase: "#141313",
        surfaceHigh: "#201f1f",
        surfaceHigher: "#2a2a2a",
        surfaceBright: "#3a3939",
        danger: "#ffb4ab"
      },
      fontFamily: {
        display: ['"Hanken Grotesk"', "Inter", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"]
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem"
      },
      boxShadow: {
        glow: "0 0 24px rgba(78, 222, 163, 0.12)",
        panel: "0 18px 48px rgba(0, 0, 0, 0.32)"
      }
    }
  },
  plugins: []
};

export default config;
