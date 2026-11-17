import type React from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '@/components/shared'
import type {
  AppMode,
  ChainPreset,
  ParsedCertificate,
  SimpleTranslateFn,
  TranslateFn,
} from '@/types'
import { createCryptographicChain } from '@/utils/sample-chain-generator'
import { parsePemToCerts, parseTrustStoreFile } from '@/utils/trust-store-parser'

import { buildChains, computeChainSummary } from './chain-validator-logic'
import type { PendingPfxUnlockState } from './ChainPfxUnlockModal'

function localizeUploadWarning(
  rawWarn: string,
  t: TranslateFn,
): { message: string; suggestedMode?: AppMode } {
  const tr = t as SimpleTranslateFn
  if (rawWarn === 'This PKCS#12 file requires a password.') {
    return { message: tr('app.trustStore.inspector.pkcs12RequiresPassword', rawWarn) }
  }
  if (rawWarn === 'Incorrect password.') {
    return { message: tr('app.trustStore.inspector.incorrectPassword', rawWarn) }
  }
  if (rawWarn === 'ERR_CRL_FILE') {
    return {
      message: tr('app.trustStore.warnings.crlFile', 'This file is a CRL, not a certificate.'),
      suggestedMode: 'crl-inspector',
    }
  }
  if (rawWarn === 'ERR_CSR_FILE') {
    return {
      message: tr('app.trustStore.warnings.csrFile', 'This file is a CSR, not a certificate.'),
      suggestedMode: 'csr-inspector',
    }
  }
  return { message: rawWarn }
}

