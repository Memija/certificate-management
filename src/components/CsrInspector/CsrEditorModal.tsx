import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Key, RefreshCw, Shield, X } from 'lucide-react'

import type { CsrFieldErrors, ParsedCSR } from '@/types'
import { validateCsr, validatePrivateKeyPem } from '@/utils/csr-validation'

import {
  buildAndSignCsr,
  type CsrEditorSubjectValues,
  type CsrExtKeyUsages,
  type CsrKeyMode,
  type CsrKeyUsages,
  extractInitialEditorState,
} from './csr-editor-helpers'
import { CsrEditorFormFields } from './CsrEditorFormFields'

import styles from './CsrEditorModal.module.css'

export interface CsrEditorModalProps {
  isOpen: boolean
  csr: ParsedCSR
  initialName: string
  onClose: () => void
  onSave: (newCsr: ParsedCSR, fileName: string, generatedPrivateKeyPem?: string) => void
}

function CsrEditorDialogContent({
  csr,
  initialName,
  onClose,
  onSave,
}: Omit<CsrEditorModalProps, 'isOpen'>) {
  const { t } = useTranslation()
  const initial = useMemo(() => extractInitialEditorState(csr), [csr])

  const [subject, setSubject] = useState<CsrEditorSubjectValues>(initial.subject)
  const [sans, setSans] = useState<string>(initial.sans)
  const [keyUsages, setKeyUsages] = useState<CsrKeyUsages>(initial.keyUsages)
  const [extKeyUsages, setExtKeyUsages] = useState<CsrExtKeyUsages>(initial.extKeyUsages)
  const [keyMode, setKeyMode] = useState<CsrKeyMode>('generate')
  const [keySize, setKeySize] = useState<number>(initial.keySize)
  const [existingKeyPem, setExistingKeyPem] = useState('')
  const [fieldErrors, setFieldErrors] = useState<CsrFieldErrors>({})
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !generating) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [generating, onClose])

  const keyValidation = useMemo(() => {
    if (!existingKeyPem.trim()) {
      return null
    }
    return validatePrivateKeyPem(existingKeyPem, t)
  }, [existingKeyPem, t])

  const existingKeyValid = keyValidation === null ? null : keyValidation.valid
  const existingKeyBits = keyValidation?.bitLength
  const keyErrorDetail =
    keyValidation && !keyValidation.valid
      ? keyValidation.error || t('app.csr.editor.keyInvalid', 'Invalid private key format')
      : ''

  const handleSubjectChange = (field: keyof CsrEditorSubjectValues, value: string): void => {
    setSubject((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
    if (error) {
      setError('')
    }
  }

  const handleSansChange = (value: string): void => {
    setSans(value)
    if (fieldErrors.sans) {
      setFieldErrors((prev) => ({ ...prev, sans: undefined }))
    }
    if (error) {
      setError('')
    }
  }

  const handleExistingKeyChange = (pem: string): void => {
    setExistingKeyPem(pem)
    if (fieldErrors.existingKey) {
      setFieldErrors((prev) => ({ ...prev, existingKey: undefined }))
    }
    if (error) {
      setError('')
    }
  }

  const handleGenerateAndSign = (): void => {
    const valResult = validateCsr(subject, {
      requireCn: false,
      sans,
      serverAuthEnabled: extKeyUsages.serverAuth,
      existingKeyPem: keyMode === 'existing' ? existingKeyPem : undefined,
      checkPlaceholders: true,
      t,
    })

    if (!valResult.isValid) {
      setFieldErrors(valResult.errors)
      const firstError =
        Object.values(valResult.errors)[0] ||
        t(
          'app.csr.editor.cnOrSanRequired',
          'Common Name (CN) or at least one Subject Alternative Name (SAN) is required.',
        )
      setError(firstError)
      return
    }

    setFieldErrors({})
    setGenerating(true)
    setError('')

    void (async () => {
      try {
        const result = await buildAndSignCsr({
          subject,
          sans,
          keyUsages,
          extKeyUsages,
          keyMode,
          keySize,
          existingKeyPem,
          initialName,
          t,
        })
        onSave(result.parsedCsr, result.fileName, result.generatedPrivateKeyPem)
        onClose()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error creating CSR'
        console.error('Failed to re-sign CSR:', err)
        setError(msg)
      } finally {
        setGenerating(false)
      }
    })()
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget && !generating) {
      onClose()
    }
  }

  const closeLabel = t('common.cancel', 'Cancel')

  return (
    <div className={styles.backdrop} role="presentation" onClick={handleBackdropClick}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csr-editor-modal-title"
      >
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <div className={`metric-icon-wrap cyan ${styles.headerIconBox}`} aria-hidden="true">
              <Shield size={20} />
            </div>
            <div>
              <h2 id="csr-editor-modal-title" className={styles.modalTitle}>
                {t('app.csr.editor.modalTitle', 'Edit & Re-sign CSR')}
              </h2>
              <p className={styles.modalSubtitle}>
                {t(
                  'app.csr.editor.modalSubtitle',
                  'Modify subject attributes, SANs, or key usages, then re-sign to generate a valid CSR.',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            onClick={onClose}
            disabled={generating}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className={styles.errorAlert} role="alert">
            <AlertTriangle size={16} className={styles.shrinkZero} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <CsrEditorFormFields
          subject={subject}
          onSubjectChange={handleSubjectChange}
          sans={sans}
          onSansChange={handleSansChange}
          keyUsages={keyUsages}
          onKeyUsageToggle={(usage, checked) =>
            setKeyUsages((prev) => ({ ...prev, [usage]: checked }))
          }
          extKeyUsages={extKeyUsages}
          onExtKeyUsageToggle={(usage, checked) =>
            setExtKeyUsages((prev) => ({ ...prev, [usage]: checked }))
          }
          keyMode={keyMode}
          onKeyModeChange={setKeyMode}
          keySize={keySize}
          onKeySizeChange={setKeySize}
          existingKeyPem={existingKeyPem}
          onExistingKeyChange={handleExistingKeyChange}
          existingKeyValid={existingKeyValid}
          existingKeyBits={existingKeyBits}
          keyErrorDetail={keyErrorDetail}
          fieldErrors={fieldErrors}
        />

        <div className={styles.footer}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={generating}
          >
            {closeLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerateAndSign}
            disabled={generating || (keyMode === 'existing' && existingKeyValid !== true)}
          >
            {generating ? (
              <>
                <RefreshCw size={15} className="spin" aria-hidden="true" />
                <span>{t('app.csr.editor.generating', 'Generating Key & Signing…')}</span>
              </>
            ) : (
              <>
                <Key size={15} aria-hidden="true" />
                <span>{t('app.csr.editor.saveBtn', 'Generate & Re-sign CSR')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CsrEditorModal(props: CsrEditorModalProps) {
  if (!props.isOpen) {
    return null
  }
  return (
    <CsrEditorDialogContent
      key={`${props.initialName}-${props.csr.fingerprintSha256}`}
      csr={props.csr}
      initialName={props.initialName}
      onClose={props.onClose}
      onSave={props.onSave}
    />
  )
}
