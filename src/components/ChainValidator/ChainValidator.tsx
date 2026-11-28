import type React from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, GitFork, List, Shield, ShieldCheck, Trash2, Upload, X } from 'lucide-react'

import { ModuleHeader, type SamplePresetItem, SamplePresetsBar } from '@/components/shared'
import { useAppStore } from '@/store'
import type { AppMode, ChainPreset } from '@/types'

import { ChainCertTabsBar, ChainStatusSummaryBanner } from './ChainCertTabsBar'
import { ChainHierarchyTree } from './ChainHierarchyTree'
import { ChainEmptyInputGrid, ChainInlinePemDrawer } from './ChainInputPanels'
import { ChainNodeInspectorModal } from './ChainNodeInspectorModal'
import { ChainPfxUnlockModal } from './ChainPfxUnlockModal'
import { ChainSingleCertView } from './ChainSingleCertView'
import { useChainPool } from './useChainPool'

import styles from './ChainValidator.module.css'

export interface ChainValidatorProps {
  onNavigate?: (mode: AppMode) => void
}

const SAMPLE_PRESETS: readonly {
  id: ChainPreset
  labelKey: string
  defaultLabel: string
  toastLabel: string
}[] = [
  {
    id: '3-tier-web',
    labelKey: 'app.chain.sample3Tier',
    defaultLabel: '3-Tier Web PKI',
    toastLabel: '3-Tier Web PKI (Root → Inter → Leaf)',
  },
  {
    id: '4-tier-enterprise',
    labelKey: 'app.chain.sample4Tier',
    defaultLabel: '4-Tier Enterprise PKI',
    toastLabel: '4-Tier Enterprise (Root → Policy → Issuing → Leaf)',
  },
  {
    id: 'multi-leaf-branch',
    labelKey: 'app.chain.sampleMultiLeaf',
    defaultLabel: 'Multi-Leaf Branch',
    toastLabel: 'Multi-Leaf Branching Tree',
  },
  {
    id: 'broken-intermediate',
    labelKey: 'app.chain.sampleBroken',
    defaultLabel: 'Broken Chain Warning',
    toastLabel: 'Broken Chain (Missing Intermediate)',
  },
  {
    id: 'expired-chain',
    labelKey: 'app.chain.sampleExpired',
    defaultLabel: 'Expired Certificate',
    toastLabel: 'Expired Leaf Certificate Chain',
  },
  {
    id: 'invalid-signature',
    labelKey: 'app.chain.sampleBadSig',
    defaultLabel: 'Invalid Signature',
    toastLabel: 'Invalid Signature (Tampered Leaf)',
  },
]

