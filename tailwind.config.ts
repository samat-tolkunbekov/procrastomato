import type { Config } from "tailwindcss";

export default {
  content: ["./entrypoints/**/*.{html,vue,ts}", "./components/**/*.vue"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
