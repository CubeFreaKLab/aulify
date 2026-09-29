import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    '.local-private/**',
    'next-env.d.ts',
    'coverage/**',
    'playwright-report/**',
    'playwright-compatibility-report/**',
    'test-results/**',
    'test-results-compatibility/**',
  ]),
]);
