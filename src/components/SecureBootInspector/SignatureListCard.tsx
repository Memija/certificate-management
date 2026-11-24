import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Shield, ShieldCheck } from 'lucide-react'

import { CertificateDetails } from '@/components/shared'
import type { EfiSignatureData, EfiSignatureList, SecureBootVarName } from '@/types'

import { extractSubjectCn } from './secure-boot-helpers'

import styles from './SecureBootInspector.module.css'

export interface SignatureListCardProps {
  list: EfiSignatureList
  index: number
  varName: SecureBootVarName
}

interface SignatureItemProps {
  signature: EfiSignatureData
}

const SignatureItem = memo(function SignatureItem({ signature }: SignatureItemProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const cert = signature.certificate

  return (
    <div className={`glass-card ${styles.signatureItem}`}>
      <button
        type="button"
        className={styles.signatureToggleBtn}
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className={styles.signatureLeft}>
          <Shield
            size={20}
            className={cert ? styles.certShieldIcon : styles.hashShieldIcon}
            aria-hidden="true"
          />
          <span className={styles.signatureTitle}>
            {cert
              ? t('app.certDetails.rawX509', 'Raw X.509 Certificate')
              : t('app.certDetails.unknownSignatureType', 'Hash / Binary Signature')}
          </span>
          {cert !== undefined && (
            <span className={styles.signatureSubject}>{extractSubjectCn(cert.subject)}</span>
          )}
          {cert === undefined && Boolean(signature.hashData) && (
            <span className={`mono ${styles.signatureSubject}`}>
              {signature.hashData?.slice(0, 16)}…
            </span>
          )}
          {cert !== undefined && (
            <div className={styles.badgeRow}>
              {cert.isRoot && (
                <span className="badge badge-success">
                  <span className="badge-dot" />
                  {t('app.certDetails.rootCa', 'Root CA')}
                </span>
              )}
              {cert.isIntermediate && (
                <span className="badge badge-warning">
                  <span className="badge-dot" />
                  {t('app.certDetails.intermediateCa', 'Intermediate CA')}
                </span>
              )}
              {cert.isLeaf && (
                <span className="badge badge-purple">
                  <span className="badge-dot" />
                  {t('app.certDetails.leafCert', 'Leaf Certificate')}
                </span>
              )}
              {cert.isExpired && (
                <span className="badge badge-danger">
                  <span className="badge-dot pulse" />
                  {t('app.certDetails.expired', 'Expired')}
                </span>
              )}
            </div>
          )}
        </div>
        <span className={styles.chevronWrap} aria-hidden="true">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>

      {expanded && (
        <div className={`animate-fade-in ${styles.expandedContent}`}>
          <div className="details-grid">
            <div className="details-label">{t('app.certDetails.ownerGuid', 'Owner GUID')}</div>
            <div className="details-value mono">{signature.signatureOwner}</div>
          </div>

          {cert !== undefined && <CertificateDetails cert={cert} />}

          {cert === undefined && Boolean(signature.hashData) && (
            <div className={styles.rawHexSection}>
              <div className={`details-label ${styles.rawHexLabel}`}>
                {t('app.certDetails.rawHexData', 'Raw Hex Data:')}
              </div>
              <pre className="code-block">{signature.hashData}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export const SignatureListCard = memo(function SignatureListCard({
  list,
  index,
  varName,
}: SignatureListCardProps) {
  const { t } = useTranslation()

  const keyedSignatures = useMemo(() => {
    const seenCounts = new Map<string, number>()
    return list.signatures.map((sig) => {
      const fingerprint =
        sig.certificate?.fingerprintSha256 ?? sig.certificate?.serialNumber ?? sig.hashData ?? 'raw'
      const baseKey = `${varName}-${index}-${sig.signatureOwner}-${fingerprint}`
      const count = (seenCounts.get(baseKey) ?? 0) + 1
      seenCounts.set(baseKey, count)
      return {
        key: count > 1 ? `${baseKey}-${count}` : baseKey,
        signature: sig,
      }
    })
  }, [index, list.signatures, varName])

  return (
    <article className="glass-panel">
      <div className={styles.listHeader}>
        <div className="metric-icon-wrap success" aria-hidden="true">
          <ShieldCheck size={26} />
        </div>
        <div className={styles.listHeaderInfo}>
          <h3 className={styles.listHeading}>
            {t('app.certDetails.signatureList', { index: index + 1 })}
          </h3>
          <p className={styles.listMetaText}>
            {t('app.certDetails.type', 'Type')}:{' '}
            <span className={styles.metaPrimary}>{list.signatureTypeName}</span> •{' '}
            {t('app.certDetails.guid', 'GUID')}:{' '}
            <span className={`mono ${styles.guidText}`}>{list.signatureTypeGuid}</span>
          </p>
        </div>
      </div>

      <div className={styles.listStatsRow}>
        <div>
          {t('app.certDetails.listSize', 'List Size')}:{' '}
          <strong className={styles.statStrong}>
            {list.signatureListSize} {t('app.certDetails.bytes', 'bytes')}
          </strong>
        </div>
        <div>
          {t('app.certDetails.signatures', 'Signatures')}:{' '}
          <strong className={styles.statStrong}>{list.signatures.length}</strong>
        </div>
      </div>

      <div className={styles.signaturesStack}>
        {keyedSignatures.map((item) => (
          <SignatureItem key={item.key} signature={item.signature} />
        ))}
      </div>
    </article>
  )
})