export function useChainPool() {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [certs, setCerts] = useState<ParsedCertificate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [suggestedMode, setSuggestedMode] = useState<AppMode | undefined>(undefined)
  const [pemInput, setPemInput] = useState('')
  const [showPemPaste, setShowPemPaste] = useState(false)
  const [activeNodeId, setActiveNodeId] = useState<string | 'all'>('all')
  const [inspectingNodeId, setInspectingNodeId] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<ChainPreset | null>(null)
  const [pendingPfxUnlock, setPendingPfxUnlock] = useState<PendingPfxUnlockState | null>(null)

  const chainGraph = useMemo(() => buildChains(certs), [certs])
  const { rootNodes, orphanNodes, allNodes } = chainGraph
  const summary = useMemo(() => computeChainSummary(certs, chainGraph), [certs, chainGraph])

  const effectiveActiveNodeId = useMemo(() => {
    if (allNodes.length === 0) {
      return null
    }
    if (activeNodeId === 'all' || allNodes.some((n) => n.id === activeNodeId)) {
      return activeNodeId
    }
    return allNodes.length > 1 ? 'all' : allNodes[0]!.id
  }, [allNodes, activeNodeId])

  const selectedNode = useMemo(
    () =>
      effectiveActiveNodeId && effectiveActiveNodeId !== 'all'
        ? (allNodes.find((n) => n.id === effectiveActiveNodeId) ?? null)
        : null,
    [allNodes, effectiveActiveNodeId],
  )

  const inspectingNode = useMemo(
    () => (inspectingNodeId ? (allNodes.find((n) => n.id === inspectingNodeId) ?? null) : null),
    [allNodes, inspectingNodeId],
  )

  const notifyPoolLoaded = useCallback(
    (count: number) => {
      const fallback = `Loaded ${count} certificate${count === 1 ? '' : 's'} into chain pool`
      showToast(t('app.chain.loadedPoolSuccess', { count, defaultValue: fallback }), 'success')
    },
    [showToast, t],
  )

  const handleUnlockPfxSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!pendingPfxUnlock || pendingPfxUnlock.loading) {
      return
    }
    if (!pendingPfxUnlock.passwordInput.trim()) {
      const reqMsg = t(
        'app.trustStore.inspector.pkcs12RequiresPassword',
        'This PKCS#12 file requires a password.',
      )
      setPendingPfxUnlock((prev) => (prev ? { ...prev, loading: false, error: reqMsg } : null))
      return
    }

    setPendingPfxUnlock((prev) => (prev ? { ...prev, loading: true, error: undefined } : null))

    try {
      const parsed = await parseTrustStoreFile(
        pendingPfxUnlock.file,
        pendingPfxUnlock.passwordInput,
      )
      if (parsed.entries.length > 0) {
        const newCerts = parsed.entries.map((entry) => entry.certificate)
        setActivePreset(null)
        setCerts((prev) => [...prev, ...newCerts])
        setActiveNodeId('all')
        setPendingPfxUnlock(null)
        notifyPoolLoaded(newCerts.length)
      } else {
        const rawWarn = parsed.warnings[0] ?? 'Incorrect password.'
        const localized = localizeUploadWarning(rawWarn, t)
        setPendingPfxUnlock((prev) =>
          prev ? { ...prev, loading: false, error: localized.message } : null,
        )
      }
    } catch (err: unknown) {
      console.error('Failed to unlock PKCS#12 file:', err)
      const fallback = t('app.trustStore.inspector.incorrectPassword', 'Incorrect password.')
      const msg = err instanceof Error && err.message ? err.message : fallback
      setPendingPfxUnlock((prev) => (prev ? { ...prev, loading: false, error: msg } : null))
    }
  }

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null)
      setSuggestedMode(undefined)
      const files = Array.from(fileList)
      const certsToAdd: ParsedCertificate[] = []
      let pfxToUnlock: File | null = null
      let encounteredError: string | null = null
      let encounteredMode: AppMode | undefined

      for (const file of files) {
        try {
          const parsed = await parseTrustStoreFile(file, '')
          if (parsed.needsPassword) {
            if (!pfxToUnlock) {
              pfxToUnlock = file
            }
            continue
          }
          if (parsed.entries.length > 0) {
            for (const entry of parsed.entries) {
              certsToAdd.push(entry.certificate)
            }
          } else if (parsed.warnings.length > 0) {
            const localized = localizeUploadWarning(parsed.warnings[0]!, t)
            encounteredError = t('app.chain.fileWarning', {
              fileName: file.name,
              warning: localized.message,
              defaultValue: `Warning for "${file.name}": ${localized.message}`,
            })
            encounteredMode = localized.suggestedMode
          }
        } catch (err: unknown) {
          console.error('Failed to process uploaded certificate file:', err)
          const errMsg = err instanceof Error ? err.message : 'Unknown error'
          encounteredError = t('app.chain.fileProcessError', {
            fileName: file.name,
            error: errMsg,
            defaultValue: `Failed to process "${file.name}": ${errMsg}`,
          })
        }
      }

      if (certsToAdd.length > 0) {
        setActivePreset(null)
        setCerts((prev) => [...prev, ...certsToAdd])
        setActiveNodeId('all')
        notifyPoolLoaded(certsToAdd.length)
      }

      if (pfxToUnlock) {
        setPendingPfxUnlock({ file: pfxToUnlock, passwordInput: '', loading: false })
      } else {
        setPendingPfxUnlock(null)
        if (encounteredError) {
          setError(encounteredError)
          setSuggestedMode(encounteredMode)
        } else if (files.length > 0 && certsToAdd.length === 0) {
          setError(
            t(
              'app.chain.noValidCerts',
              'No valid X.509 certificates could be extracted from the uploaded files.',
            ),
          )
        }
      }
    },
    [notifyPoolLoaded, t],
  )

  const handleLoadPem = (): void => {
    const trimmed = pemInput.trim()
    setError(null)
    setSuggestedMode(undefined)
    if (!trimmed) {
      setError(t('app.ocsp.emptyError', 'Please provide a PEM certificate or select a sample.'))
      return
    }
    if (
      trimmed.includes('BEGIN CERTIFICATE REQUEST') ||
      trimmed.includes('NEW CERTIFICATE REQUEST')
    ) {
      setError(
        t('app.trustStore.warnings.csrFile', 'This input is a CSR, not an X.509 certificate.'),
      )
      setSuggestedMode('csr-inspector')
      return
    }
    if (trimmed.includes('BEGIN X509 CRL') || trimmed.includes('BEGIN CRL')) {
      setError(
        t('app.trustStore.warnings.crlFile', 'This input is a CRL, not an X.509 certificate.'),
      )
      setSuggestedMode('crl-inspector')
      return
    }

    const parsedCerts = parsePemToCerts(trimmed)
    if (parsedCerts.length === 0) {
      setError(
        t(
          'app.ocsp.invalidPem',
          'Invalid PEM certificate provided. Please check the certificate formatting.',
        ),
      )
      return
    }

    setActivePreset(null)
    setCerts((prev) => [...prev, ...parsedCerts])
    setActiveNodeId('all')
    setPemInput('')
    setShowPemPaste(false)
    notifyPoolLoaded(parsedCerts.length)
  }

  const loadSample = (preset: ChainPreset, toastLabel: string): void => {
    if (activePreset === preset && certs.length > 0) {
      return
    }
    try {
      const sampleCerts = createCryptographicChain(preset)
      setActivePreset(preset)
      setCerts(sampleCerts)
      setInspectingNodeId(null)
      setActiveNodeId('all')
      setError(null)
      setSuggestedMode(undefined)
      setPendingPfxUnlock(null)
      showToast(
        t('app.chain.loadedSample', {
          label: toastLabel,
          defaultValue: `Loaded sample: ${toastLabel}`,
        }),
        'info',
      )
    } catch (err: unknown) {
      console.error('Failed to load sample chain:', err)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(
        t('app.chain.failedLoadSample', {
          error: errMsg,
          defaultValue: `Failed to load sample: ${errMsg}`,
        }),
      )
    }
  }

  const removeCert = useCallback(
    (nodeId: string) => {
      const targetNode = allNodes.find((n) => n.id === nodeId)
      if (!targetNode) {
        return
      }
      setActivePreset(null)
      setCerts((prev) => prev.filter((c) => c !== targetNode.cert))
      showToast(t('app.chain.certRemoved', 'Certificate removed from pool'), 'info')
    },
    [allNodes, showToast, t],
  )

  const clearAll = (): void => {
    setCerts([])
    setError(null)
    setSuggestedMode(undefined)
    setPemInput('')
    setShowPemPaste(false)
    setActiveNodeId('all')
    setInspectingNodeId(null)
    setActivePreset(null)
    setPendingPfxUnlock(null)
  }

  const dismissError = (): void => {
    setError(null)
    setSuggestedMode(undefined)
  }

  return {
    certs,
    error,
    suggestedMode,
    pemInput,
    setPemInput,
    showPemPaste,
    setShowPemPaste,
    activeNodeId,
    setActiveNodeId,
    effectiveActiveNodeId,
    selectedNode,
    inspectingNode,
    setInspectingNodeId,
    activePreset,
    pendingPfxUnlock,
    setPendingPfxUnlock,
    rootNodes,
    orphanNodes,
    allNodes,
    summary,
    handleUnlockPfxSubmit,
    processFiles,
    handleLoadPem,
    loadSample,
    removeCert,
    clearAll,
    dismissError,
  }
}
