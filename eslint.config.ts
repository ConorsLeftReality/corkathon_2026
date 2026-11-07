import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

const RESTRICTED_SYNTAX = [
  { selector: 'ExportDefaultDeclaration', message: 'named exports only' },
  { selector: 'ExportAllDeclaration', message: 'no barrels, export from the file itself' },
  { selector: 'TSEnumDeclaration', message: 'use a union of string literals' },
]

// unawaited it passes without checking and bun types it as void so awaiting fails lint too
const ASYNC_EXPECT = {
  selector: 'MemberExpression[object.callee.name="expect"][property.name=/^(rejects|resolves)$/]',
  message: 'use expect(await promise.catch((error: unknown) => error)).toBeInstanceOf(...)',
}

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'apps/api/**',
      // copied from D:/dev/skills, fixes belong there
      'scripts/lint-*.ts',
      'skills/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/*.e2e.ts'],
    rules: { 'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX, ASYNC_EXPECT] },
  },
  {
    files: ['*.config.ts', 'apps/*/vite.config.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
)
