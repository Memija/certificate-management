import type React from 'react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, Upload, Zap } from 'lucide-react'

import { getCountryName, isValidCountryCode } from '@/data'
import type { CsrFieldErrors } from '@/types'

import type {
  CsrEditorSubjectValues,
  CsrExtKeyUsages,
  CsrKeyMode,
  CsrKeyUsages,
} from './csr-editor-helpers'

import styles from './CsrEditorModal.module.css'

export interface CsrEditorFormFieldsProps {
  subject: CsrEditorSubjectValues
  onSubjectChange: (field: keyof CsrEditorSubjectValues, value: string) => void
  sans: string
  onSansChange: (value: string) => void
  keyUsages: CsrKeyUsages
  onKeyUsageToggle: (usage: keyof CsrKeyUsages, checked: boolean) => void
  extKeyUsages: CsrExtKeyUsages
  onExtKeyUsageToggle: (usage: keyof CsrExtKeyUsages, checked: boolean) => void
  keyMode: CsrKeyMode
  onKeyModeChange: (mode: CsrKeyMode) => void
  keySize: number
  onKeySizeChange: (bits: number) => void
  existingKeyPem: string
  onExistingKeyChange: (pem: string) => void
  existingKeyValid: boolean | null
  existingKeyBits: number | undefined
  keyErrorDetail: string
  fieldErrors: CsrFieldErrors
}

interface EditorInputFieldProps {
  id: string
  label: string
  type?: 'text' | 'email'
  fullSpan?: boolean
  maxLength?: number
  value: string
  placeholder: string
  error?: string
  successText?: string
  onChange: (nextVal: string) => void
}

