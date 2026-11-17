import { memo, useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, Shield } from 'lucide-react'

import type { EfiSignatureList } from '@/types'

import { assessBootHealth } from './secure-boot-helpers'

import styles from './SecureBootInspector.module.css'

export interface BootHealthWarningsProps {
  lists: EfiSignatureList[]
}

export const BootHealthWarnings = memo(function BootHealthWarnings({
  lists,
}: BootHealthWarningsProps) {
  const { t, i18n } = useTranslation()

  const assessment = useMemo(() => assessBootHealth(lists, t), [lists, t])

  const {
    criticals,
    warnings,
    hasMsWindowsCert,
    hasMsUefiCert,
    latestWindowsDate,
    latestWindowsSubject,
    latestUefiDate,
    latestUefiSubject,
  } = assessment

  return (
    <div className={styles.warningsContainer}>
      <section className={`glass-panel ${styles.assessmentPanel}`}>
        <h2 className={styles.assessmentTitle}>
          <Shield size={20} aria-hidden="true" />
          <span>{t('app.secureBoot.assessmentTitle')}</span>
        </h2>

        <div className={styles.assessmentGrid}>
          <div>
            <strong className={styles.assessmentItemTitle}>
              {t('app.secureBoot.whyReplacedTitle')}
            </strong>
            <p className={styles.assessmentItemDesc}>
              <Trans
                i18nKey="app.secureBoot.whyReplacedDesc"
                components={[<em key="0" />, <em key="1" />]}
              />
            </p>
          </div>

          <div>
            <strong className={styles.assessmentItemTitle}>
              {t('app.secureBoot.impactWindowsTitle')}
            </strong>
            <p className={styles.assessmentItemDesc}>{t('app.secureBoot.impactWindowsDesc')}</p>
          </div>

          <div>
            <strong className={styles.assessmentItemTitle}>
              {t('app.secureBoot.impactUefiTitle')}
            </strong>
            <p className={styles.assessmentItemDesc}>{t('app.secureBoot.impactUefiDesc')}</p>
          </div>

          <div className={styles.functionalBox}>
            <strong className={styles.assessmentItemTitle}>
              {t('app.secureBoot.functionalTitle')}
            </strong>
            <ul className={styles.functionalList}>
              <li>
                <strong>{t('app.secureBoot.windowsBoot')}</strong>{' '}
                {hasMsWindowsCert ? (
                  <span className={`badge badge-success ${styles.statusBadge}`}>
                    <span className="badge-dot" />
                    {t('app.secureBoot.validUntil', {
                      date: latestWindowsDate.toLocaleDateString(i18n.language),
                    })}
                  </span>
                ) : (
                  <span className={`badge badge-danger ${styles.statusBadge}`}>
                    <span className="badge-dot pulse" />
                    {t('app.secureBoot.invalid')}
                  </span>
                )}
                {hasMsWindowsCert && (
                  <div className={styles.governedBy}>
                    {t('app.secureBoot.governedBy', { subject: latestWindowsSubject })}
                  </div>
                )}
              </li>

              <li className={styles.functionalListItemSpaced}>
                <strong>{t('app.secureBoot.thirdPartyBoot')}</strong>{' '}
                {hasMsUefiCert ? (
                  <span className={`badge badge-success ${styles.statusBadge}`}>
                    <span className="badge-dot" />
                    {t('app.secureBoot.validUntil', {
                      date: latestUefiDate.toLocaleDateString(i18n.language),
                    })}
                  </span>
                ) : (
                  <span className={`badge badge-danger ${styles.statusBadge}`}>
                    <span className="badge-dot pulse" />
                    {t('app.secureBoot.invalid')}
                  </span>
                )}
                {hasMsUefiCert && (
                  <div className={styles.governedBy}>
                    {t('app.secureBoot.governedBy', { subject: latestUefiSubject })}
                  </div>
                )}
              </li>
            </ul>
          </div>
        </div>
      </section>

      {criticals.map((crit) => (
        <div key={crit} className={`glass-panel ${styles.criticalPanel}`} role="alert">
          <div className={styles.alertRow}>
            <div className="metric-icon-wrap danger" aria-hidden="true">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className={styles.criticalTitle}>
                {t('app.secureBoot.criticalWarning', 'Critical Warning')}
              </h3>
              <p className={styles.alertDesc}>{crit}</p>
            </div>
          </div>
        </div>
      ))}

      {warnings.map((warn) => (
        <div key={warn} className={`glass-panel ${styles.warningPanel}`}>
          <div className={styles.alertRow}>
            <div className="metric-icon-wrap warning" aria-hidden="true">
              <Shield size={24} />
            </div>
            <div>
              <h3 className={styles.warningTitle}>{t('app.secureBoot.warning', 'Warning')}</h3>
              <p className={styles.alertDesc}>{warn}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})
