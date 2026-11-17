import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '@/components/shared'
import { decryptJKSPrivateKey, parseTrustStoreFile } from '@/utils/trust-store-parser'

import type { LoadedTrustStoreFile, TrustStoreSamplePreset } from './trust-store-helpers'

function applyJksPasswordUnlock(file: LoadedTrustStoreFile, pwd: string): LoadedTrustStoreFile {
  const nextEntries = [...file.store.entries]
  let nextWarnings = [...file.store.warnings]
  let errorEncountered = false

  for (let i = 0; i < nextEntries.length; i += 1) {
    const item = nextEntries[i]
    if (item.isEncryptedJksKey && item.encryptedJksKeyData && !item.privateKeyPem) {
      try {
        const pem = decryptJKSPrivateKey(item.encryptedJksKeyData, pwd)
        nextEntries[i] = { ...item, privateKeyPem: pem }
      } catch {
        errorEncountered = true
      }
    }
  }

  if (errorEncountered) {
    if (!nextWarnings.includes('Incorrect password.')) {
      nextWarnings.unshift('Incorrect password.')
    }
  } else {
    nextWarnings = nextWarnings.filter(
      (w) =>
        !w.includes('JKS MAC') &&
        w !== 'Incorrect password.' &&
        !w.includes('private key is encrypted'),
    )
  }

  return {
    ...file,
    passwordInput: errorEncountered ? file.passwordInput : '',
    store: { ...file.store, entries: nextEntries, warnings: nextWarnings },
  }
}

export function useTrustStoreFiles() {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [loadedFiles, setLoadedFiles] = useState<LoadedTrustStoreFile[]>([])
  const [globalLoading, setGlobalLoading] = useState(false)
  const [activeFileId, setActiveFileId] = useState<string | null>(null)

  const activeFile = useMemo(() => {
    if (loadedFiles.length === 0) {
      return null
    }
    return loadedFiles.find((f) => f.id === activeFileId) ?? loadedFiles[0]
  }, [loadedFiles, activeFileId])

  const processFiles = useCallback(
    async (
      files: File[],
      meta?: { isSample?: boolean; samplePasswordHint?: string },
    ): Promise<void> => {
      if (files.length === 0) {
        return
      }
      setGlobalLoading(true)
      const newEntries: LoadedTrustStoreFile[] = []

      try {
        for (const file of files) {
          const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          try {
            const result = await parseTrustStoreFile(file, '')
            if (result.needsPassword) {
              result.warnings = result.warnings.filter((w) => w !== 'Incorrect password.')
            }
            newEntries.push({
              id,
              name: file.name,
              store: result,
              needsPassword: result.needsPassword,
              pendingFile: result.needsPassword ? file : undefined,
              passwordInput: '',
              isSample: meta?.isSample,
              samplePasswordHint: meta?.samplePasswordHint,
            })
          } catch (err: unknown) {
            const errMessage =
              err instanceof Error
                ? err.message
                : t('app.trustStore.inspector.unknownError', 'Unknown error')
            console.error(`Failed to parse trust store file "${file.name}":`, err)
            newEntries.push({
              id,
              name: file.name,
              store: { format: 'Unknown', entries: [], warnings: [errMessage] },
            })
          }
        }

        if (newEntries.length > 0) {
          setLoadedFiles((prev) => [...prev, ...newEntries])
          setActiveFileId(newEntries[newEntries.length - 1].id)
        }
      } finally {
        setGlobalLoading(false)
      }
    },
    [t],
  )

  const handleLoadPreset = useCallback(
    async (preset: TrustStoreSamplePreset): Promise<void> => {
      const existing = loadedFiles.find((f) => f.isSample && f.name === preset.fileName)
      if (existing) {
        setActiveFileId(existing.id)
        return
      }
      try {
        const file = preset.createFile()
        await processFiles([file], {
          isSample: true,
          samplePasswordHint: preset.passwordHint,
        })
      } catch (err: unknown) {
        console.error('Failed to load sample preset:', err)
        showToast(t('common.error', 'Error'), 'error')
      }
    },
    [loadedFiles, processFiles, showToast, t],
  )

  const removeFile = useCallback(
    (id: string): void => {
      setLoadedFiles((prev) => {
        const remaining = prev.filter((f) => f.id !== id)
        if (activeFile?.id === id) {
          const removedIndex = prev.findIndex((f) => f.id === id)
          const nextActive =
            remaining[removedIndex] ?? remaining[removedIndex - 1] ?? remaining[0] ?? null
          setActiveFileId(nextActive ? nextActive.id : null)
        }
        return remaining
      })
    },
    [activeFile],
  )

  const clearAllFiles = useCallback((): void => {
    setLoadedFiles([])
    setActiveFileId(null)
  }, [])

  const handlePasswordChange = useCallback((id: string, val: string): void => {
    setLoadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, passwordInput: val } : f)))
  }, [])

  const handlePasswordSubmit = useCallback(
    async (id: string, password: string): Promise<void> => {
      const entry = loadedFiles.find((f) => f.id === id)
      if (!entry?.pendingFile) {
        return
      }

      setLoadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, loading: true } : f)))

      try {
        const result = await parseTrustStoreFile(entry.pendingFile, password)
        setLoadedFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  store: result,
                  needsPassword: result.needsPassword,
                  loading: false,
                  passwordInput: result.needsPassword ? f.passwordInput : '',
                }
              : f,
          ),
        )
      } catch (err: unknown) {
        console.error('Failed to unlock PKCS#12 file:', err)
        const rawMsg = err instanceof Error ? err.message : ''
        const isIncorrect =
          rawMsg.includes('password') || rawMsg.includes('MAC') || rawMsg === 'Incorrect password.'
        const warningText = isIncorrect
          ? 'Incorrect password.'
          : rawMsg || t('app.trustStore.inspector.decryptionFailed', 'Decryption failed.')

        setLoadedFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  store: { format: 'PKCS12', entries: [], warnings: [warningText] },
                  needsPassword: true,
                  loading: false,
                }
              : f,
          ),
        )
      }
    },
    [loadedFiles, t],
  )

  const handleJksUnlockSubmit = useCallback((id: string, pwd: string): void => {
    setLoadedFiles((prev) => prev.map((f) => (f.id === id ? applyJksPasswordUnlock(f, pwd) : f)))
  }, [])

  return {
    loadedFiles,
    globalLoading,
    activeFile,
    setActiveFileId,
    processFiles,
    handleLoadPreset,
    removeFile,
    clearAllFiles,
    handlePasswordChange,
    handlePasswordSubmit,
    handleJksUnlockSubmit,
  }
}
