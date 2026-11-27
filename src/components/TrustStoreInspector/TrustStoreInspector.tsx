import type React from 'react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Archive,
  FileKey,
  FolderOpen,
  Lock,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

import { ModuleHeader } from '@/components/shared'
import { useAppStore } from '@/store'
import type { AppMode } from '@/types'

import {
  getFormatMeta,
  SUPPORTED_EXTENSIONS,
  TRUST_STORE_SAMPLE_PRESETS,
} from './trust-store-helpers'
import { TrustStoreFileCard } from './TrustStoreFileCard'
import { useTrustStoreFiles } from './useTrustStoreFiles'

import styles from './TrustStoreInspector.module.css'

export interface TrustStoreInspectorProps {
  onNavigate?: (mode: AppMode) => void
}

export function TrustStoreInspector({ onNavigate }: TrustStoreInspectorProps = {}) {
  const { t } = useTranslation()
  const storeSetMode = useAppStore((s) => s.setMode)
  const navigate = onNavigate ?? storeSetMode

  const {
    loadedFiles,
    globalLoading,
    activeFile,
    setActiveFileId,
    processFiles,
    handleLoadPreset,
    removeFile,
    clearAllFiles,
    handlePasswordChange,
    handlePasswordSubmit,
    handleJksUnlockSubmit,
  } = useTrustStoreFiles()

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = Array.from(e.dataTransfer.files)
      if (dropped.length > 0) {
        void processFiles(dropped)
      }
    },
    [processFiles],
  )

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length > 0) {
      void processFiles(selected)
    }
    e.target.value = ''
  }

  const descriptionText = `${t(
    'app.trustStore.inspector.subtitle.p1',
    'Inspect X.509 certificates, PKCS#12 archives, Java KeyStores, and PEM/DER bundles.',
  )} ${t(
    'app.trustStore.inspector.subtitle.p2',
    'Client-side cryptographic parsing: private keys and certificates never leave your browser.',
  )}`

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <ModuleHeader
          category="inspectionValidation"
          icon={<FolderOpen size={24} />}
          eyebrowIcon={<FolderOpen size={12} />}
          eyebrowText={t('app.trustStore.inspector.eyebrow', 'KeyStore & Archive Inspection')}
          title={t('app.trustStore.inspector.title', 'Trust Store & Keystore Inspector')}
          description={descriptionText}
        >
          <span className={`${styles.capabilityPill} ${styles.capabilityPillActive}`}>
            <ShieldCheck size={12} className={styles.iconSuccess} aria-hidden="true" />
            <span>{t('app.trustStore.inspector.pills.inMemory', 'In-Memory Parsing')}</span>
          </span>
          <span className={styles.capabilityPill}>
            <Archive size={12} className={styles.iconPurple} aria-hidden="true" />
            <span>{t('app.trustStore.inspector.pills.pemBundle', 'PEM Bundles')}</span>
          </span>
          <span className={styles.capabilityPill}>
            <Shield size={12} className={styles.iconInfo} aria-hidden="true" />
            <span>{t('app.trustStore.inspector.pills.derPkcs7', 'DER & PKCS#7')}</span>
          </span>
          <span className={styles.capabilityPill}>
            <Lock size={12} className={styles.iconWarning} aria-hidden="true" />
            <span>{t('app.trustStore.inspector.pills.pkcs12', 'PKCS#12 / PFX')}</span>
          </span>
          <span className={styles.capabilityPill}>
            <FileKey size={12} className={styles.iconSuccess} aria-hidden="true" />
            <span>{t('app.trustStore.inspector.pills.jks', 'Java KeyStore (JKS)')}</span>
          </span>
        </ModuleHeader>

        <div className={styles.presetsBar}>
          <span className={styles.presetsLabel}>
            <Sparkles size={14} className={styles.iconAccent} aria-hidden="true" />
            <span>{t('app.formatConverter.tryExamples', 'Try Test Examples:')}</span>
          </span>
          <div className={styles.presetsList}>
            {TRUST_STORE_SAMPLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={styles.presetBtn}
                onClick={() => void handleLoadPreset(preset)}
              >
                <span>{t(preset.nameKey, preset.defaultName)}</span>
                <span className={styles.presetBadge}>
                  {t(preset.badgeKey, preset.defaultBadge)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".cer,.crt,.pem,.der,.p7b,.p7c,.jks,.p12,.pfx,.keystore"
          className={styles.hiddenInput}
          aria-label={t('app.trustStore.inspector.dropFilesHere', 'Drop certificate files here')}
          onChange={handleFileInputChange}
        />

        <div
          className={`drop-zone ${styles.dropZoneWrap} ${isDragging ? 'active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <button
            type="button"
            className={styles.dropTriggerBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className={styles.dropIcon} aria-hidden="true">
              <Upload size={42} />
            </span>
            <span className={styles.dropTitle}>
              {t('app.trustStore.inspector.dropFilesHere', 'Drop certificate files here')}
            </span>
            <span className={styles.dropSubtitle}>
              {t('app.trustStore.inspector.orClickToBrowse', 'or click to browse')}
            </span>
            <span className={styles.dropFormats}>
              {SUPPORTED_EXTENSIONS.map((ext) => (
                <span key={ext} className={styles.formatPill}>
                  {ext}
                </span>
              ))}
            </span>
          </button>
        </div>

        {globalLoading && (
          <div className={styles.loadingRow}>
            <RefreshCw size={18} className="spin" aria-hidden="true" />
            <span>{t('app.trustStore.inspector.parsingFiles', 'Parsing file(s)…')}</span>
          </div>
        )}

        {loadedFiles.length > 0 && activeFile && (
          <section className={`animate-fade-in ${styles.loadedSection}`}>
            <div className={styles.loadedHeader}>
              <h2 className={styles.loadedTitle}>
                {t('app.trustStore.inspector.loadedFiles', 'Loaded Files')} ({loadedFiles.length})
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllFiles}>
                <X size={13} aria-hidden="true" />
                <span>{t('app.trustStore.inspector.clearAll', 'Clear All')}</span>
              </button>
            </div>

            <div className={styles.tabsBar}>
              <span className={styles.tabsLabel}>
                <FolderOpen size={14} className={styles.iconAccent} aria-hidden="true" />
                <span>{t('app.trustStore.inspector.loadedFiles', 'Loaded Files')}</span>
                <span className={styles.tabCountPill}>{loadedFiles.length}</span>:
              </span>
              {loadedFiles.map((lf) => {
                const isActive = activeFile.id === lf.id
                const fmtInfo = getFormatMeta(lf.store.format)
                const FmtIcon = fmtInfo.Icon
                return (
                  <div
                    key={lf.id}
                    className={`${styles.fileTabChip} ${isActive ? styles.fileTabChipActive : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.fileTabSelectBtn}
                      onClick={() => setActiveFileId(lf.id)}
                      title={lf.name}
                    >
                      {isActive && <span className={styles.tabActiveDot} />}
                      <FmtIcon size={13} aria-hidden="true" />
                      <span className={styles.tabFileName}>{lf.name}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.fileTabRemoveBtn}
                      onClick={() => removeFile(lf.id)}
                      aria-label={`${t('common.remove', 'Remove')} ${lf.name}`}
                      title={t('common.remove', 'Remove')}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                )
              })}
            </div>

            <TrustStoreFileCard
              key={activeFile.id}
              loadedFile={activeFile}
              onRemove={() => removeFile(activeFile.id)}
              onPasswordSubmit={(id, pwd) => void handlePasswordSubmit(id, pwd)}
              onPasswordChange={handlePasswordChange}
              onJksUnlockSubmit={handleJksUnlockSubmit}
              onNavigate={navigate}
            />
          </section>
        )}
      </div>
    </div>
  )
}
