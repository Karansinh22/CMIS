/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        surface: {
          DEFAULT: "#0f0f1a",
          50:  "#1a1a2e",
          100: "#16213e",
          200: "#1e2a4a",
          300: "#253057",
        },
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)",
        "gradient-dark":  "linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)",
        "gradient-card":  "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 100%)",
      },
      animation: {
        "fade-in":    "fadeIn 0.4s ease-out",
        "slide-up":   "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow":  "spin 3s linear infinite",
        "glow":       "glow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        glow:    { "0%,100%": { boxShadow: "0 0 8px rgba(99,102,241,0.4)" }, "50%": { boxShadow: "0 0 24px rgba(99,102,241,0.8)" } },
      },
      boxShadow: {
        "glow-brand": "0 0 20px rgba(99,102,241,0.3)",
        "glow-cyan":  "0 0 20px rgba(6,182,212,0.3)",
        "card":       "0 4px 24px rgba(0,0,0,0.4)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(99,102,241,0.2)",
      },
    },
  },
  plugins: [],
};
