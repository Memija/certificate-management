/**
 * Local Security Scan Runner
 * Cross-platform runner for local security audits (Trivy, OSV, Gitleaks, Zizmor, DAST, CodeQL, Socket).
 * Automatically detects native CLI binaries, Docker containers, or falls back to built-in tools.
 */

import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Ensures Windows PATH includes WinGet package directories and User PATH additions
 * so newly installed CLI tools are immediately recognized without requiring a shell/IDE restart.
 */
export function refreshWindowsPath() {
  if (process.platform !== 'win32') {
    return
  }

  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) {
    return
  }

  const wingetPackagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages')
  const wingetLinksDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Links')

  const extraDirs = []
  if (fs.existsSync(wingetLinksDir)) {
    extraDirs.push(wingetLinksDir)
  }

  if (fs.existsSync(wingetPackagesDir)) {
    try {
      const subdirs = fs.readdirSync(wingetPackagesDir)
      for (const subdir of subdirs) {
        extraDirs.push(path.join(wingetPackagesDir, subdir))
      }
    } catch {
      // ignore
    }
  }

  const currentPathParts = (process.env.PATH || '').split(';').map((p) => p.trim())
  const pathSet = new Set(currentPathParts.map((p) => p.toLowerCase()))

  for (const dir of extraDirs) {
    if (!pathSet.has(dir.toLowerCase())) {
      currentPathParts.push(dir)
      pathSet.add(dir.toLowerCase())
    }
  }

  process.env.PATH = currentPathParts.join(';')
}

refreshWindowsPath()

/**
 * Checks if a command/executable exists in PATH.
 * @param {string} cmd
 * @returns {boolean}
 */
