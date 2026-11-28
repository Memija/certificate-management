import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, FileArchive, Key, Shield } from 'lucide-react'

import { ModuleHeader, useToast } from '@/components/shared'
import type { AppMode, PemDerSamplePreset, PfxSamplePreset } from '@/types'

import {
  buildPfxArchive,
  type ContentType,
  type ConvertMode,
  convertPemDerContent,
  getLocalizedError,
  getLocalizedMessage,
  getLocalizedPemDerPresetName,
  getLocalizedPfxPresetName,
  hasAllowedExtension,
  type OutputFormat,
  type StatusFeedback,
  triggerBlobDownload,
  validateSourceFileBytes,
} from './format-converter-logic'
import { PemDerConverterTab } from './PemDerConverterTab'
import { PfxBuilderTab } from './PfxBuilderTab'

import styles from './FormatConverter.module.css'

export interface FormatConverterProps {
  initialMode?: ConvertMode
  onNavigate?: (mode: AppMode) => void
}

export function FormatConverter({ initialMode = 'pem-der' }: FormatConverterProps = {}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [mode, setMode] = useState<ConvertMode>(initialMode)

  const [file, setFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState<string | ArrayBuffer | null>(null)
  const [convertType, setConvertType] = useState<ContentType>('cert')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('der')
  const [activePemDerPreset, setActivePemDerPreset] = useState<string | null>(null)

  const [certInput, setCertInput] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [pfxPassword, setPfxPassword] = useState('')
  const [activePfxPreset, setActivePfxPreset] = useState<string | null>(null)

  const [message, setMessage] = useState<StatusFeedback | null>(null)
  const [error, setError] = useState<StatusFeedback | null>(null)

  const clearFeedback = useCallback((): void => {
    setError(null)
    setMessage(null)
  }, [])

  const setFeedbackError = useCallback(
    (feedback: StatusFeedback): void => {
      setError(feedback)
      setMessage(null)
      showToast(getLocalizedError(feedback, t), 'error')
    },
    [showToast, t],
  )

  const setFeedbackMessage = useCallback(
    (feedback: StatusFeedback): void => {
      setMessage(feedback)
      setError(null)
      showToast(getLocalizedMessage(feedback, t), 'success')
    },
    [showToast, t],
  )

  const handleSelectPemDerPreset = useCallback(
    (preset: PemDerSamplePreset): void => {
      try {
        const sampleFile = preset.createFile()
        const sampleContent = preset.getContent()
        setFile(sampleFile)
        setFileContent(sampleContent)
        setConvertType(preset.contentType)
        setOutputFormat(preset.outputFormat)
        setActivePemDerPreset(preset.id)
        clearFeedback()

        const localizedName = getLocalizedPemDerPresetName(preset, t)
        showToast(
          t('app.formatConverter.presetLoaded', `Loaded "${localizedName}" preset`, {
            name: localizedName,
          }),
          'info',
        )
      } catch (err: unknown) {
        console.error('Failed to load PEM/DER sample preset:', err)
        const details = err instanceof Error ? err.message : String(err)
        setFeedbackError({ code: 'CONVERSION_FAILED', details })
      }
    },
    [clearFeedback, setFeedbackError, showToast, t],
  )

  const handleClearPemDer = useCallback((): void => {
    setFile(null)
    setFileContent(null)
    setActivePemDerPreset(null)
    clearFeedback()
  }, [clearFeedback])

  const handleSelectPfxPreset = useCallback(
    (preset: PfxSamplePreset): void => {
      setCertInput(preset.certPem)
      setKeyInput(preset.keyPem)
      setPfxPassword(preset.defaultPassword)
      setActivePfxPreset(preset.id)
      clearFeedback()

      const localizedName = getLocalizedPfxPresetName(preset, t)
      showToast(
        t('app.formatConverter.presetLoaded', `Loaded "${localizedName}" preset`, {
          name: localizedName,
        }),
        'info',
      )
    },
    [clearFeedback, showToast, t],
  )

  const handleClearPfx = useCallback((): void => {
    setCertInput('')
    setKeyInput('')
    setPfxPassword('')
    setActivePfxPreset(null)
    clearFeedback()
  }, [clearFeedback])

  const processSourceFile = useCallback(
    (selectedFile: File): void => {
      clearFeedback()

      if (!hasAllowedExtension(selectedFile.name)) {
        setFile(null)
        setFileContent(null)
        setFeedbackError({ code: 'INVALID_FILE_TYPE' })
        return
      }

      if (selectedFile.size === 0) {
        setFile(null)
        setFileContent(null)
        setFeedbackError({ code: 'EMPTY_FILE' })
        return
      }

      const reader = new FileReader()
      reader.onload = (evt) => {
        const resultBuffer = evt.target?.result
        if (!(resultBuffer instanceof ArrayBuffer)) {
          return
        }

        const validation = validateSourceFileBytes(selectedFile.name, resultBuffer)
        if (!validation.ok) {
          setFile(null)
          setFileContent(null)
          setFeedbackError(validation.error)
          return
        }

        setFile(selectedFile)
        setFileContent(validation.content)
        setConvertType(validation.contentType)
        setOutputFormat(validation.outputFormat)
        setActivePemDerPreset(null)
        clearFeedback()
      }

      reader.onerror = () => {
        console.error('Failed to read source file:', reader.error)
        setFile(null)
        setFileContent(null)
        setFeedbackError({
          code: 'CONVERSION_FAILED',
          details: reader.error?.message ?? 'File read error',
        })
      }

      reader.readAsArrayBuffer(selectedFile)
    },
    [clearFeedback, setFeedbackError],
  )

  const handlePemDerConvert = useCallback((): void => {
    clearFeedback()
    if (!file || !fileContent) {
      return
    }

    try {
      const result = convertPemDerContent(file.name, fileContent, convertType)
      triggerBlobDownload(result.blob, result.filename)
      setFeedbackMessage({ code: result.feedbackCode })
    } catch (err: unknown) {
      console.error('PEM/DER conversion failed:', err)
      const details = err instanceof Error ? err.message : String(err)
      setFeedbackError({ code: 'CONVERSION_FAILED', details })
    }
  }, [clearFeedback, convertType, file, fileContent, setFeedbackError, setFeedbackMessage])

  const handlePfxBuild = useCallback((): void => {
    clearFeedback()
    if (!certInput.trim() || !keyInput.trim()) {
      setFeedbackError({ code: 'CERT_AND_KEY_REQUIRED' })
      return
    }
    if (!pfxPassword) {
      setFeedbackError({ code: 'PASSWORD_REQUIRED' })
      return
    }

    try {
      const result = buildPfxArchive(certInput, keyInput, pfxPassword)
      triggerBlobDownload(result.blob, result.filename)
      setFeedbackMessage({ code: result.feedbackCode })
    } catch (err: unknown) {
      console.error('PFX archive build failed:', err)
      const details = err instanceof Error ? err.message : String(err)
      setFeedbackError({ code: 'PFX_FAILED', details })
    }
  }, [certInput, clearFeedback, keyInput, pfxPassword, setFeedbackError, setFeedbackMessage])

  const handleCertChange = useCallback((value: string): void => {
    setCertInput(value)
    setActivePfxPreset(null)
  }, [])

  const handleKeyChange = useCallback((value: string): void => {
    setKeyInput(value)
    setActivePfxPreset(null)
  }, [])

  const handlePasswordChange = useCallback((value: string): void => {
    setPfxPassword(value)
    setActivePfxPreset(null)
  }, [])

  const activeErrorText = getLocalizedError(error, t)
  const activeMessageText = getLocalizedMessage(message, t)

  return (
    <div className={styles.wrapper}>
      <ModuleHeader
        category="keyManagement"
        eyebrowIcon={<Key size={14} />}
        eyebrowText={t('app.categories.keyManagement', 'Key Management')}
        title={t('app.formatConverter.title', 'Certificate Format Converter & PFX Builder')}
        description={t(
          'app.formatConverter.subtitle',
          'Convert between PEM and DER formats, or package a Certificate and Private Key into a PFX (PKCS#12) archive.',
        )}
        icon={<FileArchive size={26} />}
      />

      <div className={styles.modeTabs}>
        <button
          type="button"
          data-mode="pem-der"
          className={`${styles.formatTabBtn} ${
            mode === 'pem-der' ? styles.formatTabPemDerActive : ''
          }`}
          onClick={() => {
            setMode('pem-der')
            clearFeedback()
          }}
        >
          <FileArchive size={16} aria-hidden="true" />
          <span>{t('app.formatConverter.tabPemDer', 'PEM ↔ DER Converter')}</span>
        </button>

        <button
          type="button"
          data-mode="pfx"
          className={`${styles.formatTabBtn} ${mode === 'pfx' ? styles.formatTabPfxActive : ''}`}
          onClick={() => {
            setMode('pfx')
            clearFeedback()
          }}
        >
          <Shield size={16} aria-hidden="true" />
          <span>{t('app.formatConverter.tabPfx', 'Build PFX (PKCS#12)')}</span>
        </button>
      </div>

      {mode === 'pem-der' ? (
        <PemDerConverterTab
          file={file}
          fileContent={fileContent}
          convertType={convertType}
          outputFormat={outputFormat}
          activePresetId={activePemDerPreset}
          onSelectPreset={handleSelectPemDerPreset}
          onClear={handleClearPemDer}
          onSourceFileSelected={processSourceFile}
          onConvert={handlePemDerConvert}
        />
      ) : (
        <PfxBuilderTab
          certInput={certInput}
          keyInput={keyInput}
          pfxPassword={pfxPassword}
          activePresetId={activePfxPreset}
          onCertChange={handleCertChange}
          onKeyChange={handleKeyChange}
          onPasswordChange={handlePasswordChange}
          onSelectPreset={handleSelectPfxPreset}
          onClear={handleClearPfx}
          onBuildPfx={handlePfxBuild}
        />
      )}

      {(activeErrorText || activeMessageText) && (
        <div
          role={activeErrorText ? 'alert' : 'status'}
          className={`glass-panel ${styles.feedbackAlert} ${
            activeErrorText ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          {activeErrorText ? (
            <AlertTriangle size={18} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          <span>{activeErrorText || activeMessageText}</span>
        </div>
      )}
    </div>
  )
}
