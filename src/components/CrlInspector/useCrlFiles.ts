import { useCallback, useMemo, useState } from 'react'

import { parseCrlFile } from '@/utils/crl-parser'

import type { CrlErrorInfo } from './crl-helpers'
import { buildCrlErrorInfo } from './crl-helpers'
import type { CrlSampleId, LoadedCRL } from './crl-sample-generator'
import {
  createSampleLoadedCrl,
  CRL_SAMPLE_PRESETS,
  SAMPLE_CRL_FILENAME,
} from './crl-sample-generator'

export function useCrlFiles() {
  const [loadedCrls, setLoadedCrls] = useState<LoadedCRL[]>([])
  const [activeCrlId, setActiveCrlId] = useState<string | null>(null)
  const [errorInfo, setErrorInfo] = useState<CrlErrorInfo | null>(null)

  const activeItem = useMemo(() => {
    if (loadedCrls.length === 0) {
      return null
    }
    return loadedCrls.find((c) => c.id === activeCrlId) ?? loadedCrls[0]
  }, [loadedCrls, activeCrlId])

  const loadedSampleIds = useMemo(() => {
    const ids = new Set<CrlSampleId>()
    for (const item of loadedCrls) {
      if (item.sampleId) {
        ids.add(item.sampleId)
      } else if (item.isSample || item.name === SAMPLE_CRL_FILENAME) {
        ids.add('active-pem')
      }
    }
    return ids
  }, [loadedCrls])

  const hasSample = loadedSampleIds.has('active-pem')

  const processFiles = useCallback(
    async (files: File[] | FileList): Promise<void> => {
      const fileList = Array.from(files)
      if (fileList.length === 0) {
        return
      }

      const newItems: LoadedCRL[] = []
      let lastAddedId: string | null = null

      for (const file of fileList) {
        try {
          const parsed = await parseCrlFile(file)
          const alreadyLoaded =
            loadedCrls.find((c) => c.crl.fingerprintSha256 === parsed.fingerprintSha256) ??
            newItems.find((c) => c.crl.fingerprintSha256 === parsed.fingerprintSha256)
          if (alreadyLoaded) {
            lastAddedId = alreadyLoaded.id
            continue
          }

          const item: LoadedCRL = {
            id: `crl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name: file.name,
            crl: parsed,
            isSample: false,
          }
          newItems.push(item)
          lastAddedId = item.id
          setErrorInfo(null)
        } catch (err: unknown) {
          console.warn(`CRL parse error for "${file.name}":`, err)
          setErrorInfo(buildCrlErrorInfo(file.name, err))
        }
      }

      if (newItems.length > 0) {
        setLoadedCrls((prev) => [...prev, ...newItems])
      }
      if (lastAddedId) {
        setActiveCrlId(lastAddedId)
      }
    },
    [loadedCrls],
  )

  const loadSampleCrl = useCallback(
    (sampleId: CrlSampleId = 'active-pem'): void => {
      const preset = CRL_SAMPLE_PRESETS.find((p) => p.id === sampleId) ?? CRL_SAMPLE_PRESETS[0]
      const existing = loadedCrls.find((c) => c.sampleId === sampleId || c.name === preset.fileName)
      if (existing) {
        setActiveCrlId(existing.id)
        return
      }
      try {
        const item = createSampleLoadedCrl(sampleId)
        setLoadedCrls((prev) => {
          if (prev.some((c) => c.sampleId === sampleId || c.name === preset.fileName)) {
            return prev
          }
          return [...prev, item]
        })
        setActiveCrlId(item.id)
        setErrorInfo(null)
      } catch (err: unknown) {
        console.error('Failed to load sample CRL:', err)
        setErrorInfo(buildCrlErrorInfo(preset.fileName, err))
      }
    },
    [loadedCrls],
  )

  const removeCrl = useCallback(
    (id: string): void => {
      setLoadedCrls((prev) => {
        const remaining = prev.filter((c) => c.id !== id)
        if (activeItem?.id === id) {
          const removedIdx = prev.findIndex((c) => c.id === id)
          const next = remaining[removedIdx] ?? remaining[removedIdx - 1] ?? remaining[0] ?? null
          setActiveCrlId(next ? next.id : null)
        }
        return remaining
      })
    },
    [activeItem],
  )

  const clearAll = useCallback((): void => {
    setLoadedCrls([])
    setActiveCrlId(null)
    setErrorInfo(null)
  }, [])

  const replaceActiveCrl = useCallback(
    async (file: File): Promise<void> => {
      if (!activeItem) {
        return
      }
      const targetId = activeItem.id
      try {
        const parsed = await parseCrlFile(file)
        setLoadedCrls((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? {
                  id: targetId,
                  name: file.name,
                  crl: parsed,
                  isSample: false,
                }
              : c,
          ),
        )
        setErrorInfo(null)
      } catch (err: unknown) {
        console.warn(`CRL replace error for "${file.name}":`, err)
        setErrorInfo(buildCrlErrorInfo(file.name, err))
      }
    },
    [activeItem],
  )

  return {
    loadedCrls,
    activeItem,
    hasSample,
    loadedSampleIds,
    errorInfo,
    setErrorInfo,
    setActiveCrlId,
    processFiles,
    loadSampleCrl,
    removeCrl,
    clearAll,
    replaceActiveCrl,
  }
}
