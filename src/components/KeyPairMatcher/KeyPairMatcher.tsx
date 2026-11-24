import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, FileKey, Hash, Key, Shield, Sparkles, Trash2, XCircle } from 'lucide-react'

import { ModuleHeader } from '@/components/shared'
import { KEY_MATCHER_PRESETS } from '@/data/key-matcher-samples'
import { useAppStore } from '@/store'
import type {
  AppMode,
  KeyMatcherSamplePreset,
  PrivateKeyModulusInfo,
  PublicKeyModulusInfo,
} from '@/types'
import { extractCertOrCsrModulus, extractPrivateKeyModulus } from '@/utils/key-matcher'

import styles from './KeyPairMatcher.module.css'

export interface KeyPairMatcherProps {
  onNavigate?: (mode: AppMode) => void
}

export function KeyPairMatcher({ onNavigate }: KeyPairMatcherProps = {}) {
  const { t } = useTranslation()
  const storeSetMode = useAppStore((s) => s.setMode)
  void (onNavigate ?? storeSetMode)

  const [certInput, setCertInput] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const [certStatus, setCertStatus] = useState<string | null>(null)
  const [certIsError, setCertIsError] = useState(false)
  const [keyStatus, setKeyStatus] = useState<string | null>(null)
  const [keyIsError, setKeyIsError] = useState(false)
  const [certInfo, setCertInfo] = useState<PublicKeyModulusInfo | null>(null)
  const [keyInfo, setKeyInfo] = useState<PrivateKeyModulusInfo | null>(null)
  const [matchResult, setMatchResult] = useState<boolean | null>(null)

  const formatErrorMessage = (rawMsg?: string): string => {
    const msg = rawMsg ?? ''
    if (msg.includes('No RSA public key found in CSR')) {
      return t('app.keyMatcher.noRsaInCsr', 'No RSA public key found in CSR.')
    }
    if (msg.includes('No RSA public key found in Certificate')) {
      return t('app.keyMatcher.noRsaInCert', 'No RSA public key found in Certificate.')
    }
    if (msg.includes('Only RSA keys are currently supported for matching')) {
      return t(
        'app.keyMatcher.rsaOnlySupported',
        'Only RSA keys are currently supported for matching.',
      )
    }
    if (
      !msg ||
      msg.includes('Invalid PEM formatted message') ||
      msg.includes('empty') ||
      msg.includes('header') ||
      msg.includes('base64') ||
      msg.includes('ASN.1') ||
      msg.includes('DER') ||
      msg.includes('Cannot read')
    ) {
      return t('app.keyMatcher.invalidPem', 'Invalid PEM formatted message.')
    }
    return msg
  }

  const executeMatch = (certText: string, keyText: string): void => {
    setCertStatus(null)
    setCertIsError(false)
    setKeyStatus(null)
    setKeyIsError(false)
    setCertInfo(null)
    setKeyInfo(null)
    setMatchResult(null)

    let parsedCert: PublicKeyModulusInfo
    try {
      parsedCert = extractCertOrCsrModulus(certText)
      setCertInfo(parsedCert)
      setCertIsError(false)
      setCertStatus(
        parsedCert.type === 'CSR'
          ? t('app.keyMatcher.validCsrParsed', {
              bits: parsedCert.bits,
              defaultValue: `Valid CSR parsed (RSA ${parsedCert.bits} bits).`,
            })
          : t('app.keyMatcher.validCertParsed', {
              bits: parsedCert.bits,
              defaultValue: `Valid Certificate parsed (RSA ${parsedCert.bits} bits).`,
            }),
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setCertIsError(true)
      setCertStatus(`${t('common.error', 'Error')}: ${formatErrorMessage(msg)}`)
      return
    }

    let parsedKey: PrivateKeyModulusInfo
    try {
      parsedKey = extractPrivateKeyModulus(keyText)
      setKeyInfo(parsedKey)
      setKeyIsError(false)
      setKeyStatus(
        t('app.keyMatcher.validKeyParsed', {
          bits: parsedKey.bits,
          defaultValue: `Valid RSA Private Key parsed (${parsedKey.bits} bits).`,
        }),
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setKeyIsError(true)
      setKeyStatus(`${t('common.error', 'Error')}: ${formatErrorMessage(msg)}`)
      return
    }

    setMatchResult(parsedCert.modulus === parsedKey.modulus)
  }

  const handleMatch = (): void => {
    executeMatch(certInput, keyInput)
  }

  const loadPreset = (preset: KeyMatcherSamplePreset): void => {
    setActivePreset(preset.id)
    setCertInput(preset.certOrCsr)
    setKeyInput(preset.privateKey)
    executeMatch(preset.certOrCsr, preset.privateKey)
  }

  const handleClear = (): void => {
    setActivePreset(null)
    setCertInput('')
    setKeyInput('')
    setCertStatus(null)
    setCertIsError(false)
    setKeyStatus(null)
    setKeyIsError(false)
    setCertInfo(null)
    setKeyInfo(null)
    setMatchResult(null)
  }

  const certHeadingLabel = t('app.keyMatcher.certOrCsr', 'Certificate or CSR (PEM)')
  const keyHeadingLabel = t('app.keyMatcher.privateKey', 'Private Key (PEM)')
  const hasAnyInput = Boolean(certInput || keyInput)

  return (
    <div className={styles.container}>
      <ModuleHeader
        category="keyManagement"
        icon={<Key size={24} />}
        eyebrowIcon={<FileKey size={13} />}
        eyebrowText={t('app.categories.keyManagement', 'Key Management')}
        title={t('app.keyMatcher.title', 'Key Pair Modulus Matcher')}
        description={t(
          'app.keyMatcher.subtitle',
          'Paste a Certificate (or CSR) and a Private Key in PEM format to mathematically verify if their RSA public key moduli match.',
        )}
      />

      <div className={`glass-panel ${styles.presetsPanel}`}>
        <div className={styles.presetsHeader}>
          <div className={styles.presetsTitle}>
            <Sparkles size={15} className={styles.iconAccent} aria-hidden="true" />
            <span>{t('app.keyMatcher.tryExamples', 'Try Test Examples:')}</span>
          </div>

          {hasAnyInput && (
            <button
              type="button"
              className={`${styles.clearBtn} ${styles.clearMobile}`}
              onClick={handleClear}
              title={t('app.keyMatcher.clearInputs', 'Clear both inputs')}
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>{t('common.clear', 'Clear')}</span>
            </button>
          )}
        </div>

        <div className={styles.presetsList}>
          {KEY_MATCHER_PRESETS.map((preset) => {
            const isActive = activePreset === preset.id
            const presetName = t(`app.keyMatcher.presets.${preset.id}.name`, preset.name)
            const presetDesc = t(`app.keyMatcher.presets.${preset.id}.desc`, preset.description)
            const presetBadge = preset.badge
              ? t(`app.keyMatcher.presets.${preset.id}.badge`, preset.badge)
              : undefined
            return (
              <button
                key={preset.id}
                type="button"
                className={`${styles.presetPill} ${isActive ? styles.presetPillActive : ''}`}
                onClick={() => loadPreset(preset)}
                title={presetDesc}
                aria-pressed={isActive}
              >
                <span className={styles.presetName}>{presetName}</span>
                {presetBadge && (
                  <span
                    className={`${styles.presetBadge} ${
                      preset.expectedMatch ? styles.presetBadgeSuccess : styles.presetBadgeDanger
                    }`}
                  >
                    {presetBadge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {hasAnyInput && (
          <button
            type="button"
            className={`${styles.clearBtn} ${styles.clearDesktop}`}
            onClick={handleClear}
            title={t('app.keyMatcher.clearInputs', 'Clear both inputs')}
          >
            <Trash2 size={13} aria-hidden="true" />
            <span>{t('common.clear', 'Clear')}</span>
          </button>
        )}
      </div>

      <div className={styles.inputGrid}>
        <div className="glass-panel">
          <div className={styles.inputCardHeader}>
            <h2 className={styles.inputHeading}>
              <Shield size={18} className={styles.iconAccent} aria-hidden="true" />
              <span>{certHeadingLabel}</span>
            </h2>
            {certInfo && <span className="badge badge-info">RSA {certInfo.bits}-bit</span>}
          </div>

          <textarea
            id="key-matcher-cert-input"
            aria-label={certHeadingLabel}
            className={`form-textarea mono ${styles.pemTextarea}`}
            value={certInput}
            onChange={(e) => {
              setCertInput(e.target.value)
              setActivePreset(null)
            }}
            placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
          />
          {certStatus && (
            <div
              className={`${styles.statusMessage} ${certIsError ? styles.statusError : styles.statusSuccess}`}
              role={certIsError ? 'alert' : undefined}
            >
              {certStatus}
            </div>
          )}
          {certInfo && (
            <div className={`mono ${styles.hashBox}`}>
              <div className={styles.hashTitle}>
                <Hash size={12} aria-hidden="true" />
                <span>{t('app.keyMatcher.modulusSha256', 'Modulus SHA-256:')}</span>
              </div>
              <div className={styles.hashValue}>{certInfo.sha256}</div>
            </div>
          )}
        </div>

        <div className="glass-panel">
          <div className={styles.inputCardHeader}>
            <h2 className={styles.inputHeading}>
              <FileKey size={18} className={styles.iconWarning} aria-hidden="true" />
              <span>{keyHeadingLabel}</span>
            </h2>
            {keyInfo && <span className="badge badge-warning">RSA {keyInfo.bits}-bit</span>}
          </div>

          <textarea
            id="key-matcher-key-input"
            aria-label={keyHeadingLabel}
            className={`form-textarea mono ${styles.pemTextarea}`}
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value)
              setActivePreset(null)
            }}
            placeholder={'-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
          />
          {keyStatus && (
            <div
              className={`${styles.statusMessage} ${keyIsError ? styles.statusError : styles.statusSuccess}`}
              role={keyIsError ? 'alert' : undefined}
            >
              {keyStatus}
            </div>
          )}
          {keyInfo && (
            <div className={`mono ${styles.hashBox}`}>
              <div className={styles.hashTitle}>
                <Hash size={12} aria-hidden="true" />
                <span>{t('app.keyMatcher.modulusSha256', 'Modulus SHA-256:')}</span>
              </div>
              <div className={styles.hashValue}>{keyInfo.sha256}</div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.verifyRow}>
        <button
          type="button"
          className={`btn ${styles.verifyBtn}`}
          onClick={handleMatch}
          disabled={!certInput || !keyInput}
        >
          <Key size={18} aria-hidden="true" />
          <span>{t('app.keyMatcher.verifyMatch', 'Verify Modulus Match')}</span>
        </button>
      </div>

      {matchResult !== null && (
        <div
          className={`glass-panel animate-fade-in ${styles.verdictPanel} ${
            matchResult ? styles.verdictMatched : styles.verdictMismatched
          }`}
          role="status"
        >
          <div
            className={`metric-icon-wrap ${matchResult ? 'success' : 'danger'} ${styles.verdictIconWrap}`}
            aria-hidden="true"
          >
            {matchResult ? <CheckCircle size={32} /> : <XCircle size={32} />}
          </div>
          <h2
            className={`${styles.verdictHeading} ${
              matchResult ? styles.verdictHeadingSuccess : styles.verdictHeadingDanger
            }`}
          >
            {matchResult
              ? t('app.keyMatcher.matchSuccess', 'The Private Key matches the Certificate/CSR!')
              : t(
                  'app.keyMatcher.matchFailed',
                  'The Private Key does not match the Certificate/CSR.',
                )}
          </h2>
          <p className={styles.verdictDesc}>
            {matchResult
              ? t(
                  'app.keyMatcher.matchSuccessDesc',
                  'Both the public key modulus in the certificate/CSR and the private key modulus match bit-for-bit.',
                )
              : t(
                  'app.keyMatcher.matchFailedDesc',
                  'The cryptographic modulus differs. This private key cannot be used with this certificate.',
                )}
          </p>

          {certInfo && keyInfo && (
            <div className={styles.comparisonCard}>
              <h3 className={styles.comparisonHeading}>
                {t('app.keyMatcher.comparisonTitle', 'Cryptographic Modulus Comparison')}
              </h3>
              <div className={`mono ${styles.comparisonGrid}`}>
                <span className={styles.comparisonLabel}>
                  {t('app.keyMatcher.certHash', 'Cert/CSR Hash:')}
                </span>
                <span
                  className={
                    matchResult ? styles.verdictHeadingSuccess : styles.verdictHeadingDanger
                  }
                >
                  {certInfo.sha256}
                </span>
                <span className={styles.comparisonLabel}>
                  {t('app.keyMatcher.keyHash', 'Private Key Hash:')}
                </span>
                <span
                  className={
                    matchResult ? styles.verdictHeadingSuccess : styles.verdictHeadingDanger
                  }
                >
                  {keyInfo.sha256}
                </span>
                <span className={styles.comparisonLabel}>
                  {t('app.keyMatcher.bitLength', 'Bit Length:')}
                </span>
                <span className={styles.comparisonValue}>
                  {certInfo.bits} bits (Cert) vs {keyInfo.bits} bits (Key)
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
