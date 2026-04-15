import { type Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "rgb(var(--color-primary-rgb) / <alpha-value>)",
        brandDark: "rgb(var(--color-primary-dark-rgb) / <alpha-value>)",
        brandSoft: "rgb(var(--color-primary-light-rgb) / <alpha-value>)",
        secondary: "var(--color-secondary)",
        danger: "var(--color-danger)",
        success: "var(--color-success)",
        surface: "var(--color-surface)",
        bg: "var(--color-background)",
        textPrimary: "rgb(var(--color-text-primary-rgb) / <alpha-value>)",
        textSecondary: "rgb(var(--color-text-secondary-rgb) / <alpha-value>)",
        borderColor: "rgb(var(--color-border-rgb) / <alpha-value>)",
      },
      boxShadow: {
        calm: "0 22px 48px -18px rgba(99, 102, 241, 0.22)",
        premium: "0 30px 60px -12px rgba(15, 23, 42, 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
