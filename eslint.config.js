"use strict";

const js = require("@eslint/js");
const globals = require("globals");

const commonJsRules = {
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "no-debugger": "error",
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
];
