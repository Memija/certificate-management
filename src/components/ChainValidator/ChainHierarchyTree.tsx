import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  GitFork,
  Globe,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

import { LearningTerm } from '@/components/shared'
import { formatExpiry, formatExpiryTooltip } from '@/utils/expiry-formatter'

import type { ChainNode } from './chain-validator-logic'
import { getNodeRole, getSubjectCN, isCertExpired } from './chain-validator-logic'

import styles from './ChainHierarchyTree.module.css'

export interface ChainHierarchyTreeProps {
  viewMode: 'graph' | 'list'
  rootNodes: ChainNode[]
  orphanNodes: ChainNode[]
  allNodes: ChainNode[]
  selectedId: string | null
  onInspectNode: (node: ChainNode) => void
}

interface VisualTreeNodeProps {
  node: ChainNode
  selectedId: string | null
  onInspectNode: (node: ChainNode) => void
}

const VisualTreeNode = memo(function VisualTreeNode({
  node,
  selectedId,
  onInspectNode,
}: VisualTreeNodeProps) {
  const { t, i18n } = useTranslation()
  const c = node.cert
  const expired = isCertExpired(c.validTo)
  const cn = getSubjectCN(c.subject)
  const isSelected = selectedId === node.id
  const role = getNodeRole(node)

  let cardRoleClass = styles.nodeLeaf
  let badgeRoleClass = styles.badgeLeaf
  let roleLabel = t('app.chain.roles.leafEntity', 'Leaf / End-Entity')
  let RoleIcon = Globe

  if (role === 'root') {
    cardRoleClass = styles.nodeRoot
    badgeRoleClass = styles.badgeRoot
    roleLabel = t('app.chain.roles.rootAnchor', 'Root CA (Trust Anchor)')
    RoleIcon = ShieldCheck
  } else if (role === 'intermediate') {
    cardRoleClass = styles.nodeIntermediate
    badgeRoleClass = styles.badgeIntermediate
    roleLabel = t('app.chain.roles.intermediateCa', 'Intermediate CA')
    RoleIcon = Shield
  }

  const hasError = expired || node.signatureVerified === false
  const borderClass = hasError ? styles.nodeError : cardRoleClass

  return (
    <div className={styles.nodeWrapper}>
      <div className={`${styles.nodeCard} ${borderClass} ${isSelected ? styles.nodeSelected : ''}`}>
        <div className={styles.nodeTopRow}>
          <span className={`badge ${badgeRoleClass}`}>
            <RoleIcon size={12} aria-hidden="true" />
            <span>{roleLabel}</span>
          </span>

          {expired ? (
            <span className="badge badge-danger">
              <span className="badge-dot pulse" />
              <span>{t('app.certDetails.expired', 'Expired')}</span>
            </span>
          ) : node.signatureVerified === true ? (
            <span className="badge badge-success">
              <CheckCircle size={11} aria-hidden="true" />
              <span>{t('app.chain.valid', 'Valid')}</span>
            </span>
          ) : node.signatureVerified === false ? (
            <span className="badge badge-danger">
              <XCircle size={11} aria-hidden="true" />
              <span>{t('app.chain.badSig', 'Bad Sig')}</span>
            </span>
          ) : (
            <span className="badge badge-warning">
              <AlertTriangle size={11} aria-hidden="true" />
              <span>{t('app.chain.missingParent', 'Missing Parent')}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          className={styles.nodeTitleBtn}
          onClick={() => onInspectNode(node)}
          title={c.subject}
        >
          {cn}
        </button>

        <div className={styles.nodeMeta}>
          <div className={styles.nodeMetaRow}>
            <span>{t('app.certDetails.validTo', 'Expires')}:</span>
            <strong
              className={expired ? styles.expiryExpired : styles.expiryValid}
              title={formatExpiryTooltip(c.validTo, t, i18n.language)}
            >
              {new Date(c.validTo).toLocaleDateString(i18n.language)} (
              {formatExpiry(c.validTo, t, i18n.language)})
            </strong>
          </div>
          <div className={styles.nodeMetaRow}>
            <span>{t('app.chain.key', 'Key')}:</span>
            <span className="mono">
              {c.publicKeyAlgorithm}
              {c.publicKeySize !== null
                ? ` (${c.publicKeySize} ${t('app.certDetails.bits', 'bits')})`
                : ''}
            </span>
          </div>
          {node.akiMatchesParentSki !== null && !node.isSelfSigned && (
            <div className={styles.nodeMetaRow}>
              <span>AKI → SKI:</span>
              <span
                className={node.akiMatchesParentSki ? 'badge badge-cyan' : 'badge badge-danger'}
              >
                {node.akiMatchesParentSki ? 'AKI = SKI' : 'AKI ≠ SKI'}
              </span>
            </div>
          )}
        </div>

        <div className={styles.nodeFooter}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onInspectNode(node)}
          >
            <Eye size={13} aria-hidden="true" />
            <span>{t('app.chain.inspectNode', 'Inspect details')}</span>
          </button>
        </div>
      </div>

      {node.children.length > 0 && (
        <>
          <div className={styles.connectorLine} aria-hidden="true">
            <div className={styles.connectorArrow} />
            <div className={styles.connectorPill}>
              <CheckCircle size={11} className={styles.iconSuccess} />
              <span>
                {t('app.chain.signsAndIssues', 'Signs & Issues')} ({node.children.length})
              </span>
            </div>
            <div className={styles.connectorArrow} />
          </div>

          <div className={styles.graphLevel}>
            {node.children.map((child) => (
              <VisualTreeNode
                key={child.id}
                node={child}
                selectedId={selectedId}
                onInspectNode={onInspectNode}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
})

export const ChainHierarchyTree = memo(function ChainHierarchyTree({
  viewMode,
  rootNodes,
  orphanNodes,
  allNodes,
  selectedId,
  onInspectNode,
}: ChainHierarchyTreeProps) {
  const { t, i18n } = useTranslation()

  if (viewMode === 'list') {
    return (
      <div className={`animate-fade-in ${styles.classicStack}`}>
        {allNodes.map((node) => {
          const c = node.cert
          const expired = isCertExpired(c.validTo)
          const cn = getSubjectCN(c.subject)
          return (
            <div key={node.id} className={`glass-card ${styles.classicCard}`}>
              <div>
                <div className={styles.nodeTopRow}>
                  {node.isSelfSigned ? (
                    <span className={`badge ${styles.badgeRoot}`}>
                      {t('app.certDetails.rootCa', 'Root CA')}
                    </span>
                  ) : (
                    <span className={`badge ${styles.badgeIntermediate}`}>
                      {t('app.chain.intermediateLeaf', 'Intermediate / Leaf')}
                    </span>
                  )}
                  {expired ? (
                    <span className="badge badge-danger">
                      {t('app.certDetails.expired', 'Expired')}
                    </span>
                  ) : (
                    <span className="badge badge-success">{t('app.chain.valid', 'Valid')}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.nodeTitleBtn}
                  onClick={() => onInspectNode(node)}
                >
                  {cn}
                </button>
                <p className={styles.classicIssuer}>
                  {t('app.certDetails.issuer', 'Issuer')}: {c.issuer}
                </p>
              </div>
              <div className={styles.classicRight}>
                <span title={formatExpiryTooltip(c.validTo, t, i18n.language)}>
                  {t('app.certDetails.validTo', 'Expires')}:{' '}
                  {new Date(c.validTo).toLocaleDateString(i18n.language)} (
                  {formatExpiry(c.validTo, t, i18n.language)})
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onInspectNode(node)}
                >
                  <Eye size={13} aria-hidden="true" />
                  <span>{t('app.chain.inspectNode', 'Inspect details')}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`animate-fade-in ${styles.graphWrapper}`}>
      <div className={styles.graphLegendBar}>
        <div className={styles.graphHint}>
          <GitFork size={15} className={styles.iconCyan} aria-hidden="true" />
          <span>
            {t(
              'app.chain.clickNodeHint',
              'Click any node to inspect detailed cryptographic properties',
            )}
          </span>
        </div>
        <div className={styles.statusBadges}>
          <span className={`badge ${styles.badgeRoot}`}>
            <ShieldCheck size={11} aria-hidden="true" />
            <LearningTerm termId="rootCa">{t('app.chain.roles.root', 'Root')}</LearningTerm>
          </span>
          <span className={`badge ${styles.badgeIntermediate}`}>
            <Shield size={11} aria-hidden="true" />
            <LearningTerm termId="intermediateCa">
              {t('app.chain.roles.intermediate', 'Intermediate')}
            </LearningTerm>
          </span>
          <span className={`badge ${styles.badgeLeaf}`}>
            <Globe size={11} aria-hidden="true" />
            <LearningTerm termId="leafCert">{t('app.chain.roles.leaf', 'Leaf')}</LearningTerm>
          </span>
        </div>
      </div>

      <div className={styles.graphTree}>
        {rootNodes.map((rootNode) => (
          <VisualTreeNode
            key={rootNode.id}
            node={rootNode}
            selectedId={selectedId}
            onInspectNode={onInspectNode}
          />
        ))}

        {orphanNodes.length > 0 && (
          <div className={styles.orphanSection}>
            <span className="badge badge-warning">
              <AlertTriangle size={12} aria-hidden="true" />
              <span>{t('app.chain.orphanedChains', 'Orphaned / Incomplete Chains')}</span>
            </span>
            <div className={styles.graphLevel}>
              {orphanNodes.map((node) => (
                <VisualTreeNode
                  key={node.id}
                  node={node}
                  selectedId={selectedId}
                  onInspectNode={onInspectNode}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
