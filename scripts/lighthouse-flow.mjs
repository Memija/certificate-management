/**
 * Lighthouse User Flow Runner for Certificate Management
 *
 * Audits key application views (Secure Boot -> Expiry Dashboard -> Chain Validator -> CSR Inspector -> Education Center)
 * across form factors (desktop, mobile) and themes (light, dark), enforces
 * quality thresholds, and generates HTML, JSON, and Markdown summary reports.
 *
 * Supported flags:
 *   --quick    Run quick verification (desktop + light, core screens)
 *   --desktop  Audit desktop form factor only
 *   --mobile   Audit mobile form factor only
 *   --light    Audit light theme only
 *   --dark     Audit dark theme only
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const PREVIEW_PORT = 4173
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`
const OUTPUT_DIR = path.resolve(process.cwd(), '.lighthouseci', 'flows')

export const DEFAULT_FLOW_THRESHOLDS = {
  performance: 0.8,
  accessibility: 1,
  'best-practices': 1,
  seo: 1,
}

export function parseFlowFlags(rawArgs = process.argv.slice(2)) {
  const flagSet = new Set(rawArgs)
  return {
    isQuick: flagSet.has('--quick'),
    onlyDesktop: flagSet.has('--desktop'),
    onlyMobile: flagSet.has('--mobile'),
    onlyLight: flagSet.has('--light'),
    onlyDark: flagSet.has('--dark'),
  }
}

export function getFormFactors(flags = parseFlowFlags()) {
  if (flags.onlyDesktop && !flags.onlyMobile) {
    return ['desktop']
  }
  if (flags.onlyMobile && !flags.onlyDesktop) {
    return ['mobile']
  }
  if (flags.isQuick) {
    return ['desktop']
  }
  return ['desktop', 'mobile']
}

export function getThemes(flags = parseFlowFlags()) {
  if (flags.onlyLight && !flags.onlyDark) {
    return ['light']
  }
  if (flags.onlyDark && !flags.onlyLight) {
    return ['dark']
  }
  if (flags.isQuick) {
    return ['light']
  }
  return ['light', 'dark']
}

function checkServerReady(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) {
          resolve(true)
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server returned status ${res.statusCode}`))
        } else {
          setTimeout(check, 300)
        }
      })
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`))
        } else {
          setTimeout(check, 300)
        }
      })
    }
    check()
  })
}

async function ensurePreviewServer() {
  try {
    await checkServerReady(PREVIEW_URL, 1000)
    return null
  } catch {
    const viteBin = path.resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')
    const child = spawn(
      process.execPath,
      [viteBin, 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
      {
        stdio: 'ignore',
      },
    )
    await checkServerReady(PREVIEW_URL, 20000)
    return child
  }
}

export function buildFlowConfig(formFactor, baseDesktopConfig = null) {
  if (formFactor === 'desktop') {
    return {
      ...(baseDesktopConfig ?? { extends: 'lighthouse:default' }),
      settings: {
        ...baseDesktopConfig?.settings,
        formFactor: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    }
  }
  return {
    extends: 'lighthouse:default',
    settings: {
      formFactor: 'mobile',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    },
  }
}

function evaluateCategoryScore(stepName, id, cat, isSnapshot, thresholds) {
  if ((isSnapshot && id === 'performance') || typeof cat?.score !== 'number') {
    return null
  }
  const actual = Math.round(cat.score * 100)
  const minScore = thresholds[id]
  const failure =
    typeof minScore === 'number' && cat.score < minScore
      ? {
          stepName,
          category: id,
          title: cat.title || id,
          actual,
          expected: Math.round(minScore * 100),
        }
      : null
  return { actual, failure }
}

/**
 * Evaluates a single Lighthouse flow step result against quality thresholds.
 */
export function evaluateFlowStepThresholds(step, thresholds = DEFAULT_FLOW_THRESHOLDS) {
  const lhr = step ? step.lhr : undefined
  const gatherMode = lhr && lhr.gatherMode ? lhr.gatherMode : 'navigation'
  const isSnapshot = gatherMode === 'snapshot'
  const categories = lhr && lhr.categories ? lhr.categories : {}
  const stepName = step && step.name ? step.name : 'Unknown Step'
  const failures = []
  const scores = {}

  for (const [id, cat] of Object.entries(categories)) {
    const result = evaluateCategoryScore(stepName, id, cat, isSnapshot, thresholds)
    if (!result) {
      continue
    }
    scores[id] = result.actual
    if (result.failure) {
      failures.push(result.failure)
    }
  }

  return {
    stepName,
    gatherMode,
    scores,
    passed: failures.length === 0,
    failures,
  }
}

/**
 * Formats evaluated user flow summaries into a Markdown table for CI/local reporting.
 */
export function formatFlowSummaryMarkdown(flowSummaries) {
  const lines = [
    '### 🧭 Lighthouse User Flows Summary',
    '',
    '| Flow | Step | Mode | Perf | A11y | Best Practices | SEO | Status |',
    '| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |',
  ]

  for (const flow of flowSummaries) {
    for (const step of flow.steps) {
      const perf = step.scores.performance !== undefined ? `${step.scores.performance}` : '—'
      const a11y = step.scores.accessibility !== undefined ? `${step.scores.accessibility}` : '—'
      const bp =
        step.scores['best-practices'] !== undefined ? `${step.scores['best-practices']}` : '—'
      const seo = step.scores.seo !== undefined ? `${step.scores.seo}` : '—'
      const status = step.passed ? '✅ Passed' : '❌ Failed'
      lines.push(
        `| **${flow.flowName}** | ${step.stepName} | \`${step.gatherMode}\` | ${perf} | ${a11y} | ${bp} | ${seo} | ${status} |`,
      )
    }
  }

  return `${lines.join('\n')}\n`
}

