import type React from 'react'

import type { TermId } from '@/types'

export interface LearningTermProps {
  termId: TermId
  children: React.ReactNode
}

export function LearningTerm({ children }: LearningTermProps) {
  return <>{children}</>
}
