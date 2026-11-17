import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react'

import { useToast } from '@/components/shared'
import type { StoreName, WinCertEntry } from '@/types'
import { formatExpiry, formatExpiryTooltip } from '@/utils/expiry-formatter'
import { formatExtensionValue, splitPurposes, translatePurpose } from '@/utils/purpose-formatter'
import { matchesSearch } from '@/utils/text-search'

import { InlineCopyButton } from './InlineCopyButton'
import {
  decodeWinCertDerBytes,
  extractDnDisplayName,
  sanitizeWinCertFilename,
  translateWinExtensionName,
  triggerWinCertDownload,
} from './win-cert-helpers'

import styles from './WinCertListCard.module.css'

export interface WinCertListCardProps {
  entry: WinCertEntry
  search?: string
  activeStore?: StoreName
}

export const WinCertListCard = memo(function WinCertListCard({
  entry,
  search = '',
  activeStore,
}: WinCertListCardProps) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [showPem, setShowPem] = useState(false)
  const [copiedPem, setCopiedPem] = useState(false)
  const pemTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (pemTimerRef.current !== null) {
        clearTimeout(pemTimerRef.current)
      }
    }
  }, [])

  const downloadPemFile = (): void => {
    if (!entry.pem) {
      return
    }
    const filename = `${sanitizeWinCertFilename(entry)}.pem`
    const blob = new Blob([entry.pem], { type: 'application/x-pem-file' })
    triggerWinCertDownload(blob, filename)
    showToast(`${t('common.download', 'Downloaded')} ${filename}`, 'success')
  }

  const downloadDerFile = (): void => {
    if (!entry.certB64 && !entry.pem) {
      return
    }
    try {
      const bytes = decodeWinCertDerBytes(entry)
      const filename = `${sanitizeWinCertFilename(entry)}.der`
      const blob = new Blob([bytes], { type: 'application/x-x509-ca-cert' })
      triggerWinCertDownload(blob, filename)
      showToast(`${t('common.download', 'Downloaded')} ${filename}`, 'success')
    } catch (err: unknown) {
      console.error('Failed to export DER certificate:', err)
      showToast(t('common.error', 'Failed to export DER'), 'error')
    }
  }

  const copyPemText = async (): Promise<void> => {
    if (!entry.pem) {
      return
    }
    try {
      await navigator.clipboard.writeText(entry.pem)
      setCopiedPem(true)
      showToast(
        t('app.winCertStore.certCard.copiedToast', 'PEM certificate copied to clipboard'),
        'success',
      )
      if (pemTimerRef.current !== null) {
        clearTimeout(pemTimerRef.current)
      }
      pemTimerRef.current = setTimeout(() => {
        setCopiedPem(false)
        pemTimerRef.current = null
      }, 2000)
    } catch (err: unknown) {
      console.error('Clipboard copy failed:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  const cn = extractDnDisplayName(entry.subject)
  const isExpired = entry.isExpired
  const expiringSoon = entry.isExpiringSoon

  const matchesOwnName =
    !search || matchesSearch([cn, entry.subject, entry.friendlyName, entry.thumbprint], search)
  const issuerCn = extractDnDisplayName(entry.issuer)
  const showIssuerHint = Boolean(search && !matchesOwnName && matchesSearch(entry.issuer, search))

  const cardBorderClass = isExpired
    ? styles.certCardExpired
    : expiringSoon
      ? styles.certCardWarning
      : styles.certCardValid

  const expiryToneClass = isExpired
    ? styles.expirySpanExpired
    : expiringSoon
      ? styles.expirySpanWarning
      : styles.expirySpanValid

  const serialLabel = t('app.winCertStore.certCard.serialNumber', 'Serial Number')
  const thumbprintLabel = t('app.winCertStore.certCard.thumbprint', 'Thumbprint')
  const purposesList = splitPurposes(entry.purposes)

  return (
    <article className={`glass-card ${styles.certCard} ${cardBorderClass}`}>
      <button
        type="button"
        className={styles.certCardToggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className={styles.certCardLeft}>
          <Shield
            size={18}
            className={isExpired ? styles.toneIconDanger : styles.accentIcon}
            aria-hidden="true"
          />
          <div className={styles.certCardTitleWrap}>
            <h3 className={styles.certCardTitle}>{cn}</h3>
            {showIssuerHint ? (
              <div className={styles.issuerHint}>
                ↳ {t('app.winCertStore.certCard.issuedBy', 'Issued by')}: {issuerCn}
              </div>
            ) : (
              <div
                className={styles.expiryMeta}
                title={formatExpiryTooltip(entry.notAfter, t, i18n.language)}
              >
                {t('app.winCertStore.certCard.expires', 'Expires')}:{' '}
                {new Date(entry.notAfter).toLocaleDateString(i18n.language)}{' '}
                <span className={expiryToneClass}>
                  ({formatExpiry(entry.notAfter, t, i18n.language)})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.certCardBadges}>
          {isExpired && (
            <span className="badge badge-danger">
              <span className="badge-dot pulse" />
              {t('app.winCertStore.certCard.expired', 'Expired')}
            </span>
          )}
          {!isExpired && expiringSoon && (
            <span className="badge badge-warning">
              <span className="badge-dot" />
              {t('app.winCertStore.certCard.expiringSoon', 'Expiring Soon')}
            </span>
          )}
          {entry.isRoot && (
            <span className="badge badge-success">
              {t('app.winCertStore.certCard.rootCA', 'Root CA')}
            </span>
          )}
          {entry.isIntermediate && (
            <span className="badge badge-warning">
              {t('app.winCertStore.certCard.intermediate', 'Intermediate')}
            </span>
          )}
          {!entry.isRoot && !entry.isIntermediate && (
            <span className="badge badge-purple">{t('app.certDetails.leafCert', 'Leaf')}</span>
          )}
          {activeStore === 'CA' && entry.isRoot && (
            <span
              className="badge badge-danger"
              title={t(
                'app.winCertStore.certCard.misplacedRootDesc',
                'This self-signed root certificate is physically installed in the Intermediate CAs store.',
              )}
            >
              <AlertTriangle size={12} aria-hidden="true" />
              {t('app.winCertStore.certCard.misplacedRoot', 'Misplaced Root')}
            </span>
          )}
          {expanded ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </div>
      </button>

      {expanded && (
        <div className={styles.cardDetails}>
          <div className="details-grid">
            <div className="details-label">{t('app.winCertStore.certCard.subject', 'Subject')}</div>
            <div className="details-value">{entry.subject}</div>

            <div className="details-label">{t('app.winCertStore.certCard.issuer', 'Issuer')}</div>
            <div className="details-value">{entry.issuer}</div>

            <div className="details-label">
              {t('app.winCertStore.certCard.validFrom', 'Valid From')}
            </div>
            <div className="details-value">
              {new Date(entry.notBefore).toLocaleDateString(i18n.language)}
            </div>

            <div className="details-label">
              {t('app.winCertStore.certCard.validTo', 'Valid To')}
            </div>
            <div className="details-value">
              {new Date(entry.notAfter).toLocaleDateString(i18n.language)}{' '}
              <span
                className={expiryToneClass}
                title={formatExpiryTooltip(entry.notAfter, t, i18n.language)}
              >
                ({formatExpiry(entry.notAfter, t, i18n.language)})
              </span>
            </div>

            <div className="details-label">{serialLabel}</div>
            <div className="details-value mono">
              {entry.serialNumber}{' '}
              <InlineCopyButton text={entry.serialNumber} fieldLabel={serialLabel} />
            </div>

            <div className="details-label">{thumbprintLabel}</div>
            <div className="details-value mono">
              {entry.thumbprint}{' '}
              <InlineCopyButton text={entry.thumbprint} fieldLabel={thumbprintLabel} />
            </div>

            <div className="details-label">
              {t('app.winCertStore.certCard.signatureAlg', 'Signature Alg.')}
            </div>
            <div className="details-value">{entry.signatureAlgorithm}</div>

            <div className="details-label">
              {t('app.winCertStore.certCard.publicKey', 'Public Key')}
            </div>
            <div className="details-value">
              {entry.publicKeyAlgorithm}
              {entry.publicKeySize !== null
                ? ` (${entry.publicKeySize} ${t('app.certDetails.bits', 'bits')})`
                : ''}
            </div>

            {Boolean(entry.friendlyName) && (
              <>
                <div className="details-label">
                  {t('app.winCertStore.certCard.friendlyName', 'Friendly Name')}
                </div>
                <div className="details-value">{entry.friendlyName}</div>
              </>
            )}

            <div className="details-label">
              {t('app.winCertStore.certCard.purposes', 'Purposes')}
            </div>
            <div className={`details-value ${styles.purposeList}`}>
              {purposesList.map((purpose) => (
                <span key={purpose} className="badge badge-purple">
                  {translatePurpose(purpose, t)}
                </span>
              ))}
            </div>
          </div>

          {entry.extensions.length > 0 && (
            <details className={styles.extensionsBlock}>
              <summary className={styles.extensionsSummary}>
                {t('app.winCertStore.certCard.extensions', 'Extensions')} ({entry.extensions.length}
                )
              </summary>
              <div className={`details-grid ${styles.extensionsGrid}`}>
                {entry.extensions.map((ext) => (
                  <div
                    key={ext.id ?? `${ext.oid}-${ext.name}-${ext.value.slice(0, 20)}`}
                    className={styles.extensionRow}
                  >
                    <div className="details-label">{translateWinExtensionName(ext.name, t)}</div>
                    <div className={`details-value mono ${styles.extensionVal}`}>
                      OID: {ext.oid}
                      {ext.critical && (
                        <span className={`badge badge-danger ${styles.criticalBadge}`}>
                          {t('app.certDetails.critical', '(Critical)')}
                        </span>
                      )}
                      {Boolean(ext.value) && (
                        <div className={styles.extensionFormatted}>
                          {formatExtensionValue(ext.name, ext.oid, ext.value, t)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className={styles.cardActions}>
            {Boolean(entry.pem) && (
              <button
                type="button"
                className="btn btn-download-pem"
                onClick={downloadPemFile}
                title={t('app.winCertStore.certCard.pemTooltip', 'Download PEM')}
              >
                <Download size={13} aria-hidden="true" />
                <span>{t('app.winCertStore.certCard.downloadPem', 'Download PEM')}</span>
              </button>
            )}
            {Boolean(entry.certB64 || entry.pem) && (
              <button
                type="button"
                className="btn btn-download-der"
                onClick={downloadDerFile}
                title={t('app.winCertStore.certCard.derTooltip', 'Download DER')}
              >
                <Download size={13} aria-hidden="true" />
                <span>{t('app.winCertStore.certCard.downloadDer', 'Download DER')}</span>
              </button>
            )}
            {Boolean(entry.pem) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void copyPemText()}
              >
                {copiedPem ? (
                  <Check size={13} className={styles.toneIconSuccess} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                <span>
                  {copiedPem
                    ? t('app.winCertStore.certCard.copied', 'Copied')
                    : t('app.winCertStore.certCard.copyPem', 'Copy PEM')}
                </span>
              </button>
            )}
            {Boolean(entry.pem) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-expanded={showPem}
                onClick={() => setShowPem((prev) => !prev)}
              >
                {showPem ? (
                  <EyeOff size={13} aria-hidden="true" />
                ) : (
                  <Eye size={13} aria-hidden="true" />
                )}
                <span>
                  {showPem
                    ? t('app.winCertStore.certCard.hidePem', 'Hide PEM')
                    : t('app.winCertStore.certCard.viewPem', 'View PEM')}
                </span>
              </button>
            )}
          </div>

          {showPem && Boolean(entry.pem) && (
            <pre className={`code-block ${styles.pemCode}`}>{entry.pem}</pre>
          )}
        </div>
      )}
    </article>
  )
})
