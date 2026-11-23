import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Globe,
  Home,
  Layers,
  Lock,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { ModuleHeader, useToast } from '@/components/shared'
import type { TlsScanResult } from '@/types'
import { fetchLocalApiJson, WebApiUnavailableError } from '@/utils/api-client'

import {
  enrichTlsChain,
  formatAuthError,
  parseHostInput,
  TLS_QUICK_PRESETS,
  triggerPemDownload,
} from './tls-scanner-helpers'
import { TlsChainFlowCard } from './TlsChainFlowCard'
import { TlsChainStepper } from './TlsChainStepper'

import styles from './TlsScanner.module.css'

export function TlsScanner() {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [host, setHost] = useState('')
  const [port, setPort] = useState(443)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scanResult, setScanResult] = useState<TlsScanResult | null>(null)
  const [activeCertIdx, setActiveCertIdx] = useState(0)
  const [copiedAll, setCopiedAll] = useState(false)
  const copiedAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedAllTimerRef.current !== null) {
        clearTimeout(copiedAllTimerRef.current)
      }
    }
  }, [])

  const handleJumpToIndex = useCallback((targetIdx: number) => {
    setActiveCertIdx(targetIdx)
    const el = document.getElementById(`tls-cert-card-${targetIdx}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const copyAllPem = async (): Promise<void> => {
    if (!scanResult || scanResult.chain.length === 0) {
      return
    }
    const fullChainPem = scanResult.chain
      .map((c) => c.pem)
      .filter(Boolean)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(fullChainPem)
      setCopiedAll(true)
      showToast(
        t('app.tlsScanner.copiedFullChain', 'Full certificate chain copied to clipboard'),
        'success',
      )
      if (copiedAllTimerRef.current !== null) {
        clearTimeout(copiedAllTimerRef.current)
      }
      copiedAllTimerRef.current = setTimeout(() => {
        setCopiedAll(false)
        copiedAllTimerRef.current = null
      }, 2000)
    } catch (err) {
      console.error('Failed to copy full TLS chain:', err)
      showToast(t('common.error', 'Error'), 'error')
    }
  }

  const downloadAllPem = (): void => {
    if (!scanResult || scanResult.chain.length === 0) {
      return
    }
    const fullChainPem = scanResult.chain
      .map((c) => c.pem)
      .filter(Boolean)
      .join('\n\n')
    triggerPemDownload(fullChainPem, `${host || scanResult.host || 'tls'}_chain`)
    showToast(t('app.tlsScanner.downloadedFullChain', 'Chain bundle downloaded'), 'success')
  }

  const scan = async (overrideHost?: string, overridePort?: number): Promise<void> => {
    const rawHost = overrideHost !== undefined ? overrideHost : host
    const rawPort = overridePort !== undefined ? overridePort : port
    const parsed = parseHostInput(rawHost)
    const targetHost = parsed.host
    const targetPort = parsed.port || rawPort || 443

    if (overrideHost === undefined) {
      setHost(targetHost)
      setPort(targetPort)
    }

    if (!targetHost) {
      setError(t('app.tlsScanner.errors.hostRequired', 'Host is required'))
      return
    }

    setLoading(true)
    setError('')
    setScanResult(null)
    setActiveCertIdx(0)

    try {
      let rawData: TlsScanResult
      try {
        const json = await fetchLocalApiJson<{ data: TlsScanResult }>(
          `/api/tlsscanner?host=${encodeURIComponent(targetHost)}&port=${targetPort}`,
        )
        rawData = json.data
      } catch (apiErr: unknown) {
        if (apiErr instanceof WebApiUnavailableError) {
          const { scanTlsClientSide } = await import('@/utils/web-fallbacks/tls-fallback')
          rawData = scanTlsClientSide(targetHost, targetPort)
        } else {
          throw apiErr
        }
      }

      setScanResult({
        ...rawData,
        chain: enrichTlsChain(rawData.chain ?? []),
      })
    } catch (err: unknown) {
      console.error('TLS scan failed:', err)
      const message =
        err instanceof Error && err.message
          ? err.message
          : t('app.tlsScanner.errors.scanFailed', 'Failed to scan endpoint')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const authErrorInfo = scanResult ? formatAuthError(scanResult.authorizationError, t) : null

  return (
    <div className={styles.container}>
      <ModuleHeader
        category="networkStatus"
        icon={<Globe size={26} />}
        eyebrowIcon={<ShieldCheck size={14} />}
        eyebrowText={t('app.categories.networkStatus', 'Network & Status')}
        title={t('app.tlsScanner.title', 'Remote TLS Scanner')}
        description={t(
          'app.tlsScanner.subtitle',
          'Connect to any remote TLS/SSL endpoint to inspect its active certificate chain, cipher suite, protocol negotiation, and trust validation.',
        )}
      />

      <div className={`glass-panel ${styles.searchPanel}`}>
        <form
          className={styles.formRow}
          onSubmit={(e) => {
            e.preventDefault()
            void scan()
          }}
        >
          <div className={`form-group ${styles.hostField}`}>
            <label htmlFor="tls-scanner-host-input" className="form-label">
              {t('app.tlsScanner.hostLabel', 'Hostname / Domain / IP')}
            </label>
            <input
              id="tls-scanner-host-input"
              type="text"
              className="form-input"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={t(
                'app.tlsScanner.hostPlaceholder',
                'e.g. google.com or https://api.github.com',
              )}
            />
          </div>

          <div className={`form-group ${styles.portField}`}>
            <label htmlFor="tls-scanner-port-input" className="form-label">
              {t('app.tlsScanner.portLabel', 'Port')}
            </label>
            <input
              id="tls-scanner-port-input"
              type="number"
              min={1}
              max={65535}
              className="form-input"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              placeholder="443"
            />
          </div>

          <button
            id="tls-scanner-submit-btn"
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw size={16} className="spin" aria-hidden="true" />
            ) : (
              <Globe size={16} aria-hidden="true" />
            )}
            <span>
              {loading
                ? t('app.tlsScanner.scanning', 'Scanning...')
                : t('app.tlsScanner.scanButton', 'Scan Endpoint')}
            </span>
          </button>
        </form>

        <div className={styles.presetsRow}>
          <span className={styles.presetsLabel}>
            {t('app.tlsScanner.quickPresets', 'Quick Presets:')}
          </span>
          {TLS_QUICK_PRESETS.map((preset) => {
            const isActive = host === preset.host
            const presetId = `tls-preset-${preset.host.replace(/[^a-zA-Z0-9]/g, '-')}`
            if (preset.isSpecial) {
              return (
                <button
                  key={preset.host}
                  id={presetId}
                  type="button"
                  className={`${styles.presetSpecial} ${isActive ? styles.presetSpecialActive : ''}`}
                  onClick={() => {
                    setHost(preset.host)
                    setPort(preset.port)
                    void scan(preset.host, preset.port)
                  }}
                  title={`${preset.host}:${preset.port}`}
                >
                  <span className={styles.presetSpecialIcon} aria-hidden="true">
                    <Home size={13} />
                  </span>
                  <span className="mono">{preset.label}</span>
                  <span className={styles.presetSpecialSparkle} aria-hidden="true">
                    <Sparkles size={11} />
                  </span>
                </button>
              )
            }

            return (
              <button
                key={preset.host}
                id={presetId}
                type="button"
                className={`${styles.presetPill} ${isActive ? styles.presetPillActive : ''}`}
                onClick={() => {
                  setHost(preset.host)
                  setPort(preset.port)
                  void scan(preset.host, preset.port)
                }}
                title={`${preset.host}:${preset.port}`}
              >
                <span className="mono">{preset.label}</span>
                {Boolean(preset.badge) && preset.badgeType && (
                  <span className={`${styles.presetBadge} ${styles[`badge_${preset.badgeType}`]}`}>
                    {preset.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {Boolean(error) && (
        <div id="tls-scanner-error" role="alert" className={`glass-panel ${styles.errorAlert}`}>
          <AlertTriangle size={20} className={styles.shrinkZero} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {scanResult && (
        <div id="tls-scanner-results" className={`animate-fade-in ${styles.resultsStack}`}>
          <div className="metric-cards-grid">
            <div className="metric-card">
              <div className="metric-icon-wrap info" aria-hidden="true">
                <Server size={22} />
              </div>
              <div className={styles.metricInfo}>
                <div className={styles.metricLabel}>
                  {t('app.tlsScanner.metrics.protocol', 'Negotiated Protocol')}
                </div>
                <div className={styles.metricValLg}>{scanResult.protocol}</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrap success" aria-hidden="true">
                <Lock size={22} />
              </div>
              <div className={styles.metricInfo}>
                <div className={styles.metricLabel}>
                  {t('app.tlsScanner.metrics.cipher', 'Negotiated Cipher Suite')}
                </div>
                <div className={styles.metricValCipher}>
                  {scanResult.cipher?.name || t('common.unknown', 'Unknown')}
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div
                className={`metric-icon-wrap ${scanResult.authorized ? 'success' : 'danger'}`}
                aria-hidden="true"
              >
                {scanResult.authorized ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
              </div>
              <div className={styles.metricInfo}>
                <div className={styles.metricLabel}>
                  {t('app.tlsScanner.metrics.trustValidation', 'TLS Trust Validation')}
                </div>
                {scanResult.authorized ? (
                  <div className={styles.metricTrusted}>
                    {t('app.tlsScanner.metrics.trusted', 'Trusted by System Store')}
                  </div>
                ) : (
                  <div>
                    <div className={styles.metricUntrusted}>{authErrorInfo?.title}</div>
                    {Boolean(authErrorInfo?.detail) && (
                      <div
                        className={`mono ${styles.metricErrorCode}`}
                        title={scanResult.authorizationError ?? undefined}
                      >
                        {authErrorInfo?.detail}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrap cyan" aria-hidden="true">
                <Layers size={22} />
              </div>
              <div className={styles.metricInfo}>
                <div className={styles.metricLabel}>
                  {t('app.tlsScanner.metrics.chainLength', 'Chain Depth')}
                </div>
                <div className={styles.metricDepthRow}>
                  <span>{scanResult.chain.length}</span>
                  <span className={styles.metricDepthUnit}>
                    {t('app.tlsScanner.metrics.certs', 'Certificates')}
                  </span>
                </div>
                <div className={styles.metricSub}>
                  {scanResult.chain.length === 1
                    ? t('app.tlsScanner.metrics.singleCert', 'Single Leaf / Self-Signed')
                    : t('app.tlsScanner.metrics.chainBreakdown', {
                        count: Math.max(0, scanResult.chain.length - 1),
                        defaultValue: `1 Leaf · ${Math.max(0, scanResult.chain.length - 1)} Intermediate / Root`,
                      })}
                </div>
              </div>
            </div>
          </div>

          <section>
            <TlsChainStepper
              chain={scanResult.chain}
              authorized={scanResult.authorized}
              activeCertIdx={activeCertIdx}
              copiedAll={copiedAll}
              onSelectCert={handleJumpToIndex}
              onCopyAllPem={() => void copyAllPem()}
              onDownloadAllPem={downloadAllPem}
            />

            <div className={styles.cardsStack}>
              {scanResult.chain.map((cert, idx) => (
                <TlsChainFlowCard
                  key={`${scanResult.host}:${scanResult.port}:${idx}:${cert.fingerprint256 || cert.serialNumber}`}
                  cert={cert}
                  index={idx}
                  chainLength={scanResult.chain.length}
                  onJumpToIndex={handleJumpToIndex}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
