import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "var(--color-primary)",
        brandDark: "var(--color-primary-dark)",
        brandSoft: "var(--color-primary-light)",
        secondary: "var(--color-secondary)",
        danger: "var(--color-danger)",
        success: "var(--color-success)",
        surface: "var(--color-surface)",
        bg: "var(--color-background)",
        textPrimary: "var(--color-text-primary)",
        textSecondary: "var(--color-text-secondary)",
        borderColor: "var(--color-border)",
      },
      boxShadow: {
        calm: "0 20px 45px -25px rgba(15, 118, 110, 0.35)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
} satisfies Config;

