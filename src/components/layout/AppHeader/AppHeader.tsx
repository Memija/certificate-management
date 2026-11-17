import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Menu, Monitor, Moon, Sun } from 'lucide-react'

import { getCategoryForMode, LANGUAGE_META } from '@/config'
import { useThemeStore } from '@/store'
import type { AppMode, SupportedLanguage } from '@/types'
import { normalizeLanguageTag, setUserLanguagePreference } from '@/utils/system-settings'

import styles from './AppHeader.module.css'

export interface AppHeaderProps {
  mode: AppMode
  onOpenSidebar: () => void
}

const LanguagePicker = memo(function LanguagePicker() {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const normalizedLang = normalizeLanguageTag(i18n.resolvedLanguage ?? i18n.language) ?? 'en'
  const current =
    LANGUAGE_META.find((lang) => lang.code === normalizedLang) ??
    LANGUAGE_META.find((lang) => lang.code === 'en') ??
    LANGUAGE_META[0]

  useEffect(() => {
    if (!open) {
      return
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelectLanguage = useCallback(
    (code: SupportedLanguage) => {
      setUserLanguagePreference(code)
      setOpen(false)
      void i18n.changeLanguage(code).catch((err: unknown) => {
        console.error('Failed to change language:', err)
      })
    },
    [i18n],
  )

  return (
    <div className={styles.langPicker} ref={pickerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.langTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('app.language.switch')}
        onClick={() => setOpen((prev) => !prev)}
      >
        <img
          src={current.flag}
          alt=""
          width={18}
          height={13}
          aria-hidden="true"
          className={styles.langFlag}
        />
        <span className={styles.langLabel}>{current.label}</span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`${styles.langChevron} ${open ? styles.langChevronOpen : ''}`}
        />
      </button>
      {open && (
        <ul className={styles.langMenu} role="listbox" aria-label={t('app.language.switch')}>
          {LANGUAGE_META.map((lang) => {
            const isSelected = lang.code === current.code
            return (
              <li key={lang.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.langOption} ${isSelected ? styles.langOptionActive : ''}`}
                  onClick={() => handleSelectLanguage(lang.code)}
                >
                  <img
                    src={lang.flag}
                    alt=""
                    width={18}
                    height={13}
                    aria-hidden="true"
                    className={styles.langFlag}
                  />
                  <span>{lang.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})

export const AppHeader = memo(function AppHeader({ mode, onOpenSidebar }: AppHeaderProps) {
  const { t } = useTranslation()
  const theme = useThemeStore((state) => state.theme)
  const cycleTheme = useThemeStore((state) => state.cycleTheme)
  const categoryId = getCategoryForMode(mode)

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.mobileMenuBtn}
        onClick={onOpenSidebar}
        aria-label={t('app.aria.openSidebar')}
        title={t('app.aria.openSidebar')}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <div className={styles.capsuleDock} data-category={categoryId}>
        <div className={styles.capsuleFrame}>
          <div className={styles.capsuleGlassShell} aria-hidden="true" />
          <div className={styles.capsulePayload}>
            <LanguagePicker />
            <span className={styles.capsuleDivider} aria-hidden="true" />
            <button
              type="button"
              className={styles.themeToggle}
              onClick={cycleTheme}
              aria-label={t('app.aria.toggleTheme')}
              title={t('app.aria.toggleTheme')}
            >
              {theme === 'dark' ? (
                <Moon size={17} aria-hidden="true" />
              ) : theme === 'light' ? (
                <Sun size={17} aria-hidden="true" />
              ) : (
                <Monitor size={17} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
})
