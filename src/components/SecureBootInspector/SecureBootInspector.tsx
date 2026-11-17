import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw, Shield, ShieldCheck } from 'lucide-react'

import { CertificateDetails, LearningTerm, ModuleHeader } from '@/components/shared'
import type { AppMode, EfiSignatureList, ParsedCertificate, SecureBootVarName } from '@/types'
import { fetchLocalApiJson } from '@/utils/api-client'

import { BootHealthWarnings } from './BootHealthWarnings'
import {
  isUserCanceledError,
  isWebFallbackError,
  type ParsedVarEntry,
  parseSecureBootVariablePayload,
  SECURE_BOOT_VAR_TERMS,
  SECURE_BOOT_VARS,
} from './secure-boot-helpers'
import { SignatureListCard } from './SignatureListCard'

import styles from './SecureBootInspector.module.css'

export interface SecureBootInspectorProps {
  onNavigate?: (mode: AppMode) => void
}

export function SecureBootInspector(_props?: SecureBootInspectorProps) {
  const { t } = useTranslation()

  const [activeVar, setActiveVar] = useState<SecureBootVarName>('db')
  const [variablesCache, setVariablesCache] = useState<Record<string, string>>({})
  const parsedVarsCacheRef = useRef<Record<string, ParsedVarEntry>>({})
  const activeVarRef = useRef<SecureBootVarName>('db')
  const hasLoadedRef = useRef(false)

  const [signatureLists, setSignatureLists] = useState<EfiSignatureList[]>([])
  const [rawCert, setRawCert] = useState<ParsedCertificate | null>(null)

  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [needsElevation, setNeedsElevation] = useState<boolean>(false)
  const [elevating, setElevating] = useState<boolean>(false)

  const applyParsedVariable = useCallback(
    async (varName: SecureBootVarName, base64Data: string | undefined) => {
      activeVarRef.current = varName
      setActiveVar(varName)

      if (!base64Data) {
        setSignatureLists([])
        setRawCert(null)
        setError('')
        return
      }

      const cachedParsed = parsedVarsCacheRef.current[varName]
      if (cachedParsed) {
        setSignatureLists(cachedParsed.signatureLists)
        setRawCert(cachedParsed.rawCert)
        setError(cachedParsed.error)
        return
      }

      const parsed = await parseSecureBootVariablePayload(varName, base64Data)
      parsedVarsCacheRef.current[varName] = parsed
      setSignatureLists(parsed.signatureLists)
      setRawCert(parsed.rawCert)
      setError(parsed.error)
    },
    [],
  )

  const loadAllVariables = useCallback(
    async (elevate: boolean, refresh = false) => {
      setError('')
      if (elevate) {
        setElevating(true)
      } else {
        setLoading(true)
      }

      if (refresh || elevate) {
        parsedVarsCacheRef.current = {}
      }

      try {
        const url = `/api/secureboot?var=all${elevate ? '&elevate=true' : ''}${refresh ? '&refresh=true' : ''}`
        const json = await fetchLocalApiJson<{ data: Record<string, string> }>(url)
        const data = json.data ?? {}

        parsedVarsCacheRef.current = {}
        setVariablesCache(data)
        setNeedsElevation(false)

        const targetVar = activeVarRef.current
        await applyParsedVariable(targetVar, data[targetVar])
      } catch (err: unknown) {
        if (isWebFallbackError(err)) {
          const { getWebFallbackSecureBootVars } = await import('@/utils/web-fallbacks')
          const fallbackVars = getWebFallbackSecureBootVars()
          parsedVarsCacheRef.current = {}
          setVariablesCache(fallbackVars)
          setNeedsElevation(false)
          const targetVar = activeVarRef.current
          await applyParsedVariable(targetVar, fallbackVars[targetVar])
        } else if (!elevate) {
          console.warn('Secure Boot read requires Administrator elevation:', err)
          setNeedsElevation(true)
        } else {
          console.error('Secure Boot elevation request failed:', err)
          const errorMsg = err instanceof Error ? err.message : String(err)
          if (isUserCanceledError(errorMsg)) {
            setError(t('app.adminAccess.userCanceled'))
          } else {
            setError(errorMsg)
          }
        }
      } finally {
        setLoading(false)
        setElevating(false)
      }
    },
    [applyParsedVariable, t],
  )

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      void loadAllVariables(false)
    }
  }, [loadAllVariables])

  const handleTabClick = useCallback(
    (varName: SecureBootVarName) => {
      void applyParsedVariable(varName, variablesCache[varName])
    },
    [applyParsedVariable, variablesCache],
  )

  const keyedLists = useMemo(
    () =>
      signatureLists.map((list, index) => ({
        key: `${activeVar}-${list.signatureTypeGuid}-${list.signatureListSize}-${index + 1}`,
        list,
        index,
      })),
    [activeVar, signatureLists],
  )

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <ModuleHeader
          category="systemCheck"
          icon={<Shield size={26} />}
          eyebrowIcon={<ShieldCheck size={14} />}
          eyebrowText={t('app.categories.systemCheck', 'System Check')}
          title={t('app.header.secureBootTitle', 'UEFI Secure Boot Inspector')}
          description={t(
            'app.header.secureBootSubtitle',
            'Inspect UEFI NVRAM signature databases (db, dbx, KEK, PK) and verify platform boot certificates.',
          )}
          actions={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadAllVariables(false, true)}
              disabled={loading || elevating}
            >
              <RefreshCw size={15} className={loading ? 'spin' : undefined} aria-hidden="true" />
              <span>{t('app.winCertStore.refresh', 'Refresh')}</span>
            </button>
          }
        >
          <div
            className={`glass-card ${styles.varBar}`}
            role="group"
            aria-label={t('app.nav.secure-boot', 'Secure Boot NVRAM')}
          >
            {SECURE_BOOT_VARS.map((v) => (
              <button
                key={v}
                type="button"
                data-var={v}
                aria-pressed={activeVar === v}
                disabled={loading || needsElevation}
                className={`${styles.varBtn} ${activeVar === v ? styles.varBtnActive : ''}`}
                onClick={() => handleTabClick(v)}
              >
                <LearningTerm termId={SECURE_BOOT_VAR_TERMS[v]}>{v}</LearningTerm>
              </button>
            ))}
          </div>
        </ModuleHeader>

        {loading ? (
          <div className={`glass-panel ${styles.statusPanel}`} role="status" aria-live="polite">
            <RefreshCw size={48} className={`spin ${styles.loadingIcon}`} aria-hidden="true" />
            <h2>{t('app.secureBoot.loadingTitle', 'Loading Secure Boot Environment...')}</h2>
          </div>
        ) : needsElevation ? (
          <div className={styles.elevationWrap}>
            <div className={`glass-panel ${styles.elevationPanel}`}>
              {elevating ? (
                <>
                  <Shield size={64} className={styles.elevatingIcon} aria-hidden="true" />
                  <h2 className={styles.elevatingTitle}>{t('app.adminAccess.waiting')}</h2>
                  <p className={styles.elevationDesc}>
                    <Trans
                      i18nKey="app.adminAccess.checkTaskbarUac"
                      components={[
                        <LearningTerm key="uac" termId="uac">
                          {''}
                        </LearningTerm>,
                      ]}
                    />
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle size={64} className={styles.dangerIcon} aria-hidden="true" />
                  <h2>{t('app.adminAccess.title')}</h2>
                  <p className={styles.elevationDesc}>
                    <Trans
                      i18nKey="app.adminAccess.secureBootDesc"
                      components={[
                        <LearningTerm key="nvram" termId="nvram">
                          {''}
                        </LearningTerm>,
                      ]}
                    />
                  </p>
                  {Boolean(error) && (
                    <p className={styles.elevationError} role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    type="button"
                    className={`btn ${styles.unlockBtn}`}
                    onClick={() => void loadAllVariables(true)}
                  >
                    <Shield size={18} aria-hidden="true" />
                    <span>{t('app.adminAccess.unlockSecureBoot')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {activeVar === 'db' && signatureLists.length > 0 && (
              <BootHealthWarnings lists={signatureLists} />
            )}

            {error ? (
              <div className={`glass-panel ${styles.statusPanel}`} role="alert">
                <AlertTriangle size={48} className={styles.dangerIcon} aria-hidden="true" />
                <h2 className={styles.errorTitle}>
                  {t('app.secureBoot.parseErrorTitle', 'Error parsing variable')}
                </h2>
                <p>{error}</p>
              </div>
            ) : signatureLists.length === 0 && rawCert === null ? (
              <div className={`glass-panel ${styles.statusPanel}`}>
                <h2>{t('app.secureBoot.emptyTitle', 'Variable is Empty')}</h2>
                <p>
                  {t(
                    'app.secureBoot.emptyDesc',
                    'No valid signatures or certificates found in {{varName}}.',
                    { varName: activeVar },
                  )}
                </p>
              </div>
            ) : (
              <section className={`animate-fade-in ${styles.entriesSection}`}>
                <h2 className={styles.sectionHeading}>
                  {t('app.certDetails.signatures', 'Signatures')} ({activeVar})
                </h2>

                <div className={styles.signatureLists}>
                  {rawCert !== null && (
                    <div className={`glass-card ${styles.rawCertCard}`}>
                      <div className={styles.rawCertHeader}>
                        <h3 className={styles.rawCertHeading}>
                          {t('app.certDetails.rawX509', 'Raw X.509 Certificate')}
                        </h3>
                        <div className={styles.badgeRow}>
                          {rawCert.isRoot && (
                            <span className="badge badge-success">
                              <span className="badge-dot" />
                              <LearningTerm termId="rootCa">
                                {t('app.certDetails.rootCa', 'Root CA')}
                              </LearningTerm>
                            </span>
                          )}
                          {rawCert.isIntermediate && (
                            <span className="badge badge-warning">
                              <span className="badge-dot" />
                              <LearningTerm termId="intermediateCa">
                                {t('app.certDetails.intermediateCa', 'Intermediate CA')}
                              </LearningTerm>
                            </span>
                          )}
                          {rawCert.isLeaf && (
                            <span className="badge badge-purple">
                              <span className="badge-dot" />
                              <LearningTerm termId="leafCert">
                                {t('app.certDetails.leafCert', 'Leaf Certificate')}
                              </LearningTerm>
                            </span>
                          )}
                          {rawCert.isExpired && (
                            <span className="badge badge-danger">
                              <span className="badge-dot pulse" />
                              {t('app.certDetails.expired', 'Expired')}
                            </span>
                          )}
                        </div>
                      </div>
                      <CertificateDetails cert={rawCert} />
                    </div>
                  )}

                  {keyedLists.map((item) => (
                    <SignatureListCard
                      key={item.key}
                      list={item.list}
                      index={item.index}
                      varName={activeVar}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
