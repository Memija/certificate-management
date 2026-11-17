import type React from 'react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Binary, CheckCircle2, Download, FileText, Sparkles, Trash2, Upload, X } from 'lucide-react'

import { PEM_DER_PRESETS } from '@/data'
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

  const resetNativeInput = (): void => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePresetClick = (preset: PemDerSamplePreset): void => {
    resetNativeInput()
    onSelectPreset(preset)
  }

  const handleClearClick = (): void => {
    resetNativeInput()
    onClear()
  }

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
      <div className={`glass-panel animate-fade-in ${styles.presetsPanel}`}>
        <div className={styles.presetsHeader}>
          <div className={styles.presetsTitle}>
            <Sparkles size={15} className={styles.sparkleIcon} aria-hidden="true" />
            <span>{t('app.formatConverter.tryExamples', 'Try Test Examples:')}</span>
          </div>

          {file && (
            <button
              type="button"
              className={`${styles.clearBtn} ${styles.clearBtnMobile}`}
              onClick={handleClearClick}
              title={clearTitle}
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>{clearLabel}</span>
            </button>
          )}
        </div>

        <div className={styles.presetsList}>
          {PEM_DER_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id
            const badgeVariant = preset.outputFormat === 'der' ? 'badge-info' : 'badge-warning'
            return (
              <button
                key={preset.id}
                type="button"
                className={`${styles.presetPill} ${isActive ? styles.presetPillActive : ''}`}
                onClick={() => handlePresetClick(preset)}
                title={preset.description}
              >
                <span className={styles.presetName}>{getLocalizedPemDerPresetName(preset, t)}</span>
                <span className={`badge ${badgeVariant} ${styles.presetBadge}`}>
                  {preset.badge}
                </span>
              </button>
            )
          })}
        </div>

        {file && (
          <button
            type="button"
            className={`${styles.clearBtn} ${styles.clearBtnDesktop}`}
            onClick={handleClearClick}
            title={clearTitle}
          >
            <Trash2 size={13} aria-hidden="true" />
            <span>{clearLabel}</span>
          </button>
        )}
      </div>

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
