import { describe, expect, it } from 'vitest'

import {
  buildFlowConfig,
  evaluateFlowStepThresholds,
  formatFlowSummaryMarkdown,
  getFormFactors,
  getThemes,
  parseFlowFlags,
} from './lighthouse-flow.mjs'

describe('lighthouse-flow', () => {
  describe('parseFlowFlags', () => {
    it('should parse CLI flags accurately', () => {
      const flags = parseFlowFlags(['--desktop', '--dark'])
      expect(flags).toEqual({
        isQuick: false,
        onlyDesktop: true,
        onlyMobile: false,
        onlyLight: false,
        onlyDark: true,
      })
    })
  })

  describe('getFormFactors', () => {
    it('should return both desktop and mobile by default', () => {
      expect(getFormFactors(parseFlowFlags([]))).toEqual(['desktop', 'mobile'])
    })

    it('should return desktop only when --desktop or --quick is passed', () => {
      expect(getFormFactors(parseFlowFlags(['--desktop']))).toEqual(['desktop'])
      expect(getFormFactors(parseFlowFlags(['--quick']))).toEqual(['desktop'])
    })

    it('should return mobile only when --mobile is passed', () => {
      expect(getFormFactors(parseFlowFlags(['--mobile']))).toEqual(['mobile'])
    })
  })

  describe('getThemes', () => {
    it('should return both light and dark by default', () => {
      expect(getThemes(parseFlowFlags([]))).toEqual(['light', 'dark'])
    })

    it('should return light only when --light or --quick is passed', () => {
      expect(getThemes(parseFlowFlags(['--light']))).toEqual(['light'])
      expect(getThemes(parseFlowFlags(['--quick']))).toEqual(['light'])
    })

    it('should return dark only when --dark is passed', () => {
      expect(getThemes(parseFlowFlags(['--dark']))).toEqual(['dark'])
    })
  })

  describe('buildFlowConfig', () => {
    it('should return desktop config with 4 core categories for desktop', () => {
      const cfg = buildFlowConfig('desktop')
      expect(cfg.settings.onlyCategories).toEqual([
        'performance',
        'accessibility',
        'best-practices',
        'seo',
      ])
    })

    it('should return mobile config with 4 core categories for mobile', () => {
      const cfg = buildFlowConfig('mobile')
      expect(cfg.extends).toBe('lighthouse:default')
      expect(cfg.settings.formFactor).toBe('mobile')
      expect(cfg.settings.onlyCategories).toEqual([
        'performance',
        'accessibility',
        'best-practices',
        'seo',
      ])
    })
  })

  describe('evaluateFlowStepThresholds', () => {
    it('should pass when all navigation step categories meet or exceed thresholds', () => {
      const result = evaluateFlowStepThresholds({
        name: '1. Secure Boot NVRAM (light)',
        lhr: {
          gatherMode: 'navigation',
          categories: {
            performance: { title: 'Performance', score: 0.96 },
            accessibility: { title: 'Accessibility', score: 1 },
            'best-practices': { title: 'Best Practices', score: 1 },
            seo: { title: 'SEO', score: 1 },
          },
        },
      })
      expect(result.passed).toBe(true)
      expect(result.failures).toEqual([])
      expect(result.scores).toEqual({
        performance: 96,
        accessibility: 100,
        'best-practices': 100,
        seo: 100,
      })
    })

    it('should ignore performance category on snapshot steps and report failures on other categories', () => {
      const result = evaluateFlowStepThresholds({
        name: '2. Chain Validator (dark)',
        lhr: {
          gatherMode: 'snapshot',
          categories: {
            performance: { title: 'Performance', score: null },
            accessibility: { title: 'Accessibility', score: 0.82 },
            'best-practices': { title: 'Best Practices', score: 1 },
            seo: { title: 'SEO', score: 1 },
          },
        },
      })
      expect(result.passed).toBe(false)
      expect(result.scores.performance).toBeUndefined()
      expect(result.failures).toEqual([
        {
          stepName: '2. Chain Validator (dark)',
          category: 'accessibility',
          title: 'Accessibility',
          actual: 82,
          expected: 100,
        },
      ])
    })
  })

  describe('formatFlowSummaryMarkdown', () => {
    it('should format flow summaries into a Markdown table', () => {
      const md = formatFlowSummaryMarkdown([
        {
          flowName: 'Certificate Management (desktop / light)',
          steps: [
            {
              stepName: '1. Secure Boot NVRAM (light)',
              gatherMode: 'navigation',
              scores: { performance: 98, accessibility: 100, 'best-practices': 100, seo: 100 },
              passed: true,
            },
          ],
        },
      ])
      expect(md).toContain('### 🧭 Lighthouse User Flows Summary')
      expect(md).toContain(
        '| **Certificate Management (desktop / light)** | 1. Secure Boot NVRAM (light) | `navigation` | 98 | 100 | 100 | 100 | ✅ Passed |',
      )
    })
  })
})
