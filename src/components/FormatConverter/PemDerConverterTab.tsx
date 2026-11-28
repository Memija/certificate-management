import type React from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Binary, CheckCircle2, Download, FileText, Upload, X } from 'lucide-react'

import { type SamplePresetItem, SamplePresetsBar } from '@/components/shared'
import { PEM_DER_PRESETS } from '@/data/format-converter-samples'
import type { PemDerSamplePreset } from '@/types'

import {
  ALLOWED_SOURCE_EXTENSIONS,
  type ContentType,
  formatFileSize,
  getLocalizedPemDerPresetName,
  type OutputFormat,
} from './format-converter-logic'

import styles from './FormatConverter.module.css'

export interface PemDerConverterTabProps {
  file: File | null
  fileContent: string | ArrayBuffer | null
  convertType: ContentType
  outputFormat: OutputFormat
  activePresetId: string | null
  onSelectPreset: (preset: PemDerSamplePreset) => void
  onClear: () => void
  onSourceFileSelected: (file: File) => void
  onConvert: () => void
}

export function PemDerConverterTab({
  file,
  fileContent,
  convertType,
  outputFormat,
  activePresetId,
  onSelectPreset,
  onClear,
  onSourceFileSelected,
  onConvert,
}: PemDerConverterTabProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const isBinary = fileContent instanceof ArrayBuffer
  const clearTitle = t('app.formatConverter.clearInputs', 'Clear current inputs')
  const clearLabel = t('common.clear', 'Clear')
  const removeFileLabel = t('app.formatConverter.removeFile', 'Remove file')

  const resetNativeInput = useCallback((): void => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handlePresetClick = useCallback(
    (preset: PemDerSamplePreset): void => {
      resetNativeInput()
      onSelectPreset(preset)
    },
    [onSelectPreset, resetNativeInput],
  )

  const handleClearClick = useCallback((): void => {
    resetNativeInput()
    onClear()
  }, [onClear, resetNativeInput])

  const presetItems = useMemo<SamplePresetItem[]>(
    () =>
      PEM_DER_PRESETS.map((preset) => ({
        id: preset.id,
        label: getLocalizedPemDerPresetName(preset, t),
        badge: preset.badge,
        badgeTone: preset.outputFormat === 'der' ? 'info' : 'warning',
        title: preset.description,
        isActive: activePresetId === preset.id,
        onSelect: () => handlePresetClick(preset),
      })),
    [activePresetId, handlePresetClick, t],
  )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = e.target.files?.[0]
    if (selected) {
      onSourceFileSelected(selected)
    }
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      onSourceFileSelected(dropped)
    }
  }

  return (
    <>
      <SamplePresetsBar
        items={presetItems}
        showClear={Boolean(file)}
        clearLabel={clearLabel}
        clearTitle={clearTitle}
        onClear={handleClearClick}
      />

      <div className={`glass-panel animate-fade-in ${styles.pemDerPanel}`}>
        <h2 className={styles.panelTitle}>
          {t('app.formatConverter.pemDerTitle', 'PEM ↔ DER File Converter')}
        </h2>

        <div className={styles.pemDerBody}>
          <div className={`form-group ${styles.noMarginGroup}`}>
            <label htmlFor="pem-der-source-file" className="form-label">
              {t('app.formatConverter.selectSourceFile', 'Select Source File')}
            </label>
            <div
              className={`${styles.dropArea} ${isDragging ? styles.dropAreaDragging : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                id="pem-der-source-file"
                type="file"
                ref={fileInputRef}
                accept={ALLOWED_SOURCE_EXTENSIONS.join(',')}
                onChange={handleFileUpload}
                className={styles.hiddenFileInput}
              />
              <button
                type="button"
                className={`btn btn-secondary ${styles.chooseFileBtn}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} aria-hidden="true" />
                <span>{t('app.formatConverter.chooseFile', 'Choose PEM or DER File...')}</span>
              </button>

              {file && (
                <div className={styles.stagedFileCard}>
                  <div className={styles.stagedFileInfo}>
                    {isBinary ? (
                      <Binary size={22} className={styles.iconBinary} aria-hidden="true" />
                    ) : (
                      <FileText size={22} className={styles.iconAccent} aria-hidden="true" />
                    )}
                    <div className={styles.stagedFileDetails}>
                      <div className={styles.stagedFileName} title={file.name}>
                        {file.name}
                      </div>
                      <div className={styles.stagedFileMeta}>
                        <span>{formatFileSize(file.size)}</span>
                        <span aria-hidden="true">•</span>
                        <span
                          className={`${styles.formatBadge} ${
                            isBinary ? styles.formatBadgeDer : styles.formatBadgePem
                          }`}
                        >
                          {isBinary
                            ? t('app.formatConverter.badgeDer', 'DER (Binary)')
                            : t('app.formatConverter.badgePem', 'PEM (Text)')}
                        </span>
                        <span aria-hidden="true">•</span>
                        <span
                          className={`${styles.formatBadge} ${
                            convertType === 'cert' ? styles.formatBadgeCert : styles.formatBadgeKey
                          }`}
                        >
                          {convertType === 'cert'
                            ? t('app.formatConverter.typeCert', 'Certificate (X.509)')
                            : t('app.formatConverter.typeKey', 'Private Key (RSA)')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearClick}
                    className={`btn btn-secondary ${styles.removeFileBtn}`}
                    aria-label={removeFileLabel}
                    title={removeFileLabel}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={styles.converterGrid}>
            <div className={`${styles.colHeader} ${styles.colHeader1}`}>
              <label htmlFor="pem-der-content-type" className={`form-label ${styles.colLabel}`}>
                {t('app.formatConverter.contentType', 'Content Type')}
              </label>
              {file && (
                <span className={styles.autoDetectedBadge}>
                  <CheckCircle2 size={11} aria-hidden="true" />
                  <span>{t('app.formatConverter.autoDetected', 'Auto-detected')}</span>
                </span>
              )}
            </div>

            <div className={`${styles.colHeader} ${styles.colHeader2}`}>
              <label htmlFor="pem-der-target-format" className={`form-label ${styles.colLabel}`}>
                {t('app.formatConverter.targetFormat', 'Target Output Format')}
              </label>
              {file && (
                <span className={styles.autoDetectedBadge}>
                  <CheckCircle2 size={11} aria-hidden="true" />
                  <span>{t('app.formatConverter.autoSelected', 'Auto-selected')}</span>
                </span>
              )}
            </div>

            <div className={`${styles.inputCol} ${styles.inputCol1}`}>
              <select
                id="pem-der-content-type"
                className={`form-select ${styles.readOnlySelect} ${
                  file ? styles.readOnlySelectLoaded : ''
                }`}
                value={file ? convertType : ''}
                disabled
              >
                {!file ? (
                  <option value="">
                    {t('app.formatConverter.autoDetectWaiting', 'Auto-detected on upload')}
                  </option>
                ) : convertType === 'cert' ? (
                  <option value="cert">
                    {t('app.formatConverter.typeCert', 'Certificate (X.509)')}
                  </option>
                ) : (
                  <option value="key">
                    {t('app.formatConverter.typeKey', 'Private Key (RSA)')}
                  </option>
                )}
              </select>
            </div>

            <div className={`${styles.inputCol} ${styles.inputCol2}`}>
              <select
                id="pem-der-target-format"
                className={`form-select ${styles.readOnlySelect} ${
                  file ? styles.readOnlySelectLoaded : ''
                }`}
                value={file ? outputFormat : ''}
                disabled
              >
                {!file ? (
                  <option value="">
                    {t('app.formatConverter.autoTargetWaiting', 'Auto-selected on upload')}
                  </option>
                ) : outputFormat === 'der' ? (
                  <option value="der">
                    {t('app.formatConverter.formatDer', 'DER (Raw Binary)')}
                  </option>
                ) : (
                  <option value="pem">
                    {t('app.formatConverter.formatPem', 'PEM (Base64 ASCII)')}
                  </option>
                )}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={`btn btn-primary ${styles.convertActionBtn}`}
            onClick={onConvert}
            disabled={!file}
          >
            <Download size={18} aria-hidden="true" />
            <span>{t('app.formatConverter.convertAndDownload', 'Convert & Download')}</span>
          </button>
        </div>
      </div>
    </>
  )
}
