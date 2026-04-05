import {
  presetAttributify,
  presetIcons,
  presetUno,
  transformerVariantGroup,
  defineConfig,
} from "unocss";

export default defineConfig({
  content: {
    filesystem: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  },
  theme: {
    colors: {
      ink: {
        DEFAULT: "#132238",
        soft: "#4b5f7a",
      },
      paper: {
        DEFAULT: "#f6f1e8",
        warm: "#fffaf0",
      },
      accent: {
        gold: "#c7842a",
        teal: "#2c7a7b",
        rust: "#9f4d2a",
      },
    },
  },
  shortcuts: {
    "panel-shell":
      "rounded-[28px] border border-white/45 bg-white/75 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl",
    "section-title": "font-serif text-3xl text-ink md:text-4xl",
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      collections: {
        lucide: () => import("@iconify-json/lucide/icons.json").then((module) => module.default),
      },
    }),
  ],
  transformers: [transformerVariantGroup()],
});