function EditorInputField({
  id,
  label,
  type = 'text',
  fullSpan = false,
  maxLength,
  value,
  placeholder,
  error,
  successText,
  onChange,
}: EditorInputFieldProps) {
  return (
    <div className={`form-group ${styles.fieldGroup} ${fullSpan ? styles.fullSpan : ''}`}>
      <label htmlFor={id} className={`form-label ${styles.compactLabel}`}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={`form-input ${error ? styles.inputError : ''}`}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {error && (
        <div className={styles.fieldError}>
          <AlertTriangle size={13} className={styles.shrinkZero} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {successText && (
        <div className={styles.fieldSuccess}>
          <CheckCircle size={13} className={styles.shrinkZero} aria-hidden="true" />
          <span>{successText}</span>
        </div>
      )}
    </div>
  )
}

const KEY_USAGE_KEYS: ReadonlyArray<keyof CsrKeyUsages> = [
  'digitalSignature',
  'keyEncipherment',
  'dataEncipherment',
  'keyAgreement',
  'keyCertSign',
  'cRLSign',
  'nonRepudiation',
]

const EXT_KEY_USAGE_KEYS: ReadonlyArray<keyof CsrExtKeyUsages> = [
  'serverAuth',
  'clientAuth',
  'codeSigning',
  'emailProtection',
  'timeStamping',
]

const KEY_USAGE_DEFAULTS: Record<keyof CsrKeyUsages, string> = {
  digitalSignature: 'Digital Signature',
  keyEncipherment: 'Key Encipherment',
  dataEncipherment: 'Data Encipherment',
  keyAgreement: 'Key Agreement',
  keyCertSign: 'Certificate Sign',
  cRLSign: 'CRL Sign',
  nonRepudiation: 'Non-Repudiation',
}

const EXT_KEY_USAGE_DEFAULTS: Record<keyof CsrExtKeyUsages, string> = {
  serverAuth: 'Server Authentication (TLS Web Server)',
  clientAuth: 'Client Authentication (mTLS)',
  codeSigning: 'Code Signing',
  emailProtection: 'Email Protection (S/MIME)',
  timeStamping: 'Time Stamping',
}

export function CsrEditorFormFields({
  subject,
  onSubjectChange,
  sans,
  onSansChange,
  keyUsages,
  onKeyUsageToggle,
  extKeyUsages,
  onExtKeyUsageToggle,
  keyMode,
  onKeyModeChange,
  keySize,
  onKeySizeChange,
  existingKeyPem,
  onExistingKeyChange,
  existingKeyValid,
  existingKeyBits,
  keyErrorDetail,
  fieldErrors,
}: CsrEditorFormFieldsProps) {
  const { t, i18n } = useTranslation()
  const keyFileInputRef = useRef<HTMLInputElement>(null)

  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = (evt) => {
      const content = evt.target?.result
      if (typeof content === 'string') {
        onExistingKeyChange(content)
      }
    }
    reader.onerror = () => {
      console.error('Failed to read uploaded private key file')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const trimmedCountry = subject.country.trim().toUpperCase()
  const validCountryName =
    !fieldErrors.country && isValidCountryCode(trimmedCountry)
      ? getCountryName(trimmedCountry, i18n.language)
      : undefined

  return (
    <div className={styles.formSections}>
      <div className={`glass-card ${styles.sectionCard}`}>
        <h3 className={styles.sectionTitle}>
          {t('app.csr.editor.subjectSection', 'Subject Information')}
        </h3>
        <div className={styles.subjectGrid}>
          <EditorInputField
            id="csr-editor-cn"
            label={`${t('app.csr.editor.commonName', 'Common Name (CN)')} *`}
            maxLength={64}
            value={subject.cn}
            placeholder={t('app.csr.editor.commonNamePlaceholder', 'e.g. example.com')}
            error={fieldErrors.cn}
            onChange={(val) => onSubjectChange('cn', val)}
          />
          <EditorInputField
            id="csr-editor-org"
            label={t('app.csr.editor.organization', 'Organization (O)')}
            maxLength={64}
            value={subject.org}
            placeholder={t('app.csr.editor.organizationPlaceholder', 'e.g. Acme Corp')}
            error={fieldErrors.org}
            onChange={(val) => onSubjectChange('org', val)}
          />
          <EditorInputField
            id="csr-editor-ou"
            label={t('app.csr.editor.organizationalUnit', 'Organizational Unit (OU)')}
            maxLength={64}
            value={subject.ou}
            placeholder={t('app.csr.editor.organizationalUnitPlaceholder', 'e.g. IT Security')}
            error={fieldErrors.ou}
            onChange={(val) => onSubjectChange('ou', val)}
          />
          <EditorInputField
            id="csr-editor-country"
            label={t('app.csr.editor.country', 'Country Code (C)')}
            maxLength={2}
            value={subject.country}
            placeholder={t('app.csr.editor.countryPlaceholder', 'e.g. US (2 letters)')}
            error={fieldErrors.country}
            successText={validCountryName}
            onChange={(val) => onSubjectChange('country', val.toUpperCase())}
          />
          <EditorInputField
            id="csr-editor-state"
            label={t('app.csr.editor.state', 'State / Province (ST)')}
            maxLength={128}
            value={subject.state}
            placeholder={t('app.csr.editor.statePlaceholder', 'e.g. California')}
            error={fieldErrors.state}
            onChange={(val) => onSubjectChange('state', val)}
          />
          <EditorInputField
            id="csr-editor-locality"
            label={t('app.csr.editor.locality', 'City / Locality (L)')}
            maxLength={128}
            value={subject.locality}
            placeholder={t('app.csr.editor.localityPlaceholder', 'e.g. San Francisco')}
            error={fieldErrors.locality}
            onChange={(val) => onSubjectChange('locality', val)}
          />
          <EditorInputField
            id="csr-editor-email"
            label={t('app.csr.editor.email', 'Email Address')}
            type="email"
            fullSpan
            value={subject.email}
            placeholder={t('app.csr.editor.emailPlaceholder', 'e.g. admin@example.com')}
            error={fieldErrors.email}
            onChange={(val) => onSubjectChange('email', val)}
          />
        </div>
      </div>

      <div className={`glass-card ${styles.sectionCard}`}>
        <h3 className={styles.sansHeading}>
          {t('app.csr.editor.sansSection', 'Subject Alternative Names (SANs)')}
        </h3>
        <p className={styles.sansHelp}>
          {t(
            'app.csr.editor.sansHelp',
            'Enter hostnames, domains, or IPs separated by commas or newlines.',
          )}
        </p>
        <textarea
          id="csr-editor-sans"
          aria-label={t('app.csr.editor.sansSection', 'Subject Alternative Names (SANs)')}
          className={`form-textarea ${fieldErrors.sans ? styles.inputError : ''}`}
          rows={2}
          value={sans}
          onChange={(e) => onSansChange(e.target.value)}
          placeholder={t(
            'app.csr.editor.sansPlaceholder',
            'e.g. example.com, *.example.com, 192.168.1.1',
          )}
        />
        {fieldErrors.sans && (
          <div className={styles.fieldError}>
            <AlertTriangle size={13} className={styles.shrinkZero} aria-hidden="true" />
            <span>{fieldErrors.sans}</span>
          </div>
        )}
        {extKeyUsages.serverAuth && !sans.trim() && (
          <div className={styles.warningBox}>
            <AlertTriangle size={15} className={styles.shrinkZero} aria-hidden="true" />
            <span>
              {t(
                'app.csr.editor.sanMissingWarning',
                'Warning: TLS Server Authentication is selected, but no Subject Alternative Names (SANs) are defined. Modern browsers (RFC 2818) ignore Common Name and will reject this certificate.',
              )}
            </span>
          </div>
        )}
      </div>

      <div className={styles.usageGrid}>
        <div className={`glass-card ${styles.sectionCard}`}>
          <h3 className={styles.sectionTitle}>
            {t('app.csr.editor.keyUsageSection', 'Key Usages')}
          </h3>
          <div className={styles.checkboxList}>
            {KEY_USAGE_KEYS.map((usageKey) => (
              <label key={usageKey} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={keyUsages[usageKey]}
                  onChange={(e) => onKeyUsageToggle(usageKey, e.target.checked)}
                />
                <span>{t(`app.csr.editor.usages.${usageKey}`, KEY_USAGE_DEFAULTS[usageKey])}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={`glass-card ${styles.sectionCard}`}>
          <h3 className={styles.sectionTitle}>
            {t('app.csr.editor.extKeyUsageSection', 'Extended Key Usages (EKU)')}
          </h3>
          <div className={styles.checkboxList}>
            {EXT_KEY_USAGE_KEYS.map((ekuKey) => (
              <label key={ekuKey} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={extKeyUsages[ekuKey]}
                  onChange={(e) => onExtKeyUsageToggle(ekuKey, e.target.checked)}
                />
                <span>{t(`app.csr.editor.usages.${ekuKey}`, EXT_KEY_USAGE_DEFAULTS[ekuKey])}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={`glass-card ${styles.sectionCard}`}>
        <h3 className={styles.sectionTitle}>
          {t('app.csr.editor.signingKeySection', 'Signing Key & Cryptography')}
        </h3>

        <div className={styles.radioGroup}>
          <label
            className={`${styles.radioLabel} ${keyMode === 'generate' ? styles.radioLabelActive : ''}`}
          >
            <input
              type="radio"
              name="csrKeyMode"
              checked={keyMode === 'generate'}
              onChange={() => onKeyModeChange('generate')}
            />
            <span>{t('app.csr.editor.keyOptionGenerate', 'Generate New Key Pair')}</span>
          </label>
          <label
            className={`${styles.radioLabel} ${keyMode === 'existing' ? styles.radioLabelActive : ''}`}
          >
            <input
              type="radio"
              name="csrKeyMode"
              checked={keyMode === 'existing'}
              onChange={() => onKeyModeChange('existing')}
            />
            <span>{t('app.csr.editor.keyOptionExisting', 'Provide Existing Private Key')}</span>
          </label>
        </div>

        {keyMode === 'generate' ? (
          <div className={styles.generateKeyRow}>
            <div className={styles.keySizeField}>
              <label htmlFor="csr-editor-key-size" className={`form-label ${styles.compactLabel}`}>
                {t('app.csr.editor.keySizeLabel', 'Key Size')}
              </label>
              <select
                id="csr-editor-key-size"
                className="form-select"
                value={keySize}
                onChange={(e) => onKeySizeChange(Number(e.target.value))}
              >
                <option value={2048}>
                  {t('app.csr.editor.keySize2048', '2048-bit (Standard)')}
                </option>
                <option value={3072}>
                  {t('app.csr.editor.keySize3072', '3072-bit (Enhanced)')}
                </option>
                <option value={4096}>
                  {t('app.csr.editor.keySize4096', '4096-bit (High Security)')}
                </option>
              </select>
            </div>
            <div className={styles.keyNotice}>
              <Zap size={14} className={styles.noticeIcon} aria-hidden="true" />
              <span>
                {t(
                  'app.csr.editor.keyDownloadNotice',
                  'A new private key will be generated. You can download your .key file after signing.',
                )}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <div className={styles.pasteKeyHeader}>
              <label
                htmlFor="csr-editor-existing-key"
                className={`form-label ${styles.compactLabel}`}
              >
                {t('app.csr.editor.pasteKeyLabel', 'Paste Private Key (PEM format)')}
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => keyFileInputRef.current?.click()}
              >
                <Upload size={12} aria-hidden="true" />
                <span>{t('app.csr.editor.uploadKeyBtn', 'Upload .key / .pem')}</span>
              </button>
              <input
                ref={keyFileInputRef}
                type="file"
                accept=".key,.pem,.txt"
                aria-label={t('app.csr.editor.uploadKeyBtn', 'Upload .key / .pem')}
                className={styles.hiddenFileInput}
                onChange={handleKeyFileUpload}
              />
            </div>
            <textarea
              id="csr-editor-existing-key"
              className={`form-textarea mono ${styles.keyTextarea}`}
              rows={4}
              value={existingKeyPem}
              onChange={(e) => onExistingKeyChange(e.target.value)}
              placeholder={t(
                'app.csr.editor.pasteKeyPlaceholder',
                '-----BEGIN RSA PRIVATE KEY-----\n...',
              )}
            />
            {existingKeyValid === true && (
              <div className={styles.fieldSuccess}>
                <CheckCircle size={14} className={styles.shrinkZero} aria-hidden="true" />
                <span>
                  {existingKeyBits
                    ? t('app.csr.editor.keyValidWithBits', {
                        bits: existingKeyBits,
                        defaultValue: `Valid ${existingKeyBits}-bit RSA private key loaded`,
                      })
                    : t('app.csr.editor.keyValid', 'Valid private key loaded')}
                </span>
              </div>
            )}
            {existingKeyValid === false && (
              <div className={styles.fieldError}>
                <AlertTriangle size={14} className={styles.shrinkZero} aria-hidden="true" />
                <span>
                  {keyErrorDetail || t('app.csr.editor.keyInvalid', 'Invalid private key format')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
