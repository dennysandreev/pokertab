import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b1020",
        foreground: "#f3f4f6",
        border: "#1f2937",
        card: "#111827",
        accent: "#22c55e",
        muted: "#9ca3af"
      }
    }
  },
  plugins: []
};

export default config;

