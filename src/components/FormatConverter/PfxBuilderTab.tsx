import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Eye, EyeOff, Key, Shield, Sparkles, Trash2 } from 'lucide-react'

import { PFX_PRESETS } from '@/data/format-converter-samples'
import type { PfxSamplePreset } from '@/types'

import { getLocalizedPfxPresetName } from './format-converter-logic'

import styles from './FormatConverter.module.css'

export interface PfxBuilderTabProps {
  certInput: string
  keyInput: string
  pfxPassword: string
  activePresetId: string | null
  onCertChange: (value: string) => void
  onKeyChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSelectPreset: (preset: PfxSamplePreset) => void
  onClear: () => void
  onBuildPfx: () => void
}

export function PfxBuilderTab({
  certInput,
  keyInput,
  pfxPassword,
  activePresetId,
  onCertChange,
  onKeyChange,
  onPasswordChange,
  onSelectPreset,
  onClear,
  onBuildPfx,
}: PfxBuilderTabProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)

  const hasAnyInput = Boolean(certInput || keyInput || pfxPassword)
  const clearTitle = t('app.formatConverter.clearInputs', 'Clear current inputs')
  const clearLabel = t('common.clear', 'Clear')
  const passwordToggleLabel = showPassword
    ? t('app.formatConverter.hidePassword', 'Hide password')
    : t('app.formatConverter.showPassword', 'Show password')

  return (
    <>
      <div className={`glass-panel animate-fade-in ${styles.presetsPanel}`}>
        <div className={styles.presetsHeader}>
          <div className={styles.presetsTitle}>
            <Sparkles size={15} className={styles.sparkleIcon} aria-hidden="true" />
            <span>{t('app.formatConverter.tryExamples', 'Try Test Examples:')}</span>
          </div>

          {hasAnyInput && (
            <button
              type="button"
              className={`${styles.clearBtn} ${styles.clearBtnMobile}`}
              onClick={onClear}
              title={clearTitle}
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>{clearLabel}</span>
            </button>
          )}
        </div>

        <div className={styles.presetsList}>
          {PFX_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                className={`${styles.presetPill} ${isActive ? styles.presetPillActive : ''}`}
                onClick={() => onSelectPreset(preset)}
                title={preset.description}
              >
                <span className={styles.presetName}>{getLocalizedPfxPresetName(preset, t)}</span>
                <span className={`badge badge-success ${styles.presetBadge}`}>{preset.badge}</span>
              </button>
            )
          })}
        </div>

        {hasAnyInput && (
          <button
            type="button"
            className={`${styles.clearBtn} ${styles.clearBtnDesktop}`}
            onClick={onClear}
            title={clearTitle}
          >
            <Trash2 size={13} aria-hidden="true" />
            <span>{clearLabel}</span>
          </button>
        )}
      </div>

      <div className={`glass-panel animate-fade-in ${styles.pfxPanel}`}>
        <h2 className={styles.pfxTitle}>
          {t('app.formatConverter.pfxTitle', 'Package PFX Archive')}
        </h2>
        <p className={styles.pfxSubtitle}>
          {t(
            'app.formatConverter.pfxSubtitle',
            'Combine a PEM Certificate and a PEM Private Key into a secure PFX (PKCS#12) container suitable for Windows Certificate Store, IIS, or Azure Key Vault.',
          )}
        </p>

        <div className={styles.twoColGrid}>
          <div className={`form-group ${styles.noMarginGroup}`}>
            <label htmlFor="pfx-cert-pem" className="form-label">
              <Shield size={15} className={styles.iconAccent} aria-hidden="true" />
              <span>{t('app.formatConverter.certLabel', 'Certificate (PEM)')}</span>
            </label>
            <textarea
              id="pfx-cert-pem"
              className={`form-textarea mono ${styles.pfxTextarea}`}
              value={certInput}
              onChange={(e) => onCertChange(e.target.value)}
              placeholder={t(
                'app.ocsp.placeholder',
                '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
              )}
            />
          </div>

          <div className={`form-group ${styles.noMarginGroup}`}>
            <label htmlFor="pfx-key-pem" className="form-label">
              <Key size={15} className={styles.iconBinary} aria-hidden="true" />
              <span>{t('app.formatConverter.keyLabel', 'Private Key (PEM)')}</span>
            </label>
            <textarea
              id="pfx-key-pem"
              className={`form-textarea mono ${styles.pfxTextarea}`}
              value={keyInput}
              onChange={(e) => onKeyChange(e.target.value)}
              placeholder={t(
                'app.csr.editor.pasteKeyPlaceholder',
                '-----BEGIN RSA PRIVATE KEY-----\n...',
              )}
            />
          </div>
        </div>

        <div className={styles.passwordSection}>
          <div className={`form-group ${styles.noMarginGroup}`}>
            <label htmlFor="pfx-export-password" className={`form-label ${styles.passwordLabel}`}>
              {t('app.formatConverter.pfxPassword', 'PFX Archive Password')}
            </label>
            <div className={styles.passwordWrap}>
              <input
                id="pfx-export-password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${styles.passwordInput}`}
                value={pfxPassword}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder={t(
                  'app.formatConverter.passwordPlaceholder',
                  'Enter secure export password...',
                )}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={passwordToggleLabel}
                title={passwordToggleLabel}
              >
                {showPassword ? (
                  <EyeOff size={16} aria-hidden="true" />
                ) : (
                  <Eye size={16} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={`btn btn-primary ${styles.pfxActionBtn}`}
            onClick={onBuildPfx}
            disabled={!certInput || !keyInput || !pfxPassword}
          >
            <Download size={18} aria-hidden="true" />
            <span>{t('app.formatConverter.downloadPfx', 'Download PFX Archive')}</span>
          </button>
        </div>
      </div>
    </>
  )
}
