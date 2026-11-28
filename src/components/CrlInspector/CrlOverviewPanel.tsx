import type React from 'react'
import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
  XCircle,
} from 'lucide-react'

import { useToast } from '@/components/shared'
import type { ParsedCRL } from '@/types'

import {
  downloadCrlDer,
  downloadCrlPem,
  EXTENSION_DISPLAY_NAMES,
  formatCrlDate,
} from './crl-helpers'

import styles from './CrlOverviewPanel.module.css'

export interface CrlOverviewPanelProps {
  crl: ParsedCRL
  fileName: string
  isSample?: boolean
  onReplace: () => void
  onClear: () => void
  children?: React.ReactNode
}

function InlineCopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const copyAria = `${t('common.copyToClipboard', 'Copy to clipboard')}: ${label}`

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      showToast(t('common.copiedToClipboard', 'Copied to clipboard'), 'success')
      setCopied(true)
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        setCopied(false)
        timerRef.current = null
      }, 1500)
    } catch (err) {
      console.error('Clipboard copy failed:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={copyAria}
      title={t('common.copyToClipboard', 'Copy to clipboard')}
      className={`${styles.copyIconBtn} ${copied ? styles.copyIconBtnSuccess : ''}`}
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  )
}

export const CrlOverviewPanel = memo(function CrlOverviewPanel({
  crl,
  fileName,
  isSample,
  onReplace,
  onClear,
  children,
}: CrlOverviewPanelProps) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const [showPem, setShowPem] = useState(false)
  const [showExts, setShowExts] = useState(true)

  const handleDownloadPem = (): void => {
    try {
      downloadCrlPem(crl.pem)
      showToast(`${t('common.download', 'Download')}: revocation_list.pem`, 'success')
    } catch (err) {
      console.error('Failed to download CRL PEM:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  const handleDownloadDer = (): void => {
    try {
      downloadCrlDer(crl.derBase64)
      showToast(`${t('common.download', 'Download')}: revocation_list.crl`, 'success')
    } catch (err) {
      console.error('Failed to download CRL DER:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  const sha256Label = t('app.crl.sha256', 'SHA-256 Fingerprint')

  return (
    <div className={styles.detailsStack}>
      <div className={`glass-card ${styles.fileActionBar}`}>
        <div className={styles.fileInfoLeft}>
          <div className={`metric-icon-wrap info ${styles.fileIconBox}`}>
            <FileText size={20} aria-hidden="true" />
          </div>
          <div>
            <div className={styles.fileTitleRow}>
              <span className={styles.fileNameText}>{fileName}</span>
              {Boolean(isSample) && (
                <span className="badge badge-info">
                  <Sparkles size={11} aria-hidden="true" />
                  <span>{t('common.sample', 'Sample')}</span>
                </span>
              )}
            </div>
            <span className={styles.fileMetaText}>
              {t('app.crl.itemSummary', {
                count: crl.revokedCertificates.length,
                status: crl.isExpired
                  ? t('app.certDetails.expired', 'Expired')
                  : t('app.crl.active', 'Active'),
                defaultValue: `${crl.revokedCertificates.length} revoked · ${crl.isExpired ? 'Expired' : 'Active'}`,
              })}
            </span>
          </div>
        </div>

        <div className={styles.headerBtnRow}>
          <button type="button" onClick={onReplace} className="btn btn-secondary btn-sm">
            <Upload size={14} aria-hidden="true" />
            <span>{t('app.crl.replaceCrl', 'Replace CRL')}</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            className={`btn btn-secondary btn-sm ${styles.clearBtnDanger}`}
            title={t('app.crl.clearCrl', 'Clear')}
          >
            <X size={14} aria-hidden="true" />
            <span>{t('app.crl.clearCrl', 'Clear')}</span>
          </button>
        </div>
      </div>

      <div className={styles.badgesBar}>
        {crl.isExpired ? (
          <span className="badge badge-danger">
            <XCircle size={13} aria-hidden="true" />
            <span>{t('app.crl.expiredBadge', 'Expired CRL')}</span>
          </span>
        ) : (
          <span className="badge badge-success">
            <CheckCircle size={13} aria-hidden="true" />
            <span>{t('app.crl.activeBadge', 'Active CRL')}</span>
          </span>
        )}
        <span className="badge badge-info">
          <ShieldAlert size={13} aria-hidden="true" />
          <span>
            {t('app.crl.revokedCount', {
              count: crl.revokedCertificates.length,
              defaultValue: `${crl.revokedCertificates.length} Revoked Certificates`,
            })}
          </span>
        </span>
      </div>

      <div className="glass-card">
        <h3 className={styles.sectionHeading}>
          {t('app.crl.overviewTitle', 'CRL Overview & Issuer')}
        </h3>
        <div className="details-grid">
          <div className="details-label">{t('app.crl.issuerDn', 'Issuer DN')}</div>
          <div className="details-value mono">
            {crl.issuer || t('app.crl.unknownIssuer', 'Unknown Issuer')}
          </div>

          <div className="details-label">{t('app.crl.version', 'Version')}</div>
          <div className="details-value">v{crl.version}</div>

          <div className="details-label">{t('app.crl.thisUpdate', 'This Update')}</div>
          <div className="details-value">
            <span className={styles.inlineDateRow}>
              <Calendar size={14} className={styles.iconMuted} aria-hidden="true" />
              <span>{formatCrlDate(crl.thisUpdate, i18n.language)}</span>
            </span>
          </div>

          <div className="details-label">{t('app.crl.nextUpdate', 'Next Update')}</div>
          <div className="details-value">
            <span className={styles.inlineDateRow}>
              <Calendar
                size={14}
                className={crl.isExpired ? styles.iconDanger : styles.iconMuted}
                aria-hidden="true"
              />
              <span className={crl.isExpired ? styles.expiredDateText : undefined}>
                {formatCrlDate(crl.nextUpdate, i18n.language)}{' '}
                {crl.isExpired ? `(${t('app.certDetails.expired', 'Expired')})` : ''}
              </span>
            </span>
          </div>

          <div className="details-label">{sha256Label}</div>
          <div className="details-value mono">
            <span className={styles.fingerprintRow}>
              <span>{crl.fingerprintSha256}</span>
              <InlineCopyButton value={crl.fingerprintSha256} label={sha256Label} />
            </span>
          </div>
        </div>
      </div>

      {children}

      {crl.extensions.length > 0 && (
        <div className="glass-card">
          <h3 className={styles.extensionsHeadingReset}>
            <button
              type="button"
              className={styles.extensionsToggleBtn}
              aria-expanded={showExts}
              onClick={() => setShowExts((prev) => !prev)}
            >
              <span>
                {t('app.crl.crlExtensions', {
                  count: crl.extensions.length,
                  defaultValue: `CRL Extensions (${crl.extensions.length})`,
                })}
              </span>
              {showExts ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </button>
          </h3>

          {showExts && (
            <div className={styles.extensionsList}>
              {crl.extensions.map((ext) => {
                const isCrlNumber = ext.name === 'crlNumber' || ext.oid === '2.5.29.20'
                const label = t(
                  `app.crl.extensionNames.${ext.name}`,
                  EXTENSION_DISPLAY_NAMES[ext.name] || ext.name,
                )
                const isShortValue = Boolean(ext.value && ext.value.length <= 16)

                return (
                  <div
                    key={`${ext.oid}-${ext.name}-${ext.value.slice(0, 16)}`}
                    className={`details-grid ${styles.extensionItem}`}
                  >
                    <div className="details-label">{label}</div>
                    <div className="details-value">
                      {isShortValue ? (
                        <div className={styles.extShortRow}>
                          <span className={styles.extValueChip}>
                            {isCrlNumber ? `#${ext.value}` : ext.value}
                          </span>
                          <span className={styles.extOidText}>(OID: {ext.oid})</span>
                          {ext.critical && (
                            <span className="badge badge-warning">
                              [{t('app.crl.critical', 'CRITICAL')}]
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className={styles.extOidMetaRow}>
                            <span className={styles.extOidText}>OID: {ext.oid}</span>
                            {ext.critical && (
                              <span className="badge badge-warning">
                                [{t('app.crl.critical', 'CRITICAL')}]
                              </span>
                            )}
                          </div>
                          {ext.value && <div className={styles.extLongValueBox}>{ext.value}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="glass-card">
        <div className={styles.rawPemBar}>
          <button
            type="button"
            onClick={() => setShowPem((prev) => !prev)}
            aria-expanded={showPem}
            className="btn btn-secondary btn-sm"
          >
            {showPem ? (
              <EyeOff size={14} aria-hidden="true" />
            ) : (
              <Eye size={14} aria-hidden="true" />
            )}
            <span>
              {showPem
                ? t('app.crl.hideRawPem', 'Hide Raw PEM')
                : t('app.crl.viewRawPem', 'View Raw PEM')}
            </span>
          </button>

          <div className={styles.headerBtnRow}>
            <button
              type="button"
              onClick={handleDownloadPem}
              title={t(
                'app.winCertStore.certCard.pemTooltip',
                'Privacy Enhanced Mail (Base64 Text). Standard for Linux and web servers.',
              )}
              className="btn btn-download-pem"
            >
              <Download size={14} aria-hidden="true" />
              <span>{t('app.crl.downloadPem', 'Download PEM')}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadDer}
              title={t(
                'app.winCertStore.certCard.derTooltip',
                'Distinguished Encoding Rules (Raw Binary). Standard for Windows and Java.',
              )}
              className="btn btn-download-der"
            >
              <Download size={14} aria-hidden="true" />
              <span>{t('app.crl.downloadDer', 'Download DER')}</span>
            </button>
          </div>
        </div>

        {showPem && (
          <div className={styles.rawPemWrap}>
            <div className={styles.rawPemCopyPos}>
              <InlineCopyButton value={crl.pem} label="PEM" />
            </div>
            <pre className={`code-block ${styles.rawPemPre}`}>{crl.pem}</pre>
          </div>
        )}
      </div>
    </div>
  )
})
