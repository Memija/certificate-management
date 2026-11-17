import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDown,
  Award,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Lock,
  ShieldCheck,
} from 'lucide-react'

import { useToast } from '@/components/shared'
import type { TlsChainCertificate } from '@/types'

import {
  calculateValidityProgress,
  type CertChainRole,
  formatDn,
  resolveChainRole,
  triggerPemDownload,
} from './tls-scanner-helpers'
import { TlsCertSections } from './TlsCertSections'

import styles from './TlsChainFlowCard.module.css'

export interface TlsChainFlowCardProps {
  cert: TlsChainCertificate
  index: number
  chainLength: number
  onJumpToIndex: (targetIdx: number) => void
}

const ROLE_BADGE_CLASSES: Record<CertChainRole, string> = {
  leaf: styles.badgeLeaf,
  intermediate: styles.badgeIntermediate,
  root: styles.badgeRoot,
}

export const TlsChainFlowCard = memo(function TlsChainFlowCard({
  cert,
  index,
  chainLength,
  onJumpToIndex,
}: TlsChainFlowCardProps) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()

  const [isPemOpen, setIsPemOpen] = useState(false)
  const [copiedPem, setCopiedPem] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const { role, isSelfSigned } = resolveChainRole(cert, index, chainLength)
  const isLeaf = role === 'leaf'
  const isIntermediate = role === 'intermediate'
  const subjectCN = cert.subjectCN || formatDn(cert.subject) || 'Unknown'
  const issuerCN = cert.issuerCN || formatDn(cert.issuer) || 'Unknown'

  const validity = useMemo(
    () => calculateValidityProgress(cert.valid_from, cert.valid_to),
    [cert.valid_from, cert.valid_to],
  )

  const copyText = async (val: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(val)
      showToast(`${label}: ${t('common.copiedToClipboard', 'Copied to clipboard')}`, 'success')
    } catch (err) {
      console.error('Clipboard copy failed:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  const copyPem = async (): Promise<void> => {
    if (!cert.pem) {
      return
    }
    try {
      await navigator.clipboard.writeText(cert.pem)
      setCopiedPem(true)
      showToast(t('common.copiedToClipboard', 'Copied to clipboard'), 'success')
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current)
      }
      copiedTimerRef.current = setTimeout(() => {
        setCopiedPem(false)
        copiedTimerRef.current = null
      }, 2000)
    } catch (err) {
      console.error('Clipboard PEM copy failed:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  const downloadPem = (): void => {
    if (!cert.pem) {
      return
    }
    triggerPemDownload(cert.pem, subjectCN)
    showToast(t('app.tlsScanner.downloadPem', 'Download PEM'), 'success')
  }

  const roleLabel = isLeaf
    ? t('app.certDetails.leafCert', 'Leaf Certificate')
    : isIntermediate
      ? t('app.certDetails.intermediateCa', 'Intermediate CA')
      : t('app.certDetails.rootCa', 'Root CA / Anchor')
  const iconToneClass = validity.isExpired
    ? 'danger'
    : isLeaf
      ? styles.blueIconWrap
      : isIntermediate
        ? 'info'
        : 'success'
  const progressToneClass = validity.isExpired
    ? styles.progressDanger
    : validity.isExpiringSoon
      ? styles.progressWarning
      : styles.progressNormal
  const statusTextClass = validity.isExpired
    ? styles.statusDanger
    : validity.isExpiringSoon
      ? styles.statusWarning
      : styles.statusSuccess

  const copyCnLabel = t('app.tlsScanner.copyCn', 'Copy Common Name')
  const downloadPemLabel = t('app.tlsScanner.downloadPem', 'Download PEM')
  const expiryText = validity.isExpired
    ? validity.daysExpired > 0
      ? t('app.tlsScanner.expiredDaysAgo', {
          count: validity.daysExpired,
          defaultValue: `Expired ${validity.daysExpired} days ago`,
        })
      : t('app.certDetails.expired', 'Expired')
    : t('app.tlsScanner.daysRemaining', {
        count: validity.daysRemaining,
        defaultValue: `${validity.daysRemaining} days remaining`,
      })

  const RoleIcon = isLeaf ? Globe : isIntermediate ? ShieldCheck : Award

  return (
    <div className={styles.cardWrapper}>
      {index > 0 && (
        <div className={styles.connector}>
          <div className={styles.connectorLine} />
          <div className={styles.connectorBadge}>
            <Lock size={13} className={styles.cyanIcon} aria-hidden="true" />
            <span>{t('app.tlsScanner.signedAndIssuedBy', 'Signed & Issued by CA')}</span>
            <ArrowDown size={13} className={styles.cyanIcon} aria-hidden="true" />
          </div>
          <div className={styles.connectorLine} />
        </div>
      )}

      <article
        id={`tls-cert-card-${index}`}
        className={`${styles.certCard} ${styles[role]} ${validity.isExpired ? styles.expired : ''}`}
      >
        <div className={styles.cardHeader}>
          <div className={styles.headerIdentity}>
            <div
              className={`metric-icon-wrap ${styles.roleIconWrap} ${iconToneClass}`}
              aria-hidden="true"
            >
              <RoleIcon size={22} />
            </div>

            <div className={styles.identityBody}>
              <div className={styles.roleBadgesRow}>
                <span className={`${styles.roleBadge} ${ROLE_BADGE_CLASSES[role]}`}>
                  #{index + 1} {roleLabel}
                </span>
                {Boolean(cert.ca) && !isLeaf && <span className="badge badge-info">CA</span>}
                {isSelfSigned && index > 0 && (
                  <span className="badge badge-success">
                    {t('app.tlsScanner.selfSigned', 'Self-Signed')}
                  </span>
                )}
              </div>

              <div className={styles.subjectRow}>
                <h3 className={styles.subjectHeading}>{subjectCN}</h3>
                <button
                  type="button"
                  className={`btn btn-secondary btn-sm ${styles.miniIconBtn}`}
                  onClick={() =>
                    void copyText(subjectCN, t('app.tlsScanner.commonName', 'Common Name'))
                  }
                  aria-label={copyCnLabel}
                  title={copyCnLabel}
                >
                  <Copy size={11} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.issuerRow}>
                <span>{t('app.tlsScanner.issuer', 'Issuer')}:</span>
                <span className={styles.issuerValue}>{issuerCN}</span>
                {index < chainLength - 1 && (
                  <button
                    type="button"
                    className={styles.jumpBtn}
                    onClick={() => onJumpToIndex(index + 1)}
                    title={t('app.tlsScanner.jumpToIssuer', 'Jump to Issuer Certificate')}
                  >
                    <span>#{index + 2}</span>
                    <ExternalLink size={11} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
            <span
              className={`badge ${validity.isExpired ? 'badge-danger' : validity.isExpiringSoon ? 'badge-warning' : 'badge-success'} ${styles.expiryPill}`}
            >
              {validity.isExpired ? (
                <>
                  <span className="badge-dot pulse" />
                  {expiryText}
                </>
              ) : (
                <>
                  <Clock size={12} aria-hidden="true" />
                  <span>{expiryText}</span>
                </>
              )}
            </span>

            {Boolean(cert.pem) && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void copyPem()}
                  title={t('app.tlsScanner.copyPem', 'Copy PEM')}
                >
                  {copiedPem ? (
                    <Check size={13} className={styles.copiedIcon} aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  <span>
                    {copiedPem
                      ? t('app.tlsScanner.copied', 'Copied!')
                      : t('app.tlsScanner.copyPem', 'Copy PEM')}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-download-pem btn-sm"
                  onClick={downloadPem}
                  aria-label={downloadPemLabel}
                  title={downloadPemLabel}
                >
                  <Download size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsPemOpen((prev) => !prev)}
                  aria-expanded={isPemOpen}
                  title={
                    isPemOpen
                      ? t('app.tlsScanner.hidePem', 'Hide PEM')
                      : t('app.tlsScanner.viewPem', 'View PEM')
                  }
                >
                  {isPemOpen ? (
                    <EyeOff size={13} aria-hidden="true" />
                  ) : (
                    <Eye size={13} aria-hidden="true" />
                  )}
                  <span>PEM</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.validityWrap}>
          <div className={styles.validityTopRow}>
            <span className={styles.validityLabelGroup}>
              <Calendar size={13} className={styles.accentIcon} aria-hidden="true" />
              <strong className={styles.primaryStrong}>
                {t('app.tlsScanner.lifespan', 'Certificate Lifespan')}
              </strong>
              <span>
                ({validity.percent}% {t('app.tlsScanner.elapsed', 'elapsed')})
              </span>
            </span>
            <span className={statusTextClass}>
              {validity.isExpired
                ? expiryText
                : t('app.tlsScanner.daysLeft', {
                    count: validity.daysRemaining,
                    defaultValue: `${validity.daysRemaining} days left`,
                  })}
            </span>
          </div>

          <progress
            className={`${styles.validityProgress} ${progressToneClass}`}
            value={Math.min(100, Math.max(2, validity.percent))}
            max={100}
            aria-label={t('app.tlsScanner.lifespan', 'Certificate Lifespan')}
          />

          <div className={styles.validityDatesRow}>
            <span>
              <strong>{t('app.tlsScanner.validFrom', 'Valid From')}:</strong>{' '}
              {new Date(cert.valid_from).toLocaleString(i18n.language)}
            </span>
            <span>
              <strong>{t('app.tlsScanner.validTo', 'Valid To')}:</strong>{' '}
              <span className={validity.isExpired ? styles.statusDanger : undefined}>
                {new Date(cert.valid_to).toLocaleString(i18n.language)}
              </span>
            </span>
          </div>
        </div>

        <TlsCertSections
          cert={cert}
          isPemOpen={isPemOpen}
          onCopyText={(val, label) => void copyText(val, label)}
          onCopyPem={() => void copyPem()}
          onDownloadPem={downloadPem}
        />
      </article>
    </div>
  )
})
