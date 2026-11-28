import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileKey,
  Key,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'

import type { ParsedCSR } from '@/types'
import { formatExtensionValue, formatPurposesList } from '@/utils/purpose-formatter'

import {
  base64ToUint8Array,
  formatCsrParseError,
  translateCsrExtensionLabel,
  translateSubjectFieldLabel,
  triggerCsrDownload,
} from './csr-presets'

import styles from './CsrParsedView.module.css'

export interface CsrParsedViewProps {
  csr: ParsedCSR
  fileName: string
  isSample?: boolean
  privateKeyPem?: string
  onRemove: () => void
  onEdit: () => void
}

export interface CsrErrorCardProps {
  name: string
  error: string
  action?: { label: string; onClick: () => void }
  onRemove: () => void
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleCopy = (): void => {
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true)
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
        }
        timerRef.current = setTimeout(() => {
          setCopied(false)
          timerRef.current = null
        }, 1500)
      })
      .catch((err: unknown) => {
        console.error('Clipboard copy failed:', err)
      })
  }

  const label = t('common.copyToClipboard', 'Copy to clipboard')

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
    >
      <Copy size={13} aria-hidden="true" />
    </button>
  )
}

export function CsrParsedView({
  csr,
  fileName,
  isSample,
  privateKeyPem,
  onRemove,
  onEdit,
}: CsrParsedViewProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)
  const [showPem, setShowPem] = useState(false)
  const [showExts, setShowExts] = useState(true)

  const cn = csr.subjectFields.find((f) => f.shortName === 'CN')?.value || fileName
  const removeLabel = t('common.remove', 'Remove')

  const downloadDer = (): void => {
    try {
      const bytes = base64ToUint8Array(csr.derBase64)
      const blob = new Blob([bytes], { type: 'application/octet-stream' })
      triggerCsrDownload(blob, `${fileName.replace(/\.[^/.]+$/, '')}.der`)
    } catch (err) {
      console.error('Failed to export DER CSR:', err)
    }
  }

  const downloadPem = (): void => {
    const blob = new Blob([csr.pem], { type: 'text/plain' })
    const targetName =
      fileName.endsWith('.csr') || fileName.endsWith('.req') || fileName.endsWith('.pem')
        ? fileName
        : `${fileName}.csr`
    triggerCsrDownload(blob, targetName)
  }

  const downloadKey = (): void => {
    if (!privateKeyPem) {
      return
    }
    const blob = new Blob([privateKeyPem], { type: 'application/x-pem-file' })
    triggerCsrDownload(blob, `${fileName.replace(/\.[^/.]+$/, '')}.key`)
  }

  return (
    <div className={`glass-panel ${styles.csrCard}`}>
      <div className={styles.cardHeader}>
        <button
          type="button"
          className={styles.cardToggleBtn}
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <span className={styles.cardIdentity}>
            <FileKey size={22} className={styles.iconAccent} aria-hidden="true" />
            <span>
              <span className={styles.cardTitleRow}>
                <span>{cn}</span>
                {Boolean(isSample) && (
                  <span className="badge badge-info">
                    <Sparkles size={11} aria-hidden="true" />
                    <span>{t('common.sample', 'Sample')}</span>
                  </span>
                )}
                {privateKeyPem && (
                  <span
                    title={t('app.csr.editor.privateKeyAvailable', 'Private Key Available')}
                    className={styles.tabKeyIndicator}
                  >
                    <Key size={13} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className={styles.cardSubtext}>{fileName}</span>
            </span>
          </span>
          {expanded ? (
            <ChevronUp size={18} className={styles.iconSecondary} aria-hidden="true" />
          ) : (
            <ChevronDown size={18} className={styles.iconSecondary} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${removeLabel} ${fileName}`}
          title={removeLabel}
          className={styles.iconActionBtn}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className={`animate-fade-in ${styles.cardBody}`}>
          <div className={styles.detailsStack}>
            <div className={styles.badgeToolbar}>
              <div className={styles.badgeGroup}>
                {csr.signatureValid ? (
                  <span className="badge badge-success">
                    <CheckCircle size={13} aria-hidden="true" />
                    <span>{t('app.csr.validSignature', 'Self-Signature Valid')}</span>
                  </span>
                ) : (
                  <span className="badge badge-danger">
                    <XCircle size={13} aria-hidden="true" />
                    <span>{t('app.csr.invalidSignature', 'Self-Signature Invalid')}</span>
                  </span>
                )}
                <span className="badge badge-info">
                  <FileKey size={13} aria-hidden="true" />
                  <span>{t('app.csr.csrBadge', 'CSR')}</span>
                </span>
                {privateKeyPem && (
                  <span className="badge badge-purple">
                    <Key size={13} aria-hidden="true" />
                    <span>{t('app.csr.editor.privateKeyAvailable', 'Private Key Available')}</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onEdit}
                title={t('app.csr.editor.modalTitle', 'Edit & Re-sign CSR')}
              >
                <Edit3 size={14} className={styles.iconAccent} aria-hidden="true" />
                <span>{t('app.csr.editor.editCsrBtn', 'Edit CSR')}</span>
              </button>
            </div>

            <div className="glass-card">
              <h3 className={styles.sectionHeading}>{t('app.csr.subjectTitle', 'Subject')}</h3>
              <div className="details-grid">
                {csr.subjectFields.length > 0 ? (
                  csr.subjectFields.map((field) => (
                    <div
                      key={`${field.shortName}-${field.name}-${field.value}`}
                      className={styles.rowContents}
                    >
                      <div className="details-label">
                        {translateSubjectFieldLabel(field.shortName, field.name, t)}
                      </div>
                      <div className="details-value">{field.value}</div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="details-label">{t('app.csr.fullDn', 'Full DN')}</div>
                    <div className="details-value">
                      {csr.subject || t('app.csr.emptySubject', '(empty subject)')}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="glass-card">
              <h3 className={styles.sectionHeading}>
                {t('app.csr.cryptoDetailsTitle', 'Cryptographic Details')}
              </h3>
              <div className="details-grid">
                <div className="details-label">{t('app.csr.publicKey', 'Public Key')}</div>
                <div className="details-value">
                  {csr.publicKeyAlgorithm}
                  {csr.publicKeySize
                    ? ` (${csr.publicKeySize} ${t('app.certDetails.bits', 'bits')})`
                    : ''}
                </div>

                <div className="details-label">
                  {t('app.csr.signatureAlgorithm', 'Signature Algorithm')}
                </div>
                <div className="details-value">{csr.signatureAlgorithm}</div>

                <div className="details-label">{t('app.csr.signatureOid', 'Signature OID')}</div>
                <div className="details-value mono">{csr.signatureOid}</div>

                <div className="details-label">
                  {t('app.csr.requestedPurposes', 'Requested Purposes')}
                </div>
                <div className="details-value">
                  {formatPurposesList(csr.requestedPurposes, t) ||
                    t('app.chain.noneSpecified', 'None specified')}
                </div>

                <div className="details-label">
                  {t('app.csr.sha256Fingerprint', 'SHA-256 Fingerprint')}
                </div>
                <div className={`details-value mono ${styles.fingerprintValue}`}>
                  <span>{csr.fingerprintSha256}</span>
                  <CopyButton value={csr.fingerprintSha256} />
                </div>
              </div>
            </div>

            {csr.requestedExtensions.length > 0 && (
              <div className="glass-card">
                <h3 className={styles.extensionsHeadingWrap}>
                  <button
                    type="button"
                    className={styles.extensionsToggleBtn}
                    onClick={() => setShowExts((prev) => !prev)}
                    aria-expanded={showExts}
                  >
                    <span>
                      {t('app.csr.requestedExtensions', {
                        count: csr.requestedExtensions.length,
                        defaultValue: `Requested Extensions (${csr.requestedExtensions.length})`,
                      })}
                    </span>
                    {showExts ? (
                      <ChevronUp size={16} className={styles.iconSecondary} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={16} className={styles.iconSecondary} aria-hidden="true" />
                    )}
                  </button>
                </h3>
                {showExts && (
                  <div className={`details-grid ${styles.extensionsGrid}`}>
                    {csr.requestedExtensions.map((ext) => (
                      <div
                        key={`${ext.oid}-${ext.name}-${ext.value.slice(0, 24)}`}
                        className={styles.rowContents}
                      >
                        <div className="details-label">
                          <span>{translateCsrExtensionLabel(ext.name, t)}</span>
                          {ext.critical && (
                            <span className={styles.criticalTag}>
                              {t('app.csr.critical', 'Critical')}
                            </span>
                          )}
                        </div>
                        <div className={`details-value ${ext.value.length > 60 ? 'mono' : ''}`}>
                          <div>
                            {formatExtensionValue(ext.name, ext.oid, ext.value, t) ||
                              ext.value ||
                              t('app.csr.noValue', '(no value)')}
                          </div>
                          {ext.oid && (
                            <div className={styles.oidSubtext}>
                              {t('app.csr.oidLabel', 'OID:')} {ext.oid}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="glass-card">
              <div className={styles.pemHeader}>
                <button
                  type="button"
                  onClick={() => setShowPem((prev) => !prev)}
                  className={styles.pemToggleBtn}
                  aria-expanded={showPem}
                >
                  {showPem ? (
                    <EyeOff size={14} aria-hidden="true" />
                  ) : (
                    <Eye size={14} aria-hidden="true" />
                  )}
                  <span>
                    {showPem
                      ? t('app.chain.hidePem', 'Hide PEM')
                      : t('app.chain.viewPem', 'View PEM')}
                  </span>
                  {showPem ? (
                    <ChevronUp size={14} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={14} aria-hidden="true" />
                  )}
                </button>
                <div className={styles.downloadGroup}>
                  <button type="button" className="btn btn-download-pem" onClick={downloadPem}>
                    <Download size={13} aria-hidden="true" />
                    <span>{t('app.csr.downloadCsr', 'Download .csr')}</span>
                  </button>
                  <button type="button" className="btn btn-download-der" onClick={downloadDer}>
                    <Download size={13} aria-hidden="true" />
                    <span>{t('app.csr.downloadDer', 'Download .der')}</span>
                  </button>
                  {privateKeyPem && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={downloadKey}
                    >
                      <Key size={13} aria-hidden="true" />
                      <span>{t('app.csr.editor.downloadKey', 'Download .key')}</span>
                    </button>
                  )}
                </div>
              </div>
              {showPem && <pre className={`code-block ${styles.pemPre}`}>{csr.pem}</pre>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function CsrErrorCard({ name, error, action, onRemove }: CsrErrorCardProps) {
  const { t } = useTranslation()
  const displayMessage = formatCsrParseError(error, name, t)
  const removeLabel = t('common.remove', 'Remove')

  return (
    <div className={`glass-panel ${styles.errorCard}`} role="alert">
      <div className={styles.errorHeader}>
        <div className={styles.errorBody}>
          <AlertTriangle size={20} className={styles.errorIcon} aria-hidden="true" />
          <div>
            <div className={styles.errorTitle}>{name}</div>
            <div className={styles.errorMessage}>{displayMessage}</div>
            {action && (
              <button
                type="button"
                className={`btn btn-secondary btn-sm ${styles.errorActionBtn}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${removeLabel} ${name}`}
          title={removeLabel}
          className={styles.iconActionBtn}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
