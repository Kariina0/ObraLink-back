// eslint.config.js — flat config para ESLint v9/v10
// Projeto Node.js CommonJS (sem TypeScript, sem frontend)
const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["src/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      // Erros reais
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-console": "off",

      // Boas práticas
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-var": "warn",
      "prefer-const": "warn",
    },
  },
  {
    // Ignora arquivos de teste e configuração de terceiros
    ignores: ["node_modules/**", "coverage/**", "tests/**", "data/**", "logs/**"],
  },
];