export function ChainValidator({ onNavigate }: ChainValidatorProps = {}) {
  const { t } = useTranslation()
  const storeSetMode = useAppStore((s) => s.setMode)
  const navigate = onNavigate ?? storeSetMode

  const [isDragging, setIsDragging] = useState(false)
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    certs,
    error,
    suggestedMode,
    pemInput,
    setPemInput,
    showPemPaste,
    setShowPemPaste,
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
  } = useChainPool()

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        void processFiles(e.dataTransfer.files)
      }
    },
    [processFiles],
  )

  const dismissErrorLabel = t('app.educationCenter.modal.close', 'Close')

  const presetItems = useMemo<SamplePresetItem[]>(
    () =>
      SAMPLE_PRESETS.map((preset) => ({
        id: preset.id,
        label: t(preset.labelKey, preset.defaultLabel),
        isActive: activePreset === preset.id && certs.length > 0,
        onSelect: () => loadSample(preset.id, preset.toastLabel),
      })),
    [activePreset, certs.length, loadSample, t],
  )

  return (
    <div
      className={styles.container}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsDragging(false)
        }
      }}
    >
      {isDragging && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragCard}>
            <Upload size={48} className={styles.iconCyan} aria-hidden="true" />
            <p className={styles.dragTitle}>
              {t('app.chain.dropZoneTitle', 'Drop certificates here to reconstruct trust graph')}
            </p>
            <p className={styles.dragDesc}>
              {t(
                'app.chain.dropZoneDesc',
                'Upload single files or multi-certificate bundles (.pem, .crt, .p7b, .pfx)',
              )}
            </p>
          </div>
        </div>
      )}

      <div className={styles.inner}>
        <ModuleHeader
          category="inspectionValidation"
          icon={<GitFork size={24} />}
          eyebrowIcon={<GitFork size={12} />}
          eyebrowText={t('app.chain.eyebrow', 'Path Validation & Hierarchy')}
          title={t('app.chain.title', 'Certificate Chain Visualizer & Validator')}
          description={t(
            'app.chain.subtitle',
            'Reconstruct certification paths from end-entity to trust anchor. Verify cryptographic signatures, inspect Authority Key Identifiers, and detect missing intermediate certificates.',
          )}
          actions={
            certs.length > 0 ? (
              <>
                <div className={styles.viewModeToggle}>
                  <button
                    type="button"
                    className={`btn btn-sm ${viewMode === 'graph' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('graph')}
                  >
                    <GitFork size={13} aria-hidden="true" />
                    <span>{t('app.chain.visualGraph', 'Visual Graph')}</span>
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('list')}
                  >
                    <List size={13} aria-hidden="true" />
                    <span>{t('app.chain.classicStack', 'Classic Stack')}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary btn-sm"
                >
                  <Upload size={13} aria-hidden="true" />
                  <span>{t('app.chain.addCerts', 'Add Certs')}</span>
                </button>
                <button type="button" onClick={clearAll} className="btn btn-danger btn-sm">
                  <Trash2 size={13} aria-hidden="true" />
                  <span>{t('common.clear', 'Clear')}</span>
                </button>
              </>
            ) : undefined
          }
        >
          <div className={styles.headerPills}>
            <span className={`${styles.headerPill} ${styles.headerPillActive}`}>
              <ShieldCheck size={12} className={styles.iconSuccess} aria-hidden="true" />
              <span>{t('app.chain.pills.sigVerify', 'Signature Verification')}</span>
            </span>
            <span className={styles.headerPill}>
              <Shield size={12} className={styles.iconInfo} aria-hidden="true" />
              <span>{t('app.chain.pills.rootAnchor', 'Root Anchor Detection')}</span>
            </span>
            <span className={styles.headerPill}>
              <AlertTriangle size={12} className={styles.iconWarning} aria-hidden="true" />
              <span>{t('app.chain.pills.brokenChain', 'Broken Chain Isolation')}</span>
            </span>
            <span className={styles.headerPill}>
              <GitFork size={12} className={styles.iconPurple} aria-hidden="true" />
              <span>{t('app.chain.pills.treeGraph', 'Interactive Tree Graph')}</span>
            </span>
          </div>
        </ModuleHeader>

        <SamplePresetsBar items={presetItems} />

        <input
          ref={fileInputRef}
          id="chain-file-input"
          type="file"
          multiple
          accept=".pem,.crt,.cer,.der,.p7b,.p12,.pfx,.jks"
          className={styles.hiddenInput}
          aria-label={t('app.chain.addCerts', 'Add Certs')}
          onChange={(e) => {
            if (e.target.files) {
              void processFiles(e.target.files)
            }
            e.target.value = ''
          }}
        />

        {error && (
          <div className={styles.errorAlert} role="alert">
            <div className={styles.errorContent}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
            <div className={styles.errorActions}>
              {suggestedMode && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(suggestedMode)}
                >
                  {suggestedMode === 'crl-inspector'
                    ? t('app.trustStore.warnings.goToCrlInspector', 'Open in CRL Inspector')
                    : t('app.trustStore.warnings.goToCsrInspector', 'Open in CSR Inspector')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-icon"
                onClick={dismissError}
                aria-label={dismissErrorLabel}
                title={dismissErrorLabel}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {certs.length === 0 ? (
          <ChainEmptyInputGrid
            isDragging={isDragging}
            pemInput={pemInput}
            onPemInputChange={setPemInput}
            onLoadPem={handleLoadPem}
            onTriggerFileSelect={() => fileInputRef.current?.click()}
          />
        ) : (
          <div className={styles.loadedStack}>
            <ChainCertTabsBar
              allNodes={allNodes}
              effectiveActiveNodeId={effectiveActiveNodeId}
              showPemPaste={showPemPaste}
              onSelectFullChain={() => setActiveNodeId('all')}
              onSelectNode={(nodeId) => setActiveNodeId(nodeId)}
              onRemoveNode={removeCert}
              onTogglePemPaste={() => setShowPemPaste((prev) => !prev)}
            />

            {showPemPaste && (
              <ChainInlinePemDrawer
                pemInput={pemInput}
                onPemInputChange={setPemInput}
                onLoadPem={handleLoadPem}
                onCancel={() => setShowPemPaste(false)}
              />
            )}

            {selectedNode ? (
              <ChainSingleCertView
                node={selectedNode}
                totalNodesCount={allNodes.length}
                onSelectNode={(node) => setActiveNodeId(node.id)}
                onInspectNode={(node) => setInspectingNodeId(node.id)}
                onViewFullChain={() => setActiveNodeId('all')}
                onRemoveCert={removeCert}
              />
            ) : (
              <>
                <ChainStatusSummaryBanner summary={summary} />

                <ChainHierarchyTree
                  viewMode={viewMode}
                  rootNodes={rootNodes}
                  orphanNodes={orphanNodes}
                  allNodes={allNodes}
                  selectedId={effectiveActiveNodeId}
                  onInspectNode={(node) => setInspectingNodeId(node.id)}
                />
              </>
            )}
          </div>
        )}

        {inspectingNode && (
          <ChainNodeInspectorModal
            node={inspectingNode}
            allNodes={allNodes}
            onSelectNode={(node) => setInspectingNodeId(node.id)}
            onClose={() => setInspectingNodeId(null)}
          />
        )}

        {pendingPfxUnlock && (
          <ChainPfxUnlockModal
            state={pendingPfxUnlock}
            onChangePassword={(nextPassword) =>
              setPendingPfxUnlock((prev) =>
                prev ? { ...prev, passwordInput: nextPassword, error: undefined } : null,
              )
            }
            onRequirePasswordError={() =>
              setPendingPfxUnlock((prev) =>
                prev
                  ? {
                      ...prev,
                      error: t(
                        'app.trustStore.inspector.pkcs12RequiresPassword',
                        'This PKCS#12 file requires a password.',
                      ),
                    }
                  : null,
              )
            }
            onSubmit={(e) => void handleUnlockPfxSubmit(e)}
            onClose={() => setPendingPfxUnlock(null)}
          />
        )}
      </div>
    </div>
  )
}
