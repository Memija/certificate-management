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
  Trash2,
  XCircle,
} from 'lucide-react'

import { CertificateDetails } from '@/components/shared'

import type { ChainNode } from './chain-validator-logic'
import { getNodeRole, getSubjectCN, isCertExpired } from './chain-validator-logic'
import { ChainRelationshipCard } from './ChainNodeInspectorModal'

import styles from './ChainHierarchyTree.module.css'

export interface ChainSingleCertViewProps {
  node: ChainNode
  totalNodesCount: number
  onSelectNode: (node: ChainNode) => void
  onInspectNode: (node: ChainNode) => void
  onViewFullChain: () => void
  onRemoveCert: (nodeId: string) => void
}

export const ChainSingleCertView = memo(function ChainSingleCertView({
  node,
  totalNodesCount,
  onSelectNode,
  onInspectNode,
  onViewFullChain,
  onRemoveCert,
}: ChainSingleCertViewProps) {
  const { t } = useTranslation()
  const c = node.cert
  const cn = getSubjectCN(c.subject)
  const expired = isCertExpired(c.validTo)
  const role = getNodeRole(node)

  let roleLabel = t('app.chain.roles.leafEntity', 'Leaf / End-Entity')
  let roleBadgeClass = styles.badgeLeaf
  let RoleIcon = Globe

  if (role === 'root') {
    roleLabel = t('app.chain.roles.rootAnchor', 'Root CA (Trust Anchor)')
    roleBadgeClass = styles.badgeRoot
    RoleIcon = ShieldCheck
  } else if (role === 'intermediate') {
    roleLabel = t('app.chain.roles.intermediateCa', 'Intermediate CA')
    roleBadgeClass = styles.badgeIntermediate
    RoleIcon = Shield
  }

  const removeLabel = `${t('common.remove', 'Remove')} ${cn}`

  return (
    <section className="glass-panel animate-fade-in">
      <div className={styles.singleTopBar}>
        <div className={styles.statusBadges}>
          {totalNodesCount > 1 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onViewFullChain}>
              <GitFork size={13} className={styles.iconCyan} aria-hidden="true" />
              <span>{t('app.chain.viewFullChain', '← View Full Chain')}</span>
            </button>
          )}
          <span className={`badge ${roleBadgeClass}`}>
            <RoleIcon size={13} aria-hidden="true" />
            <span>{roleLabel}</span>
          </span>
          {expired ? (
            <span className="badge badge-danger">
              <span className="badge-dot pulse" />
              <span>{t('app.certDetails.expired', 'Expired')}</span>
            </span>
          ) : (
            <span className="badge badge-success">
              <CheckCircle size={12} aria-hidden="true" />
              <span>{t('app.chain.valid', 'Valid')}</span>
            </span>
          )}
          {node.isSelfSigned ? (
            <span className="badge badge-success">
              <ShieldCheck size={12} aria-hidden="true" />
              <span>{t('app.chain.rootCaSelfSigned', 'Root CA (Self-Signed)')}</span>
            </span>
          ) : node.signatureVerified === true ? (
            <span className="badge badge-success">
              <CheckCircle size={12} aria-hidden="true" />
              <span>{t('app.chain.cryptoVerified', 'Cryptographically Verified')}</span>
            </span>
          ) : node.signatureVerified === false ? (
            <span className="badge badge-danger">
              <XCircle size={12} aria-hidden="true" />
              <span>{t('app.chain.badSig', 'Bad Sig')}</span>
            </span>
          ) : (
            <span className="badge badge-warning">
              <AlertTriangle size={12} aria-hidden="true" />
              <span>{t('app.chain.parentMissing', 'Parent Missing in Pool')}</span>
            </span>
          )}
        </div>

        <div className={styles.statusBadges}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onInspectNode(node)}
          >
            <Eye size={13} aria-hidden="true" />
            <span>{t('app.chain.inspectNode', 'Inspect details')}</span>
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm btn-icon"
            onClick={() => onRemoveCert(node.id)}
            aria-label={removeLabel}
            title={removeLabel}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.singleHeadline}>
        <h2 className={styles.singleTitle}>{cn}</h2>
        <p className={styles.singleSubject}>{c.subject}</p>
      </div>

      <ChainRelationshipCard node={node} onSelectNode={onSelectNode} />
      <CertificateDetails cert={c} />
    </section>
  )
})
