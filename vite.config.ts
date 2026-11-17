import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { localApiPlugins } from './vite-plugins'

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ...localApiPlugins()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
    headers: SECURITY_HEADERS,
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: SECURITY_HEADERS,
  },
  build: {
    target: 'baseline-widely-available',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom|scheduler|zustand)[\\/]/,
              priority: 30,
            },
            {
              name: 'i18n-vendor',
              test: /node_modules[\\/](?:i18next|react-i18next|i18next-browser-languagedetector)[\\/]/,
              priority: 25,
            },
            {
              name: 'forge-vendor',
              test: /node_modules[\\/]node-forge[\\/]/,
              priority: 20,
            },
            {
              name: 'icons-vendor',
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15000,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.{js,mjs}'],
    reporters: ['default', 'vitest-sonar-reporter'],
    outputFile: {
      'vitest-sonar-reporter': './coverage/sonar-report.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        'vite-plugins/**',
        'src/test/**',
        'src/types/**',
        'src/data/**',
        'src/i18n/locales/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'scripts/**',
        'test-certs/**',
        'test-samples/**',
        '**/*.d.ts',
      ],
    },
  },
})
