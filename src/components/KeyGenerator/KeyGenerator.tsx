import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, FileKey, RefreshCw, Zap } from 'lucide-react'

import { ModuleHeader, useToast } from '@/components/shared'
import { getCountryName, isValidCountryCode } from '@/data/country-codes'
import { useAppStore } from '@/store'
import type { AppMode } from '@/types'
import {
  isOnlyPlaceholderSubject,
  isPlaceholderValue,
  PLACEHOLDER_CN_LIST,
  validateCsr,
} from '@/utils/csr-validation'

import { generateKeyPairAndOutput, type KeyGeneratorOutputType } from './key-generator-helpers'
import { KeyGeneratorOutputPanel } from './KeyGeneratorOutputPanel'

import styles from './KeyGenerator.module.css'

export interface KeyGeneratorProps {
  onNavigate?: (mode: AppMode) => void
}

interface SubjectTextFieldProps {
  id: string
  label: string
  required?: boolean
  alignedLabel?: boolean
  value: string
  maxLength: number
  placeholder: string
  placeholderWarning?: string
  limitReachedMessage: string
  onChange: (nextValue: string) => void
}

function SubjectTextField({
  id,
  label,
  required = false,
  alignedLabel = false,
  value,
  maxLength,
  placeholder,
  placeholderWarning,
  limitReachedMessage,
  onChange,
}: SubjectTextFieldProps) {
  const isLimitReached = value.length >= maxLength
  const hasInvalidVisual = isLimitReached || Boolean(placeholderWarning)

  return (
    <div className={`form-group ${styles.fieldGroup}`}>
      <label htmlFor={id} className={`form-label ${alignedLabel ? styles.alignedLabel : ''}`}>
        <span>{label}</span>
        {required && <span className={styles.requiredStar}>*</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={`form-input ${hasInvalidVisual ? styles.inputInvalid : ''}`}
        placeholder={placeholder}
      />
      {placeholderWarning && (
        <div className={styles.feedbackDanger}>
          <AlertTriangle size={14} className={styles.shrinkZero} aria-hidden="true" />
          <span>{placeholderWarning}</span>
        </div>
      )}
      {isLimitReached && (
        <div className={styles.feedbackDanger}>
          <AlertTriangle size={14} className={styles.shrinkZero} aria-hidden="true" />
          <span>{limitReachedMessage}</span>
        </div>
      )}
    </div>
  )
}

function isCnPlaceholder(val: string): boolean {
  const clean = val.trim().toLowerCase()
  return clean.length > 0 && PLACEHOLDER_CN_LIST.includes(clean)
}

export function KeyGenerator({ onNavigate }: KeyGeneratorProps = {}) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const storeSetMode = useAppStore((s) => s.setMode)
  void (onNavigate ?? storeSetMode)

  const [cn, setCn] = useState('')
  const [org, setOrg] = useState('')
  const [ou, setOu] = useState('')
  const [locality, setLocality] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [keySize, setKeySize] = useState(2048)
  const [outputType, setOutputType] = useState<KeyGeneratorOutputType>('csr')

  const [generating, setGenerating] = useState(false)
  const [generatedKey, setGeneratedKey] = useState('')
  const [generatedOutput, setGeneratedOutput] = useState('')
  const [error, setError] = useState('')

  const clearErrorAndSet =
    (setter: (val: string) => void) =>
    (nextVal: string): void => {
      setter(nextVal)
      if (error) {
        setError('')
      }
    }

  const handleGenerate = (): void => {
    setError('')

    const valResult = validateCsr(
      { cn, country, state, locality, org, ou },
      { requireCn: true, checkPlaceholders: true, t },
    )

    if (!valResult.isValid) {
      const msg = valResult.errors.country
        ? valResult.errors.country
        : !cn.trim()
          ? t('app.keyGenerator.cnRequired', 'Common Name (CN) is required.')
          : valResult.errors.cn ||
            valResult.errors.org ||
            valResult.errors.ou ||
            valResult.errors.state ||
            valResult.errors.locality ||
            valResult.errors.general ||
            Object.values(valResult.errors)[0] ||
            t('common.error', 'Invalid inputs.')
      setError(msg)
      showToast(msg, 'error')
      return
    }

    setGenerating(true)

    void (async () => {
      try {
        const bundle = await generateKeyPairAndOutput(
          { cn, org, ou, locality, state, country },
          keySize,
          outputType,
        )
        setGeneratedKey(bundle.privateKeyPem)
        setGeneratedOutput(bundle.outputPem)
        showToast(
          outputType === 'csr'
            ? t('app.keyGenerator.successToastCsr', 'Generated RSA Key Pair & CSR')
            : t('app.keyGenerator.successToastCert', 'Generated RSA Key Pair & Certificate'),
          'success',
        )
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('Key generation failed:', err)
        const failMsg = t('app.keyGenerator.failedToGenerate', {
          error: errMsg,
          defaultValue: `Failed to generate: ${errMsg}`,
        })
        const toastFailMsg = t('app.keyGenerator.generationFailedToast', {
          error: errMsg,
          defaultValue: `Generation failed: ${errMsg}`,
        })
        setError(failMsg)
        showToast(toastFailMsg, 'error')
      } finally {
        setGenerating(false)
      }
    })()
  }

  const safeName = cn.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'certificate'
  const hasCnPlaceholder = isCnPlaceholder(cn)
  const hasLocPlaceholder = isPlaceholderValue('locality', locality)
  const hasOrgPlaceholder = isPlaceholderValue('org', org)
  const hasOuPlaceholder = isPlaceholderValue('ou', ou)
  const hasStatePlaceholder = isPlaceholderValue('state', state)
  const isInvalidSetup = isOnlyPlaceholderSubject({ cn, org, ou, locality, state })

  const trimmedCountry = country.trim().toUpperCase()
  const hasCountryValue = trimmedCountry.length > 0
  const isCountryValid = hasCountryValue && isValidCountryCode(trimmedCountry)
  const countryName = hasCountryValue ? getCountryName(trimmedCountry, i18n.language) : undefined
  const isCountryInvalid = hasCountryValue && !isCountryValid

  const hasAnyLengthExceeded =
    cn.length > 64 ||
    org.length > 64 ||
    ou.length > 64 ||
    locality.length > 128 ||
    state.length > 128

  const isGenerateDisabled =
    generating ||
    isInvalidSetup ||
    hasCnPlaceholder ||
    hasLocPlaceholder ||
    hasOrgPlaceholder ||
    hasOuPlaceholder ||
    hasStatePlaceholder ||
    isCountryInvalid ||
    hasAnyLengthExceeded

  const generateButtonTitle = isInvalidSetup
    ? !cn.trim()
      ? t('app.keyGenerator.cnRequired', 'Common Name (CN) is required.')
      : t(
          'app.keyGenerator.placeholderSetup',
          'Cannot create a setup using only placeholder values. Please provide real subject details.',
        )
    : undefined

  const limit64Msg = t('app.keyGenerator.limitReached', {
    count: 64,
    defaultValue: 'Maximum limit of {{count}} characters reached (RFC 5280).',
  })
  const limit128Msg = t('app.keyGenerator.limitReached', {
    count: 128,
    defaultValue: 'Maximum limit of {{count}} characters reached (RFC 5280).',
  })

  return (
    <div className={styles.container}>
      <ModuleHeader
        category="keyManagement"
        icon={<Zap size={24} />}
        eyebrowIcon={<FileKey size={13} />}
        eyebrowText={t('app.categories.keyManagement', 'Key Management')}
        title={t('app.keyGenerator.title', 'Key Pair & CSR / Self-Signed Generator')}
        description={t(
          'app.keyGenerator.subtitle',
          'Generate a new RSA Key Pair and a Certificate Signing Request (CSR) or Self-Signed Certificate entirely in your browser using pure cryptography.',
        )}
      />

      <div className={styles.mainGrid}>
        <div className="glass-panel">
          <h2 className={styles.sectionHeading}>
            <Zap size={18} className={styles.iconAccent} aria-hidden="true" />
            <span>{t('app.keyGenerator.subjectDetailsTitle', 'Subject Details & Parameters')}</span>
          </h2>

          <div className={styles.formStack}>
            <SubjectTextField
              id="keygen-cn"
              label={t('app.keyGenerator.commonName', 'Common Name (CN)')}
              required
              value={cn}
              maxLength={64}
              placeholder={t('app.keyGenerator.commonNamePlaceholder', 'e.g. example.com')}
              placeholderWarning={
                hasCnPlaceholder
                  ? t(
                      'app.keyGenerator.placeholderSetup',
                      'Cannot create a setup using only placeholder values. Please provide real subject details.',
                    )
                  : undefined
              }
              limitReachedMessage={limit64Msg}
              onChange={clearErrorAndSet(setCn)}
            />

            <div className={styles.row2}>
              <SubjectTextField
                id="keygen-org"
                label={t('app.keyGenerator.organization', 'Organization (O)')}
                alignedLabel
                value={org}
                maxLength={64}
                placeholder={t('app.keyGenerator.organizationPlaceholder', 'Organization')}
                placeholderWarning={
                  hasOrgPlaceholder
                    ? t(
                        'app.keyGenerator.placeholderOrg',
                        'Generic placeholder detected for Organization. Real organization name required.',
                      )
                    : undefined
                }
                limitReachedMessage={limit64Msg}
                onChange={clearErrorAndSet(setOrg)}
              />
              <SubjectTextField
                id="keygen-ou"
                label={t('app.keyGenerator.organizationalUnit', 'Unit (OU)')}
                alignedLabel
                value={ou}
                maxLength={64}
                placeholder={t('app.keyGenerator.organizationalUnitPlaceholder', 'IT Dept')}
                placeholderWarning={
                  hasOuPlaceholder
                    ? t(
                        'app.keyGenerator.placeholderOu',
                        'Generic placeholder detected for Organizational Unit. Real unit name required.',
                      )
                    : undefined
                }
                limitReachedMessage={limit64Msg}
                onChange={clearErrorAndSet(setOu)}
              />
            </div>

            <div className={styles.row3}>
              <SubjectTextField
                id="keygen-locality"
                label={t('app.keyGenerator.locality', 'City (L)')}
                alignedLabel
                value={locality}
                maxLength={128}
                placeholder={t('app.keyGenerator.localityPlaceholder', 'City')}
                placeholderWarning={
                  hasLocPlaceholder
                    ? t('app.keyGenerator.placeholderLoc', {
                        value: locality.trim(),
                        defaultValue:
                          'Generic placeholder detected for City ("{{value}}"). Real locality name required.',
                      })
                    : undefined
                }
                limitReachedMessage={limit128Msg}
                onChange={clearErrorAndSet(setLocality)}
              />
              <SubjectTextField
                id="keygen-state"
                label={t('app.keyGenerator.state', 'State (ST)')}
                alignedLabel
                value={state}
                maxLength={128}
                placeholder={t('app.keyGenerator.statePlaceholder', 'State')}
                placeholderWarning={
                  hasStatePlaceholder
                    ? t(
                        'app.keyGenerator.placeholderState',
                        'Generic placeholder detected for State. Real state name required.',
                      )
                    : undefined
                }
                limitReachedMessage={limit128Msg}
                onChange={clearErrorAndSet(setState)}
              />

              <div className={`form-group ${styles.fieldGroup}`}>
                <label htmlFor="keygen-country" className={`form-label ${styles.alignedLabel}`}>
                  {t('app.keyGenerator.country', 'Country (C)')}
                </label>
                <input
                  id="keygen-country"
                  type="text"
                  value={country}
                  maxLength={2}
                  onChange={(e) => clearErrorAndSet(setCountry)(e.target.value.toUpperCase())}
                  className={`form-input ${
                    isCountryInvalid ? styles.inputInvalid : isCountryValid ? styles.inputValid : ''
                  }`}
                  placeholder={t('app.keyGenerator.countryPlaceholder', 'US')}
                />
                {isCountryInvalid && (
                  <div className={styles.feedbackDanger}>
                    <AlertTriangle size={14} className={styles.shrinkZero} aria-hidden="true" />
                    <span>
                      {trimmedCountry.length < 2
                        ? t(
                            'app.keyGenerator.countryLengthError',
                            'Country Code must be a 2-letter ISO 3166-1 alpha-2 code (e.g. US, DE, GB).',
                          )
                        : t('app.keyGenerator.countryUnrecognized', {
                            code: trimmedCountry,
                            defaultValue:
                              'Unknown country code "{{code}}". Must be a valid ISO 3166-1 alpha-2 code (e.g. US, DE, GB).',
                          })}
                    </span>
                  </div>
                )}
                {isCountryValid && countryName && (
                  <div className={styles.feedbackSuccess}>
                    <Check size={14} className={styles.shrinkZero} aria-hidden="true" />
                    <span>{countryName}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.row2}>
              <div className={`form-group ${styles.fieldGroup}`}>
                <label htmlFor="keygen-key-size" className={`form-label ${styles.alignedLabel}`}>
                  {t('app.keyGenerator.keySize', 'Key Size')}
                </label>
                <select
                  id="keygen-key-size"
                  value={keySize}
                  onChange={(e) => setKeySize(Number(e.target.value))}
                  className="form-select"
                >
                  <option value={2048}>
                    {t('app.keyGenerator.keySize2048', '2048-bit (Standard)')}
                  </option>
                  <option value={4096}>
                    {t('app.keyGenerator.keySize4096', '4096-bit (High Security)')}
                  </option>
                </select>
              </div>

              <div className={`form-group ${styles.fieldGroup}`}>
                <label htmlFor="keygen-output-type" className={`form-label ${styles.alignedLabel}`}>
                  {t('app.keyGenerator.outputType', 'Output Type')}
                </label>
                <select
                  id="keygen-output-type"
                  value={outputType}
                  onChange={(e) =>
                    setOutputType(e.target.value === 'self-signed' ? 'self-signed' : 'csr')
                  }
                  className="form-select"
                >
                  <option value="csr">
                    {t('app.keyGenerator.outputCsr', 'CSR (Signing Request)')}
                  </option>
                  <option value="self-signed">
                    {t('app.keyGenerator.outputSelfSigned', 'Self-Signed Certificate')}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`btn ${styles.submitBtn}`}
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
            title={generateButtonTitle}
          >
            {generating ? (
              <RefreshCw size={18} className="spin" aria-hidden="true" />
            ) : (
              <Zap size={18} aria-hidden="true" />
            )}
            <span>
              {generating
                ? outputType === 'csr'
                  ? t('app.keyGenerator.generatingCsr', 'Generating Keys & CSR...')
                  : t('app.keyGenerator.generatingCert', 'Generating Keys & Cert...')
                : outputType === 'csr'
                  ? t('app.keyGenerator.generateCsr', 'Generate Key Pair & CSR')
                  : t('app.keyGenerator.generateCert', 'Generate Key Pair & Cert')}
            </span>
          </button>

          {error && (
            <div className={styles.errorBanner} role="alert">
              {error}
            </div>
          )}
        </div>

        <KeyGeneratorOutputPanel
          outputType={outputType}
          safeName={safeName}
          generatedKey={generatedKey}
          generatedOutput={generatedOutput}
        />
      </div>
    </div>
  )
}
