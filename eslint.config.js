"use strict";

const js = require("@eslint/js");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

const commonJsRules = {
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "no-debugger": "error",
};

const typescriptRules = {
  "no-unused-vars": "off",
  "no-debugger": "error",
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
};

const typescriptParserOptions = {
  parser: tsParser,
  ecmaVersion: 2022,
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "backend/node_modules/**",
      "data/**",
    ],
  },
  js.configs.recommended,
  {
    files: [
      "eslint.config.js",
      "scripts/**/*.js",
      "scripts/**/*.cjs",
      "backend/**/*.js",
      "backend/**/*.cjs",
      "**/*.cjs",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: commonJsRules,
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: commonJsRules,
  },
  {
    files: ["**/*.js"],
    ignores: [
      "eslint.config.js",
      "scripts/**",
      "backend/**",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: commonJsRules,
  },
  {
    files: [
      "scripts/**/*.ts",
      "scripts/**/*.tsx",
      "backend/**/*.ts",
      "backend/**/*.tsx",
    ],
    languageOptions: {
      ...typescriptParserOptions,
      sourceType: "commonjs",
      globals: globals.node,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: typescriptRules,
  },
  {
    files: [
      "scripts/ci/fixtures/lint/esm/**/*.ts",
      "scripts/ci/fixtures/lint/esm/**/*.tsx",
    ],
    languageOptions: {
      ...typescriptParserOptions,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: typescriptRules,
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "scripts/**",
      "backend/**",
    ],
    languageOptions: {
      ...typescriptParserOptions,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: typescriptRules,
  },
];
