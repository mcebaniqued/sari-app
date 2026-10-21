import js from "@eslint/js";
import jsxA11y from "@htmlacademy/eslint-plugin-jsx-a11y";
import { defineConfig, globalIgnores } from "eslint/config";
import playwright from "eslint-plugin-playwright";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  // ESLint already ignores node_modules and .git; exclude generated outputs here.
  globalIgnores([
    // Build tools own emitted code, declarations, and coverage instrumentation.
    "**/dist/**",
    "**/coverage/**",
    // Playwright owns generated reports, traces, and screenshots.
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    plugins: {
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        // Required callback slots (such as Express's fourth error-handler argument)
        // and intentionally discarded destructured fields use an underscore prefix.
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
    },
    languageOptions: { globals: globals.node },
  },
  {
    files: [
      "api/src/**/*.ts",
      "packages/contracts/src/**/*.ts",
      "web/src/**/*.{ts,tsx}",
    ],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: false, allowNullish: false },
      ],
    },
  },
  {
    files: ["web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.strict,
    ],
    rules: {
      // Native dialogs need keyboard trapping and backdrop clicks; browser/axe tests cover them.
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        { dialog: ["onClick", "onKeyDown"] },
      ],
    },
  },
  { files: ["e2e/**/*.ts"], extends: [playwright.configs["flat/recommended"]] },
);