async function applyTheme(page, theme) {
  await page.evaluate((targetTheme) => {
    try {
      localStorage.setItem('app-theme', targetTheme)
      localStorage.setItem('app-theme-customized', 'true')
      document.documentElement.setAttribute('data-theme', targetTheme)
    } catch {
      // ignore storage errors
    }
  }, theme)
}

async function switchAppMode(page, mode, theme) {
  await page.evaluate((targetMode) => {
    window.__store?.getState?.()?.setMode?.(targetMode)
  }, mode)
  await applyTheme(page, theme)
  await new Promise((r) => setTimeout(r, 450))
}

async function saveAndLogFlowResults(flow, flowName, formFactor, theme) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const reportBase = path.join(OUTPUT_DIR, `flow-${formFactor}-${theme}`)
  const htmlReport = await flow.generateReport()
  const flowResult = await flow.createFlowResult()

  fs.writeFileSync(`${reportBase}.html`, htmlReport, 'utf8')
  fs.writeFileSync(`${reportBase}.json`, JSON.stringify(flowResult, null, 2), 'utf8')

  const evaluatedSteps = flowResult.steps.map((step) => evaluateFlowStepThresholds(step))
  console.log(`\n=== ${flowName} ===`)
  for (const stepEval of evaluatedSteps) {
    const scores = Object.entries(stepEval.scores)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ')
    console.log(`  ${stepEval.passed ? '✓' : '✗'} ${stepEval.stepName} -> ${scores}`)
  }
  console.log(`  Saved report: ${reportBase}.html`)

  return {
    flowName,
    formFactor,
    theme,
    steps: evaluatedSteps,
    failures: evaluatedSteps.flatMap((s) => s.failures),
  }
}

async function runSingleFlow(browser, formFactor, theme, isQuick = false) {
  const { desktopConfig, startFlow } = await import('lighthouse')
  const page = await browser.newPage()
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: theme },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ])

  const viewport =
    formFactor === 'desktop'
      ? { width: 1350, height: 940, deviceScaleFactor: 1, isMobile: false }
      : { width: 412, height: 823, deviceScaleFactor: 2, isMobile: true }
  await page.setViewport(viewport)

  const flowName = `Certificate Management (${formFactor} / ${theme})`
  const flow = await startFlow(page, {
    name: flowName,
    config: buildFlowConfig(formFactor, desktopConfig),
  })

  await flow.navigate(PREVIEW_URL, { name: `1. Secure Boot NVRAM (${theme})` })
  await applyTheme(page, theme)

  await switchAppMode(page, 'chain-validator', theme)
  await flow.snapshot({ name: `2. Chain Validator (${theme})` })

  if (!isQuick) {
    await switchAppMode(page, 'csr-inspector', theme)
    await flow.snapshot({ name: `3. CSR Inspector (${theme})` })

    await switchAppMode(page, 'key-matcher', theme)
    await flow.snapshot({ name: `4. Key Pair Matcher (${theme})` })

    await switchAppMode(page, 'education-center', theme)
    await flow.snapshot({ name: `5. Education Center (${theme})` })
  }

  const summary = await saveAndLogFlowResults(flow, flowName, formFactor, theme)
  await page.close()
  return summary
}

export async function main() {
  const chromeLauncher = await import('chrome-launcher')
  const { default: puppeteer } = await import('puppeteer-core')
  const flags = parseFlowFlags()
  const formFactors = getFormFactors(flags)
  const themes = getThemes(flags)
  console.log(
    `Starting Lighthouse User Flows [formFactors=${formFactors.join(',')}, themes=${themes.join(',')}, quick=${flags.isQuick}]`,
  )

  const serverProcess = await ensurePreviewServer()
  let chrome = null
  const flowSummaries = []

  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    })
    const browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${chrome.port}`,
    })

    for (const formFactor of formFactors) {
      for (const theme of themes) {
        const summary = await runSingleFlow(browser, formFactor, theme, flags.isQuick)
        flowSummaries.push(summary)
      }
    }

    await browser.disconnect()
  } finally {
    if (chrome) {
      await chrome.kill()
    }
    if (serverProcess) {
      serverProcess.kill()
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'flow-summary.json'),
    JSON.stringify(flowSummaries, null, 2),
    'utf8',
  )
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'flow-summary.md'),
    formatFlowSummaryMarkdown(flowSummaries),
    'utf8',
  )

  const allFailures = flowSummaries.flatMap((f) => f.failures)
  if (allFailures.length > 0) {
    console.error('\nLighthouse User Flow threshold violations detected:')
    for (const failure of allFailures) {
      console.error(
        `  - [${failure.stepName}] ${failure.title}: ${failure.actual} (expected >= ${failure.expected})`,
      )
    }
    process.exit(1)
  }
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()

if (isDirectRun) {
  main().catch((error) => {
    console.error('Lighthouse flow failed:', error)
    process.exit(1)
  })
}
