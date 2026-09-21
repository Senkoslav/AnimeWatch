import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

// Hex-цвет в строке или в произвольном значении Tailwind: "#fff", "bg-[#0E1116]", "shadow-[0_0_0_1px_#fff]".
const HEX_COLOR = String.raw`/(^|[\s\[:(_,=])#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z_-])/`;
// Цветовые функции в обход токенов: "bg-[rgb(255,0,0)]", "oklch(0.7 0.1 80)".
const COLOR_FUNCTION = String.raw`/(^|[^\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/`;
// Якоря вида href="#add" тоже похожи на hex, но это не цвет.
const ANCHOR_ATTRIBUTE = "JSXAttribute[name.name=/^(href|id)$/]";
const NOT_ANCHOR = `:not(${ANCHOR_ATTRIBUTE} > Literal, ${ANCHOR_ATTRIBUTE} > JSXExpressionContainer > Literal)`;
const COLOR_MESSAGE =
  "Цвет только через токен из docs/04-design-system.md. Не хватает токена — добавь его в app/globals.css.";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    ".tmp/**",
    // Инструменты агента, поставленные пакетом: чужой код, который мы не правим и не сдаём.
    ".claude/skills/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "lib/generated/**",
  ]),
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
    // Интерфейс может появиться в любой папке, поэтому правило действует везде, кроме кода без разметки.
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: ["tests/**", "**/*.test.{ts,tsx}", "eslint.config.mjs"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${HEX_COLOR}]${NOT_ANCHOR}`, message: COLOR_MESSAGE },
        { selector: `TemplateElement[value.raw=${HEX_COLOR}]`, message: COLOR_MESSAGE },
        { selector: `Literal[value=${COLOR_FUNCTION}]`, message: COLOR_MESSAGE },
        { selector: `TemplateElement[value.raw=${COLOR_FUNCTION}]`, message: COLOR_MESSAGE },
      ],
    },
  },
]);
