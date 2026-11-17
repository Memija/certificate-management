import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'

import { useToast } from '@/components/shared'

import styles from './WinCertListCard.module.css'

export interface InlineCopyButtonProps {
  text: string
  fieldLabel: string
}

export const InlineCopyButton = memo(function InlineCopyButton({
  text,
  fieldLabel,
}: InlineCopyButtonProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const copyLabel = `${t('common.copyToClipboard', 'Copy to clipboard')}: ${fieldLabel}`

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      showToast(t('common.copiedToClipboard', 'Copied to clipboard'), 'success')
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        setCopied(false)
        timerRef.current = null
      }, 1500)
    } catch (err: unknown) {
      console.error('Clipboard copy failed:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={copyLabel}
      title={copyLabel}
      className={`${styles.inlineCopyBtn} ${copied ? styles.inlineCopyBtnCopied : ''}`}
    >
      <Copy size={12} aria-hidden="true" />
    </button>
  )
})
