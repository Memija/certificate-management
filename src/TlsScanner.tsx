import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  Link as LinkIcon,
  Download,
  Copy,
  Check,
  Server,
  Lock,
  Cpu,
  Layers,
} from 'lucide-react';
import * as forge from 'node-forge';
import { formatExpiry, formatExpiryTooltip } from './utils/expiryFormatter';
import { formatExtensionValue } from './utils/purposeFormatter';

function formatDn(dn: any): string {
  if (!dn) return '';
  if (typeof dn === 'string') {
    return dn.split('\n').filter(Boolean).join(', ');
  }
  if (typeof dn === 'object') {
    return Object.entries(dn)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
  }
  return String(dn);
}

function derB64ToPem(b64: string): string {
  if (!b64) return '';
  const formatted = b64.match(/.{1,64}/g)?.join('\n') || b64;
  return `-----BEGIN CERTIFICATE-----\n${formatted}\n-----END CERTIFICATE-----\n`;
}

function formatKeyDescription(cert: any): string {
  if (cert.keyType === 'ec') {
    const curve = cert.keyDetails?.namedCurve || 'ECC';
    return `ECDSA (${curve})`;
  }
  if (cert.keyType === 'rsa') {
    const bits = cert.keyDetails?.modulusLength || cert.bits || 2048;
    return `RSA (${bits}-bit)`;
  }
  if (cert.keyType) {
    return cert.keyType.toUpperCase();
  }
  return 'Unknown Public Key';
}

function parseHostInput(input: string): { host: string; port?: number } {
  let cleaned = input.trim();
  if (cleaned.includes('://')) {
    try {
      const parsed = new URL(cleaned);
      const port = parsed.port ? parseInt(parsed.port, 10) : undefined;
      return { host: parsed.hostname, port };
    } catch {
      cleaned = cleaned.replace(/^[a-zA-Z]+:\/\//, '');
      const slash = cleaned.indexOf('/');
      if (slash !== -1) cleaned = cleaned.substring(0, slash);
    }
  }
  const slash = cleaned.indexOf('/');
  if (slash !== -1) cleaned = cleaned.substring(0, slash);

  if (cleaned.startsWith('[')) {
    const endBracket = cleaned.indexOf(']');
    if (endBracket !== -1) {
      const portPart = cleaned.substring(endBracket + 1);
      const host = cleaned.substring(1, endBracket);
      if (portPart.startsWith(':')) {
        const port = parseInt(portPart.substring(1), 10);
        return { host, port: !isNaN(port) ? port : undefined };
      }
      return { host };
    }
  } else if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    if (parts.length === 2 && !isNaN(Number(parts[1]))) {
      return { host: parts[0], port: parseInt(parts[1], 10) };
    }
  }
  return { host: cleaned };
}

