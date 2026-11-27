import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'

import { APP_VERSION, getCategoryForMode } from '@/config'
import type { AppMode } from '@/types'

import styles from './AppFooter.module.css'

export interface AppFooterProps {
  mode?: AppMode
}

export const AppFooter = memo(function AppFooter({ mode = 'secure-boot' }: AppFooterProps) {
  const { t } = useTranslation()
  const categoryId = getCategoryForMode(mode)

  return (
    <footer className={styles.footer}>
      <div className={styles.capsuleDock} data-category={categoryId}>
        <div className={styles.capsuleFrame}>
          <div className={styles.capsuleGlassShell} aria-hidden="true" />
          <div className={styles.capsulePayload}>
            <span className={styles.taglineChip}>
              <ShieldCheck size={14} aria-hidden="true" className={styles.taglineIcon} />
              <span className={styles.taglineText}>{t('app.footer.tagline')}</span>
            </span>
            <span className={styles.capsuleDivider} aria-hidden="true" />
            <span className={`mono ${styles.versionChip}`}>v{APP_VERSION}</span>
          </div>
        </div>
      </div>
    </footer>
  )
})
