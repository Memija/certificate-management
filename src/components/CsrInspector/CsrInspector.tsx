import type React from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  Edit3,
  FileKey,
  Key,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

import { ModuleHeader, useToast } from '@/components/shared'
import { useAppStore } from '@/store'
import type { AppMode, ParsedCSR } from '@/types'
import { parseCSRFile } from '@/utils/csr-parser'

import type { CsrSampleId } from './csr-presets'
import {
  createSampleParsedCsr,
  CSR_ACCEPT_EXTENSIONS,
  CSR_SAMPLE_PRESETS,
  isAcceptedCsrFile,
} from './csr-presets'
import { CsrEditorModal } from './CsrEditorModal'
import { CsrErrorCard, CsrParsedView } from './CsrParsedView'

import styles from './CsrInspector.module.css'

export interface CsrInspectorProps {
  onNavigate?: (mode: AppMode) => void
}

interface CSREntry {
  id: string
  name: string
  result: { ok: true; csr: ParsedCSR; privateKeyPem?: string } | { ok: false; error: string }
  loading: boolean
}

export function CsrInspector({ onNavigate }: CsrInspectorProps = {}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const storeSetMode = useAppStore((s) => s.setMode)
  const navigate = onNavigate ?? storeSetMode

  const [entries, setEntries] = useState<CSREntry[]>([])
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [editingCsr, setEditingCsr] = useState<{ csr: ParsedCSR; name: string } | null>(null)

  const dropInputRef = useRef<HTMLInputElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)

  const resolvedActiveId = useMemo(() => {
    if (entries.length === 0) {
      return null
    }
    if (activeEntryId && entries.some((e) => e.id === activeEntryId)) {
      return activeEntryId
    }
    return entries[0]!.id
  }, [entries, activeEntryId])

  const loadedSampleIds = useMemo(() => {
    const ids = new Set<CsrSampleId>()
    for (const preset of CSR_SAMPLE_PRESETS) {
      if (entries.some((e) => e.name === preset.fileName)) {
        ids.add(preset.id)
      }
    }
    return ids
  }, [entries])

  const handleFiles = useCallback(
    async (files: File[]) => {
      const newFiles = files.filter((f) => !entries.some((e) => e.name === f.name))
      if (newFiles.length === 0) {
        const firstExisting = entries.find((e) => files.some((f) => f.name === e.name))
        if (firstExisting) {
          setActiveEntryId(firstExisting.id)
        }
        return
      }

      const pending: CSREntry[] = newFiles.map((f, idx) => ({
        id: `${f.name}-${Date.now()}-${idx}`,
        name: f.name,
        result: { ok: false, error: '' },
        loading: true,
      }))

      setEntries((prev) => [...prev, ...pending])
      if (pending.length > 0) {
        setActiveEntryId(pending[pending.length - 1]!.id)
      }

      for (let i = 0; i < newFiles.length; i += 1) {
        const file = newFiles[i]!
        const targetId = pending[i]!.id
        try {
          const csr = await parseCSRFile(file)
          setEntries((prev) =>
            prev.map((e) =>
              e.id === targetId ? { ...e, loading: false, result: { ok: true, csr } } : e,
            ),
          )
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          setEntries((prev) =>
            prev.map((e) =>
              e.id === targetId
                ? { ...e, loading: false, result: { ok: false, error: message } }
                : e,
            ),
          )
        }
      }
    },
    [entries],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const files = Array.from(e.dataTransfer.files).filter(isAcceptedCsrFile)
      if (files.length > 0) {
        void handleFiles(files)
      }
    },
    [handleFiles],
  )

  const removeEntry = (id: string): void => {
    setEntries((prev) => {
      const remaining = prev.filter((e) => e.id !== id)
      if (resolvedActiveId === id) {
        const removedIdx = prev.findIndex((e) => e.id === id)
        const next = remaining[removedIdx] ?? remaining[removedIdx - 1] ?? remaining[0] ?? null
        setActiveEntryId(next ? next.id : null)
      }
      return remaining
    })
  }

  const clearAll = (): void => {
    setEntries([])
    setActiveEntryId(null)
  }

  const loadSampleCsr = useCallback(
    (sampleId: CsrSampleId = 'standard-pem') => {
      const preset = CSR_SAMPLE_PRESETS.find((p) => p.id === sampleId) ?? CSR_SAMPLE_PRESETS[0]
      const existing = entries.find((e) => e.name === preset.fileName)
      if (existing) {
        setActiveEntryId(existing.id)
        return
      }
      try {
        const { fileName, csr } = createSampleParsedCsr(sampleId)
        const entry: CSREntry = {
          id: `sample-csr-${sampleId}-${Date.now()}`,
          name: fileName,
          result: { ok: true, csr },
          loading: false,
        }
        setEntries((prev) => {
          if (prev.some((e) => e.name === fileName)) {
            return prev
          }
          return [...prev, entry]
        })
        setActiveEntryId(entry.id)
      } catch (err: unknown) {
        console.error('Failed to load sample CSR:', err)
      }
    },
    [entries],
  )

  const getErrorAction = (
    errorCode: string,
  ): { label: string; onClick: () => void } | undefined => {
    if (errorCode === 'ERR_CERT_NOT_CSR') {
      return {
        label: t('app.csr.goToTrustStore', 'Open in Trust Store Inspector'),
        onClick: () => navigate('trust-store'),
      }
    }
    if (errorCode === 'ERR_CRL_NOT_CSR') {
      return {
        label: t('app.csr.goToCrlInspector', 'Open in CRL Inspector'),
        onClick: () => navigate('crl-inspector'),
      }
    }
    return undefined
  }

  const cleanTitle = t('app.csr.title', 'Certificate Signing Request (CSR) Inspector').replace(
    /<\/?\d+>/g,
    '',
  )
  const description = `${t(
    'app.csr.descP1',
    'Verify embedded self-signatures, inspect requested Subject DN attributes and SAN extensions.',
  )} ${t(
    'app.csr.descP2',
    'Client-side cryptographic parsing: modify and re-sign in place without exposing private keys.',
  )}`
  const removeLabel = t('common.remove', 'Remove')
  const activeEntry = entries.find((e) => e.id === resolvedActiveId)

  return (
    <div className={styles.container}>
      <ModuleHeader
        category="inspectionValidation"
        icon={<FileKey size={24} />}
        eyebrowIcon={<FileKey size={12} />}
        eyebrowText={t('app.csr.eyebrow', 'PKCS#10 Request Inspection')}
        title={cleanTitle}
        description={description}
      >
        <div className={styles.headerPills}>
          <span className={`${styles.headerPill} ${styles.headerPillActive}`}>
            <ShieldCheck size={12} className={styles.iconSuccess} aria-hidden="true" />
            <span>{t('app.csr.pills.selfSig', 'Self-Signature Verification')}</span>
          </span>
          <span className={styles.headerPill}>
            <FileKey size={12} className={styles.iconPurple} aria-hidden="true" />
            <span>{t('app.csr.pills.rfc2986', 'PKCS#10 RFC 2986')}</span>
          </span>
          <span className={styles.headerPill}>
            <Edit3 size={12} className={styles.iconInfo} aria-hidden="true" />
            <span>{t('app.csr.pills.editor', 'Interactive Editor & Re-sign')}</span>
          </span>
          <span className={styles.headerPill}>
            <Lock size={12} className={styles.iconWarning} aria-hidden="true" />
            <span>{t('app.csr.pills.offline', '100% Offline Parsing')}</span>
          </span>
        </div>
      </ModuleHeader>

      <div
        className={`drop-zone ${styles.dropZone} ${dragging ? styles.dropZoneDragging : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={dropInputRef}
          type="file"
          accept={CSR_ACCEPT_EXTENSIONS}
          multiple
          aria-label={t('app.csr.dropTitle', 'Drop CSR files here')}
          className={styles.hiddenInput}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) {
              void handleFiles(files)
            }
            e.target.value = ''
          }}
        />
        <Upload size={46} className={styles.dropIcon} aria-hidden="true" />
        <h2 className={styles.dropTitle}>{t('app.csr.dropTitle', 'Drop CSR files here')}</h2>
        <p className={styles.dropDesc}>
          <Trans
            i18nKey="app.csr.dropDesc"
            defaults="Supports PEM and DER · <0>.csr</0> · <1>.req</1> · <2>.pem</2> · <3>.der</3>"
            components={[<code key="0" />, <code key="1" />, <code key="2" />, <code key="3" />]}
          />
        </p>
        <div className={styles.dropActions}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => dropInputRef.current?.click()}
          >
            <Upload size={14} aria-hidden="true" />
            <span>{t('app.csr.addCsr', 'Add CSR')}</span>
          </button>
          {CSR_SAMPLE_PRESETS.map((preset) => {
            const isLoaded = loadedSampleIds.has(preset.id)
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadSampleCsr(preset.id)}
                disabled={isLoaded}
                className="btn btn-secondary btn-sm"
                title={
                  isLoaded
                    ? t('app.csr.sampleAlreadyLoaded', 'Sample CSR is already loaded')
                    : undefined
                }
              >
                <Sparkles size={14} className={styles.iconAccent} aria-hidden="true" />
                <span>{t(preset.labelKey, preset.defaultLabel)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <input
        ref={addFileInputRef}
        type="file"
        accept={CSR_ACCEPT_EXTENSIONS}
        multiple
        aria-label={t('app.csr.addCsr', 'Add CSR')}
        className={styles.hiddenInput}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) {
            void handleFiles(files)
          }
          e.target.value = ''
        }}
      />

      {entries.length > 0 && (
        <section className={`animate-fade-in ${styles.loadedSection}`}>
          <div className={styles.loadedHeader}>
            <h2 className={styles.loadedHeading}>
              {t('app.csr.loadedFiles', 'Loaded Files')} ({entries.length})
            </h2>
            <div className={styles.loadedActions}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => addFileInputRef.current?.click()}
              >
                <Upload size={13} aria-hidden="true" />
                <span>{t('app.csr.addCsr', 'Add CSR')}</span>
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearAll}>
                <X size={13} aria-hidden="true" />
                <span>{t('common.clearAll', 'Clear All')}</span>
              </button>
            </div>
          </div>

          <div className={styles.tabsBar}>
            <span className={styles.tabsLabel}>
              <FileKey size={14} className={styles.iconAccent2} aria-hidden="true" />
              <span>{t('app.csr.tabsLabel', 'CSRs')}</span>
              <span className={styles.tabsCountPill}>{entries.length}</span>:
            </span>
            {entries.map((entry) => {
              const isActive = resolvedActiveId === entry.id
              const cn = entry.result.ok
                ? entry.result.csr.subjectFields.find((f) => f.shortName === 'CN')?.value ||
                  entry.name
                : entry.name
              const hasPrivateKey = entry.result.ok && Boolean(entry.result.privateKeyPem)

              return (
                <div
                  key={entry.id}
                  className={`${styles.tabPill} ${isActive ? styles.tabPillActive : ''} ${!entry.result.ok && !entry.loading ? styles.tabPillError : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveEntryId(entry.id)}
                    className={styles.tabSelectBtn}
                    title={entry.name}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    {isActive && <span className={styles.tabActiveDot} aria-hidden="true" />}
                    <FileKey size={13} aria-hidden="true" />
                    <span className={styles.tabName}>{cn}</span>
                    {hasPrivateKey && (
                      <span
                        title={t('app.csr.editor.privateKeyAvailable', 'Private Key Available')}
                        className={styles.tabKeyIndicator}
                      >
                        <Key size={11} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.tabRemoveBtn}
                    onClick={() => removeEntry(entry.id)}
                    aria-label={`${removeLabel} ${entry.name}`}
                    title={removeLabel}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>

          {activeEntry &&
            (activeEntry.loading ? (
              <div className={`glass-panel ${styles.loadingPanel}`}>
                <RefreshCw size={18} className={`spin ${styles.iconAccent}`} aria-hidden="true" />
                <span className={styles.loadingText}>
                  {t('app.csr.parsing', {
                    name: activeEntry.name,
                    defaultValue: `Parsing ${activeEntry.name}…`,
                  })}
                </span>
              </div>
            ) : activeEntry.result.ok ? (
              <CsrParsedView
                key={activeEntry.id}
                csr={activeEntry.result.csr}
                fileName={activeEntry.name}
                privateKeyPem={activeEntry.result.privateKeyPem}
                onRemove={() => removeEntry(activeEntry.id)}
                onEdit={() =>
                  setEditingCsr({
                    csr: (activeEntry.result as { ok: true; csr: ParsedCSR }).csr,
                    name: activeEntry.name,
                  })
                }
              />
            ) : (
              <CsrErrorCard
                key={activeEntry.id}
                name={activeEntry.name}
                error={activeEntry.result.error}
                action={getErrorAction(activeEntry.result.error)}
                onRemove={() => removeEntry(activeEntry.id)}
              />
            ))}
        </section>
      )}

      {editingCsr && (
        <CsrEditorModal
          isOpen={Boolean(editingCsr)}
          csr={editingCsr.csr}
          initialName={editingCsr.name}
          onClose={() => setEditingCsr(null)}
          onSave={(newCsr, fileName, generatedPrivateKeyPem) => {
            const newId = `csr-edited-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            const newEntry: CSREntry = {
              id: newId,
              name: fileName,
              result: {
                ok: true,
                csr: newCsr,
                privateKeyPem: generatedPrivateKeyPem,
              },
              loading: false,
            }
            setEntries((prev) => [...prev, newEntry])
            setActiveEntryId(newId)
            showToast(
              t('app.csr.editor.saveSuccess', 'CSR successfully re-signed and loaded!'),
              'success',
            )
          }}
        />
      )}
    </div>
  )
}
