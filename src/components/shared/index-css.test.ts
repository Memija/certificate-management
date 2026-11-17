import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const INDEX_CSS_PATH = path.resolve(process.cwd(), 'src/index.css')

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const channels = [
    Number.parseInt(clean.slice(0, 2), 16) / 255,
    Number.parseInt(clean.slice(2, 4), 16) / 255,
    Number.parseInt(clean.slice(4, 6), 16) / 255,
  ]
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex)
  const l2 = relativeLuminance(bgHex)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function parseCustomProps(cssBlock: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const match of cssBlock.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    map.set(match[1]!, match[2]!.trim())
  }
  return map
}

describe('src/index.css design tokens & WCAG AA compliance', () => {
  const cssContent = fs.readFileSync(INDEX_CSS_PATH, 'utf8')

  it('stays within the <= 480 total lines ceiling', () => {
    const lineCount = cssContent.split(/\r?\n/).length
    expect(lineCount).toBeLessThanOrEqual(480)
  })

  it('declares identical color/theme custom property sets in :root and [data-theme="light"]', () => {
    const rootBlock = cssContent.match(/:root\s*\{([^}]+)\}/)?.[1] ?? ''
    const lightBlock = cssContent.match(/\[data-theme=['"]light['"]\]\s*\{([^}]+)\}/)?.[1] ?? ''

    expect(rootBlock).toContain('color-scheme: dark')
    expect(lightBlock).toContain('color-scheme: light')

    const layoutInvariant = new Set([
      '--font-sans',
      '--font-body',
      '--font-mono',
      '--header-height',
      '--footer-height',
      '--radius-sm',
      '--radius-md',
      '--radius-lg',
    ])

    const rootProps = parseCustomProps(rootBlock)
    const lightProps = parseCustomProps(lightBlock)

    const rootColorKeys = [...rootProps.keys()].filter((k) => !layoutInvariant.has(k)).sort()
    const lightColorKeys = [...lightProps.keys()].sort()

    expect(rootColorKeys).toEqual(lightColorKeys)
  })

  it('meets WCAG AA (>= 4.5:1) contrast across all dark and light surfaces', () => {
    const rootBlock = cssContent.match(/:root\s*\{([^}]+)\}/)?.[1] ?? ''
    const lightBlock = cssContent.match(/\[data-theme=['"]light['"]\]\s*\{([^}]+)\}/)?.[1] ?? ''

    const darkTokens = parseCustomProps(rootBlock)
    const lightTokens = parseCustomProps(lightBlock)

    const foregroundKeys = [
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--text-accent',
      '--text-accent-2',
      '--accent-color',
      '--accent-hover',
      '--success-color',
      '--danger-color',
      '--warning-color',
      '--info-color',
      '--purple-color',
      '--blue-color',
      '--cyan-color',
      '--cat-systemcheck',
      '--cat-inspectionvalidation',
      '--cat-keymanagement',
      '--cat-networkstatus',
      '--cat-learning',
    ]

    const darkSurfaces = ['#080f14', '#0e171f', '#131f2b']
    for (const key of foregroundKeys) {
      const hex = darkTokens.get(key)
      expect(hex, `Missing dark token ${key}`).toMatch(/^#[0-9a-f]{6}$/i)
      for (const surface of darkSurfaces) {
        expect(
          contrastRatio(hex!, surface),
          `Dark ${key} (${hex}) vs ${surface}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }

    const lightSurfaces = ['#ffffff', '#f8fafc', '#f1f5f9']
    for (const key of foregroundKeys) {
      const hex = lightTokens.get(key)
      expect(hex, `Missing light token ${key}`).toMatch(/^#[0-9a-f]{6}$/i)
      for (const surface of lightSurfaces) {
        expect(
          contrastRatio(hex!, surface),
          `Light ${key} (${hex}) vs ${surface}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }

    // Primary CTA button gradient (#ffffff text on --btn-cta-start / --btn-cta-end)
    expect(contrastRatio('#ffffff', darkTokens.get('--btn-cta-start')!)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', lightTokens.get('--btn-cta-start')!)).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('includes all required global primitive classes and accessibility rules', () => {
    const requiredClasses = [
      '.glass-panel',
      '.glass-card',
      '.btn',
      '.btn-primary',
      '.btn-secondary',
      '.btn-outline',
      '.btn-danger',
      '.btn-sm',
      '.btn-icon',
      '.btn-download',
      '.btn-download-pem',
      '.btn-download-der',
      '.btn-download-pfx',
      '.badge',
      '.badge-dot',
      '.badge-success',
      '.badge-danger',
      '.badge-warning',
      '.badge-info',
      '.badge-purple',
      '.badge-cyan',
      '.form-group',
      '.form-label',
      '.form-input',
      '.form-select',
      '.form-textarea',
      '.metric-cards-grid',
      '.metric-card',
      '.metric-icon-wrap',
      '.drop-zone',
      '.details-grid',
      '.details-label',
      '.details-value',
      '.table-responsive',
      '.segmented-tabs-group',
      '.segmented-tab-btn',
      '.mono',
      '.code-block',
      '.spin',
      '.animate-fade-in',
    ]

    for (const cls of requiredClasses) {
      expect(cssContent).toContain(cls)
    }
    expect(cssContent).toContain(':focus-visible')
    expect(cssContent).toContain('prefers-reduced-motion: reduce')
  })
})
