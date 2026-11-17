import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

interface RgbColor {
  r: number
  g: number
  b: number
  a: number
}

const INDEX_CSS_PATH = path.resolve(__dirname, './index.css')
const SRC_DIR = path.resolve(__dirname)
const MAX_STYLESHEET_LINES = 500
const WCAG_AA_TEXT_RATIO = 4.5

const LAYOUT_INVARIANT_TOKENS = new Set([
  '--font-sans',
  '--font-body',
  '--font-mono',
  '--header-height',
  '--footer-height',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
])

const FOREGROUND_TEXT_TOKENS = [
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--text-accent',
  '--text-accent-2',
  '--success-color',
  '--danger-color',
  '--warning-color',
  '--info-color',
  '--purple-color',
  '--cyan-color',
] as const

const SURFACE_TOKENS = [
  '--bg-base',
  '--bg-surface',
  '--bg-secondary',
  '--glass-bg',
  '--header-bg',
  '--sidebar-bg',
  '--input-bg',
] as const

const PRIMARY_CTA_SURFACE_TOKENS = [
  '--btn-cta-start',
  '--btn-cta-end',
  '--btn-cta-hover-start',
  '--btn-cta-hover-end',
] as const

function extractBlock(css: string, selectorPattern: RegExp): string {
  const match = selectorPattern.exec(css)
  if (!match) {
    throw new Error(`Selector block not found for ${selectorPattern.source}`)
  }
  const openBraceIndex = css.indexOf('{', match.index)
  let depth = 0
  for (let i = openBraceIndex; i < css.length; i++) {
    if (css[i] === '{') {
      depth++
    } else if (css[i] === '}') {
      depth--
      if (depth === 0) {
        return css.slice(openBraceIndex + 1, i)
      }
    }
  }
  throw new Error(`Unclosed CSS block for ${selectorPattern.source}`)
}

function parseTokens(block: string): Map<string, string> {
  const tokens = new Map<string, string>()
  const declRegex = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm
  let match: RegExpExecArray | null
  while ((match = declRegex.exec(block)) !== null) {
    tokens.set(match[1], match[2].trim())
  }
  return tokens
}

function parseColor(value: string): RgbColor {
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(value)
  if (hexMatch) {
    const hex = hexMatch[1]
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: 1,
    }
  }

  const rgbaMatch =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i.exec(value)
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    }
  }

  throw new Error(`Unsupported color value: "${value}"`)
}

function compositeOver(fg: RgbColor, bg: RgbColor): RgbColor {
  const alpha = fg.a
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
    a: 1,
  }
}

function relativeLuminance({ r, g, b }: RgbColor): number {
  const toLinear = (channel: number): number => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(colorA: RgbColor, colorB: RgbColor): number {
  const lumA = relativeLuminance(colorA)
  const lumB = relativeLuminance(colorB)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

function collectModuleCssFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectModuleCssFiles(fullPath))
    } else if (entry.name.endsWith('.module.css')) {
      files.push(fullPath)
    }
  }
  return files
}

describe('index.css design tokens and accessibility guardrails', () => {
  const css = fs.readFileSync(INDEX_CSS_PATH, 'utf-8')
  const darkBlock = extractBlock(css, /^:root\s*\{/m)
  const lightBlock = extractBlock(css, /^\[data-theme='light'\]\s*\{/m)
  const darkTokens = parseTokens(darkBlock)
  const lightTokens = parseTokens(lightBlock)
  const moduleCssFiles = collectModuleCssFiles(SRC_DIR)

  it('keeps src/index.css and every *.module.css file in src/ within the 500-line ceiling', () => {
    const indexLineCount = css.split(/\r?\n/).length
    expect(indexLineCount).toBeLessThanOrEqual(MAX_STYLESHEET_LINES)

    expect(moduleCssFiles.length).toBeGreaterThan(0)
    for (const moduleCssPath of moduleCssFiles) {
      const content = fs.readFileSync(moduleCssPath, 'utf-8')
      const lineCount = content.split(/\r?\n/).length
      const relativePath = path.relative(SRC_DIR, moduleCssPath)
      expect(
        lineCount,
        `Stylesheet "${relativePath}" has ${lineCount} lines (> ${MAX_STYLESHEET_LINES})`,
      ).toBeLessThanOrEqual(MAX_STYLESHEET_LINES)
    }
  })

  it('declares matching theme color tokens in :root (dark) and [data-theme="light"]', () => {
    expect(darkBlock).toContain('color-scheme: dark;')
    expect(lightBlock).toContain('color-scheme: light;')

    const expectedLightKeys = [...darkTokens.keys()]
      .filter((key) => !LAYOUT_INVARIANT_TOKENS.has(key))
      .sort()
    const actualLightKeys = [...lightTokens.keys()].sort()

    expect(actualLightKeys).toEqual(expectedLightKeys)
  })

  it.each([
    { themeName: 'dark', tokens: darkTokens },
    { themeName: 'light', tokens: lightTokens },
  ])(
    'meets WCAG AA (>= 4.5:1) text contrast across all surfaces and CTA buttons in $themeName theme',
    ({ themeName, tokens }) => {
      const baseBg = parseColor(tokens.get('--bg-base') ?? '')

      for (const surfaceToken of SURFACE_TOKENS) {
        const rawSurface = parseColor(tokens.get(surfaceToken) ?? '')
        const surface = rawSurface.a < 1 ? compositeOver(rawSurface, baseBg) : rawSurface

        for (const fgToken of FOREGROUND_TEXT_TOKENS) {
          const fg = parseColor(tokens.get(fgToken) ?? '')
          const ratio = contrastRatio(fg, surface)
          expect(
            ratio,
            `${themeName} theme: ${fgToken} (${tokens.get(fgToken)}) on ${surfaceToken} (${tokens.get(surfaceToken)}) contrast ${ratio.toFixed(2)}:1 < 4.5:1`,
          ).toBeGreaterThanOrEqual(WCAG_AA_TEXT_RATIO)
        }
      }

      const white: RgbColor = { r: 255, g: 255, b: 255, a: 1 }
      for (const ctaToken of PRIMARY_CTA_SURFACE_TOKENS) {
        const ctaSurface = parseColor(tokens.get(ctaToken) ?? '')
        const ratio = contrastRatio(white, ctaSurface)
        expect(
          ratio,
          `${themeName} theme: #ffffff on ${ctaToken} (${tokens.get(ctaToken)}) contrast ${ratio.toFixed(2)}:1 < 4.5:1`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT_RATIO)
      }
    },
  )

  it('includes focus-visible, prefers-reduced-motion, and proper vendor prefix order', () => {
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toMatch(/-webkit-text-size-adjust:\s*100%;\s*\r?\n\s*text-size-adjust:\s*100%;/)

    const lines = css.split(/\r?\n/)
    for (let i = 0; i < lines.length - 1; i++) {
      const current = lines[i].trim()
      const next = lines[i + 1].trim()
      if (current.startsWith('user-select:')) {
        expect(next.startsWith('-webkit-user-select:')).toBe(false)
      }
      if (current.startsWith('text-size-adjust:')) {
        expect(next.startsWith('-webkit-text-size-adjust:')).toBe(false)
      }
    }
  })
})
