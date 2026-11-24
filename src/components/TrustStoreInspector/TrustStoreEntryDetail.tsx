import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Download, EyeOff, FileKey } from 'lucide-react'

import { CertificateDetails, useToast } from '@/components/shared'
import type { TrustStoreEntry } from '@/types'

import { downloadPrivateKeyFile } from './trust-store-helpers'

import styles from './TrustStoreEntry.module.css'

export interface TrustStoreEntryDetailProps {
  entry: TrustStoreEntry | null
}

export const TrustStoreEntryDetail = memo(function TrustStoreEntryDetail({
  entry,
}: TrustStoreEntryDetailProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  if (!entry) {
    return (
      <div className={styles.detailsPanel}>
        <div className={styles.emptySelection}>
          {t('app.trustStore.inspector.selectCert', 'Select a certificate from the list')}
        </div>
      </div>
    )
  }

  const { certificate: cert, privateKeyPem, alias } = entry

  const handleDownloadKey = (): void => {
    if (!privateKeyPem) {
      return
    }
    try {
      const filename = downloadPrivateKeyFile(privateKeyPem, alias)
      showToast(`${t('common.download', 'Download')}: ${filename}`, 'success')
    } catch (err) {
      console.error('Failed to export private key:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  const handleCopyKey = async (): Promise<void> => {
    if (!privateKeyPem) {
      return
    }
    try {
      await navigator.clipboard.writeText(privateKeyPem)
      showToast(t('common.copiedToClipboard', 'Copied to clipboard'), 'success')
      setCopiedKey(true)
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current)
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedKey(false)
        copyTimerRef.current = null
      }, 2000)
    } catch (err) {
      console.error('Failed to copy private key:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  return (
    <div className={styles.detailsPanel}>
      <div className={styles.entryHeader}>
        <h3 className={styles.entryTitle}>{alias}</h3>
        <div className={styles.certBadges}>
          {cert.isRoot && (
            <span className="badge badge-success">
              <span className="badge-dot" />
              {t('app.certDetails.rootCa', 'Root CA')}
            </span>
          )}
          {cert.isIntermediate && (
            <span className="badge badge-warning">
              <span className="badge-dot" />
              {t('app.certDetails.intermediateCa', 'Intermediate CA')}
            </span>
          )}
          {cert.isLeaf && (
            <span className="badge badge-purple">
              <span className="badge-dot" />
              {t('app.certDetails.leafCert', 'Leaf Certificate')}
            </span>
          )}
          {cert.isExpired && (
            <span className="badge badge-danger">
              <span className="badge-dot pulse" />
              {t('app.certDetails.expired', 'Expired')}
            </span>
          )}
        </div>
      </div>

      <CertificateDetails cert={cert} />

      {Boolean(privateKeyPem) && (
        <div className={styles.privateKeySection}>
          <div className={styles.privateKeyActions}>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              aria-expanded={showPrivateKey}
              onClick={() => setShowPrivateKey((prev) => !prev)}
            >
              {showPrivateKey ? (
                <EyeOff size={13} aria-hidden="true" />
              ) : (
                <FileKey size={13} aria-hidden="true" />
              )}
              <span>
                {showPrivateKey
                  ? t('app.trustStore.certDetails.hidePrivateKey', 'Hide Private Key')
                  : t('app.trustStore.certDetails.viewPrivateKey', 'View Private Key')}
              </span>
            </button>

            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadKey}>
              <Download size={13} aria-hidden="true" />
              <span>{t('app.csr.editor.downloadKey', 'Download .key')}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleCopyKey()}
            >
              {copiedKey ? (
                <Check size={13} className={styles.iconSuccess} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              <span>
                {copiedKey
                  ? t('app.winCertStore.certCard.copied', 'Copied')
                  : t('common.copy', 'Copy')}
              </span>
            </button>
          </div>

          {showPrivateKey && privateKeyPem && (
            <pre className={`code-block ${styles.privateKeyBlock}`}>{privateKeyPem}</pre>
          )}
        </div>
      )}
    </div>
  )
})
