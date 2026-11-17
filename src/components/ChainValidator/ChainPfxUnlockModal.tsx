import type React from 'react'
import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Lock, RefreshCw, X } from 'lucide-react'

import styles from './ChainNodeInspectorModal.module.css'

export interface PendingPfxUnlockState {
  file: File
  passwordInput: string
  error?: string
  loading?: boolean
}

export interface ChainPfxUnlockModalProps {
  state: PendingPfxUnlockState
  onChangePassword: (nextPassword: string) => void
  onRequirePasswordError: () => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onClose: () => void
}

export const ChainPfxUnlockModal = memo(function ChainPfxUnlockModal({
  state,
  onChangePassword,
  onRequirePasswordError,
  onSubmit,
  onClose,
}: ChainPfxUnlockModalProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !state.loading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [state.loading, onClose])

  const cancelLabel = t('common.cancel', 'Cancel')
  const toggleLabel = showPassword
    ? t('app.trustStore.inspector.hidePassword', 'Hide password')
    : t('app.trustStore.inspector.showPassword', 'Show password')

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !state.loading) {
          onClose()
        }
      }}
    >
      <div
        className={`${styles.dialog} ${styles.dialogCompact}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chain-pfx-unlock-title"
      >
        <div className={styles.modalHeader}>
          <div className={styles.pfxTitleRow}>
            <div className={`metric-icon-wrap warning ${styles.pfxIconWrap}`}>
              <Lock size={18} aria-hidden="true" />
            </div>
            <h2 id="chain-pfx-unlock-title" className={styles.modalTitle}>
              {t('app.chain.unlockPfxTitle', 'Unlock PKCS#12 / PFX Keystore')}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            onClick={() => {
              if (!state.loading) {
                onClose()
              }
            }}
            aria-label={cancelLabel}
            title={cancelLabel}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <p className={styles.pfxDesc}>
          {t('app.chain.pfxPasswordPrompt', {
            fileName: state.file.name,
            defaultValue: `The file "${state.file.name}" is password-protected. Enter the password to extract certificates into the chain validation pool.`,
          })}
        </p>

        {state.error && <div className={styles.pfxError}>{state.error}</div>}

        <form onSubmit={onSubmit}>
          <div className={styles.passwordFieldWrap}>
            <input
              id="chain-pfx-password-input"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${styles.passwordInput}`}
              autoFocus
              aria-label={t(
                'app.trustStore.inspector.passwordPlaceholder',
                'Enter keystore password…',
              )}
              placeholder={t(
                'app.trustStore.inspector.passwordPlaceholder',
                'Enter keystore password…',
              )}
              value={state.passwordInput}
              onChange={(e) => onChangePassword(e.target.value)}
              onBlur={() => {
                if (!state.passwordInput.trim()) {
                  onRequirePasswordError()
                }
              }}
            />
            <button
              type="button"
              className={styles.passwordToggleBtn}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={toggleLabel}
              title={toggleLabel}
            >
              {showPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          </div>

          <div className={styles.pfxFooter}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={state.loading}
            >
              {cancelLabel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={state.loading}>
              {state.loading ? (
                <>
                  <RefreshCw size={14} className="spin" aria-hidden="true" />
                  <span>{t('app.chain.unlocking', 'Unlocking…')}</span>
                </>
              ) : (
                t('app.trustStore.inspector.unlock', 'Unlock')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
})
