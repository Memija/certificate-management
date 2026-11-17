import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Download, Eye, EyeOff } from 'lucide-react'

import type { CertExtension, ParsedCertificate } from '@/types'
import { formatExpiry, formatExpiryTooltip } from '@/utils/expiry-formatter'
import { formatExtensionValue, splitPurposes, translatePurpose } from '@/utils/purpose-formatter'

import { useToast } from '../ToastContext'
import {
  pemToDerBytes,
  sanitizeCertFilename,
  translateExtensionName,
  triggerBlobDownload,
} from './certificate-details-helpers'

import styles from './CertificateDetails.module.css'

export interface CertificateDetailsProps {
  cert: ParsedCertificate
}

export const CertificateDetails = memo(function CertificateDetails({
  cert,
}: CertificateDetailsProps) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const [showPem, setShowPem] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const downloadPemFile = (): void => {
    if (!cert.pem) {
      return
    }
    const filename = `${sanitizeCertFilename(cert)}.pem`
    const blob = new Blob([cert.pem], { type: 'application/x-pem-file' })
    triggerBlobDownload(blob, filename)
    showToast(`${t('common.download', 'Downloaded')} ${filename}`, 'success')
  }

  const downloadDerFile = (): void => {
    if (!cert.pem) {
      return
    }
    try {
      const bytes = pemToDerBytes(cert.pem)
      const filename = `${sanitizeCertFilename(cert)}.der`
      const blob = new Blob([bytes], { type: 'application/x-x509-ca-cert' })
      triggerBlobDownload(blob, filename)
      showToast(`${t('common.download', 'Downloaded')} ${filename}`, 'success')
    } catch (err) {
      console.error('Failed to export DER certificate:', err)
      showToast(t('common.error', 'Failed to export DER'), 'error')
    }
  }

  const copyToClipboard = async (value: string, successMessage: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(value)
      showToast(successMessage, 'success')
      return true
    } catch (err) {
      console.error('Clipboard copy failed:', err)
      showToast(t('common.error', 'Error'), 'error')
      return false
    }
  }

  const copyPemText = async (): Promise<void> => {
    if (!cert.pem) {
      return
    }
    const ok = await copyToClipboard(
      cert.pem,
      t('app.winCertStore.certCard.copiedToast', 'PEM certificate copied to clipboard'),
    )
    if (ok) {
      setCopied(true)
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current)
      }
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false)
        copiedTimerRef.current = null
      }, 2000)
    }
  }

  const copyValue = async (val: string, label: string): Promise<void> => {
    await copyToClipboard(val, `${t('common.copiedToClipboard', 'Copied to clipboard')}: ${label}`)
  }

  const serialLabel = t('app.certDetails.serialNumber', 'Serial Number')
  const sha1Label = t('app.certDetails.sha1Fingerprint', 'SHA-1 Fingerprint')
  const sha256Label = t('app.certDetails.sha256Fingerprint', 'SHA-256 Fingerprint')
  const copyTitle = t('common.copyToClipboard', 'Copy to clipboard')
  const formattedPurposes = splitPurposes(cert.purposes)
    .map((purpose) => translatePurpose(purpose, t))
    .join(', ')

  return (
    <>
      <div className={`details-grid ${styles.grid}`}>
        <div className="details-label">{t('app.certDetails.subject', 'Subject')}</div>
        <div className="details-value">{cert.subject}</div>

        <div className="details-label">{t('app.certDetails.issuer', 'Issuer')}</div>
        <div className="details-value">{cert.issuer}</div>

        <div className="details-label">{t('app.certDetails.validFrom', 'Valid From')}</div>
        <div className="details-value">
          {new Date(cert.validFrom).toLocaleString(i18n.language)}
        </div>

        <div className="details-label">{t('app.certDetails.validTo', 'Valid To')}</div>
        <div className="details-value">
          {new Date(cert.validTo).toLocaleString(i18n.language)}{' '}
          <span
            className={cert.isExpired ? styles.expiryExpired : styles.expiryValid}
            title={formatExpiryTooltip(cert.validTo, t, i18n.language)}
          >
            ({formatExpiry(cert.validTo, t, i18n.language)})
          </span>
          {cert.isExpired && (
            <span className={`badge badge-danger ${styles.expiredBadge}`}>
              <span className="badge-dot pulse" />
              {t('app.certDetails.expired', 'Expired')}
            </span>
          )}
        </div>

        <div className="details-label">{serialLabel}</div>
        <div className="details-value">
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => void copyValue(cert.serialNumber, serialLabel)}
            title={copyTitle}
          >
            <span>{cert.serialNumber}</span>
            <Copy size={12} className={styles.copyIcon} aria-hidden="true" />
          </button>
        </div>

        <div className="details-label">{t('app.certDetails.version', 'Version')}</div>
        <div className="details-value">v{cert.version + 1}</div>

        <div className="details-label">
          {t('app.certDetails.signatureAlgorithm', 'Signature Algorithm')}
        </div>
        <div className="details-value">
          {cert.signatureAlgorithm} ({cert.signatureOid})
        </div>

        <div className="details-label">{t('app.certDetails.publicKey', 'Public Key')}</div>
        <div className="details-value">
          {cert.publicKeyAlgorithm}
          {cert.publicKeySize !== null
            ? ` (${cert.publicKeySize} ${t('app.certDetails.bits', 'bits')})`
            : ''}
        </div>

        <div className="details-label">{sha1Label}</div>
        <div className="details-value">
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => void copyValue(cert.fingerprintSha1, sha1Label)}
            title={copyTitle}
          >
            <span>{cert.fingerprintSha1}</span>
            <Copy size={12} className={styles.copyIcon} aria-hidden="true" />
          </button>
        </div>

        <div className="details-label">{sha256Label}</div>
        <div className="details-value">
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => void copyValue(cert.fingerprintSha256, sha256Label)}
            title={copyTitle}
          >
            <span>{cert.fingerprintSha256}</span>
            <Copy size={12} className={styles.copyIcon} aria-hidden="true" />
          </button>
        </div>

        <div className="details-label">{t('app.certDetails.purposes', 'Purposes')}</div>
        <div className="details-value">{formattedPurposes}</div>
      </div>

      {cert.extensions.length > 0 && (
        <details className={styles.extensionsDetails}>
          <summary className={styles.extensionsSummary}>
            {t('app.certDetails.extensions', 'Extensions')} ({cert.extensions.length})
          </summary>
          <div className={`details-grid ${styles.extensionsGrid}`}>
            {cert.extensions.map((ext: CertExtension) => (
              <div
                key={ext.id ?? `${ext.oid}-${ext.name}-${ext.value.slice(0, 24)}`}
                className={styles.extensionRow}
              >
                <div className="details-label">{translateExtensionName(ext.name, t)}</div>
                <div className="details-value">
                  <div>
                    OID: <span className="mono">{ext.oid}</span>
                    {ext.critical && (
                      <span className={`badge badge-danger ${styles.criticalBadge}`}>
                        {t('app.certDetails.critical', '(Critical)')}
                      </span>
                    )}
                  </div>
                  {ext.value && (
                    <div className={`mono ${styles.extensionValue}`}>
                      {formatExtensionValue(ext.name, ext.oid, ext.value, t)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {Boolean(cert.pem) && (
        <div className={styles.pemSection}>
          <div className={styles.pemActions}>
            <button
              type="button"
              className="btn btn-download-pem"
              onClick={downloadPemFile}
              title={t('app.winCertStore.certCard.pemTooltip', 'Download PEM')}
            >
              <Download size={13} aria-hidden="true" />
              <span>{t('app.winCertStore.certCard.downloadPem', 'Download PEM')}</span>
            </button>
            <button
              type="button"
              className="btn btn-download-der"
              onClick={downloadDerFile}
              title={t('app.winCertStore.certCard.derTooltip', 'Download DER')}
            >
              <Download size={13} aria-hidden="true" />
              <span>{t('app.winCertStore.certCard.downloadDer', 'Download DER')}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void copyPemText()}
            >
              {copied ? (
                <Check size={13} className={styles.copiedIcon} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              <span>
                {copied
                  ? t('app.winCertStore.certCard.copied', 'Copied')
                  : t('app.winCertStore.certCard.copyPem', 'Copy PEM')}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPem((prev) => !prev)}
              aria-expanded={showPem}
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
          </div>

          {showPem && <pre className={`code-block ${styles.pemBlock}`}>{cert.pem}</pre>}
        </div>
      )}
    </>
  )
})
