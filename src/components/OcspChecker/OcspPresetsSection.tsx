import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, FileText, Globe, RefreshCw } from 'lucide-react'

import { type SamplePresetItem, SamplePresetsBar } from '@/components/shared'
import { OCSP_SAMPLE_PRESETS } from '@/data/ocsp-samples'
import type { OcspSamplePreset } from '@/types'

import { getLocalizedPresetMeta } from './ocsp-helpers'

import styles from './OcspChecker.module.css'

export interface OcspPresetsSectionProps {
  activePreset: OcspSamplePreset | null
  hasInput: boolean
  loading: boolean
  hasResult: boolean
  onSelectPreset: (preset: OcspSamplePreset) => void
  onClear: () => void
  onVerifyActivePreset: (pem: string) => void
}

export const OcspPresetsSection = memo(function OcspPresetsSection({
  activePreset,
  hasInput,
  loading,
  hasResult,
  onSelectPreset,
  onClear,
  onVerifyActivePreset,
}: OcspPresetsSectionProps) {
  const { t } = useTranslation()
  const activePresetMeta = activePreset ? getLocalizedPresetMeta(activePreset, t) : null

  const presetItems = useMemo<SamplePresetItem[]>(
    () =>
      OCSP_SAMPLE_PRESETS.map((preset) => {
        const meta = getLocalizedPresetMeta(preset, t)
        return {
          id: preset.id,
          label: meta.name,
          badge: meta.badge,
          badgeTone: preset.badgeType,
          title: meta.description,
          isActive: activePreset?.id === preset.id,
          onSelect: () => onSelectPreset(preset),
        }
      }),
    [activePreset?.id, onSelectPreset, t],
  )

  return (
    <>
      <SamplePresetsBar items={presetItems} showClear={hasInput} onClear={onClear} />

      {activePreset && activePresetMeta && (
        <div
          className={`glass-panel animate-fade-in ${styles.activePresetPanel} ${styles[`border_${activePreset.expectedStatus}`]}`}
        >
          <div className={styles.activePresetHeader}>
            <div className={styles.activePresetTitleRow}>
              <span className={styles.activePresetName}>{activePresetMeta.name}</span>
              <span
                className={`${styles.presetBadge} ${styles[`badge_${activePreset.badgeType}`]}`}
              >
                {activePresetMeta.category}
              </span>
            </div>

            <div className={styles.expectedRow}>
              <span>{t('app.ocsp.expectedResult', 'Expected Result:')}</span>
              <span className={styles[`verdict_${activePreset.expectedStatus}`]}>
                {activePreset.expectedStatus === 'good'
                  ? t('app.ocsp.expectedVerdictGood', 'Valid (Not Revoked)')
                  : activePreset.expectedStatus === 'revoked'
                    ? t('app.ocsp.expectedVerdictRevoked', 'Revoked')
                    : t('app.ocsp.expectedVerdictUnknown', 'Unknown / Offline')}
              </span>
            </div>
          </div>

          <p className={styles.activePresetDesc}>{activePresetMeta.description}</p>

          <div className={styles.activePresetFooter}>
            <div className={styles.endpointsRow}>
              <span
                className={`${styles.endpointItem} ${activePreset.ocspUrl ? '' : styles.endpointMuted}`}
              >
                <Globe
                  size={13}
                  className={activePreset.ocspUrl ? styles.accentIcon : styles.mutedIcon}
                  aria-hidden="true"
                />
                <span>
                  <strong className={styles.endpointLabel}>
                    {t('app.ocsp.ocspLabel', 'OCSP:')}
                  </strong>
                  {activePreset.ocspUrl ? (
                    <code className={styles.endpointUrl}>{activePreset.ocspUrl}</code>
                  ) : (
                    t('app.ocsp.notAvailable', 'N/A')
                  )}
                </span>
              </span>

              <span
                className={`${styles.endpointItem} ${activePreset.crlUrl ? '' : styles.endpointMuted}`}
              >
                <FileText
                  size={13}
                  className={activePreset.crlUrl ? styles.warningIcon : styles.mutedIcon}
                  aria-hidden="true"
                />
                <span>
                  <strong className={styles.endpointLabel}>{t('app.ocsp.crlLabel', 'CRL:')}</strong>
                  {activePreset.crlUrl ? (
                    <code className={styles.endpointUrl}>{activePreset.crlUrl}</code>
                  ) : (
                    t('app.ocsp.notAvailable', 'N/A')
                  )}
                </span>
              </span>
            </div>

            {!hasResult && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onVerifyActivePreset(activePreset.certificatePem)}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw size={13} className="spin" aria-hidden="true" />
                ) : (
                  <Activity size={13} aria-hidden="true" />
                )}
                <span>
                  {loading
                    ? t('app.ocsp.verifying', 'Verifying...')
                    : t('app.ocsp.verifyExample', 'Verify This Example')}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
})
