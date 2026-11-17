# Coding Principles & Guidelines

**Certificate Management** (`certificate-management`) is a local-first X.509 certificate, PKI, and UEFI Secure Boot inspection & management web application built with **React 19**, **TypeScript 6**, **Vite 8 (Rolldown)**, **Zustand 5**, **`node-forge`**, **Lucide React**, **`react-i18next`**, and **CSS Modules**.

---

## 1. DRY Principle (Don't Repeat Yourself)

**CRITICAL RULE:** Before writing ANY new code, verify whether similar functionality already exists in the codebase.

### Pre-Implementation Checklist

- [ ] **Search existing code** — Use grep/codebase search before writing new utilities, ASN.1/PEM parsers, or UI patterns
- [ ] **Check shared components** — Inspect `src/components/shared/` (`ErrorBoundary`, `ModuleHeader`, `ToastContext`, `LearningTerm`, etc.)
- [ ] **Check hooks & utilities** — Inspect `src/hooks/` and `src/utils/` (`efi-parser.ts`, `csr-parser.ts`, `crl-parser.ts`, `trust-store-parser.ts`, `expiry-formatter.ts`, `purpose-formatter.ts`, `text-search.ts`, etc.)
- [ ] **Check stores & selectors** — Inspect `src/store/` (`useAppStore`, `useThemeStore`, `useToastStore`) before adding duplicate state
- [ ] **Check existing translation keys** — Search `src/i18n/locales/en/translation.json` before adding duplicate keys

### Shared Code Locations

- `src/components/shared/` — Reusable UI components used across features
- `src/components/layout/` — App shell (`AppSidebar`, `AppHeader`, `AppFooter`)
- `src/hooks/` — Shared stateful hooks and UI behavior
- `src/utils/` — Pure cryptographic helpers, X.509/ASN.1/EFI/JKS parsers, and web fallbacks
- `src/store/` — Zustand stores (`useAppStore`, `useThemeStore`, `useToastStore`)
- `src/types/` — Shared TypeScript interfaces and type aliases
- `src/i18n/` — Lazy-loaded translations (`en`, `de`, `bs`, `sr-Cyrl`, `id`, `pl`)
- `src/data/` — Static presets, sample certificates, country codes, and education topics
- `vite-plugins/` — Local Vite dev/preview middlewares for Windows Secure Boot, Cert Store, TLS, OCSP, and CT queries

### Refactoring Triggers

Stop and extract a shared abstraction whenever you see:

1. Identical or near-identical logic in 2+ places
2. Copied JSX structures (module headers, preset bars, drop zones, certificate detail cards, modals)
3. Duplicated PEM/DER decoding, Distinguished Name formatting, or expiry calculation rules
4. Repeated CSS declarations that belong in `src/index.css` tokens or a shared component

---

## 2. Project Structure & Component Architecture

### Folder Organization

```text
public/                 # Static assets served at root (/flags, icons, site.webmanifest)
scripts/                # Node CLI scripts (Lighthouse flows, security orchestration, test fixtures)
vite-plugins/           # Local Vite server plugins (Secure Boot, Cert Store, TLS, OCSP, CT)
src/
├── components/         # Feature folders + shared/ + layout/ (AppSidebar, AppHeader, AppFooter)
├── config/             # App-level navigation categories and constants
├── data/               # Sample presets, country codes, and education topics
├── hooks/              # Custom React hooks
├── i18n/               # i18next setup & lazy-loaded locale bundles
├── store/              # Zustand stores (useAppStore, useThemeStore, useToastStore)
├── test/               # Vitest global test setup (setup.ts)
├── types/              # Shared TypeScript types
├── utils/              # Pure utilities, cryptographic parsers, and web fallbacks
├── App.tsx             # Mode-based root shell & lazy view orchestration
├── index.css           # Global CSS custom properties (dark/light themes) & resets
└── main.tsx            # React root entry point
```

### Component File Structure (No Static Inline Styles)

**CRITICAL RULE:** Every styled component MUST separate logic/markup from styles using CSS Modules. Static inline `style={{ ... }}` attributes are forbidden.

```text
ComponentName/
├── ComponentName.tsx        # Logic and JSX markup
├── ComponentName.module.css # Scoped CSS Module consuming tokens from src/index.css
└── index.ts                 # Clean barrel export (when helpful)
```

```tsx
// ❌ FORBIDDEN — static inline styles
export const BadBadge = () => <span style={{ color: 'red', padding: '8px' }}>Expired</span>

// ✅ REQUIRED — CSS Module + global design tokens
import styles from './StatusBadge.module.css'

interface StatusBadgeProps {
  label: string
}

export const StatusBadge = ({ label }: StatusBadgeProps) => (
  <span className={styles.badge}>{label}</span>
)
```

### File Size & Extraction Limits

Keep files small and focused on a single responsibility. ESLint enforces hard ceilings in `eslint.config.js`:

