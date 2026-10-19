/** @type {import("tailwindcss").Config} */
const config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        closer: {
          bg: "#08090a",
          sidebar: "#0f1011",
          surface: "#0f1011",
          panel: "#141516",
          soft: "#191a1b",
          hover: "rgba(255, 255, 255, 0.055)",
          active: "rgba(255, 255, 255, 0.09)",
          selected: "rgba(244, 97, 42, 0.16)",
          border: "#23252a",
          "border-strong": "#34343a",
        },
        accent: {
          DEFAULT: "#f4612a",
          hover: "#ff7a45",
          strong: "#c34e22",
          soft: "rgba(244, 97, 42, 0.18)",
        },
      },
      fontFamily: {
        sans: ["Inter", "Inter Variable", "system-ui", "sans-serif"],
        mono: ["SF Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: "11px",
        sm: "12px",
        base: "14px",
        lg: "16px",
        xl: "19px",
        "2xl": "24px",
        "3xl": "28px",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      borderRadius: {
        sm: "5px",
        md: "7px",
        lg: "10px",
        xl: "12px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.4)",
        md: "0 4px 14px rgba(0, 0, 0, 0.45)",
        lg: "0 16px 48px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
