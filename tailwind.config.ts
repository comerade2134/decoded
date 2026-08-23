import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#f4f4f5",
        surface: {
          DEFAULT: "rgba(18, 18, 23, 0.65)",
          hover: "rgba(25, 25, 33, 0.75)",
          active: "rgba(32, 32, 42, 0.85)",
          border: "rgba(255, 255, 255, 0.08)",
          highlight: "rgba(255, 255, 255, 0.05)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-space-grotesk)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "spring": "cubic-bezier(0.32, 0.72, 0, 1)",
        "spring-bouncy": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      animation: {
        "shimmer": "shimmer 3s linear infinite",
        "pulse-subtle": "pulseSubtle 2.5s ease-in-out infinite",
        "scan-beam": "scanBeam 2.2s cubic-bezier(0.77, 0, 0.175, 1) infinite",
        "glow-slow": "glowSlow 4s ease-in-out infinite alternate",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.85" },
        },
        scanBeam: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "50%": { opacity: "0.8" },
          "100%": { transform: "translateY(300%)", opacity: "0" },
        },
        glowSlow: {
          "0%": { opacity: "0.3" },
          "100%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
