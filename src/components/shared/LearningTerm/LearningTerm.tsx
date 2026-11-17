import type React from 'react'
import { useTranslation } from 'react-i18next'

import type { TermId } from '@/types'

import styles from './LearningTerm.module.css'

export interface LearningTermProps {
  termId: TermId
  children: React.ReactNode
}

export function LearningTerm({ termId, children }: LearningTermProps) {
  const { t } = useTranslation()
  const definition = t(`app.learningTerms.${termId}`, '')

  if (!definition) {
    return <>{children}</>
  }

  return (
    <span className={styles.term} title={definition}>
      {children}
    </span>
  )
}
