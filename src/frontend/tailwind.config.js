import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["index.html", "src/**/*.{js,ts,jsx,tsx,html,css}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "oklch(var(--popover))",
          foreground: "oklch(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
        chart: {
          1: "oklch(var(--chart-1))",
          2: "oklch(var(--chart-2))",
          3: "oklch(var(--chart-3))",
          4: "oklch(var(--chart-4))",
          5: "oklch(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "oklch(var(--sidebar))",
          foreground: "oklch(var(--sidebar-foreground))",
          primary: "oklch(var(--sidebar-primary))",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground))",
          accent: "oklch(var(--sidebar-accent))",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground))",
          border: "oklch(var(--sidebar-border))",
          ring: "oklch(var(--sidebar-ring))",
        },
        /* Palette 1-8 as first-class utilities */
        lime: "oklch(var(--lime) / <alpha-value>)",
        "lime-bright": "oklch(var(--lime-bright) / <alpha-value>)",
        "baby-blue": "oklch(var(--baby-blue) / <alpha-value>)",
        "baby-pink": "oklch(var(--baby-pink) / <alpha-value>)",
        "silk-black": "oklch(var(--silk-black) / <alpha-value>)",
        "night-sky": "oklch(var(--night-sky) / <alpha-value>)",
        "shine-navy": "oklch(var(--shine-navy) / <alpha-value>)",
        "blue-green": "oklch(var(--blue-green) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0,0,0,0.05)",
        "block":
          "0 1px 0 0 oklch(var(--border)), 0 10px 28px -22px oklch(0 0 0 / 0.75)",
        "block-open":
          "0 1px 0 0 oklch(var(--border)), 0 22px 48px -30px oklch(0 0 0 / 0.85)",
        "ledger": "inset 0 1px 0 0 oklch(var(--card))",
        "rail": "0 1px 0 0 oklch(var(--border))",
        "block-tinted":
          "0 1px 0 0 oklch(var(--border)), 0 12px 30px -24px oklch(0 0 0 / 0.8)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "chain-draw": {
          "0%": { strokeDashoffset: "240", opacity: "0.35" },
          "45%": { strokeDashoffset: "0", opacity: "1" },
          "70%": { strokeDashoffset: "0", opacity: "1" },
          "100%": { strokeDashoffset: "-240", opacity: "0.35" },
        },
        "chain-pulse": {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "1" },
        },
        "block-seal": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "rule-sweep": {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "tile-ignite": {
          "0%": { opacity: "0" },
          "18%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "ambient-drift": {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(-14px, -18px, 0)" },
          "100%": { transform: "translate3d(0, 0, 0)" },
        },
        "signal-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "chain-draw": "chain-draw 2.6s cubic-bezier(0.65, 0, 0.35, 1) infinite",
        "chain-pulse": "chain-pulse 3.2s ease-in-out infinite",
        "block-seal": "block-seal 0.28s cubic-bezier(0.16, 1, 0.3, 1) both",
        "rule-sweep": "rule-sweep 1.6s linear infinite",
        "tile-ignite": "tile-ignite 1.05s ease-out both",
        "ambient-drift": "ambient-drift 26s ease-in-out infinite",
        "signal-blink": "signal-blink 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [typography, containerQueries, animate],
};