export function checkCommandExists(cmd) {
  try {
    const isWindows = process.platform === 'win32'
    const checkCmd = isWindows ? `where.exe ${cmd}` : `which ${cmd}`
    execSync(checkCmd, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Checks if the Docker daemon is reachable.
 * @returns {boolean}
 */
export function isDockerAvailable() {
  try {
    execSync('docker info', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function parseSocketConfigFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim()
    let jsonStr = raw
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8')
      if (decoded.includes('apiToken')) {
        jsonStr = decoded
      }
    } catch {
      // ignore
    }
    const parsed = JSON.parse(jsonStr)
    if (!parsed.apiToken || parsed.apiToken === 'undefined') {
      return null
    }
    if (parsed.defaultOrg === 'SocketDemo') {
      return { authenticated: false, isDemoToken: true }
    }
    return { authenticated: true, isDemoToken: false }
  } catch {
    return null
  }
}

/**
 * Checks if Socket API authentication is configured with valid scan permissions.
 * @returns {{ authenticated: boolean, isDemoToken: boolean }}
 */
export function checkSocketAuth() {
  if (process.env.SOCKET_CLI_API_TOKEN || process.env.SOCKET_SECURITY_API_KEY) {
    return { authenticated: true, isDemoToken: false }
  }

  const candidates = [
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, 'socket', 'settings', 'config.json'),
    path.join(os.homedir(), '.config', 'socket', 'settings', 'config.json'),
    path.join(os.homedir(), '.socket', 'settings', 'config.json'),
  ].filter(Boolean)

  for (const p of candidates) {
    if (!fs.existsSync(p)) {
      continue
    }
    const status = parseSocketConfigFile(p)
    if (status) {
      return status
    }
  }

  return { authenticated: false, isDemoToken: false }
}

function resolveTrivy({ hasCmd, hasDocker, normalizedCwd }) {
  if (hasCmd('trivy')) {
    return { type: 'cli', cmd: 'trivy fs . --severity CRITICAL,HIGH --ignore-unfixed' }
  }
  if (hasDocker()) {
    return {
      type: 'docker',
      cmd: `docker run --rm -v "${normalizedCwd}:/src" aquasec/trivy fs /src --severity CRITICAL,HIGH --ignore-unfixed`,
    }
  }
  return {
    type: 'missing',
    instructions: [
      'Trivy is not found in PATH and Docker daemon is not active.',
      'Install Trivy locally:',
      '  • Windows (winget): winget install AquaSecurity.Trivy',
      '  • macOS (Homebrew): brew install trivy',
      '  • Or start Docker Desktop to run via container.',
    ].join('\n'),
  }
}

function resolveOsv({ hasCmd, hasDocker, normalizedCwd }) {
  if (hasCmd('osv-scanner')) {
    return {
      type: 'cli',
      cmd: 'osv-scanner --lockfile=package-lock.json --config=osv-scanner.toml',
    }
  }
  if (hasDocker()) {
    return {
      type: 'docker',
      cmd: `docker run --rm -v "${normalizedCwd}:/src" ghcr.io/google/osv-scanner:latest --lockfile=/src/package-lock.json --config=/src/osv-scanner.toml`,
    }
  }
  return {
    type: 'missing',
    instructions: [
      'Google OSV-Scanner is not found in PATH and Docker daemon is not active.',
      'Install OSV-Scanner locally:',
      '  • Go: go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest',
      '  • Or download binary from: https://github.com/google/osv-scanner/releases',
      '  • Or start Docker Desktop to run via container.',
    ].join('\n'),
  }
}

function resolveGitleaks({ hasCmd, hasDocker, normalizedCwd }) {
  if (hasCmd('gitleaks')) {
    return { type: 'cli', cmd: 'gitleaks detect --source . --config .gitleaks.toml --verbose' }
  }
  if (hasDocker()) {
    return {
      type: 'docker',
      cmd: `docker run --rm -v "${normalizedCwd}:/path" zricethezav/gitleaks:latest detect --source=/path --config=/path/.gitleaks.toml --verbose`,
    }
  }
  return {
    type: 'fallback',
    cmd: 'node scripts/check-secrets.js',
    message:
      'Gitleaks CLI not found in PATH. Falling back to built-in local secret scanner (scripts/check-secrets.js)...',
  }
}

function resolveZizmor({ hasCmd }) {
  if (hasCmd('zizmor')) {
    return { type: 'cli', cmd: 'zizmor .' }
  }
  if (hasCmd('uvx')) {
    return { type: 'cli', cmd: 'uvx zizmor .' }
  }
  if (hasCmd('pipx')) {
    return { type: 'cli', cmd: 'pipx run zizmor .' }
  }
  return {
    type: 'missing',
    instructions: [
      'zizmor is not installed.',
      'Install zizmor locally:',
      '  • uv: uvx zizmor .',
      '  • Cargo: cargo install zizmor',
      '  • pipx: pipx install zizmor',
      '  • Or download binary from: https://github.com/zizmorcore/zizmor/releases',
    ].join('\n'),
  }
}

function resolveDast({ hasDocker, normalizedCwd }) {
  if (hasDocker()) {
    return {
      type: 'docker',
      cmd: `docker run --rm -v "${normalizedCwd}/.zap:/zap/wrk/:ro" -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:4173 -c rules.tsv -I`,
    }
  }
  return {
    type: 'missing',
    instructions: [
      'Docker daemon is required to run OWASP ZAP locally.',
      'Start Docker Desktop and run `npm run preview` (port 4173), then re-run this command.',
    ].join('\n'),
  }
}

function resolveCodeql({ hasCmd }) {
  if (hasCmd('codeql')) {
    return {
      type: 'cli',
      cmd: 'codeql database create codeql-db --language=javascript-typescript && codeql database analyze codeql-db',
    }
  }
  return {
    type: 'missing',
    instructions: [
      'CodeQL CLI is not installed.',
      'To run CodeQL locally:',
      '  • Install the official "CodeQL" extension in VS Code / Cursor for interactive local queries.',
      '  • Or install CodeQL CLI: https://docs.github.com/en/code-security/codeql-cli',
    ].join('\n'),
  }
}

function resolveSocket({ hasCmd, isSocketAuth, isDemoToken }) {
  if (isSocketAuth) {
    const cmd = hasCmd('socket')
      ? 'socket scan create .'
      : 'npx -y @socketsecurity/cli scan create .'
    return { type: 'cli', cmd }
  }
  return {
    type: 'missing',
    instructions: isDemoToken
      ? [
          'Socket.dev is currently configured with the limited public demo token (SocketDemo),',
          'which does not have the "full-scans:create" permission required for repository scans.',
          'To run Socket supply chain security scans locally:',
          '  • Create a free token at https://socket.dev/dashboard (Settings -> API Keys)',
          '  • Run: npx @socketsecurity/cli login and enter your personal token, OR',
          '  • Set: $env:SOCKET_CLI_API_TOKEN = "your_token"',
          '  • Note: Supply chain protection also runs automatically in CI via .github/workflows/socket.yml.',
        ].join('\n')
      : [
          'Socket.dev API token is not configured.',
          'To run Socket supply chain security scans locally:',
          '  • Run: npx @socketsecurity/cli login (to authenticate with your Socket.dev account)',
          '  • Or set the SOCKET_CLI_API_TOKEN environment variable.',
          '  • Note: Supply chain protection also runs automatically in CI via .github/workflows/socket.yml.',
        ].join('\n'),
  }
}

const TOOL_RESOLVERS = {
  trivy: resolveTrivy,
  osv: resolveOsv,
  gitleaks: resolveGitleaks,
  zizmor: resolveZizmor,
  dast: resolveDast,
  codeql: resolveCodeql,
  socket: resolveSocket,
}

/**
 * Resolves execution plan for a specified security tool.
 * @param {string} tool - 'trivy' | 'osv' | 'gitleaks' | 'zizmor' | 'dast' | 'codeql' | 'socket'
 * @param {object} [envChecks] - Optional dependency injection for testing
 * @returns {{ type: 'cli' | 'docker' | 'fallback' | 'missing', cmd?: string, instructions?: string, message?: string }}
 */
export function resolveRunner(tool, envChecks = {}) {
  const hasCmd = envChecks.hasCmd ?? checkCommandExists
  const hasDocker = envChecks.hasDocker ?? isDockerAvailable
  const checkSocket = envChecks.hasSocketAuth ?? checkSocketAuth
  const socketStatus = typeof checkSocket === 'function' ? checkSocket() : checkSocket
  const isSocketAuth =
    typeof socketStatus === 'boolean' ? socketStatus : Boolean(socketStatus?.authenticated)
  const isDemoToken = typeof socketStatus === 'object' && Boolean(socketStatus?.isDemoToken)
  const cwd = envChecks.cwd ?? process.cwd()
  const normalizedCwd = cwd.replace(/\\/g, '/')

  const resolver = TOOL_RESOLVERS[tool]
  if (!resolver) {
    return {
      type: 'missing',
      instructions: `Unknown security tool: "${tool}". Supported: trivy, osv, gitleaks, zizmor, dast, codeql, socket, all`,
    }
  }

  return resolver({ hasCmd, hasDocker, isSocketAuth, isDemoToken, normalizedCwd })
}

/**
 * Executes a resolved runner plan.
 * @param {string} tool
 * @param {object} [plan]
 * @returns {number} Exit code
 */
export function executePlan(tool, plan = resolveRunner(tool)) {
  console.log(`\n========================================`)
  console.log(`Running Security Scan: ${tool.toUpperCase()}`)
  console.log(`========================================\n`)

  if (plan.type === 'missing') {
    console.warn(`[!] ${plan.instructions}\n`)
    return 1
  }

  if (plan.type === 'fallback' && plan.message) {
    console.log(`[*] ${plan.message}\n`)
  }

  const fullCmd = plan.cmd
  console.log(`Executing: ${fullCmd}\n`)

  const result = spawnSync(fullCmd, {
    stdio: 'inherit',
    shell: true,
  })

  return result.status ?? (result.error ? 1 : 0)
}

/**
 * Runs all configured local security scans.
 */
export function runAll() {
  console.log('Starting full local security scan suite...\n')

  const steps = [
    { name: 'Secrets Check', cmd: 'node scripts/check-secrets.js' },
    { name: 'Gitleaks Scan', tool: 'gitleaks' },
    { name: 'NPM Audit', cmd: 'npm audit --audit-level=critical' },
    {
      name: 'CycloneDX SBOM',
      cmd: 'npx --no-install cyclonedx-npm --ignore-npm-errors --output-file cyclonedx.sbom.json',
    },
    { name: 'Trivy Scan', tool: 'trivy' },
    { name: 'OSV Scanner', tool: 'osv' },
    { name: 'Zizmor Workflows', tool: 'zizmor' },
  ]

  let totalFailures = 0

  for (const step of steps) {
    console.log(`\n----------------------------------------`)
    console.log(`>> [SUITE] ${step.name}`)
    console.log(`----------------------------------------`)

    if (step.tool) {
      const plan = resolveRunner(step.tool)
      if (plan.type === 'missing') {
        console.log(`[i] Skipped (tool not installed locally).`)
        continue
      }
      const code = executePlan(step.tool, plan)
      if (code !== 0) {
        totalFailures++
      }
    } else {
      console.log(`Executing: ${step.cmd}\n`)
      const result = spawnSync(step.cmd, { stdio: 'inherit', shell: true })
      if ((result.status ?? 0) !== 0) {
        totalFailures++
      }
    }
  }

  console.log('\n========================================')
  if (totalFailures === 0) {
    console.log(' [SUITE] All executed security checks passed successfully!')
  } else {
    console.warn(` [SUITE] Completed with ${totalFailures} failed check(s).`)
  }
  console.log('========================================\n')

  return totalFailures === 0 ? 0 : 1
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()

if (isDirectRun) {
  const tool = (process.argv[2] || 'all').toLowerCase()
  if (tool === 'all') {
    process.exit(runAll())
  } else {
    process.exit(executePlan(tool))
  }
}
