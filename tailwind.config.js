/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#18181b",
          soft: "#3f3f46",
          muted: "#71717a",
          faint: "#a1a1aa",
        },
        line: {
          DEFAULT: "#e4e4e7",
          soft: "#f1f1f3",
        },
        canvas: "#fafafa",
        accent: {
          DEFAULT: "#4f46e5",
          hover: "#4338ca",
          soft: "#eef2ff",
          line: "#c7d2fe",
        },
        positive: { DEFAULT: "#047857", soft: "#ecfdf5" },
        warn: { DEFAULT: "#b45309", soft: "#fffbeb" },
        danger: { DEFAULT: "#b91c1c", soft: "#fef2f2" },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Inter", "Roboto",
          "Helvetica Neue", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(24,24,27,0.04), 0 1px 3px rgba(24,24,27,0.06)",
        lift: "0 4px 12px rgba(24,24,27,0.08), 0 1px 3px rgba(24,24,27,0.06)",
        pop: "0 12px 32px rgba(24,24,27,0.12)",
      },
      maxWidth: { content: "1160px" },
    },
  },
  plugins: [],
};