export function TlsScanner() {
  const { t, i18n } = useTranslation();
  const [host, setHost] = useState('');
  const [port, setPort] = useState(443);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [copiedPemIdx, setCopiedPemIdx] = useState<number | null>(null);

  const scan = async (overrideHost?: string, overridePort?: number) => {
    const targetHostRaw = overrideHost !== undefined ? overrideHost : host;
    const targetPortRaw = overridePort !== undefined ? overridePort : port;

    const parsed = parseHostInput(targetHostRaw);
    const targetHost = parsed.host;
    const targetPort = parsed.port || targetPortRaw || 443;

    if (overrideHost === undefined) {
      setHost(targetHost);
      setPort(targetPort);
    }

    if (!targetHost) {
      setError(t('app.tlsScanner.errors.hostRequired', 'Host is required'));
      return;
    }

    setLoading(true);
    setError('');
    setScanResult(null);

    try {
      const res = await fetch(`/api/tlsscanner?host=${encodeURIComponent(targetHost)}&port=${targetPort}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || t('app.tlsScanner.errors.scanFailed', 'Failed to scan endpoint'));
      }

      // Enrich certificate chain with fallback PEM and extensions parsing
      const enrichedChain = (json.data.chain || []).map((c: any) => {
        // Ensure PEM is available
        if (!c.pem && c.rawB64) {
          c.pem = derB64ToPem(c.rawB64);
        }

        // Ensure CN values are readable strings
        c.subjectCN = c.subjectCN || formatDn(c.subject) || 'Unknown';
        c.issuerCN = c.issuerCN || formatDn(c.issuer) || 'Unknown';

        // Fallback ASN.1 extension parsing if backend extensions are empty
        if ((!c.extensions || c.extensions.length === 0) && c.rawB64) {
          try {
            const derStr = forge.util.decode64(c.rawB64);
            const asn1: any = forge.asn1.fromDer(derStr);
            const tbsCert = asn1.value[0];
            const extWrapper = tbsCert.value.find(
              (el: any) => el.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && el.type === 3
            );
            if (extWrapper && extWrapper.value && extWrapper.value[0]) {
              const extSeq = extWrapper.value[0];
              c.extensions = extSeq.value.map((e: any) => {
                try {
                  const ext = (forge.pki as any).certificateExtensionFromAsn1(e);
                  return {
                    id: ext.id,
                    oid: ext.id,
                    name: ext.name || ext.id,
                    critical: !!ext.critical,
                    value: typeof ext.value === 'string' ? ext.value : JSON.stringify(ext.value),
                  };
                } catch {
                  const oid = forge.asn1.derToOid(e.value[0].value);
                  const critical = e.value.length === 3 ? !!e.value[1].value : false;
                  const valObj = e.value.length === 3 ? e.value[2] : e.value[1];
                  let valStr = '';
                  try {
                    valStr = forge.util.bytesToHex(valObj.value);
                  } catch {
                    valStr = '';
                  }
                  return {
                    id: oid,
                    oid,
                    name: (forge.pki.oids as any)[oid] || oid,
                    critical,
                    value: valStr,
                  };
                }
              });
            }
          } catch {
            c.extensions = [];
          }
        }

        return c;
      });

      setScanResult({
        ...json.data,
        chain: enrichedChain,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyPem = (pem: string, idx: number) => {
    if (!pem) return;
    navigator.clipboard.writeText(pem);
    setCopiedPemIdx(idx);
    setTimeout(() => setCopiedPemIdx(null), 2000);
  };

  const downloadPem = (pem: string, name: string) => {
    const blob = new Blob([pem], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (name || 'certificate').replace(/[^a-z0-9_-]/gi, '_');
    a.download = `${safeName}.pem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const presets = [
    { label: 'google.com', host: 'google.com', port: 443 },
    { label: 'cloudflare.com', host: 'cloudflare.com', port: 443 },
    { label: 'github.com', host: 'github.com', port: 443 },
    { label: 'expired.badssl.com', host: 'expired.badssl.com', port: 443 },
    { label: 'self-signed.badssl.com', host: 'self-signed.badssl.com', port: 443 },
  ];

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('app.tlsScanner.title', 'Remote TLS Endpoint Scanner')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            {t(
              'app.tlsScanner.subtitle',
              'Connect to any remote TLS/SSL endpoint to inspect its active certificate chain, cipher suite, protocol negotiation, and trust validation.'
            )}
          </p>
        </div>

        <div
          className="glass-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '2rem',
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 240px', marginBottom: 0 }}>
              <label className="form-label">{t('app.tlsScanner.hostLabel', 'Hostname / Domain / IP')}</label>
              <input
                id="tls-scanner-host-input"
                type="text"
                className="form-input"
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="e.g. google.com or https://api.github.com"
                onKeyDown={e => e.key === 'Enter' && scan()}
              />
            </div>
            <div className="form-group" style={{ flex: '0 1 120px', marginBottom: 0 }}>
              <label className="form-label">{t('app.tlsScanner.portLabel', 'Port')}</label>
              <input
                id="tls-scanner-port-input"
                type="number"
                className="form-input"
                value={port}
                onChange={e => setPort(Number(e.target.value))}
                placeholder="443"
                onKeyDown={e => e.key === 'Enter' && scan()}
              />
            </div>
            <button
              id="tls-scanner-submit-btn"
              className="btn btn-primary"
              onClick={() => scan()}
              disabled={loading}
              style={{ height: '42px', padding: '0 1.5rem' }}
            >
              {loading ? (
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Globe size={16} />
              )}
              <span>{loading ? t('app.tlsScanner.scanning', 'Scanning...') : t('app.tlsScanner.scanButton', 'Scan Endpoint')}</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('app.tlsScanner.quickPresets', 'Quick Presets:')}
            </span>
            {presets.map(p => (
              <button
                key={p.host}
                type="button"
                className="badge"
                style={{
                  cursor: 'pointer',
                  background: 'var(--badge-bg, rgba(255,255,255,0.06))',
                  border: '1px solid var(--glass-border-subtle)',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => {
                  setHost(p.host);
                  setPort(p.port);
                  scan(p.host, p.port);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            id="tls-scanner-error"
            className="glass-panel"
            style={{
              background: 'var(--danger-bg)',
              borderColor: 'var(--danger-border)',
              color: 'var(--danger-color)',
              marginBottom: '2rem',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {scanResult && (
          <div id="tls-scanner-results" className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <div className="metric-cards-grid">
              <div className="metric-card">
                <div className="metric-icon-wrap info">
                  <Server size={22} />
                </div>
                <div className="metric-info">
                  <div className="metric-label">{t('app.tlsScanner.metrics.protocol', 'Negotiated Protocol')}</div>
                  <div className="metric-val" style={{ fontSize: '1.25rem' }}>{scanResult.protocol}</div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-wrap success">
                  <Lock size={22} />
                </div>
                <div className="metric-info">
                  <div className="metric-label">{t('app.tlsScanner.metrics.cipher', 'Negotiated Cipher Suite')}</div>
                  <div className="metric-val" style={{ fontSize: '0.95rem', wordBreak: 'break-all' }}>
                    {scanResult.cipher?.name || 'Unknown'}
                  </div>
                </div>
              </div>

              <div className="metric-card">
                <div className={`metric-icon-wrap ${scanResult.authorized ? 'success' : 'danger'}`}>
                  {scanResult.authorized ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
                </div>
                <div className="metric-info">
                  <div className="metric-label">{t('app.tlsScanner.metrics.trustValidation', 'TLS Trust Validation')}</div>
                  <div
                    className="metric-val"
                    style={{
                      fontSize: '0.95rem',
                      color: scanResult.authorized ? 'var(--success-color)' : 'var(--danger-color)',
                    }}
                  >
                    {scanResult.authorized
                      ? t('app.tlsScanner.metrics.trusted', 'Trusted by System Store')
                      : scanResult.authorizationError || t('app.tlsScanner.metrics.untrusted', 'Validation Issue')}
                  </div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-wrap purple">
                  <Layers size={22} />
                </div>
                <div className="metric-info">
                  <div className="metric-label">{t('app.tlsScanner.metrics.chainLength', 'Chain Depth')}</div>
                  <div className="metric-val" style={{ fontSize: '1.25rem' }}>
                    {scanResult.chain?.length || 0} {t('app.tlsScanner.metrics.certs', 'Certificates')}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1.25rem',
                  fontSize: '1.2rem',
                  color: 'var(--text-primary)',
                }}
              >
                <LinkIcon size={18} style={{ color: 'var(--text-accent)' }} />
                {t('app.tlsScanner.presentedChain', 'Presented Certificate Chain')} ({scanResult.chain.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {scanResult.chain.map((cert: any, idx: number) => {
                  const isExpired = new Date(cert.valid_to) < new Date();
                  const isLeaf = idx === 0;
                  const isRoot = idx === scanResult.chain.length - 1 && idx > 0;
                  const isIntermediate = idx > 0 && !isRoot;

                  return (
                    <div
                      key={idx}
                      className="glass-card"
                      style={{
                        borderLeft: `3px solid ${
                          isExpired
                            ? 'var(--danger-color)'
                            : isLeaf
                            ? 'var(--accent-color)'
                            : 'var(--glass-border-accent)'
                        }`,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '1.25rem',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            className={`metric-icon-wrap ${isExpired ? 'danger' : isLeaf ? 'info' : 'success'}`}
                            style={{ width: 38, height: 38, borderRadius: 8 }}
                          >
                            <Shield size={18} />
                          </div>
                          <div>
                            <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                              {cert.subjectCN}
                            </strong>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {t('app.tlsScanner.issuer', 'Issuer')}: {cert.issuerCN}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {isLeaf && <span className="badge badge-purple">{t('app.certDetails.leafCert', 'Leaf Certificate')}</span>}
                          {isIntermediate && <span className="badge badge-warning">{t('app.certDetails.intermediateCa', 'Intermediate CA')}</span>}
                          {isRoot && <span className="badge badge-success">{t('app.certDetails.rootCa', 'Root CA')}</span>}
                          {cert.ca && !isLeaf && <span className="badge badge-blue">CA</span>}
                          {isExpired && (
                            <span className="badge badge-danger">
                              <span className="badge-dot pulse" />
                              {t('app.certDetails.expired', 'Expired')}
                            </span>
                          )}

                          {cert.pem && (
                            <>
                              <button
                                type="button"
                                className="btn btn-download-pem"
                                onClick={() => copyPem(cert.pem, idx)}
                                style={{ marginLeft: '0.4rem' }}
                                title={t('app.tlsScanner.copyPem', 'Copy PEM to Clipboard')}
                              >
                                {copiedPemIdx === idx ? <Check size={13} style={{ color: 'var(--success-color)' }} /> : <Copy size={13} />}
                                {copiedPemIdx === idx ? t('app.tlsScanner.copied', 'Copied!') : t('app.tlsScanner.copyPem', 'Copy PEM')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-download-pem"
                                onClick={() => downloadPem(cert.pem, cert.subjectCN)}
                              >
                                <Download size={13} /> {t('app.tlsScanner.downloadPem', 'Download PEM')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="details-grid">
                        <div className="details-label">{t('app.tlsScanner.subject', 'Subject')}</div>
                        <div className="details-value">{formatDn(cert.subject)}</div>

                        <div className="details-label">{t('app.tlsScanner.issuer', 'Issuer')}</div>
                        <div className="details-value">{formatDn(cert.issuer)}</div>

                        <div className="details-label">{t('app.tlsScanner.validFrom', 'Valid From')}</div>
                        <div className="details-value">{new Date(cert.valid_from).toLocaleString()}</div>

                        <div className="details-label">{t('app.tlsScanner.validTo', 'Valid To')}</div>
                        <div
                          className="details-value"
                          style={{
                            color: isExpired ? 'var(--danger-color)' : undefined,
                            fontWeight: isExpired ? 600 : undefined,
                          }}
                        >
                          {new Date(cert.valid_to).toLocaleString()}{' '}
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              color: isExpired ? 'var(--danger-color)' : 'var(--text-secondary)',
                              marginLeft: '0.35rem',
                              cursor: 'help',
                            }}
                            title={formatExpiryTooltip(cert.valid_to, t, i18n.language)}
                          >
                            ({formatExpiry(cert.valid_to, t, i18n.language)})
                          </span>
                        </div>

                        <div className="details-label">{t('app.tlsScanner.publicKey', 'Public Key')}</div>
                        <div className="details-value mono">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Cpu size={14} style={{ color: 'var(--accent-color)' }} />
                            {formatKeyDescription(cert)}
                          </span>
                        </div>

                        <div className="details-label">{t('app.tlsScanner.serialNumber', 'Serial Number')}</div>
                        <div className="details-value mono">{cert.serialNumber}</div>

                        <div className="details-label">{t('app.tlsScanner.fingerprint256', 'SHA-256 Fingerprint')}</div>
                        <div className="details-value mono" style={{ wordBreak: 'break-all' }}>
                          {cert.fingerprint256}
                        </div>
                      </div>

                      {cert.subjectAltNames && cert.subjectAltNames.length > 0 && (
                        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border-subtle)' }}>
                          <details>
                            <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', fontSize: '0.88rem', fontWeight: 600 }}>
                              {t('app.tlsScanner.sanTitle', 'Subject Alternative Names (SANs)')} ({cert.subjectAltNames.length})
                            </summary>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.65rem' }}>
                              {cert.subjectAltNames.map((san: string, sIdx: number) => (
                                <span
                                  key={sIdx}
                                  className="badge"
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.78rem',
                                    background: 'var(--badge-bg, rgba(255,255,255,0.05))',
                                    border: '1px solid var(--glass-border-subtle)',
                                  }}
                                >
                                  {san}
                                </span>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}

                      {cert.extensions && cert.extensions.length > 0 && (
                        <details style={{ marginTop: '0.75rem' }}>
                          <summary
                            style={{
                              cursor: 'pointer',
                              color: 'var(--text-accent)',
                              marginBottom: '0.5rem',
                              fontSize: '0.88rem',
                              fontWeight: 600,
                            }}
                          >
                            {t('app.tlsScanner.viewExtensions', 'View Extensions')} ({cert.extensions.length})
                          </summary>
                          <div
                            className="details-grid"
                            style={{
                              background: 'var(--card-bg)',
                              border: '1px solid var(--glass-border-subtle)',
                              padding: '0.85rem 1rem',
                              borderRadius: 8,
                              marginTop: 4,
                            }}
                          >
                            {cert.extensions.map((ext: any, i: number) => (
                              <div key={i} style={{ display: 'contents' }}>
                                <div className="details-label" style={{ fontSize: '0.78rem' }}>
                                  {ext.name || ext.oid}
                                </div>
                                <div className="details-value">
                                  <div style={{ fontSize: '0.8rem' }}>
                                    OID: {ext.oid}{' '}
                                    {ext.critical && (
                                      <span className="badge badge-danger" style={{ fontSize: '0.65em', marginLeft: 4 }}>
                                        {t('app.certDetails.critical', 'Critical')}
                                      </span>
                                    )}
                                  </div>
                                  {ext.value && (
                                    <div
                                      className="mono"
                                      style={{
                                        wordBreak: 'break-all',
                                        fontSize: '0.78rem',
                                        marginTop: '0.25rem',
                                        color: 'var(--text-muted)',
                                      }}
                                    >
                                      {formatExtensionValue(ext.name, ext.oid, String(ext.value), t)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {cert.pem && (
                        <details style={{ marginTop: '0.75rem' }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--text-accent)', fontSize: '0.88rem', fontWeight: 600 }}>
                            {t('app.tlsScanner.viewPem', 'View PEM')}
                          </summary>
                          <pre className="code-block" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                            {cert.pem}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
