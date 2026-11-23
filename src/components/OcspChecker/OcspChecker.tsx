import type React from 'react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  Calendar,
  CheckCircle2,
  FileText,
  Globe,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'

import { ModuleHeader } from '@/components/shared'
import { OCSP_SAMPLE_PRESETS } from '@/data/ocsp-samples'
import { useAppStore } from '@/store'
import type { AppMode, OcspRevocationResult, OcspSamplePreset } from '@/types'
import { fetchLocalApiJson, WebApiUnavailableError } from '@/utils/api-client'

import {
  detectNonCertInputType,
  parseOcspCertInput,
  parseUploadedOcspFileBytes,
  validateOcspFileExtension,
  validateOcspPemBeforeCheck,
} from './ocsp-helpers'
import { OcspPresetsSection } from './OcspPresetsSection'
import { OcspResultPanel } from './OcspResultPanel'

import styles from './OcspChecker.module.css'

export interface OcspCheckerProps {
  onNavigate?: (mode: AppMode) => void
}

export function OcspChecker({ onNavigate }: OcspCheckerProps = {}) {
  const { t, i18n } = useTranslation()
  const storeSetMode = useAppStore((s) => s.setMode)
  const navigate = onNavigate ?? storeSetMode

  const [certInput, setCertInput] = useState('')
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<OcspRevocationResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activePreset = useMemo(
    () => OCSP_SAMPLE_PRESETS.find((p) => p.id === activePresetId) ?? null,
    [activePresetId],
  )
  const detectedNonCertType = useMemo(() => detectNonCertInputType(certInput), [certInput])
  const parsedCert = useMemo(
    () => parseOcspCertInput(certInput, activePreset, t),
    [certInput, activePreset, t],
  )

  const handleSelectPreset = (preset: OcspSamplePreset): void => {
    setActivePresetId(preset.id)
    setCertInput(preset.certificatePem)
    setError('')
    setResult(null)
  }

  const handleClear = (): void => {
    setCertInput('')
    setActivePresetId(null)
    setError('')
    setResult(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    setActivePresetId(null)
    setError('')
    setResult(null)

    try {
      const extError = validateOcspFileExtension(file.name, t)
      if (extError) {
        setError(extError)
        return
      }
      const buffer = await file.arrayBuffer()
      const parsed = parseUploadedOcspFileBytes(new Uint8Array(buffer), t)
      if (parsed.error) {
        setError(parsed.error)
      } else if (parsed.pem) {
        setCertInput(parsed.pem)
      }
    } catch (err) {
      console.error('Failed to read uploaded OCSP certificate file:', err)
      setError(
        t('app.ocsp.invalidFile', 'Could not parse uploaded file as PEM or DER X.509 certificate.'),
      )
    } finally {
      e.target.value = ''
    }
  }

  const checkRevocation = async (overrideCert?: string): Promise<void> => {
    const input = overrideCert ?? certInput
    const validation = validateOcspPemBeforeCheck(input, t)
    if (validation.error || !validation.certB64) {
      setError(
        validation.error ||
          t(
            'app.ocsp.invalidPem',
            'Invalid PEM certificate provided. Please check the certificate formatting.',
          ),
      )
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      try {
        const json = await fetchLocalApiJson<{ data: OcspRevocationResult }>('/api/ocsp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ certB64: validation.certB64 }),
        })
        setResult(json.data)
      } catch (apiErr: unknown) {
        if (apiErr instanceof WebApiUnavailableError) {
          const { verifyOcspClientSide } = await import('@/utils/web-fallbacks/ocsp-ct-fallback')
          const certMeta = overrideCert
            ? parseOcspCertInput(overrideCert, activePreset, t)
            : parsedCert
          setResult(verifyOcspClientSide(input.trim(), certMeta, activePresetId))
        } else {
          throw apiErr
        }
      }
    } catch (err: unknown) {
      console.error('OCSP revocation check failed:', err)
      const msg =
        err instanceof Error && err.message
          ? err.message
          : t('app.ocsp.checkFailed', 'Failed to check revocation status')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const uploadLabel = t('app.ocsp.uploadBtn', 'Upload .pem / .cer / .crt / .der')

  return (
    <div className={styles.container}>
      <ModuleHeader
        category="networkStatus"
        icon={<ShieldAlert size={26} />}
        eyebrowIcon={<Activity size={14} />}
        eyebrowText={t('app.ocsp.eyebrow', 'Real-Time Revocation · RFC 6960 & RFC 5280')}
        title={t('app.ocsp.title', 'Online Revocation Checker')}
        description={t(
          'app.ocsp.subtitle',
          'Check real-time revocation status using OCSP and CRL endpoints extracted directly from the certificate.',
        )}
      />

      <OcspPresetsSection
        activePreset={activePreset}
        hasInput={Boolean(certInput || activePresetId)}
        loading={loading}
        hasResult={Boolean(result)}
        onSelectPreset={handleSelectPreset}
        onClear={handleClear}
        onVerifyActivePreset={(pem) => void checkRevocation(pem)}
      />

      <div className={`glass-panel ${styles.inputPanel}`}>
        <div className={styles.inputHeader}>
          <label htmlFor="ocsp-cert-textarea" className="form-label">
            {t('app.ocsp.inputLabel', 'Certificate (PEM / DER)')}
          </label>
          <div className={styles.inputActions}>
            {Boolean(certInput) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClear}
                title={t('common.clear', 'Clear')}
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>{t('common.clear', 'Clear')}</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={14} aria-hidden="true" />
              <span>{uploadLabel}</span>
            </button>
            <input
              ref={fileInputRef}
              id="ocsp-file-upload"
              type="file"
              accept=".cer,.crt,.pem,.der"
              className={styles.hiddenFileInput}
              aria-label={uploadLabel}
              tabIndex={-1}
              onChange={(e) => void handleFileUpload(e)}
            />
          </div>
        </div>

        <div className="form-group">
          <textarea
            id="ocsp-cert-textarea"
            className={`form-textarea mono ${styles.certTextarea}`}
            value={certInput}
            onChange={(e) => {
              setCertInput(e.target.value)
              setActivePresetId(null)
              setError('')
              setResult(null)
            }}
            placeholder={t(
              'app.ocsp.placeholder',
              '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
            )}
            spellCheck={false}
          />
        </div>

        {detectedNonCertType && (
          <div className={`animate-fade-in ${styles.nonCertAlert}`} role="status">
            <div className={styles.nonCertBody}>
              <ShieldAlert size={20} className={styles.warningIcon} aria-hidden="true" />
              <div>
                <div className={styles.nonCertTitle}>
                  {detectedNonCertType === 'csr' &&
                    t('app.ocsp.csrDetectedTitle', 'Certificate Signing Request (CSR) Detected')}
                  {detectedNonCertType === 'key' &&
                    t('app.ocsp.keyDetectedTitle', 'Private Key Detected')}
                  {detectedNonCertType === 'crl' &&
                    t('app.ocsp.crlDetectedTitle', 'Certificate Revocation List (CRL) Detected')}
                </div>
                <div className={styles.nonCertDesc}>
                  {detectedNonCertType === 'csr' &&
                    t(
                      'app.ocsp.csrNotCert',
                      'The provided data is a Certificate Signing Request (CSR), not an issued X.509 certificate.',
                    )}
                  {detectedNonCertType === 'key' &&
                    t(
                      'app.ocsp.keyNotCert',
                      'The provided data is a Private Key, not an X.509 certificate.',
                    )}
                  {detectedNonCertType === 'crl' &&
                    t(
                      'app.ocsp.crlNotCert',
                      'The provided data is a Certificate Revocation List (CRL), not an X.509 certificate.',
                    )}
                </div>
              </div>
            </div>

            {(detectedNonCertType === 'csr' || detectedNonCertType === 'crl') && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  navigate(detectedNonCertType === 'csr' ? 'csr-inspector' : 'crl-inspector')
                }
              >
                {detectedNonCertType === 'csr'
                  ? t('app.ocsp.goToCsrInspector', 'Open in CSR Inspector')
                  : t('app.ocsp.goToCrlInspector', 'Open in CRL Inspector')}
              </button>
            )}
          </div>
        )}

        {parsedCert && (
          <div className={`animate-fade-in ${styles.parsedPreview}`}>
            <div className={styles.parsedGrid}>
              <div>
                <div className={styles.parsedLabel}>{t('app.ocsp.subjectLabel', 'Subject')}</div>
                <div className={styles.parsedValue}>{parsedCert.subject}</div>
              </div>

              <div>
                <div className={styles.parsedLabel}>{t('app.ocsp.issuerLabel', 'Issuer')}</div>
                <div className={styles.parsedValue}>{parsedCert.issuer}</div>
              </div>

              <div>
                <div className={styles.parsedLabel}>
                  {t('app.ocsp.validityPeriod', 'Validity Period')}
                </div>
                <div className={styles.validityRow}>
                  <Calendar size={13} className={styles.mutedIcon} aria-hidden="true" />
                  <span>
                    {parsedCert.notBefore.toLocaleDateString(i18n.language)} –{' '}
                    {parsedCert.notAfter.toLocaleDateString(i18n.language)}
                  </span>
                  {parsedCert.isExpired ? (
                    <span className="badge badge-danger">
                      {t('app.ocsp.expiredBadge', 'Expired')}
                    </span>
                  ) : (
                    <span className="badge badge-success">
                      {t('app.ocsp.validWindowBadge', 'Valid Window')}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className={styles.parsedLabel}>
                  {t('app.ocsp.serialNumber', 'Serial Number')}
                </div>
                <div className={`mono ${styles.parsedValue}`}>{parsedCert.serialNumber}</div>
              </div>
            </div>

            <div className={styles.parsedEndpoints}>
              <div className={styles.endpointItem}>
                <Globe
                  size={13}
                  className={parsedCert.ocspUrl ? styles.accentIcon : styles.mutedIcon}
                  aria-hidden="true"
                />
                <span>
                  <strong className={styles.endpointLabel}>
                    {t('app.ocsp.aiaOcspLabel', 'AIA OCSP:')}
                  </strong>
                  {parsedCert.ocspUrl ? (
                    <code className={styles.endpointUrl}>{parsedCert.ocspUrl}</code>
                  ) : (
                    <span className={styles.italicMuted}>{t('app.ocsp.none', 'None')}</span>
                  )}
                </span>
              </div>

              <div className={styles.endpointItem}>
                <FileText
                  size={13}
                  className={parsedCert.crlUrl ? styles.warningIcon : styles.mutedIcon}
                  aria-hidden="true"
                />
                <span>
                  <strong className={styles.endpointLabel}>
                    {t('app.ocsp.cdpCrlLabel', 'CDP CRL:')}
                  </strong>
                  {parsedCert.crlUrl ? (
                    <code className={styles.endpointUrl}>{parsedCert.crlUrl}</code>
                  ) : (
                    <span className={styles.italicMuted}>{t('app.ocsp.none', 'None')}</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          className={`btn btn-primary ${styles.checkSubmitBtn}`}
          onClick={() => void checkRevocation()}
          disabled={loading || !certInput.trim() || Boolean(detectedNonCertType) || Boolean(result)}
          title={
            result
              ? t(
                  'app.ocsp.alreadyCheckedTooltip',
                  'Revocation status is already displayed on the page. Modify certificate or clear to check again.',
                )
              : undefined
          }
        >
          {loading ? (
            <RefreshCw size={18} className="spin" aria-hidden="true" />
          ) : result ? (
            <CheckCircle2 size={18} aria-hidden="true" />
          ) : (
            <Activity size={18} aria-hidden="true" />
          )}
          <span>
            {loading
              ? t('app.ocsp.checkingBtn', 'Checking Revocation Status Online...')
              : result
                ? t('app.ocsp.alreadyCheckedBtn', 'Revocation Status Displayed Below')
                : t('app.ocsp.checkBtn', 'Check Revocation Status')}
          </span>
        </button>
      </div>

      {Boolean(error) && (
        <div role="alert" className={`glass-panel animate-fade-in ${styles.errorAlert}`}>
          <XCircle size={20} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <OcspResultPanel
          result={result}
          activePreset={activePreset}
          onClearResult={() => setResult(null)}
        />
      )}
    </div>
  )
}
