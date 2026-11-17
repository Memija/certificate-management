import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  XCircle,
} from 'lucide-react'

import { LearningTerm, useToast } from '@/components/shared'
import type { OcspRevocationResult, OcspSamplePreset } from '@/types'

import { getLocalizedPresetMeta } from './ocsp-helpers'

import styles from './OcspResultPanel.module.css'

export interface OcspResultPanelProps {
  result: OcspRevocationResult
  activePreset: OcspSamplePreset | null
  onClearResult: () => void
}

function buildDiagnosticHtml(output: string): string {
  const lineCount = output.split('\n').length
  const escaped = output.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Windows certutil -verify -urlfetch Diagnostic Output</title><style>:root{color-scheme:dark}body{background:#090d16;color:#e2e8f0;font-family:ui-monospace,Consolas,monospace;padding:2rem;margin:0;line-height:1.6}.container{max-width:1200px;margin:0 auto}.header{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:1.25rem 1.5rem;margin-bottom:1.5rem}h1{margin:0;font-size:1.15rem;color:#38bdf8;font-family:system-ui,sans-serif}.meta{color:#94a3b8;font-size:0.82rem;font-family:system-ui,sans-serif;margin-top:0.35rem}pre{background:#0d1321;border:1px solid #1e293b;border-radius:8px;padding:1.25rem;overflow-x:auto;font-size:0.85rem;white-space:pre-wrap;word-break:break-all}</style></head><body><div class="container"><div class="header"><h1>Windows certutil -verify -urlfetch</h1><div class="meta">Revocation Check &bull; ${lineCount} lines &bull; ${new Date().toLocaleString()}</div></div><pre id="log">${escaped}</pre></div></body></html>`
}

export const OcspResultPanel = memo(function OcspResultPanel({
  result,
  activePreset,
  onClearResult,
}: OcspResultPanelProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const handleCopyOutput = async (): Promise<void> => {
    if (!result.output) {
      return
    }
    try {
      await navigator.clipboard.writeText(result.output)
      setCopied(true)
      showToast(t('common.copiedToClipboard', 'Copied to clipboard'), 'success')
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current)
      }
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false)
        copiedTimerRef.current = null
      }, 2000)
    } catch (err) {
      console.error('Failed to copy OCSP diagnostic log:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  const handleOpenInBrowser = (): void => {
    if (!result.output) {
      return
    }
    const blob = new Blob([buildDiagnosticHtml(result.output)], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const iconTone =
    result.status === 'good' ? 'success' : result.status === 'revoked' ? 'danger' : 'warning'
  const StatusIcon =
    result.status === 'good' ? ShieldCheck : result.status === 'revoked' ? ShieldAlert : HelpCircle

  const verdictTitle =
    result.status === 'good'
      ? t('app.ocsp.statusGood', 'Certificate is Valid (Not Revoked)')
      : result.status === 'revoked'
        ? t('app.ocsp.statusRevoked', 'Certificate is Revoked')
        : t('app.ocsp.statusUnknown', 'Revocation Status Unknown / Offline')

  const verdictDesc =
    result.status === 'good'
      ? t(
          'app.ocsp.statusGoodDesc',
          'Verified via live Authority Information Access (AIA/OCSP) or Certificate Revocation List (CRL). The certificate is active and not revoked.',
        )
      : result.status === 'revoked'
        ? t(
            'app.ocsp.statusRevokedDesc',
            'Alert! The issuing Certificate Authority has revoked this certificate. It must not be trusted for TLS handshakes or signatures.',
          )
        : t(
            'app.ocsp.statusUnknownDesc',
            'The certificate either has no online revocation endpoints (AIA/CDP), or the revocation servers were unreachable.',
          )

  const presetMeta = activePreset ? getLocalizedPresetMeta(activePreset, t) : null
  const matchesPreset = activePreset ? result.status === activePreset.expectedStatus : false

  return (
    <section className={`animate-fade-in glass-panel ${styles.resultPanel}`}>
      <div className={styles.verdictHeader}>
        <div className={styles.verdictLeft}>
          <div
            className={`metric-icon-wrap ${iconTone} ${styles.verdictIconWrap}`}
            aria-hidden="true"
          >
            <StatusIcon size={32} />
          </div>

          <div>
            <h2 className={`${styles.verdictHeading} ${styles[`verdict_${result.status}`]}`}>
              {verdictTitle}
            </h2>
            <p className={styles.verdictDesc}>{verdictDesc}</p>
          </div>
        </div>

        <div className={styles.verdictRight}>
          {activePreset && presetMeta && (
            <div
              className={`${styles.presetMatchPill} ${matchesPreset ? styles.matchSuccess : styles.matchDanger}`}
            >
              {matchesPreset ? (
                <>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>
                    {t('app.ocsp.matchesPreset', {
                      badge: presetMeta.badge,
                      defaultValue: `Matches Expected Preset Verdict: ${presetMeta.badge}`,
                    })}
                  </span>
                </>
              ) : (
                <>
                  <XCircle size={14} aria-hidden="true" />
                  <span>
                    {t('app.ocsp.differsPreset', {
                      badge: presetMeta.badge,
                      defaultValue: `Differs from Expected Preset: ${presetMeta.badge}`,
                    })}
                  </span>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClearResult}
            title={t('app.ocsp.clearResultTooltip', 'Dismiss results and re-enable check button')}
          >
            <Trash2 size={13} aria-hidden="true" />
            <span>{t('app.ocsp.clearResultBtn', 'Clear Result')}</span>
          </button>
        </div>
      </div>

      <div className={styles.checksGrid}>
        <div className={styles.checkCard}>
          <div className={styles.checkCardHeader}>
            <h3 className={styles.checkCardTitle}>
              <LearningTerm termId="ocsp">OCSP</LearningTerm>{' '}
              {t('app.ocsp.ocspCheckTitle', 'OCSP Responder Check')}
            </h3>
            {result.ocspVerified ? (
              <span className="badge badge-success">{t('app.ocsp.badgeVerified', 'Verified')}</span>
            ) : result.ocspUrl ? (
              <span className="badge badge-warning">
                {t('app.ocsp.badgeEndpointPresent', 'Endpoint Present')}
              </span>
            ) : (
              <span className="badge badge-info">{t('app.ocsp.badgeNoUrl', 'No URL')}</span>
            )}
          </div>
          {result.ocspUrl ? (
            <span className={styles.endpointItem}>
              <Globe size={13} className={styles.accentIcon} aria-hidden="true" />
              <code className={styles.endpointUrl}>{result.ocspUrl}</code>
            </span>
          ) : (
            <span className={styles.endpointMuted}>
              {t('app.ocsp.noAiaUrl', 'No OCSP Authority Information Access (AIA) URL found.')}
            </span>
          )}
        </div>

        <div className={styles.checkCard}>
          <div className={styles.checkCardHeader}>
            <h3 className={styles.checkCardTitle}>
              <LearningTerm termId="crl">CRL</LearningTerm>{' '}
              {t('app.ocsp.crlCheckTitle', 'CRL Distribution Point Check')}
            </h3>
            {result.crlVerified ? (
              <span className="badge badge-success">{t('app.ocsp.badgeVerified', 'Verified')}</span>
            ) : result.crlUrl ? (
              <span className="badge badge-warning">
                {t('app.ocsp.badgeEndpointPresent', 'Endpoint Present')}
              </span>
            ) : (
              <span className="badge badge-info">{t('app.ocsp.badgeNoUrl', 'No URL')}</span>
            )}
          </div>
          {result.crlUrl ? (
            <span className={styles.endpointItem}>
              <FileText size={13} className={styles.warningIcon} aria-hidden="true" />
              <code className={styles.endpointUrl}>{result.crlUrl}</code>
            </span>
          ) : (
            <span className={styles.endpointMuted}>
              {t('app.ocsp.noCdpUrl', 'No CRL Distribution Points (CDP) extension found.')}
            </span>
          )}
        </div>
      </div>

      <div className={styles.diagnosticBox}>
        <div className={styles.diagnosticToolbar}>
          <button
            type="button"
            className={styles.diagnosticToggleBtn}
            onClick={() => setIsLogOpen((prev) => !prev)}
            aria-expanded={isLogOpen}
          >
            <Terminal size={15} className={styles.accentIcon} aria-hidden="true" />
            <span>
              {t(
                'app.ocsp.diagnosticSummary',
                'View Raw Native Diagnostic Output (Windows certutil -verify -urlfetch)',
              )}
            </span>
            {isLogOpen ? (
              <ChevronUp size={15} aria-hidden="true" />
            ) : (
              <ChevronDown size={15} aria-hidden="true" />
            )}
          </button>

          <div className={styles.diagnosticActions}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleOpenInBrowser}
              title={t('app.ocsp.openInBrowserTooltip', 'Open full raw log in a new browser tab')}
            >
              <ExternalLink size={12} aria-hidden="true" />
              <span>{t('app.ocsp.openInBrowser', 'Open in New Tab')}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleCopyOutput()}
            >
              {copied ? (
                <Check size={12} aria-hidden="true" />
              ) : (
                <Copy size={12} aria-hidden="true" />
              )}
              <span>
                {copied ? t('app.ocsp.copiedOutput', 'Copied!') : t('app.ocsp.copyOutput', 'Copy')}
              </span>
            </button>
          </div>
        </div>

        {isLogOpen && <pre className={`code-block ${styles.diagnosticPre}`}>{result.output}</pre>}
      </div>
    </section>
  )
})
