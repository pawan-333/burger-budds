import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-figtree)",
          "Figtree",
          "Open Sans",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          primary: "#f7ce0c",
          primaryHover: "#ebd000",
          primarySoft: "#fef9db",
          secondary: "#4c6d3e",
          secondaryDark: "#3b5630",
          secondarySoft: "#eef3ec",
        },
        text: {
          primary: "#212121",
          secondary: "#3a3a3a",
          tertiary: "#11141a",
          muted: "#6b7280",
          onSecondary: "#ffffff",
          onPrimary: "#212121",
        },
        surface: {
          base: "#ffffff",
          raised: "#f8f8f8",
          page: "#f4f1e6",
          dark: "#11141a",
        },
        border: {
          muted: "#d2d2d2",
          subtle: "#e8eaed",
        },
        status: {
          open: "#1e9e4a",
          openSoft: "#e8f7ed",
          error: "#d92d20",
          errorSoft: "#fef3f2",
          warning: "#f0a500",
          warningSoft: "#fff8e6",
        },
        veg: "#0f8a3c",
        nonveg: "#d92d20",
        egg: "#f0a500",
      },
      borderRadius: {
        xs: "8px",
        sm: "10px",
        md: "12px",
        pill: "999px",
      },
      boxShadow: {
        "1": "0 2px 8px rgba(0, 0, 0, 0.06)",
        card: "0 2px 8px rgba(0, 0, 0, 0.06)",
        floating: "0 8px 24px rgba(0, 0, 0, 0.14)",
      },
      transitionDuration: {
        instant: "120ms",
        fast: "200ms",
        normal: "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
