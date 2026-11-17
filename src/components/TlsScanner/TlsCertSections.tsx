import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Download,
  Globe,
  Key,
  Search,
  Shield,
  Sparkles,
} from 'lucide-react'

import type { TlsChainCertificate } from '@/types'
import { formatExtensionValue } from '@/utils/purpose-formatter'

import {
  type DnEntry,
  formatDn,
  formatKeyDescription,
  parseDnEntries,
  translateExtensionLabel,
} from './tls-scanner-helpers'

import styles from './TlsCertSections.module.css'

export interface TlsCertSectionsProps {
  cert: TlsChainCertificate
  isPemOpen: boolean
  onCopyText: (val: string, label: string) => void
  onCopyPem: () => void
  onDownloadPem: () => void
}

interface DnSectionProps {
  title: string
  entries: DnEntry[]
  rawValue: string
  isRaw: boolean
  rawToggleLabel: string
  onToggleRaw: () => void
}

function DnSection({
  title,
  entries,
  rawValue,
  isRaw,
  rawToggleLabel,
  onToggleRaw,
}: DnSectionProps) {
  return (
    <div className={styles.dnBox}>
      <div className={styles.dnHeader}>
        <span className={styles.dnTitle}>{title}</span>
        <button
          type="button"
          className={styles.dnToggleBtn}
          onClick={onToggleRaw}
          aria-expanded={isRaw}
        >
          {rawToggleLabel}
        </button>
      </div>
      {isRaw ? (
        <div className={`mono ${styles.dnRaw}`}>{rawValue}</div>
      ) : (
        <div className={styles.dnChipsWrap}>
          {entries.map((entry, idx) => (
            <span key={`${entry.key}-${entry.value}-${idx}`} className={styles.dnChip}>
              <span className={styles.dnTag} title={entry.label}>
                {entry.key}:
              </span>
              <span className={styles.dnVal}>{entry.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export const TlsCertSections = memo(function TlsCertSections({
  cert,
  isPemOpen,
  onCopyText,
  onCopyPem,
  onDownloadPem,
}: TlsCertSectionsProps) {
  const { t } = useTranslation()
  const [isRawDn, setIsRawDn] = useState(false)
  const [sanFilter, setSanFilter] = useState('')
  const [isExtOpen, setIsExtOpen] = useState(false)

  const subjectEntries = useMemo(() => parseDnEntries(cert.subject, t), [cert.subject, t])
  const issuerEntries = useMemo(() => parseDnEntries(cert.issuer, t), [cert.issuer, t])

  const sans = useMemo(() => cert.subjectAltNames ?? [], [cert.subjectAltNames])
  const normalizedFilter = sanFilter.toLowerCase().trim()
  const filteredSans = useMemo(
    () =>
      normalizedFilter ? sans.filter((s) => s.toLowerCase().includes(normalizedFilter)) : sans,
    [sans, normalizedFilter],
  )

  const copySerialLabel = t('app.tlsScanner.copySerialNumber', 'Copy Serial Number')
  const copyFpLabel = t('app.tlsScanner.copyFingerprint', 'Copy Full Fingerprint')
  const rawToggleLabel = isRawDn
    ? t('app.tlsScanner.structuredDn', 'View Structured')
    : t('app.tlsScanner.rawDn', 'View Raw')

  return (
    <>
      <div className={styles.paramsGrid}>
        <div className={styles.paramBox}>
          <div className={styles.paramLabel}>
            <Cpu size={12} className={styles.accentIcon} aria-hidden="true" />
            {t('app.tlsScanner.publicKey', 'Public Key')}
          </div>
          <div className={`mono ${styles.paramVal}`}>{formatKeyDescription(cert, t)}</div>
        </div>

        <div className={styles.paramBox}>
          <div className={styles.paramLabel}>
            <Shield size={12} className={styles.cyanIcon} aria-hidden="true" />
            {cert.ca
              ? t('app.tlsScanner.caClassification', 'CA Classification')
              : t('app.tlsScanner.keyPurpose', 'Key Purpose')}
          </div>
          <div className={styles.paramVal}>
            {cert.ca
              ? t(
                  'app.tlsScanner.caClassificationDesc',
                  'Certificate Authority (Issues Certificates)',
                )
              : t('app.tlsScanner.keyPurposeDesc', 'Server Authentication (TLS / SSL)')}
          </div>
        </div>

        <div className={styles.paramBox}>
          <div className={styles.paramLabel}>
            <Key size={12} className={styles.cyanIcon} aria-hidden="true" />
            {t('app.tlsScanner.serialNumber', 'Serial Number')}
          </div>
          <div className={`mono ${styles.paramVal} ${styles.paramValRow}`}>
            <span className={styles.ellipsisText}>{cert.serialNumber}</span>
            <button
              type="button"
              className={styles.inlineCopyBtn}
              onClick={() =>
                onCopyText(cert.serialNumber, t('app.tlsScanner.serialNumber', 'Serial Number'))
              }
              aria-label={copySerialLabel}
              title={copySerialLabel}
            >
              <Copy size={11} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={styles.paramBox}>
          <div className={styles.paramLabel}>
            <Sparkles size={12} className={styles.accentIcon} aria-hidden="true" />
            {t('app.tlsScanner.fingerprint256', 'SHA-256 Fingerprint')}
          </div>
          <div className={`mono ${styles.paramVal} ${styles.paramValRow}`}>
            <span className={styles.ellipsisText}>
              {cert.fingerprint256 ? `${cert.fingerprint256.slice(0, 23)}...` : 'N/A'}
            </span>
            {Boolean(cert.fingerprint256) && (
              <button
                type="button"
                className={styles.inlineCopyBtn}
                onClick={() =>
                  onCopyText(
                    cert.fingerprint256,
                    t('app.tlsScanner.fingerprint256', 'SHA-256 Fingerprint'),
                  )
                }
                aria-label={copyFpLabel}
                title={copyFpLabel}
              >
                <Copy size={11} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.dnStack}>
        <DnSection
          title={t('app.tlsScanner.subjectDn', 'Subject Distinguished Name')}
          entries={subjectEntries}
          rawValue={formatDn(cert.subject)}
          isRaw={isRawDn}
          rawToggleLabel={rawToggleLabel}
          onToggleRaw={() => setIsRawDn((prev) => !prev)}
        />
        <DnSection
          title={t('app.tlsScanner.issuerDn', 'Issuer Distinguished Name')}
          entries={issuerEntries}
          rawValue={formatDn(cert.issuer)}
          isRaw={isRawDn}
          rawToggleLabel={rawToggleLabel}
          onToggleRaw={() => setIsRawDn((prev) => !prev)}
        />
      </div>

      {sans.length > 0 && (
        <div className={styles.sectionDivider}>
          <div className={styles.sanHeader}>
            <span className={styles.sanTitle}>
              <Globe size={14} aria-hidden="true" />
              {t('app.tlsScanner.sanTitle', 'Subject Alternative Names (SANs)')} ({sans.length})
            </span>
            {sans.length > 6 && (
              <div className={styles.sanSearchWrap}>
                <Search size={12} className={styles.sanSearchIcon} aria-hidden="true" />
                <input
                  type="text"
                  className={styles.sanSearchInput}
                  placeholder={t('app.tlsScanner.searchSans', 'Filter SAN domains...')}
                  aria-label={t('app.tlsScanner.searchSans', 'Filter SAN domains...')}
                  value={sanFilter}
                  onChange={(e) => setSanFilter(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className={styles.sanList}>
            {filteredSans.map((san) => (
              <button
                key={san}
                type="button"
                className={styles.sanPillBtn}
                onClick={() => onCopyText(san, t('app.tlsScanner.domainSan', 'Domain SAN'))}
                title={t('app.tlsScanner.clickToCopyDomain', 'Click to copy domain')}
              >
                {san}
              </button>
            ))}
            {filteredSans.length === 0 && (
              <span className={styles.sanEmpty}>
                {t('app.tlsScanner.noSansMatch', 'No SAN domains matching search filter')}
              </span>
            )}
          </div>
        </div>
      )}

      {cert.extensions.length > 0 && (
        <div className={styles.sectionDivider}>
          <button
            type="button"
            className={styles.extToggleBtn}
            onClick={() => setIsExtOpen((prev) => !prev)}
            aria-expanded={isExtOpen}
          >
            {isExtOpen ? (
              <ChevronUp size={14} aria-hidden="true" />
            ) : (
              <ChevronDown size={14} aria-hidden="true" />
            )}
            <span>
              {t('app.tlsScanner.viewExtensions', 'View Extensions')} ({cert.extensions.length})
            </span>
          </button>

          {isExtOpen && (
            <div className={`details-grid ${styles.extGrid}`}>
              {cert.extensions.map((ext, extIdx) => (
                <div key={`${ext.oid}-${ext.name}-${extIdx}`} className={styles.extRow}>
                  <div className="details-label">{translateExtensionLabel(ext, t)}</div>
                  <div className="details-value">
                    <div className={styles.extOidRow}>
                      <span>
                        OID: <span className="mono">{ext.oid}</span>
                      </span>
                      {ext.critical && (
                        <span className="badge badge-danger">
                          {t('app.certDetails.critical', 'Critical')}
                        </span>
                      )}
                    </div>
                    {Boolean(ext.value) && (
                      <div className={`mono ${styles.extVal}`}>
                        {formatExtensionValue(ext.name, ext.oid, String(ext.value), t)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {Boolean(cert.pem) && isPemOpen && (
        <div className={styles.sectionDivider}>
          <div className={styles.pemHeader}>
            <span className={styles.pemTitle}>
              {t('app.tlsScanner.pemFormatTitle', 'X.509 Certificate (PEM Format)')}
            </span>
            <div className={styles.pemActions}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onCopyPem}>
                <Copy size={11} aria-hidden="true" />
                <span>{t('common.copy', 'Copy')}</span>
              </button>
              <button type="button" className="btn btn-download-pem btn-sm" onClick={onDownloadPem}>
                <Download size={11} aria-hidden="true" />
                <span>{t('common.download', 'Download')}</span>
              </button>
            </div>
          </div>
          <pre className={`code-block ${styles.pemCode}`}>{cert.pem}</pre>
        </div>
      )}
    </>
  )
})