- **Components** (`src/components/**/*.tsx`): Target `< 300` lines, hard max **`500` lines** (`max-lines-per-function: 420`)
- **Config, Data, Hooks, Stores & Utils** (`src/{config,data,hooks,i18n,store,utils}/**/*.ts`): Target `< 200` lines, hard max **`400` lines** (`max-lines-per-function: 350`)
- **Vite Plugins** (`vite-plugins/**/*.ts`): Hard max **`400` lines** (`max-lines-per-function: 350`)
- **Scripts** (`scripts/**/*.{js,mjs}`): Hard max **`400` lines** (`max-lines-per-function: 80`, `complexity: 15`)
- **Stylesheets** (`src/index.css` & `*.module.css`): Target `< 300` lines, max **`500` lines**

Extract sub-components, custom hooks, or pure helper modules early—do not wait until a file hits the ESLint ceiling.

### Naming Conventions

| Artifact              | Convention                            | Example                                        |
| --------------------- | ------------------------------------- | ---------------------------------------------- |
| Component files/dirs  | `PascalCase`                          | `ChainValidator/ChainValidator.tsx`            |
| Hook files            | `camelCase` prefixed with `use`       | `useThemeSync.ts`                              |
| Utility / data files  | `kebab-case`                          | `csr-parser.ts`, `key-matcher-samples.ts`      |
| Functions & variables | `camelCase`                           | `parseEfiSignatureLists`, `effectiveTheme`     |
| Constants             | `SCREAMING_SNAKE_CASE`                | `SUPPORTED_LANGUAGES`, `SECURITY_HEADERS`      |
| Booleans              | Prefixed `is`, `has`, `can`, `should` | `isExpired`, `isExpiringSoon`, `hasPrivateKey` |

---

## 3. State, Navigation & Performance

### Local-First & Hybrid Execution

- **Client-Side Cryptography First:** All X.509, CSR, CRL, PKCS#7, PKCS#12, JKS, and EFI Signature List parsing runs 100% locally in browser memory.
- **Graceful Static Web Fallbacks:** Local `/api/*` endpoints provided by `vite-plugins/` during workstation inspection MUST degrade gracefully via `fetchLocalApiJson` and `src/utils/web-fallbacks/` without emitting HTTP `500` console errors when running unprivileged or deployed on static hosting.
- **Zustand Stores:** Manage app navigation (`useAppStore` exposed on `window.__store`), theme state (`useThemeStore`), and toast notifications (`useToastStore`) cleanly via fine-grained selectors.

### Mode-Based Lazy Navigation

- Navigation is controlled by `mode` (`AppMode`) in `useAppStore` and `src/App.tsx` (with `?mode=` URL sync).
- Keep feature views lazy-loaded via `React.lazy` + `Suspense`, wrapped in `ErrorBoundary`.

### Rendering & Memory Performance

- Use `useMemo` for expensive ASN.1/certificate filtering and `useCallback` for handlers passed to memoized children (`React.memo`).
- Always return cleanup functions in `useEffect` (event listeners, `matchMedia`, timers, object URLs).
- Never use array index as `key` when list items can reorder, filter, or delete.

---

## 4. TypeScript, Code Quality & Formatting

### Strict TypeScript (`tsconfig.json`)

- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noImplicitReturns: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`.
- `verbatimModuleSyntax: true` — Always use `import type { ... }` for type-only imports.
- `erasableSyntaxOnly: true` — Do **not** use TypeScript `enum`, runtime `namespace`, or constructor parameter properties; use union literal types (`type Theme = 'system' | 'light' | 'dark'`) or `as const` objects instead.
- `@/*` path alias maps to `./src/*` (`tsconfig.app.json` + Vite `tsconfigPaths: true`).

### Mandatory ESLint & Quality Rules (`eslint.config.js`)

- **No `any` (`@typescript-eslint/no-explicit-any`):** Use concrete interfaces, generics, or `unknown` with type guards.
- **Curly braces always (`curly: ['error', 'all']`):** Every `if`, `else`, `for`, and `while` block MUST use `{ ... }`, even for a single line.
- **Strict equality (`eqeqeq`):** Always use `===` / `!==` (`== null` check is permitted).
- **Bounded complexity:** Max nesting depth `4` (`max-depth`), max function parameters `6` (`max-params` — group into an options object when > 3–4).
- **No `console.log` in `src/`:** `no-console` permits only `console.warn`, `console.error`, and `console.debug` in application code.

### Prettier Formatting (`.prettierrc`)

All files use Prettier (`npm run format`): **`semi: false`**, **`singleQuote: true`**, **`trailingComma: 'all'`**, **`printWidth: 100`**, **`tabWidth: 2`**.

### Import Sorting (`eslint-plugin-simple-import-sort`)

Imports are auto-sorted into **4 blank-line-separated groups** (`npm run lint:fix`):

```tsx
// 1. React, node: built-ins, and third-party packages
import React, { useMemo } from 'react'
import { ShieldCheck } from 'lucide-react'

// 2. @/ aliased internal imports
import type { ParsedCertificate } from '@/types'

// 3. Relative internal imports
import { formatExpiry } from './helpers'

// 4. Stylesheets
import styles from './CertCard.module.css'
```

---

## 5. Error Handling, Security & Licensing

### Error Handling

- Never let async file, keystore, or cryptographic operations fail silently (`try / catch / finally`).
- Log technical context with `console.error` / `console.warn`, surface localized actionable feedback in the UI, and always reset loading/file-input states in `finally`.

### Security & Data Integrity

- **Untrusted Inputs:** Treat all uploaded certificate/keystore files, pasted PEM/ASN.1 payloads, and `localStorage` data as untrusted—validate bounds, ASN.1 structure, and allowlists before processing.
- **Command Injection Prevention:** Local `vite-plugins/` endpoints MUST strictly validate parameters against allowlists (`VALID_VARS`, `VALID_STORES`, `VALID_LOCATIONS`) and use `execFile` / Base64-encoded PowerShell commands rather than unsanitized shell interpolation.
- **XSS Prevention:** Never use `dangerouslySetInnerHTML`.
- **Secrets & Environment Variables:** Never commit real private keys, API keys, or tokens (`npm run security:secrets` and `npm run security:gitleaks` must pass).

### Licensing & Author Privacy

- Licensed under **PolyForm Noncommercial License 1.0.0** (`PolyForm-Noncommercial-1.0.0` in `LICENSE`, attribution in `NOTICE`, commercial terms in `COMMERCIAL.md`).
- **Author Privacy Rule:** Never insert a personal author name into source files, documentation, or package metadata—always use `Owner` or `Repository Owner`.

---

## 6. Accessibility (A11y) & Lighthouse Gates (100% Rule)

**CRITICAL:** CI and local Lighthouse budgets (`lighthouserc.json` & `scripts/lighthouse-flow.mjs`) require **`100` (`1.0`)** on **Accessibility**, **Best Practices**, and **SEO** (`Performance >= 80`) across mobile, desktop, and user flows.

- **WCAG AA Color Contrast:** Every text/background token pair in `src/index.css` must meet WCAG AA (`>= 4.5:1` normal text, `>= 3:1` large text & UI components) in **both** dark (`:root` / `[data-theme='dark']`) and light (`[data-theme='light']`) themes.
- **WCAG 2.5.3 Label in Name:** Never attach an `aria-label` that overrides or omits a control's visible text. Omit `aria-label` when visible text is already descriptive, or ensure `aria-label` contains the exact visible text string.
- **Sequential Heading Order:** Follow strict `<h1>` → `<h2>` → `<h3>` hierarchy without skipping levels.
- **Accessible Controls:** Icon-only buttons MUST have localized `aria-label` (and `title`); images MUST have `alt` (`alt=""` if decorative); inputs MUST have `<label htmlFor>` or `aria-label`; all interactive elements MUST be keyboard operable (`<button type="button">`, never `<div onClick>`).

---

## 7. Internationalization (i18n)

- Uses `i18next` + `react-i18next` (`src/i18n/`) with synchronous `en` fallback and lazy-loaded locale bundles (`de`, `bs`, `sr-Cyrl`, `id`, `pl`).
- **Zero hardcoded UI strings:** Every user-facing label, `aria-label`, `title`, placeholder, and error message must use `t(...)`.
- **Key parity:** Maintain identical nested key structures across all 6 `translation.json` files (verified by unit tests).
- **German compound words:** Always write complete compound words (never truncated with trailing hyphens).

---

## 8. Testing, Validation & Commits

### Testing (`Vitest` + React Testing Library)

- Co-locate unit and component tests alongside source files (`*.test.ts`, `*.test.tsx`).
- Maintain global V8 coverage thresholds (`>= 80%` lines, statements, functions; `>= 70%` branches).
- Test user-visible behavior, accessibility roles/labels, cryptographic edge cases (corrupt ASN.1/PEM, expired/revoked certs, mismatched keys, locale switching), and store/hook contracts.

### Quality Gate Commands

- `npm run format:check` / `npm run format` — Prettier check / write
- `npm run lint` — ESLint with `--max-warnings 0`
- `npm run typecheck` — TypeScript project-references check (`tsc -b --noEmit`)
- `npm run test:run` / `npm run test:coverage` — Vitest test suite & V8 coverage
- `npm run lighthouse` / `npm run lighthouse:flows:quick` — Mobile, desktop & user-flow Lighthouse audits
- `npm run validate` — Full gate (format, lint, typecheck, secrets, gitleaks, audit, licenses, build, coverage, Lighthouse)

### Conventional Commits (`commitlint.config.js` + Husky)

All commit messages are validated by Commitlint via Husky (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`, `ci:`, `build:`, `style:`):

```text
feat(chain-validator): add AKI/SKI cross-signed root resolution
```
