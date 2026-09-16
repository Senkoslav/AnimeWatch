import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

// Hex-цвет в строке или в произвольном значении Tailwind: "#fff", "bg-[#0E1116]".
const HEX_COLOR = String.raw`/(^|[\s\[:(])#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z_-])/`;
// Якоря вида href="#add" тоже похожи на hex, но это не цвет.
const ANCHOR_ATTRIBUTE = "JSXAttribute[name.name=/^(href|id)$/]";
const HEX_MESSAGE =
  "Цвет только через токен из docs/04-design-system.md. Не хватает токена — добавь его в app/globals.css.";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([".next/**", ".tmp/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // CLAUDE.md: @ts-expect-error только с комментарием, почему он нужен.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", "ts-ignore": true, "ts-nocheck": true },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${HEX_COLOR}]:not(${ANCHOR_ATTRIBUTE} > Literal)`, message: HEX_MESSAGE },
        { selector: `TemplateElement[value.raw=${HEX_COLOR}]`, message: HEX_MESSAGE },
      ],
    },
  },
]);
