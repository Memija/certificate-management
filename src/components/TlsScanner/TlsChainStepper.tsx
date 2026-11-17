import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Link as LinkIcon,
  Lock,
} from 'lucide-react'

import type { TlsChainCertificate } from '@/types'

import {
  calculateValidityProgress,
  formatKeyDescription,
  resolveChainRole,
} from './tls-scanner-helpers'

import styles from './TlsChainStepper.module.css'

export interface TlsChainStepperProps {
  chain: TlsChainCertificate[]
  authorized: boolean
  activeCertIdx: number
  copiedAll: boolean
  onSelectCert: (idx: number) => void
  onCopyAllPem: () => void
  onDownloadAllPem: () => void
}

export const TlsChainStepper = memo(function TlsChainStepper({
  chain,
  authorized,
  activeCertIdx,
  copiedAll,
  onSelectCert,
  onCopyAllPem,
  onDownloadAllPem,
}: TlsChainStepperProps) {
  const { t, i18n } = useTranslation()

  return (
    <>
      <div className={styles.chainHeader}>
        <div className={styles.chainHeaderLeft}>
          <div className={`metric-icon-wrap cyan ${styles.chainHeaderIcon}`} aria-hidden="true">
            <LinkIcon size={20} />
          </div>
          <div>
            <h2 className={styles.chainHeading}>
              <span>{t('app.tlsScanner.presentedChain', 'Presented Certificate Chain')}</span>
              <span className="badge badge-info">
                {chain.length} {t('app.tlsScanner.metrics.certs', 'Certificates')}
              </span>
              {authorized ? (
                <span className="badge badge-success">
                  <CheckCircle2 size={12} aria-hidden="true" />
                  {t('app.tlsScanner.chainTrusted', 'Chain of Trust Verified')}
                </span>
              ) : (
                <span className="badge badge-danger">
                  <AlertTriangle size={12} aria-hidden="true" />
                  {t('app.tlsScanner.chainWarning', 'Trust Path Warning')}
                </span>
              )}
            </h2>
            <div className={styles.chainSub}>
              {authorized
                ? t(
                    'app.tlsScanner.chainTrustedSub',
                    'Complete trusted cryptographic chain from end-entity to trust anchor',
                  )
                : t(
                    'app.tlsScanner.chainUntrustedSub',
                    'Certificates presented by the remote server during TLS handshake',
                  )}
            </div>
          </div>
        </div>

        <div className={styles.batchActions}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCopyAllPem}
            title={t('app.tlsScanner.copyAllPem', 'Copy entire certificate chain (PEM format)')}
          >
            {copiedAll ? (
              <Check size={14} className={styles.copiedIcon} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            <span>
              {copiedAll
                ? t('app.tlsScanner.copied', 'Copied!')
                : t('app.tlsScanner.copyChain', 'Copy Full Chain')}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-download-pem btn-sm"
            onClick={onDownloadAllPem}
            title={t('app.tlsScanner.downloadAllPem', 'Download entire certificate chain bundle')}
          >
            <Download size={14} aria-hidden="true" />
            <span>{t('app.tlsScanner.downloadChain', 'Download Bundle')}</span>
          </button>
        </div>
      </div>

      <div
        className={styles.chainFlow}
        role="region"
        aria-label={t('app.tlsScanner.chainStepperAria', 'Certificate Chain Stepper')}
      >
        {chain.map((cert, idx) => {
          const { role } = resolveChainRole(cert, idx, chain.length)
          const validity = calculateValidityProgress(cert.valid_from, cert.valid_to)
          const roleShort =
            role === 'leaf'
              ? t('app.chain.roles.leaf', 'Leaf')
              : role === 'intermediate'
                ? t('app.chain.roles.intermediate', 'Intermediate')
                : t('app.chain.roles.root', 'Root')

          return (
            <React.Fragment key={`${cert.fingerprint256 || cert.serialNumber}-${idx}`}>
              <button
                type="button"
                className={`${styles.chainFlowStep} ${styles[`step_${role}`]} ${validity.isExpired ? styles.stepExpired : ''} ${activeCertIdx === idx ? styles.stepActive : ''}`}
                onClick={() => onSelectCert(idx)}
                title={t('app.tlsScanner.inspectCertTitle', {
                  num: idx + 1,
                  defaultValue: `Click to inspect certificate #${idx + 1}`,
                })}
              >
                <div className={styles.stepBadges}>
                  <span className={`${styles.stepRoleBadge} ${styles[`role_${role}`]}`}>
                    #{idx + 1} {roleShort}
                  </span>
                  <span
                    className={`badge ${validity.isExpired ? 'badge-danger' : validity.isExpiringSoon ? 'badge-warning' : 'badge-success'}`}
                  >
                    {validity.isExpired ? (
                      <>
                        <span className="badge-dot pulse" />
                        {t('app.certDetails.expired', 'Expired')}
                      </>
                    ) : (
                      `${validity.daysRemaining}d`
                    )}
                  </span>
                </div>

                <div>
                  <div className={styles.stepSubject}>{cert.subjectCN}</div>
                  <div className={styles.stepIssuer}>
                    <span>{t('app.tlsScanner.issuer', 'Issuer')}:</span>
                    <span className={styles.stepIssuerName}>{cert.issuerCN}</span>
                  </div>
                </div>

                <div className={styles.stepFooter}>
                  <span className="mono">{formatKeyDescription(cert, t)}</span>
                  <span>{new Date(cert.valid_to).toLocaleDateString(i18n.language)}</span>
                </div>
              </button>

              {idx < chain.length - 1 && (
                <div className={styles.chainFlowArrow} aria-hidden="true">
                  <span className={styles.chainFlowArrowPill}>
                    <Lock size={10} className={styles.cyanIcon} />
                    <span>{t('app.tlsScanner.issuedBy', 'Signed by')}</span>
                  </span>
                  <ArrowRight size={16} className={styles.accentIcon} />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
})
