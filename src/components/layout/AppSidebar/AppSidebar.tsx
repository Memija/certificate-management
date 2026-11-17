import { memo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BookOpen,
  FileArchive,
  FileKey,
  FolderOpen,
  Globe,
  Key,
  LayoutDashboard,
  Link as LinkIcon,
  Monitor,
  Search,
  Shield,
  ShieldAlert,
  X,
  Zap,
} from 'lucide-react'

import { NAV_CATEGORIES } from '@/config'
import type { AppMode, NavIconName } from '@/types'

import styles from './AppSidebar.module.css'

export interface AppSidebarProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  isOpen: boolean
  onClose: () => void
  onPreloadMode?: (mode: AppMode) => void
}

const NAV_ICON_MAP: Record<NavIconName, LucideIcon> = {
  Shield,
  Monitor,
  LayoutDashboard,
  FolderOpen,
  ShieldAlert,
  Link: LinkIcon,
  FileKey,
  Key,
  Zap,
  FileArchive,
  Globe,
  Activity,
  Search,
  BookOpen,
}

export const AppSidebar = memo(function AppSidebar({
  mode,
  onModeChange,
  isOpen,
  onClose,
  onPreloadMode,
}: AppSidebarProps) {
  const { t } = useTranslation()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const activeBtn = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [mode])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        role="presentation"
        onClick={onClose}
      />
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.header}>
          <img
            src="/logo.svg"
            alt=""
            width={36}
            height={36}
            aria-hidden="true"
            className={styles.logo}
          />
          <div className={styles.brandTitle}>
            <span className={styles.brandPrimary}>Certificate</span>
            <span className={styles.brandSecondary}>Management</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('app.aria.closeSidebar')}
            title={t('app.aria.closeSidebar')}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className={styles.nav} ref={navRef} aria-label={t('app.title')}>
          {NAV_CATEGORIES.map((category) => {
            const categoryTitleId = `sidebar-category-${category.id}`
            return (
              <div key={category.id} className={styles.category} data-category={category.id}>
                <div id={categoryTitleId} className={styles.categoryTitle}>
                  {t(`app.categories.${category.id}`)}
                </div>
                <ul className={styles.navList} aria-labelledby={categoryTitleId}>
                  {category.items.map((item) => {
                    const Icon = NAV_ICON_MAP[item.iconName]
                    const isActive = mode === item.id
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={isActive ? 'page' : undefined}
                          className={`${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}
                          onMouseEnter={() => onPreloadMode?.(item.id)}
                          onFocus={() => onPreloadMode?.(item.id)}
                          onClick={() => onModeChange(item.id)}
                        >
                          <Icon size={17} aria-hidden="true" />
                          <span>{t(`app.nav.${item.id}`)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
})
