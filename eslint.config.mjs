import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "apps/mobile/**",
    "apps/crm-mobile/**",
    ".next-sales-build*/**",
    ".next-sales-dev/**",
    ".codex-runtime/**",
    ".git/**",
    "node_modules/**",
    "mobile-app/node_modules/**",
    "apps/mobile/node_modules/**",
    "apps/crm-mobile/node_modules/**",
    "src/generated/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
