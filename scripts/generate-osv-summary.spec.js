import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { generateOsvSummary } from './generate-osv-summary'

describe('generate-osv-summary', () => {
  const testDir = path.resolve(process.cwd(), 'temp-test-sarif')
  const summaryFile = path.resolve(process.cwd(), 'temp-test-summary.md')

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true })
    process.env.GITHUB_STEP_SUMMARY = summaryFile
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    if (fs.existsSync(summaryFile)) {
      fs.unlinkSync(summaryFile)
    }
    delete process.env.GITHUB_STEP_SUMMARY
  })

  it('should generate an all-clear summary when 0 vulnerabilities are present', () => {
    const mockSarif = {
      runs: [{ results: [] }],
    }
    fs.writeFileSync(path.join(testDir, 'results.sarif'), JSON.stringify(mockSarif))

    generateOsvSummary(testDir)

    const summary = fs.readFileSync(summaryFile, 'utf8')
    expect(summary).toContain('Google OSV Supply Chain Security Report')
    expect(summary).toContain('All Clear — No Known Vulnerabilities Detected!')
    expect(summary).toContain('`0` 🛡️')
  })

  it('should list vulnerabilities when present in SARIF results', () => {
    const mockSarif = {
      runs: [
        {
          results: [
            {
              ruleId: 'GHSA-1234',
              message: { text: 'Critical flaw in mock package' },
              level: 'error',
            },
          ],
        },
      ],
    }
    fs.writeFileSync(path.join(testDir, 'results.sarif'), JSON.stringify(mockSarif))

    generateOsvSummary(testDir)

    const summary = fs.readFileSync(summaryFile, 'utf8')
    expect(summary).toContain('Warning: 1 Vulnerability Detected')
    expect(summary).toContain('`GHSA-1234`')
    expect(summary).toContain('Critical flaw in mock package')
    expect(summary).toContain('**error**')
  })

  it('should handle missing SARIF directory gracefully', () => {
    generateOsvSummary('non-existent-directory')

    const summary = fs.readFileSync(summaryFile, 'utf8')
    expect(summary).toContain('No SARIF results directory found')
  })
})
