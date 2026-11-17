import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import security from 'eslint-plugin-security'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'coverage-ts',
    '.firebase',
    '.lighthouseci',
    'lighthouse-reports',
    'zap-reports',
    'sarif-results',
    'codeql-db',
    'test-certs',
    'test-samples',
  ]),
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      security.configs.recommended,
    ],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-unsafe-regex': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'max-depth': ['error', 4],
      'max-params': ['error', 6],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // 1. React, Core Libraries, and Third-Party Packages
            ['^react', '^node:', '^@?\\w'],
            // 2. Absolute Internal Imports (configured with @/ alias)
            ['^@/'],
            // 3. Relative Internal Imports
            ['^\\.'],
            // 4. Styles
            ['^.+\\.s?css$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
    },
  },
  {
    files: ['src/components/**/*.tsx'],
    ignores: ['**/*.test.tsx', '**/*.spec.tsx'],
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 420, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/{config,data,hooks,i18n,store,utils}/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 350, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['vite-plugins/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'security/detect-child-process': 'off',
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 350, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    ignores: ['**/*.test.{js,mjs}', '**/*.spec.{js,mjs}'],
    rules: {
      'no-console': 'off',
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 15],
    },
  },
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      curly: ['error', 'all'],
    },
  },
])
