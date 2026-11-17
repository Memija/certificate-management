import type React from 'react'
import { memo } from 'react'

import type { NavCategoryId } from '@/types'

import styles from './ModuleHeader.module.css'

export interface ModuleHeaderProps {
  category: NavCategoryId
  eyebrowIcon?: React.ReactNode
  eyebrowText: string
  title: string
  description: string
  icon: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}

export const ModuleHeader = memo(function ModuleHeader({
  category,
  eyebrowIcon,
  eyebrowText,
  title,
  description,
  icon,
  actions,
  children,
}: ModuleHeaderProps) {
  return (
    <header className={`${styles.header} ${styles[category]}`} data-category={category}>
      <div className={styles.content}>
        <div className={styles.iconBox} aria-hidden="true">
          {icon}
        </div>
        <div className={styles.body}>
          <div className={styles.eyebrow}>
            {eyebrowIcon !== undefined && eyebrowIcon !== null && (
              <span className={styles.eyebrowIcon} aria-hidden="true">
                {eyebrowIcon}
              </span>
            )}
            <span>{eyebrowText}</span>
          </div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
          {children !== undefined && children !== null && (
            <div className={styles.extra}>{children}</div>
          )}
        </div>
      </div>
      {actions !== undefined && actions !== null && <div className={styles.actions}>{actions}</div>}
    </header>
  )
})
