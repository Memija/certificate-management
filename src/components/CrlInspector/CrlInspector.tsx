import type React from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Calendar,
  FileKey,
  FileText,
  FolderOpen,
  Info,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

import { LearningTerm, ModuleHeader } from '@/components/shared'
import { useAppStore } from '@/store'
import type { AppMode } from '@/types'

import { formatLocalizedCrlError, getIssuerCN } from './crl-helpers'
import { CrlOverviewPanel } from './CrlOverviewPanel'
import { CrlRevokedTable } from './CrlRevokedTable'
import { useCrlFiles } from './useCrlFiles'

import styles from './CrlInspector.module.css'

export interface CrlInspectorProps {
  onNavigate?: (mode: AppMode) => void
}

export function CrlInspector({ onNavigate }: CrlInspectorProps = {}) {
  const { t } = useTranslation()
  const storeSetMode = useAppStore((s) => s.setMode)
  const navigate = onNavigate ?? storeSetMode

  const {
    loadedCrls,
    activeItem,
    hasSample,
    errorInfo,
    setErrorInfo,
    setActiveCrlId,
    processFiles,
    loadSampleCrl,
    removeCrl,
    clearAll,
    replaceActiveCrl,
  } = useCrlFiles()

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceFileInputRef = useRef<HTMLInputElement>(null)

  const localizedError = useMemo(() => {
    if (!errorInfo) {
      return null
    }
    return formatLocalizedCrlError(errorInfo, t)
  }, [errorInfo, t])

  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        void processFiles(e.dataTransfer.files)
      }
    },
    [processFiles],
  )

  const handleReplaceInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0]
    try {
      if (file) {
        await replaceActiveCrl(file)
      }
    } finally {
      e.target.value = ''
    }
  }

  const headerTitle = t('app.crl.title', 'Certificate Revocation List (CRL) Inspector').replace(
    /<\/?\d+>/g,
    '',
  )
  const headerDescription = `${t(
    'app.crl.descP1',
    'Parse RFC 5280 revocation lists in PEM or DER encoding.',
  )} ${t(
    'app.crl.descP2',
    'Verify issuer validity, inspect next update windows, and search revoked serial numbers and reason codes.',
  )}`
  const clearLabel = t('common.clear', 'Clear')

  return (
    <div
      className={styles.container}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
    >
      <div className={styles.inner}>
        <ModuleHeader
          category="inspectionValidation"
          icon={<ShieldAlert size={24} />}
          eyebrowIcon={<ShieldAlert size={12} />}
          eyebrowText={t('app.crl.eyebrow', 'Revocation Status & RFC 5280')}
          title={headerTitle}
          description={headerDescription}
        >
          <span className={`${styles.capabilityPill} ${styles.capabilityPillActive}`}>
            <ShieldCheck size={12} className={styles.iconSuccess} aria-hidden="true" />
            <LearningTerm termId="crl">
              {t('app.crl.pills.rfc5280', 'RFC 5280 Parser')}
            </LearningTerm>
          </span>
          <span className={styles.capabilityPill}>
            <FileText size={12} className={styles.iconInfo} aria-hidden="true" />
            <span>{t('app.crl.pills.pemDer', 'PEM & DER Decoders')}</span>
          </span>
          <span className={styles.capabilityPill}>
            <Search size={12} className={styles.iconWarning} aria-hidden="true" />
            <span>{t('app.crl.pills.serialLookup', 'Revoked Serial Lookup')}</span>
          </span>
          <span className={styles.capabilityPill}>
            <Calendar size={12} className={styles.iconPurple} aria-hidden="true" />
            <span>{t('app.crl.pills.updateWindow', 'Update Window Audit')}</span>
          </span>
        </ModuleHeader>

        {localizedError && errorInfo && (
          <div
            className={`${styles.alertBanner} ${
              errorInfo.action ? styles.alertWarning : styles.alertDanger
            }`}
          >
            <div className={styles.alertBody}>
              {errorInfo.action ? (
                <Info size={16} className={styles.iconWarning} aria-hidden="true" />
              ) : (
                <AlertTriangle size={16} className={styles.iconDanger} aria-hidden="true" />
              )}
              <span className={styles.alertText}>{localizedError}</span>
            </div>
            <div className={styles.alertActions}>
              {errorInfo.action && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(errorInfo.action!.targetMode)}
                >
                  {errorInfo.action.targetMode === 'trust-store' && (
                    <FolderOpen size={14} aria-hidden="true" />
                  )}
                  {errorInfo.action.targetMode === 'csr-inspector' && (
                    <FileKey size={14} aria-hidden="true" />
                  )}
                  <span>{t(errorInfo.action.labelKey, errorInfo.action.defaultLabel)}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setErrorInfo(null)}
                className={styles.alertCloseBtn}
                title={clearLabel}
                aria-label={clearLabel}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".crl,.pem,.der"
          multiple
          className={styles.hiddenInput}
          aria-label={t('app.crl.dropZoneTitle', 'Drop a CRL file here or click to browse')}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void processFiles(e.target.files)
              e.target.value = ''
            }
          }}
        />

        <input
          ref={replaceFileInputRef}
          type="file"
          accept=".crl,.pem,.der"
          className={styles.hiddenInput}
          aria-label={t('app.crl.replaceCrl', 'Replace CRL')}
          onChange={(e) => void handleReplaceInputChange(e)}
        />

        <div
          className={`drop-zone ${styles.dropZoneWrap} ${isDragging ? 'active' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
        >
          <button
            type="button"
            className={styles.dropTriggerBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className={styles.dropIcon} aria-hidden="true">
              <Upload size={44} />
            </span>
            <span className={styles.dropTitle}>
              {t('app.crl.dropZoneTitle', 'Drop a CRL file here or click to browse')}
            </span>
            <span className={styles.dropSubtitle}>
              {t(
                'app.crl.dropZoneDesc',
                'Supports standard DER and PEM formatted Certificate Revocation Lists (.crl)',
              )}
            </span>
          </button>

          <div className={styles.dropSampleRow}>
            <button
              type="button"
              onClick={loadSampleCrl}
              disabled={hasSample}
              className="btn btn-secondary btn-sm"
              title={
                hasSample
                  ? t('app.crl.sampleAlreadyLoaded', 'Sample CRL is already loaded')
                  : undefined
              }
            >
              <Sparkles size={14} className={styles.iconAccent} aria-hidden="true" />
              <span>{t('app.crl.trySampleCrl', 'Try Sample CRL')}</span>
            </button>
          </div>
        </div>

        {loadedCrls.length > 0 && activeItem && (
          <section className={`animate-fade-in ${styles.loadedSection}`}>
            <div className={styles.loadedHeader}>
              <h2 className={styles.loadedTitle}>
                {t('app.crl.loadedFiles', 'Loaded Files')} ({loadedCrls.length})
              </h2>
              <div className={styles.headerBtnRow}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={13} aria-hidden="true" />
                  <span>{t('app.crl.addCrl', 'Add CRL')}</span>
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearAll}>
                  <X size={13} aria-hidden="true" />
                  <span>{t('common.clearAll', 'Clear All')}</span>
                </button>
              </div>
            </div>

            <div className={styles.tabsBar}>
              <span className={styles.tabsLabel}>
                <ShieldAlert size={14} className={styles.iconDanger} aria-hidden="true" />
                <span>{t('app.crl.tabsLabel', 'CRLs')}</span>
                <span className={styles.tabCountPill}>{loadedCrls.length}</span>:
              </span>
              {loadedCrls.map((item) => {
                const isActive = activeItem.id === item.id
                const issuerCn = getIssuerCN(item.crl.issuer) || item.name
                return (
                  <div
                    key={item.id}
                    className={`${styles.crlTabChip} ${isActive ? styles.crlTabChipActive : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.crlTabSelectBtn}
                      onClick={() => setActiveCrlId(item.id)}
                      title={item.name}
                    >
                      {isActive && <span className={styles.tabActiveDot} />}
                      <ShieldAlert size={13} aria-hidden="true" />
                      <span className={styles.tabIssuerText}>{issuerCn}</span>
                      {Boolean(item.isSample) && (
                        <span className={styles.sampleTabTag}>
                          {t('app.crl.sampleTag', 'Sample')}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.crlTabRemoveBtn}
                      onClick={() => removeCrl(item.id)}
                      aria-label={`${t('common.remove', 'Remove')} ${item.name}`}
                      title={t('common.remove', 'Remove')}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                )
              })}
            </div>

            <CrlOverviewPanel
              key={activeItem.id}
              crl={activeItem.crl}
              fileName={activeItem.name}
              isSample={activeItem.isSample}
              onReplace={() => replaceFileInputRef.current?.click()}
              onClear={() => removeCrl(activeItem.id)}
            >
              <CrlRevokedTable crl={activeItem.crl} />
            </CrlOverviewPanel>
          </section>
        )}
      </div>
    </div>
  )
}
