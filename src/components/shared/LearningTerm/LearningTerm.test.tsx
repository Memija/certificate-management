import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import i18n from '@/i18n'

import type { TermId } from './index'
import { ALL_LEARNING_TERMS, LearningTerm } from './index'

describe('LearningTerm', () => {
  it('renders children with accessible title tooltip for defined PKI terms', () => {
    render(<LearningTerm termId="nvram">Secure Boot NVRAM</LearningTerm>)

    const termEl = screen.getByText('Secure Boot NVRAM')
    expect(termEl.tagName).toBe('SPAN')
    expect(termEl).toHaveAttribute('title')
    expect(termEl.getAttribute('title')).toMatch(/Non-Volatile Random-Access Memory/i)
  })

  it('updates localized tooltip when language switches', async () => {
    render(<LearningTerm termId="x509">X.509</LearningTerm>)

    const enTitle = screen.getByText('X.509').getAttribute('title')
    expect(enTitle).toBeTruthy()

    await act(async () => {
      await i18n.changeLanguage('de')
    })

    const deTitle = screen.getByText('X.509').getAttribute('title')
    expect(deTitle).toBeTruthy()
    expect(deTitle).not.toBe(enTitle)
  })

  it('renders plain children without wrapper span when termId has no definition', () => {
    const unknownTerm = 'nonExistentTerm' as TermId
    const { container } = render(<LearningTerm termId={unknownTerm}>Plain Text</LearningTerm>)

    expect(screen.getByText('Plain Text')).toBeInTheDocument()
    expect(container.querySelector('span[title]')).toBeNull()
  })

  it('re-exports ALL_LEARNING_TERMS array containing all 18 expected terms', () => {
    expect(ALL_LEARNING_TERMS).toContain('nvram')
    expect(ALL_LEARNING_TERMS).toContain('x509')
    expect(ALL_LEARNING_TERMS).toContain('der')
    expect(ALL_LEARNING_TERMS.length).toBe(18)
  })
})
