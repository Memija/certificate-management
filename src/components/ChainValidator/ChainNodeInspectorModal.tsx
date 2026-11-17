import { memo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Globe,
  Shield,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'

import { CertificateDetails } from '@/components/shared'

import type { ChainNode } from './chain-validator-logic'
import { formatKeyIdentifier, getNodeRole, getSubjectCN } from './chain-validator-logic'

import styles from './ChainNodeInspectorModal.module.css'

export interface ChainRelationshipCardProps {
  node: ChainNode
  onSelectNode?: (node: ChainNode) => void
}

export const ChainRelationshipCard = memo(function ChainRelationshipCard({
  node,
  onSelectNode,
}: ChainRelationshipCardProps) {
  const { t } = useTranslation()
  const parentNode = node.parent

  return (
    <div className={styles.relationshipCard}>
      <div className={styles.relationshipRow}>
        <div className={styles.relationshipGroup}>
          <span className={styles.relationshipLabel}>{t('app.certDetails.issuer', 'Issuer')}:</span>
          {parentNode ? (
            <span className={styles.relationshipPrimary}>
              {getSubjectCN(parentNode.cert.subject)}
            </span>
          ) : node.isSelfSigned ? (
            <span className={styles.relationshipSuccess}>
              <ShieldCheck size={14} aria-hidden="true" />
              <span>{t('app.chain.selfSignedRoot', 'Self-signed (Trust Anchor)')}</span>
            </span>
          ) : (
            <span className={styles.relationshipWarning}>
              {getSubjectCN(node.cert.issuer)} ({t('app.chain.notLoaded', 'Not loaded in pool')})
            </span>
          )}
        </div>

        {parentNode && onSelectNode && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onSelectNode(parentNode)}
          >
            <span>{t('app.chain.viewIssuer', 'View Issuer Cert')}</span>
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {node.children.length > 0 && (
        <div className={`${styles.relationshipRow} ${styles.relationshipRowBorder}`}>
          <div className={styles.relationshipGroup}>
            <span className={styles.relationshipLabel}>
              {t('app.chain.signsAndIssues', 'Signs & Issues')} ({node.children.length}):
            </span>
            {node.children.map((child) => (
              <button
                key={child.id}
                type="button"
                className={styles.childPillBtn}
                onClick={() => onSelectNode?.(child)}
              >
                <span>{getSubjectCN(child.cert.subject)}</span>
                <ChevronRight size={12} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {(node.skiHex || node.akiHex) && (
        <div className={`${styles.relationshipRow} ${styles.relationshipRowBorder}`}>
          <div className={styles.relationshipGroup}>
            {node.skiHex && (
              <span className={styles.keyIdCode}>SKI: {formatKeyIdentifier(node.skiHex)}</span>
            )}
            {node.akiHex && (
              <span className={styles.keyIdCode}>AKI: {formatKeyIdentifier(node.akiHex)}</span>
            )}
          </div>
          {node.akiMatchesParentSki !== null && !node.isSelfSigned && (
            <span className={node.akiMatchesParentSki ? 'badge badge-cyan' : 'badge badge-danger'}>
              {node.akiMatchesParentSki ? 'AKI = SKI' : 'AKI ≠ SKI'}
            </span>
          )}
        </div>
      )}
    </div>
  )
})

export interface ChainNodeInspectorModalProps {
  node: ChainNode
  allNodes?: ChainNode[]
  onSelectNode?: (node: ChainNode) => void
  onClose: () => void
}

export const ChainNodeInspectorModal = memo(function ChainNodeInspectorModal({
  node,
  allNodes = [],
  onSelectNode,
  onClose,
}: ChainNodeInspectorModalProps) {
  const { t } = useTranslation()
  const c = node.cert
  const cn = getSubjectCN(c.subject)
  const closeLabel = t('app.chain.closeInspector', 'Close Inspector')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chain-inspector-modal-title"
      >
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalBadges}>
              <span className="badge badge-purple">
                {t('app.chain.inspectingNode', 'Inspecting Node')}
              </span>
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
            <h2 id="chain-inspector-modal-title" className={styles.modalTitle}>
              {cn}
            </h2>
          </div>

          <div className={styles.modalHeaderActions}>
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-icon"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {allNodes.length > 1 && onSelectNode && (
          <div className={styles.modalTabsBar}>
            {allNodes.map((n) => {
              const isActive = n.id === node.id
              const itemCn = getSubjectCN(n.cert.subject)
              const role = getNodeRole(n)
              const RoleIcon =
                role === 'root' ? ShieldCheck : role === 'intermediate' ? Shield : Globe

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelectNode(n)}
                  className={`${styles.modalTabBtn} ${isActive ? styles.modalTabBtnActive : ''}`}
                  title={n.cert.subject}
                >
                  <RoleIcon size={13} aria-hidden="true" />
                  <span className={styles.modalTabCn}>{itemCn}</span>
                </button>
              )
            })}
          </div>
        )}

        <ChainRelationshipCard node={node} onSelectNode={onSelectNode} />
        <CertificateDetails cert={c} />
      </div>
    </div>
  )
})
