# Certificate Management 🛡️

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Memija_certificate-management&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Memija_certificate-management)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Memija_certificate-management&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Memija_certificate-management)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Memija_certificate-management&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Memija_certificate-management)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Memija_certificate-management&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Memija_certificate-management)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Memija_certificate-management&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Memija_certificate-management)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg?logo=vite)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-6e9f18.svg?logo=vitest)](https://vitest.dev)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-blue.svg)](./LICENSE)

An enterprise-grade, privacy-first **X.509 certificate, PKI, and UEFI Secure Boot inspection & management** application built with **React 19**, **Vite 8 (Rolldown)**, **TypeScript 6**, **Zustand**, and **node-forge**. Designed for system administrators, security engineers, and developers, Certificate Management combines 100% in-browser ASN.1/X.509 cryptographic tooling with local Windows workstation inspection (UEFI Secure Boot NVRAM, Windows Certificate Stores, live TLS/OCSP probing) and seamless static-web fallbacks, backed by a defense-in-depth security and quality verification pipeline.

---

## ✨ Features

### 🖥️ System & Firmware Inspection

- **UEFI Secure Boot NVRAM Inspector**: Inspects `PK` (Platform Key), `KEK` (Key Exchange Key), `db` (Allowed Signature Database), and `dbx` (Revoked Signature Database) EFI Signature Lists, automatically evaluating 2011-to-2023 Microsoft UEFI CA and Windows Production PCA rollover readiness.
- **Windows Certificate Store Explorer**: Browses `CurrentUser` and `LocalMachine` stores (`Root`, `CA`, `My`, `TrustedPublisher`, `Disallowed`) with misplaced-root detection, purpose filtering, and PEM/DER export.
- **Certificate Expiry Dashboard**: Consolidated 30-day expiring-soon and expired certificate radar across system stores with sorting, filtering, and severity breakdowns.

### 🔍 PKI Inspection & Cryptographic Validation

- **Trust Store & Keystore Inspector**: Parses `.pem`, `.crt`, `.cer`, `.der`, `.p7b`/`.p7c` (PKCS#7), `.pfx`/`.p12` (PKCS#12), and `.jks`/`.keystore` (Java KeyStore, including password-protected `SunJCE` private key decryption) entirely in browser memory.
- **CRL Inspector**: Decodes PEM and binary DER Certificate Revocation Lists (`.crl`), issuer metadata, next-update windows, and RFC 5280 revocation reason codes.
- **X.509 Chain Validator**: Orders unordered certificate bundles from Leaf → Intermediate CA → Root CA, verifying cryptographic signatures, validity windows, Basic Constraints, and AKI/SKI linkage.
- **CSR Inspector & Interactive Builder**: Parses PEM/DER PKCS#10 Certificate Signing Requests (`.csr`, `.req`), verifies self-signatures, validates Subject & SAN rules (DNS wildcards, IPv4/IPv6, URI, email), and generates compliant CSRs in-browser.

### 🔑 Key Management & Format Conversion

- **Key Pair Modulus Matcher**: Cryptographically verifies whether an X.509 Certificate, CSR, and RSA Private Key (PKCS#1 / PKCS#8) share an identical modulus fingerprint without transmitting private key material.
- **In-Browser Key & Self-Signed Cert Generator**: Generates 2048/4096-bit RSA key pairs, CSRs, and self-signed X.509 certificates via Web Crypto & `node-forge`.
- **Universal Format Converter**: Converts seamlessly between **PEM**, **DER**, **PKCS#7 (`.p7b`)**, and password-protected **PKCS#12 (`.pfx`/`.p12`)** bundles.

### 🌐 Network & Revocation Diagnostics

- **Remote TLS Scanner**: Inspects live TLS certificate chains, negotiated protocol versions, cipher suites, SANs, and X.509v3 extensions.
- **OCSP & CRL Revocation Checker**: Evaluates certificate revocation status (`good`, `revoked`, `unknown`) with AIA/CDP endpoint extraction.
- **Certificate Transparency (CT) Log Search**: Queries public CT logs (`crt.sh` with `CertSpotter` failover) for domain/subdomain issuance history.
- **PKI Education Center**: Interactive reference guides covering UEFI Secure Boot, X.509 trust hierarchies, TLS/OCSP protocols, and cryptographic container formats.

### 🌍 Multi-Language Internationalization (i18n)

- Complete localization across **6 languages** (`en`, `de`, `bs`, `sr-Cyrl`, `id`, `pl`) with lazy-loaded translation bundles, OS locale/theme detection, and zero hardcoded UI strings.

---

## 🏗️ Architecture & Key Technical Decisions

1. **React 19 & TypeScript 6 Strict Mode**:
   - Modern functional components with hooks (`useState`, `useMemo`, `useCallback`, `useEffect`).
   - Strict TypeScript configuration (`strict`, `noImplicitReturns`, `noImplicitOverride`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, zero `any`) shared across DRY `tsconfig` project references.
2. **Vite 8 (Rolldown) & On-Demand Code Splitting**:
   - Dedicated vendor chunk groups (`react-vendor`, `i18n-vendor`, `forge-vendor`, `icons-vendor`), lazy-loaded feature views (`React.lazy` + `Suspense`), and lazy-loaded locale bundles.
3. **Modular Component Structure (CSS Modules)**:
   - Every component enforces strict file separation (`.tsx` logic/markup and `.module.css` scoped styles consuming `src/index.css` tokens), small focused files (`< 500` lines max), and reusable primitives in `src/components/shared/`.
4. **Zustand State Management & Hybrid Execution**:
   - Lightweight Zustand stores (`useAppStore`, `useThemeStore`, `useToastStore`) manage navigation, theme preferences, and notifications, while modular Vite server plugins (`vite-plugins/`) provide local Windows inspection with deterministic client-side fallbacks (`src/utils/web-fallbacks/`) for static hosting.
5. **Comprehensive Vitest Suite**:
   - Unit and component tests running via **Vitest 4**, **React Testing Library**, and **jsdom** with V8 code coverage thresholds (`80%` lines/statements/functions, `70%` branches) and SonarCloud execution reporting.

---

## 📁 Project Structure

```text
certificate-management/
├── .github/
│   ├── ISSUE_TEMPLATE/          # Bug report and feature request templates
│   ├── workflows/               # GitHub Actions CI/CD security and quality workflows
│   ├── CODEOWNERS               # Repository code ownership rules
│   ├── dependabot.yml           # Automated weekly dependency updates
│   ├── PULL_REQUEST_TEMPLATE.md # Pull request checklist template
│   └── SECURITY.md              # Security vulnerability reporting policy
├── .husky/                      # Git hooks (pre-commit, commit-msg, pre-push)
├── public/                      # Static assets, PWA manifest, icons, and country flags
├── scripts/                     # Security, secret scanning, OSV, Lighthouse & fixture scripts
├── src/
│   ├── components/              # Feature views, layout shell, and shared UI primitives
│   │   ├── ChainValidator/      # X.509 trust chain builder & validator
│   │   ├── CrlInspector/        # PEM/DER CRL parser & revocation reason inspector
│   │   ├── CsrInspector/        # PKCS#10 CSR inspector & interactive CSR builder modal
│   │   ├── CtLogSearch/         # Certificate Transparency log search
│   │   ├── EducationCenter/     # PKI & Secure Boot interactive learning center
│   │   ├── ExpiryDashboard/     # Cross-store certificate expiration radar
│   │   ├── FormatConverter/     # PEM / DER / PKCS#7 / PKCS#12 converter
│   │   ├── KeyGenerator/        # RSA key pair & self-signed cert generator
│   │   ├── KeyPairMatcher/      # Cert / CSR / Private Key modulus matcher
│   │   ├── OcspChecker/         # OCSP & CRL revocation status verifier
│   │   ├── SecureBootInspector/ # UEFI Secure Boot NVRAM (PK, KEK, db, dbx) inspector
│   │   ├── TlsScanner/          # Remote TLS handshake & chain scanner
│   │   ├── TrustStoreInspector/ # PEM / DER / P7B / PFX / JKS file inspector
│   │   ├── WinCertStoreInspector/ # Windows CurrentUser & LocalMachine store explorer
│   │   ├── layout/              # AppSidebar, AppHeader, and AppFooter
│   │   └── shared/              # ErrorBoundary, ModuleHeader, ToastContainer, LearningTerm
│   ├── config/                  # Navigation categories and app constants
│   ├── data/                    # Preset samples, country codes, and education topics
│   ├── hooks/                   # Custom React hooks
│   ├── i18n/                    # Lazy-loaded locales (en, de, bs, sr-Cyrl, id, pl)
│   ├── store/                   # Zustand state stores (app mode, theme, toasts)
│   ├── test/                    # Vitest global test setup
│   ├── types/                   # Shared TypeScript domain interfaces
│   ├── utils/                   # X.509/ASN.1/EFI/JKS parsers, validators & web fallbacks
│   ├── App.tsx                  # Root application shell & lazy view orchestrator
│   ├── index.css                # Global CSS custom properties (dark/light) & base resets
│   └── main.tsx                 # React bootstrap entry point
├── vite-plugins/                # Modular local Vite dev/preview inspection middlewares
├── CODE_OF_CONDUCT.md           # Community code of conduct
├── COMMERCIAL.md                # Commercial licensing terms (separate contract required)
├── CONTRIBUTING.md              # Contribution guidelines and workflow
├── LICENSE                      # PolyForm Noncommercial License 1.0.0
├── NOTICE                       # PolyForm required attribution notice
├── commitlint.config.js         # Conventional Commits lint configuration
├── eslint.config.js             # ESLint 9 flat config with React Hooks, TS, and security rules
├── firebase.json                # Firebase Hosting config and HTTP security headers
├── lighthouserc.json            # Lighthouse CI performance and accessibility budgets
├── package.json                 # Dependencies, engine constraints, and operational scripts
├── sonar-project.properties     # SonarCloud static analysis and coverage configuration
├── tsconfig.json                # Shared base TypeScript compiler options & project references
├── tsconfig.app.json            # Application & Vitest TypeScript configuration
├── tsconfig.node.json           # Node/Vite tooling TypeScript configuration
└── vite.config.ts               # Vite 8 (Rolldown) bundler and Vitest 4 runner configuration
```

---

## 💻 Local Development

### 📋 Prerequisites

- **Node.js**: `v22.13.0` or later (Node `v22` / `v24` LTS recommended)
- **npm**: `v10.0.0` or later (`npm@11.9.0` configured in `packageManager`)

### 🚀 Getting Started

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Memija/certificate-management.git
   cd certificate-management
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the local development server:**

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173/` in your browser.

4. **Build for production:**

   ```bash
   npm run build
   ```

5. **Preview the production build locally:**

   ```bash
   npm run preview
   ```

   Serves the production bundle at `http://localhost:4173/`.

---

## 🛠️ Available Scripts

| Category         | Script                           | Description                                                                                      |
| :--------------- | :------------------------------- | :----------------------------------------------------------------------------------------------- |
| **Development**  | `npm run dev`                    | Launches local Vite development server on port `5173`                                            |
|                  | `npm run watch`                  | Rebuilds production bundle continuously on file changes                                          |
|                  | `npm run build`                  | Typechecks (`tsc -b`) and builds production bundle (`vite build`)                                |
|                  | `npm run preview`                | Serves production build locally on port `4173` for verification                                  |
| **Code Quality** | `npm run typecheck`              | Validates TypeScript types across project references without emitting files                      |
|                  | `npm run lint`                   | Lints codebase via ESLint (`--max-warnings 0`, including `eslint-plugin-security`)               |
|                  | `npm run lint:fix`               | Auto-fixes ESLint issues with zero-warning enforcement                                           |
|                  | `npm run format`                 | Auto-formats files with Prettier                                                                 |
|                  | `npm run format:check`           | Verifies code formatting without modifying files                                                 |
|                  | `npm run sonar:scan`             | Executes `sonar-scanner-npm` against local codebase and coverage telemetry                       |
| **Testing**      | `npm test`                       | Starts Vitest in interactive watch mode                                                          |
|                  | `npm run test:run`               | Executes all unit tests once and exits                                                           |
|                  | `npm run test:coverage`          | Runs test suite with V8 code coverage and Sonar XML test execution report                        |
| **Performance**  | `npm run lighthouse`             | Runs Lighthouse CI (`lhci autorun`) for both mobile and desktop presets                          |
|                  | `npm run lighthouse:flows`       | Runs Lighthouse user flows (supports `-- --quick`, `--desktop`, `--mobile`, `--light`, `--dark`) |
|                  | `npm run lighthouse:flows:quick` | Runs quick desktop light-theme user-flow verification                                            |
| **Security**     | `npm run security:all`           | Executes full local security scan suite (Trivy, OSV, Gitleaks, Zizmor, SBOM, etc.)               |
|                  | `npm run security:audit`         | Audits dependencies for critical vulnerabilities (`npm audit`)                                   |
|                  | `npm run security:codeql`        | Runs local CodeQL database creation and static security analysis                                 |
|                  | `npm run security:dast`          | Runs local OWASP ZAP baseline DAST scan via Docker                                               |
|                  | `npm run security:gitleaks`      | Scans git history and workspace for secrets with Gitleaks                                        |
|                  | `npm run security:licenses`      | Validates production dependency licenses against approved open-source list                       |
|                  | `npm run security:osv`           | Identifies open-source vulnerabilities via Google OSV-Scanner                                    |
|                  | `npm run security:sbom`          | Generates a CycloneDX Software Bill of Materials (`cyclonedx.sbom.json`)                         |
|                  | `npm run security:secrets`       | Scans git staged changes for accidentally committed credentials & keys                           |
|                  | `npm run security:socket`        | Scans dependencies for supply-chain risks via Socket.dev CLI                                     |
|                  | `npm run security:trivy`         | Scans repository filesystem and dependencies for known CVEs via Aqua Trivy                       |
|                  | `npm run security:zizmor`        | Audits GitHub Actions workflows with Zizmor                                                      |
| **Pre-Flight**   | `npm run validate`               | Runs formatting, linting, typecheck, secret/license audits, build, coverage & Lighthouse CI      |
| **Deployment**   | `npm run deploy`                 | Builds (`predeploy`) and deploys static bundle to Firebase Hosting                               |

---

## 🛡️ Security & Quality Assurance Pipeline

This project employs a defense-in-depth security and performance pipeline enforced via GitHub Actions CI/CD:

- **SonarCloud**: Static analysis, quality gate enforcement, code coverage, duplication (CPD), and maintainability metrics.
- **CodeQL**: Semantic code analysis detecting security vulnerabilities, data leaks, and injection risks.
- **OWASP ZAP (DAST)**: Dynamic application security testing against the built web application and HTTP security headers.
- **Lighthouse CI**: Automated mobile, desktop, and interactive user-flow audits for performance, accessibility, best practices, and SEO.
- **Aqua Trivy**: Scans repository filesystem and dependencies for known CVEs.
- **Google OSV-Scanner**: Identifies open-source vulnerabilities via the Google OSV database.
- **GitLeaks**: Prevents hardcoded secrets, credentials, and API tokens from entering git history.
- **OpenSSF Scorecard**: Automated evaluation of supply-chain security and repository hygiene.
- **Socket.dev**: Detects malicious supply-chain package behavior and typosquatting.
- **Zizmor**: Static security audit and misconfiguration analyzer for GitHub Actions workflows.
- **CycloneDX & SPDX SBOM**: Automated generation of Software Bills of Materials for dependency transparency.
- **Husky, Lint-Staged & Commitlint**: Enforces pre-commit secret checks, zero-warning linting, Prettier formatting, and Conventional Commits.

---

## 🌐 Supported Languages

| Language              | Code      | Default Locale | Status   |
| :-------------------- | :-------- | :------------- | :------- |
| 🇬🇧 English            | `en`      | `en-US`        | Complete |
| 🇩🇪 German             | `de`      | `de-DE`        | Complete |
| 🇧🇦 Bosnian            | `bs`      | `bs-BA`        | Complete |
| 🇷🇸 Serbian (Cyrillic) | `sr-Cyrl` | `sr-RS`        | Complete |
| 🇮🇩 Indonesian         | `id`      | `id-ID`        | Complete |
| 🇵🇱 Polish             | `pl`      | `pl-PL`        | Complete |

---

## 🤝 Contributing & Security

- **Contributions**: Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before submitting pull requests.
- **Security Vulnerabilities**: Please follow the responsible disclosure instructions in [.github/SECURITY.md](./.github/SECURITY.md) rather than opening a public issue.

---

## 📄 License

- **Personal & Non-Commercial Use**: Licensed under the **PolyForm Noncommercial License 1.0.0** — see [LICENSE](./LICENSE) for full details.
- **Commercial Use**: Any commercial use requires signing a separate written contract negotiated on a specific, case-by-case basis with the Owner — see [COMMERCIAL.md](./COMMERCIAL.md).
- **Attribution Notice**: Downstream redistributions must preserve the required plain-text attribution in [NOTICE](./NOTICE).
