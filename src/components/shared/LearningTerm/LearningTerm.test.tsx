import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { TermId } from './index'
import { ALL_LEARNING_TERMS, LearningTerm } from './index'

describe('LearningTerm', () => {
  it('renders plain children without inline tooltip or help cursor wrapper', () => {
    const { container } = render(<LearningTerm termId="nvram">Secure Boot NVRAM</LearningTerm>)

    expect(screen.getByText('Secure Boot NVRAM')).toBeInTheDocument()
    expect(container.querySelector('[title]')).toBeNull()
  })

  it('renders plain children when termId is unknown', () => {
    const unknownTerm = 'nonExistentTerm' as TermId
    const { container } = render(<LearningTerm termId={unknownTerm}>Plain Text</LearningTerm>)

    expect(screen.getByText('Plain Text')).toBeInTheDocument()
    expect(container.querySelector('[title]')).toBeNull()
  })

  it('re-exports ALL_LEARNING_TERMS array containing all 18 expected terms', () => {
    expect(ALL_LEARNING_TERMS).toContain('nvram')
    expect(ALL_LEARNING_TERMS).toContain('x509')
    expect(ALL_LEARNING_TERMS).toContain('der')
    expect(ALL_LEARNING_TERMS.length).toBe(18)
  })
})
