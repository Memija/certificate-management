import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, FileText, GitFork, Globe, Shield, ShieldCheck, X } from 'lucide-react'

import type { ChainNode, ChainValidationSummary } from './chain-validator-logic'
import { getNodeRole, getSubjectCN, isCertExpired } from './chain-validator-logic'

import styles from './ChainValidator.module.css'

export interface ChainStatusSummaryBannerProps {
  summary: ChainValidationSummary
}

export const ChainStatusSummaryBanner = memo(function ChainStatusSummaryBanner({
  summary,
}: ChainStatusSummaryBannerProps) {
  const { t } = useTranslation()

  return (
    <div
      className={`glass-panel ${styles.statusBanner} ${summary.isComplete ? styles.statusBannerValid : styles.statusBannerWarning}`}
    >
      <div className={styles.statusBannerLeft}>
        <div className={`metric-icon-wrap ${summary.isComplete ? 'success' : 'warning'}`}>
          {summary.isComplete ? (
            <ShieldCheck size={24} aria-hidden="true" />
          ) : (
            <AlertTriangle size={24} aria-hidden="true" />
          )}
        </div>
        <div>
          <h2 className={summary.isComplete ? styles.statusTitleValid : styles.statusTitleWarning}>
            {summary.isComplete
              ? t('app.chain.validCompleteHierarchy', 'Valid Complete Trust Hierarchy')
              : t(
                  'app.chain.incompleteChain',
                  'Incomplete Chain (Missing Intermediate or Issuer in Pool)',
                )}
          </h2>
          <p className={styles.statusDesc}>
            {summary.isComplete
              ? t(
                  'app.chain.allCertsLinkRoot',
                  'All {{count}} certificate(s) link back to a verified self-signed Root CA.',
                  { count: summary.totalCount },
                )
              : t(
                  'app.chain.missingParentDesc',
                  'One or more certificates cannot find their parent issuer in the current pool.',
                )}
          </p>
        </div>
      </div>

      <div className={styles.statusBadges}>
        <span className="badge">
          {t('app.chain.loadedCerts', '{{count}} Loaded Certs', { count: summary.totalCount })}
        </span>
        <span className="badge badge-success">
          {t('app.chain.rootAnchorsCount', '{{count}} Root Anchor(s)', {
            count: summary.rootCount,
          })}
        </span>
      </div>
    </div>
  )
})

export interface ChainCertTabsBarProps {
  allNodes: ChainNode[]
  effectiveActiveNodeId: string | 'all' | null
  showPemPaste: boolean
  onSelectFullChain: () => void
  onSelectNode: (nodeId: string) => void
  onRemoveNode: (nodeId: string) => void
  onTogglePemPaste: () => void
}

export const ChainCertTabsBar = memo(function ChainCertTabsBar({
  allNodes,
  effectiveActiveNodeId,
  showPemPaste,
  onSelectFullChain,
  onSelectNode,
  onRemoveNode,
  onTogglePemPaste,
}: ChainCertTabsBarProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.tabsBar}>
      <span className={styles.tabsLabel}>
        <Shield size={14} className={styles.iconCyan} aria-hidden="true" />
        <span>{t('app.chain.certTabsLabel', 'Certificates')}</span>
        <span className={styles.tabsCountPill}>{allNodes.length}</span>
      </span>

      {allNodes.length > 1 && (
        <div
          className={`${styles.certTabGroup} ${effectiveActiveNodeId === 'all' ? styles.certTabGroupActive : ''}`}
        >
          <button type="button" className={styles.certTabBtn} onClick={onSelectFullChain}>
            <GitFork size={13} aria-hidden="true" />
            <span>{t('app.chain.fullChainTab', 'Full Chain')}</span>
            <span className="badge">{allNodes.length}</span>
          </button>
        </div>
      )}

      {allNodes.map((node) => {
        const isActive = effectiveActiveNodeId === node.id
        const cn = getSubjectCN(node.cert.subject)
        const expired = isCertExpired(node.cert.validTo)
        const hasErr = expired || node.signatureVerified === false
        const role = getNodeRole(node)
        const RoleIcon = role === 'root' ? ShieldCheck : role === 'intermediate' ? Shield : Globe
        const roleTabClass =
          role === 'root'
            ? styles.roleRootTab
            : role === 'intermediate'
              ? styles.roleIntermediateTab
              : styles.roleLeafTab
        const removeLabel = `${t('common.remove', 'Remove')} ${cn}`

        return (
          <div
            key={node.id}
            className={`${styles.certTabGroup} ${roleTabClass} ${hasErr ? styles.statusErrorTab : ''} ${isActive ? styles.certTabGroupActive : ''}`}
          >
            <button
              type="button"
              className={styles.certTabBtn}
              onClick={() => onSelectNode(node.id)}
              title={node.cert.subject}
            >
              <RoleIcon size={13} aria-hidden="true" />
              <span className={styles.certTabCn}>{cn}</span>
              {node.isSelfSigned && (
                <span className="badge badge-success">{t('app.chain.roles.root', 'Root')}</span>
              )}
            </button>
            <button
              type="button"
              className={styles.certTabRemoveBtn}
              onClick={() => onRemoveNode(node.id)}
              aria-label={removeLabel}
              title={removeLabel}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        onClick={onTogglePemPaste}
        className="btn btn-outline btn-sm"
        aria-expanded={showPemPaste}
      >
        <FileText size={13} aria-hidden="true" />
        <span>PEM</span>
      </button>
    </div>
  )
})
