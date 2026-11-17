import { memo } from 'react'

import { APP_VERSION } from '@/config'

import styles from './AppFooter.module.css'

export const AppFooter = memo(function AppFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.right}>
          <span className={`mono ${styles.version}`}>v{APP_VERSION}</span>
        </div>
      </div>
    </footer>
  )
})
