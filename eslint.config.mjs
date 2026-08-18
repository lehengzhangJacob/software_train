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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Independent repository checked out inside the project tree.
    "dsh-routing-suite/**",
    // Cloud deploy staging copy of the standalone bundle (scripts/deploy.mjs).
    ".deploy-stage/**",
    // Android build intermediates copied under android/app/build.
    "android/app/build/**",
  ]),
]);

export default eslintConfig;
