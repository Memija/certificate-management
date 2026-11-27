import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Eye, EyeOff, FileKey, Info, Lock, ShieldAlert, X } from 'lucide-react'

import type { AppMode, TrustStoreEntry } from '@/types'

import type { FormatTone, LoadedTrustStoreFile } from './trust-store-helpers'
import { getEntryKey, getFormatMeta, localizeTrustStoreWarning } from './trust-store-helpers'
import { TrustStoreEntryDetail } from './TrustStoreEntryDetail'
import { TrustStoreSidebar } from './TrustStoreSidebar'

import styles from './TrustStoreFileCard.module.css'

export interface TrustStoreFileCardProps {
  loadedFile: LoadedTrustStoreFile
  onRemove: () => void
  onPasswordSubmit: (id: string, password: string) => void
  onPasswordChange: (id: string, val: string) => void
  onJksUnlockSubmit: (id: string, password: string) => void
  onNavigate: (mode: AppMode) => void
}

const TONE_CLASS_MAP: Record<FormatTone, string> = {
  cyan: styles.formatToneCyan,
  info: styles.formatToneInfo,
  purple: styles.formatTonePurple,
  warning: styles.formatToneWarning,
  success: styles.formatToneSuccess,
  danger: styles.formatToneDanger,
}

export const TrustStoreFileCard = memo(function TrustStoreFileCard({
  loadedFile,
  onRemove,
  onPasswordSubmit,
  onPasswordChange,
  onJksUnlockSubmit,
  onNavigate,
}: TrustStoreFileCardProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [hasExitedEmpty, setHasExitedEmpty] = useState(false)
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { store, name, needsPassword, id } = loadedFile
  const fmtInfo = getFormatMeta(store.format)
  const FmtIcon = fmtInfo.Icon
  const toneClass = TONE_CLASS_MAP[fmtInfo.tone]
  const removeLabel = `${t('common.remove', 'Remove')} ${name}`
  const passwordPlaceholder = t(
    'app.trustStore.inspector.passwordPlaceholder',
    'Enter keystore password…',
  )
  const togglePwdLabel = showPassword
    ? t('app.trustStore.inspector.hidePassword', 'Hide password')
    : t('app.trustStore.inspector.showPassword', 'Show password')

  const selectedEntry = useMemo(() => {
    if (store.entries.length === 0) {
      return null
    }
    if (selectedEntryKey !== null) {
      const found = store.entries.find((e) => getEntryKey(e) === selectedEntryKey)
      if (found) {
        return found
      }
    }
    return store.entries[0]
  }, [store.entries, selectedEntryKey])

  const handleSelectEntry = useCallback((entry: TrustStoreEntry) => {
    setSelectedEntryKey(getEntryKey(entry))
  }, [])

  const isInputEmpty = !loadedFile.passwordInput?.trim()
  const showError =
    hasAttemptedSubmit || hasExitedEmpty || store.warnings.includes('Incorrect password.')

  const handleUnlock = (): void => {
    setHasAttemptedSubmit(true)
    if (isInputEmpty) {
      return
    }
    onPasswordSubmit(id, loadedFile.passwordInput ?? '')
  }

  if (needsPassword) {
    const errorMessage = isInputEmpty
      ? t(
          'app.trustStore.inspector.pkcs12RequiresPassword',
          'This PKCS#12 file requires a password.',
        )
      : store.warnings.includes('Incorrect password.')
        ? t('app.trustStore.inspector.incorrectPassword', 'Incorrect password.')
        : localizeTrustStoreWarning(
            store.warnings[0] ?? 'This PKCS#12 file requires a password.',
            store.format,
            t,
          ).text

    return (
      <div className={`glass-card ${styles.fileCard}`}>
        <div className={styles.fileHeader}>
          <div className={styles.fileHeaderLeft}>
            <div className={`metric-icon-wrap warning ${styles.fileIconWrap}`}>
              <Lock size={20} aria-hidden="true" />
            </div>
            <div>
              <div className={styles.fileName}>{name}</div>
              <div className={`${styles.fileFormatLabel} ${toneClass}`}>
                {t(fmtInfo.key, fmtInfo.label)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="btn btn-secondary btn-sm"
            aria-label={removeLabel}
            title={t('common.remove', 'Remove')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.passwordBox}>
          <p className={styles.passwordDesc}>
            {t(
              'app.trustStore.inspector.passwordProtectedDesc',
              'This file is password-protected. Enter the password to decrypt and inspect its certificates.',
            )}
          </p>
          {Boolean(loadedFile.isSample && loadedFile.samplePasswordHint) && (
            <div className={styles.passwordHint}>{loadedFile.samplePasswordHint}</div>
          )}
          <div className={styles.passwordInputRow}>
            <div className={styles.passwordFieldWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${styles.passwordInput}`}
                placeholder={passwordPlaceholder}
                aria-label={passwordPlaceholder}
                value={loadedFile.passwordInput ?? ''}
                onChange={(e) => {
                  if (hasExitedEmpty) {
                    setHasExitedEmpty(false)
                  }
                  if (hasAttemptedSubmit && e.target.value) {
                    setHasAttemptedSubmit(false)
                  }
                  onPasswordChange(id, e.target.value)
                }}
                onBlur={() => {
                  if (isInputEmpty) {
                    setHasExitedEmpty(true)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUnlock()
                  }
                }}
              />
              <button
                type="button"
                className={styles.passwordToggleBtn}
                onClick={() => setShowPassword((prev) => !prev)}
                title={togglePwdLabel}
                aria-label={togglePwdLabel}
              >
                {showPassword ? (
                  <EyeOff size={16} aria-hidden="true" />
                ) : (
                  <Eye size={16} aria-hidden="true" />
                )}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loadedFile.loading}
              onClick={handleUnlock}
            >
              {t('app.trustStore.inspector.unlock', 'Unlock')}
            </button>
          </div>
          {showError && <p className={styles.passwordError}>{errorMessage}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className={`glass-card ${styles.fileCard}`}>
      <div className={styles.fileHeader}>
        <div className={styles.fileHeaderLeft}>
          <div className={`metric-icon-wrap info ${styles.fileIconWrap}`}>
            <FmtIcon size={20} aria-hidden="true" />
          </div>
          <div>
            <div className={styles.fileName}>{name}</div>
            <div className={`${styles.fileFormatLabel} ${toneClass}`}>
              {t(fmtInfo.key, fmtInfo.label)}
            </div>
          </div>
          <span className="badge">
            {store.entries.length}{' '}
            {store.entries.length === 1
              ? t('app.trustStore.inspector.certsCount_one', 'cert')
              : t('app.trustStore.inspector.certsCount_other', 'certs')}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="btn btn-secondary btn-sm"
          aria-label={removeLabel}
          title={t('common.remove', 'Remove')}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {store.warnings.map((warning) => {
        const info = localizeTrustStoreWarning(warning, store.format, t)
        return (
          <div key={warning} className={styles.warningBanner}>
            <div className={styles.warningContent}>
              <Info size={16} className={styles.iconWarning} aria-hidden="true" />
              <span className={styles.warningText}>{info.text}</span>
            </div>
            {info.targetMode && info.actionKey && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate(info.targetMode as AppMode)}
              >
                {info.targetMode === 'crl-inspector' ? (
                  <ShieldAlert size={14} aria-hidden="true" />
                ) : (
                  <FileKey size={14} aria-hidden="true" />
                )}
                <span>{t(info.actionKey, info.actionDefault ?? '')}</span>
              </button>
            )}
          </div>
        )
      })}

      {store.entries.some((e) => e.isEncryptedJksKey && !e.privateKeyPem) && (
        <div className={styles.jksUnlockCard}>
          <p className={styles.jksUnlockTitle}>
            <Lock size={16} className={styles.iconWarning} aria-hidden="true" />
            <span>{t('app.trustStore.inspector.unlockJksTitle', 'Unlock Private Keys')}</span>
          </p>
          {Boolean(loadedFile.isSample && loadedFile.samplePasswordHint) && (
            <div className={styles.passwordHint}>{loadedFile.samplePasswordHint}</div>
          )}
          <div className={styles.passwordInputRow}>
            <div className={styles.passwordFieldWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${styles.passwordInput}`}
                placeholder={passwordPlaceholder}
                aria-label={passwordPlaceholder}
                value={loadedFile.passwordInput ?? ''}
                onChange={(e) => onPasswordChange(id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onJksUnlockSubmit(id, loadedFile.passwordInput ?? '')
                  }
                }}
              />
              <button
                type="button"
                className={styles.passwordToggleBtn}
                onClick={() => setShowPassword((prev) => !prev)}
                title={togglePwdLabel}
                aria-label={togglePwdLabel}
              >
                {showPassword ? (
                  <EyeOff size={16} aria-hidden="true" />
                ) : (
                  <Eye size={16} aria-hidden="true" />
                )}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onJksUnlockSubmit(id, loadedFile.passwordInput ?? '')}
            >
              {t('app.trustStore.inspector.unlock', 'Unlock')}
            </button>
          </div>
        </div>
      )}

      {store.entries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <AlertTriangle
              size={40}
              className={store.format === 'CRL' ? styles.iconWarning : styles.iconDanger}
              aria-hidden="true"
            />
          </div>
          <p className={styles.emptyTitle}>
            {store.format === 'CRL'
              ? t(
                  'app.trustStore.warnings.crlDetectedTitle',
                  'Certificate Revocation List Detected',
                )
              : t(
                  'app.trustStore.inspector.noCertsExtracted',
                  'No certificates could be extracted from this file.',
                )}
          </p>
          <p className={styles.emptyDesc}>
            {store.format === 'CRL'
              ? t(
                  'app.trustStore.warnings.crlFile',
                  'This file is a Certificate Revocation List (CRL), not a certificate trust store. Please inspect this file in the CRL Inspector.',
                )
              : t(
                  'app.chain.noValidCerts',
                  'No valid X.509 certificates could be extracted from the uploaded files.',
                )}
          </p>
          {store.format === 'CRL' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('crl-inspector')}
            >
              <ShieldAlert size={14} aria-hidden="true" />
              <span>{t('app.trustStore.warnings.goToCrlInspector', 'Open in CRL Inspector')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className={styles.trustStoreLayout}>
          <TrustStoreSidebar
            entries={store.entries}
            selectedEntry={selectedEntry}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectEntry={handleSelectEntry}
          />
          <TrustStoreEntryDetail
            key={selectedEntry ? getEntryKey(selectedEntry) : 'none'}
            entry={selectedEntry}
          />
        </div>
      )}
    </div>
  )
})
