import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--fg)",
        "fg-secondary": "var(--fg-secondary)",
        "fg-tertiary": "var(--fg-tertiary)",
        border: "var(--border)",
        "bg-subtle": "var(--bg-subtle)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
    },
  },
  plugins: [],
};
export default config;
