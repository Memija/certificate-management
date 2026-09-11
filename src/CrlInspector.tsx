import { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import {
  Upload, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Copy, Download, X, Search, ShieldAlert, Calendar, Eye, EyeOff, Sparkles, FileText,
  FolderOpen, FileKey, Info, KeyRound, RefreshCw, Ban, UserX, PauseCircle, ShieldOff, CheckCircle2, HelpCircle
} from 'lucide-react';
import { parseCrlFile, parseCrlText, SAMPLE_CRL_PEM } from './utils/crlParser';
import type { ParsedCRL } from './utils/crlParser';
import { LearningTerm } from './LearningTerm';
import type { AppMode } from './App';

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={t('common.copyToClipboard', 'Copy to clipboard')}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: copied ? 'var(--success-color)' : 'var(--text-secondary)',
        padding: '2px 4px', borderRadius: 4, transition: 'color 0.2s',
        display: 'inline-flex', alignItems: 'center',
      }}
    >
      <Copy size={13} />
    </button>
  );
}

interface LoadedCRL {
  id: string;
  name: string;
  crl: ParsedCRL;
  isSample?: boolean;
}

const REASON_KEY_MAP: Record<string, string> = {
  'Unspecified': 'unspecified',
  'Key Compromise': 'keyCompromise',
  'CA Compromise': 'caCompromise',
  'Affiliation Changed': 'affiliationChanged',
  'Superseded': 'superseded',
  'Cessation Of Operation': 'cessationOfOperation',
  'Certificate Hold': 'certificateHold',
  'Remove From CRL': 'removeFromCRL',
  'Privilege Withdrawn': 'privilegeWithdrawn',
  'AA Compromise': 'aaCompromise',
};

const EXTENSION_DISPLAY_NAMES: Record<string, string> = {
  crlNumber: 'CRL Number',
  crlReason: 'CRL Reason',
  deltaCRLIndicator: 'Delta CRL Indicator',
  issuingDistributionPoint: 'Issuing Distribution Point',
  authorityKeyIdentifier: 'Authority Key Identifier',
};

function getReasonKey(reason: string): string {
  if (REASON_KEY_MAP[reason]) return REASON_KEY_MAP[reason];
  const normalized = reason.toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized.includes('keycompromise')) return 'keyCompromise';
  if (normalized.includes('cacompromise')) return 'caCompromise';
  if (normalized.includes('aacompromise')) return 'aaCompromise';
  if (normalized.includes('compromise')) return 'keyCompromise';
  if (normalized.includes('superseded')) return 'superseded';
  if (normalized.includes('cessation')) return 'cessationOfOperation';
  if (normalized.includes('affiliation')) return 'affiliationChanged';
  if (normalized.includes('hold')) return 'certificateHold';
  if (normalized.includes('removefromcrl') || normalized.includes('remove')) return 'removeFromCRL';
  if (normalized.includes('privilege')) return 'privilegeWithdrawn';
  if (normalized.includes('unspecified')) return 'unspecified';
  return 'unspecified';
}

const CYRL_TO_LATIN_MAP: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ђ': 'dj', 'е': 'e', 'ж': 'z', 'з': 'z', 'и': 'i',
  'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj', 'м': 'm', 'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r',
  'с': 's', 'т': 't', 'ћ': 'c', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'c', 'џ': 'dz', 'ш': 's',
};

function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split('')
    .map(c => CYRL_TO_LATIN_MAP[c] || c)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[čć]/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'dj');
}

interface ReasonConfig {
  className: string;
  Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}

const REASON_CONFIGS: Record<string, ReasonConfig> = {
  keyCompromise: {
    className: 'reason-key-compromise',
    Icon: KeyRound,
  },
  caCompromise: {
    className: 'reason-ca-compromise',
    Icon: ShieldAlert,
  },
  aaCompromise: {
    className: 'reason-aa-compromise',
    Icon: ShieldAlert,
  },
  superseded: {
    className: 'reason-superseded',
    Icon: RefreshCw,
  },
  cessationOfOperation: {
    className: 'reason-cessation',
    Icon: Ban,
  },
  affiliationChanged: {
    className: 'reason-affiliation',
    Icon: UserX,
  },
  certificateHold: {
    className: 'reason-hold',
    Icon: PauseCircle,
  },
  privilegeWithdrawn: {
    className: 'reason-privilege',
    Icon: ShieldOff,
  },
  removeFromCRL: {
    className: 'reason-remove',
    Icon: CheckCircle2,
  },
  unspecified: {
    className: 'reason-unspecified',
    Icon: HelpCircle,
  },
};

function ReasonBadge({ reason, localizedText }: { reason: string; localizedText: string }) {
  const key = getReasonKey(reason);
  const config = REASON_CONFIGS[key] || REASON_CONFIGS.unspecified;
  const IconComponent = config.Icon;

  return (
    <span className={`crl-reason-badge ${config.className}`}>
      <IconComponent size={12} />
      <span>{localizedText}</span>
    </span>
  );
}


function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function CRLDetails({
  crl,
  fileName,
  isSample,
  onReplace,
  onClear,
}: {
  crl: ParsedCRL;
  fileName: string;
  isSample?: boolean;
  onReplace: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [showPem, setShowPem] = useState(false);
  const [showExts, setShowExts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const downloadDer = () => {
    const link = document.createElement('a');
    link.href = `data:application/octet-stream;base64,${crl.derBase64}`;
    link.download = 'revocation_list.crl';
    link.click();
  };

  const downloadPem = () => {
    const blob = new Blob([crl.pem], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'revocation_list.pem';
    link.click();
  };

  const filteredRevoked = useMemo(() => {
    if (!searchTerm.trim()) return crl.revokedCertificates;
    const rawQ = searchTerm.trim().toLowerCase();
    const normQ = normalizeSearchText(rawQ);

    return crl.revokedCertificates.filter((item) => {
      const reasonKey = getReasonKey(item.reason);
      const localizedReason = reasonKey ? t(`app.crl.reasons.${reasonKey}`, item.reason).toLowerCase() : '';
      const formattedDate = formatDate(item.revocationDate).toLowerCase();
      const rawDate = (item.revocationDate || '').toLowerCase();
      const serial = item.serialNumber.toLowerCase();

      // 1. Serial Number match (hex, with or without leading zeros)
      const trimmedSerial = serial.replace(/^0+/, '');
      const trimmedQ = rawQ.replace(/^0+/, '');
      if (serial.includes(rawQ) || (trimmedQ && trimmedSerial.includes(trimmedQ))) return true;

      // 2. Date match (both formatted localized date and ISO date)
      if (formattedDate.includes(rawQ) || rawDate.includes(rawQ)) return true;

      // 3. Raw English reason match
      if (item.reason.toLowerCase().includes(rawQ) || normalizeSearchText(item.reason).includes(normQ)) return true;

      // 4. Localized reason match (direct + normalized cross-script Latin/Cyrillic + diacritics)
      if (localizedReason.includes(rawQ) || (normQ && normalizeSearchText(localizedReason).includes(normQ))) return true;

      return false;
    });
  }, [crl.revokedCertificates, searchTerm, t]);

  const totalPages = Math.max(1, Math.ceil(filteredRevoked.length / pageSize));
  const currentSlice = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRevoked.slice(start, start + pageSize);
  }, [filteredRevoked, currentPage]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* File Header & Actions Bar */}
      <div className="glass-card" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'rgba(56, 189, 248, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-accent)', flexShrink: 0
          }}>
            <FileText size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem', wordBreak: 'break-all' }}>
                {fileName}
              </span>
              {isSample && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.2rem 0.55rem', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
                  background: 'rgba(234, 179, 8, 0.15)', color: '#eab308',
                  border: '1px solid rgba(234, 179, 8, 0.3)'
                }}>
                  <Sparkles size={11} /> {t('app.crl.sampleBadge', 'Sample CRL')}
                </span>
              )}
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              {t('app.crl.itemSummary', {
                count: crl.revokedCertificates.length,
                status: crl.isExpired ? t('app.certDetails.expired', 'Expired') : t('app.crl.active', 'Active'),
                defaultValue: `${crl.revokedCertificates.length} revoked · ${crl.isExpired ? 'Expired' : 'Active'}`
              })}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onReplace}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
          >
            <Upload size={14} /> {t('app.crl.replaceCrl', 'Replace CRL')}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem', color: '#ef4444' }}
            title={t('app.crl.clearCrl', 'Clear CRL')}
          >
            <X size={14} /> {t('app.crl.clearCrl', 'Clear')}
          </button>
        </div>
      </div>

      {/* Badges Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {crl.isExpired ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
            background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            <XCircle size={13} /> {t('app.crl.expiredBadge', 'Expired CRL')}
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
            background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}>
            <CheckCircle size={13} /> {t('app.crl.activeBadge', 'Active CRL')}
          </span>
        )}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.82rem',
          background: 'rgba(56, 189, 248, 0.12)', color: 'var(--text-accent)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}>
          <ShieldAlert size={13} /> {t('app.crl.revokedCount', { count: crl.revokedCertificates.length, defaultValue: `${crl.revokedCertificates.length} Revoked Certificates` })}
        </span>
      </div>

      {/* Overview Card */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
          {t('app.crl.overviewTitle', 'CRL Overview & Issuer')}
        </h4>
        <div className="details-grid">
          <div className="details-label">{t('app.crl.issuerDn', 'Issuer DN')}</div>
          <div className="details-value" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{crl.issuer || t('app.crl.unknownIssuer', 'Unknown Issuer')}</div>

          <div className="details-label">{t('app.crl.version', 'Version')}</div>
          <div className="details-value">v{crl.version}</div>

          <div className="details-label">{t('app.crl.thisUpdate', 'This Update')}</div>
          <div className="details-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <span>{formatDate(crl.thisUpdate)}</span>
          </div>

          <div className="details-label">{t('app.crl.nextUpdate', 'Next Update')}</div>
          <div className="details-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={14} style={{ color: crl.isExpired ? '#ef4444' : 'var(--text-secondary)' }} />
            <span style={{ color: crl.isExpired ? '#ef4444' : 'inherit', fontWeight: crl.isExpired ? 600 : 400 }}>
              {formatDate(crl.nextUpdate)} {crl.isExpired ? `(${t('app.certDetails.expired', 'Expired')})` : ''}
            </span>
          </div>

          <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t('app.crl.sha256', 'SHA-256 Fingerprint')}</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', wordBreak: 'break-all' }}>
            {crl.fingerprintSha256}
            <CopyButton value={crl.fingerprintSha256} />
          </div>
        </div>
      </div>

      {/* Revoked Certificates Table */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={16} /> {t('app.crl.revokedEntriesTitle', 'Revoked Certificate Entries')} ({filteredRevoked.length})
          </h4>
          {crl.revokedCertificates.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--input-bg, rgba(255,255,255,0.05))',
              borderRadius: '6px',
              padding: '0.35rem 0.6rem',
              border: '1px solid var(--border-color)',
              minWidth: '280px',
              maxWidth: '420px',
              flex: '1 1 280px',
            }}>
              <Search size={14} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem', flexShrink: 0 }} />
              <input
                type="text"
                placeholder={t('app.crl.searchPlaceholder', 'Search by serial or reason...')}
                aria-label={t('app.crl.searchPlaceholder', 'Search by serial or reason...')}
                title={t('app.crl.searchPlaceholder', 'Search by serial or reason...')}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: '0.85rem' }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  title={t('common.clear', 'Clear')}
                  aria-label={t('common.clear', 'Clear')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <X size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                </button>
              )}
            </div>
          )}
        </div>

        {filteredRevoked.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {crl.revokedCertificates.length === 0
              ? t('app.crl.noRevokedCerts', 'This CRL currently lists no revoked certificates.')
              : t('app.crl.noMatchingRevokedCerts', 'No revoked certificates match your search query.')}
          </div>
        ) : (
          <>
            <div className="crl-table-container">
              <table className="crl-table">
                <thead>
                  <tr>
                    <th>{t('app.crl.serialNumberHex', 'Serial Number (Hex)')}</th>
                    <th>{t('app.crl.revocationDate', 'Revocation Date')}</th>
                    <th>{t('app.crl.reasonCode', 'Reason Code')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSlice.map((entry, idx) => {
                    const reasonKey = getReasonKey(entry.reason);
                    const localizedReason = reasonKey ? t(`app.crl.reasons.${reasonKey}`, entry.reason) : entry.reason;
                    return (
                      <tr key={`${entry.serialNumber}-${idx}`}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                          {entry.serialNumber}
                          <CopyButton value={entry.serialNumber} />
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {formatDate(entry.revocationDate)}
                        </td>
                        <td>
                          <ReasonBadge reason={entry.reason} localizedText={localizedReason} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div>{t('app.crl.pageInfo', { current: currentPage, total: totalPages, defaultValue: `Page ${currentPage} of ${totalPages}` })}</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.4 : 1 }}
                  >
                    {t('app.crl.previous', 'Previous')}
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.4 : 1 }}
                  >
                    {t('app.crl.next', 'Next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CRL Extensions */}
      {crl.extensions.length > 0 && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setShowExts(!showExts)}
          >
            <h4 style={{ margin: 0, color: 'var(--text-accent)', fontSize: '0.92rem', fontWeight: 600 }}>
              {t('app.crl.crlExtensions', { count: crl.extensions.length, defaultValue: `CRL Extensions (${crl.extensions.length})` })}
            </h4>
            {showExts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          {showExts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1rem' }}>
              {crl.extensions.map((ext, idx) => {
                const isCrlNumber = ext.name === 'crlNumber' || ext.oid === '2.5.29.20';
                const label = t(`app.crl.extensionNames.${ext.name}`, EXTENSION_DISPLAY_NAMES[ext.name] || ext.name);
                const isShortValue = Boolean(ext.value && ext.value.length <= 16);

                return (
                  <div
                    key={idx}
                    className="details-grid"
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: 'var(--table-row-alt-bg, rgba(255,255,255,0.02))',
                      borderRadius: 6,
                      border: '1px solid var(--glass-border)',
                      alignItems: 'center'
                    }}
                  >
                    <div className="details-label" style={{ fontWeight: 600 }}>{label}</div>
                    <div className="details-value">
                      {isShortValue ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            padding: '0.15rem 0.55rem',
                            borderRadius: '6px',
                            background: 'var(--input-bg, rgba(255,255,255,0.05))',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-accent, #34d399)'
                          }}>
                            {isCrlNumber ? `#${ext.value}` : ext.value}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            (OID: {ext.oid})
                          </span>
                          {ext.critical && (
                            <span style={{
                              fontSize: '0.7rem', padding: '0.12rem 0.45rem', borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600
                            }}>
                              [{t('app.crl.critical', 'CRITICAL')}]
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              OID: {ext.oid}
                            </span>
                            {ext.critical && (
                              <span style={{
                                fontSize: '0.7rem', padding: '0.12rem 0.45rem', borderRadius: '4px',
                                background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600
                              }}>
                                [{t('app.crl.critical', 'CRITICAL')}]
                              </span>
                            )}
                          </div>
                          {ext.value && (
                            <div style={{
                              fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-primary)',
                              wordBreak: 'break-all', background: 'var(--input-bg, rgba(255,255,255,0.03))',
                              padding: '0.35rem 0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)'
                            }}>
                              {ext.value}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Raw PEM View / Downloads */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            onClick={() => setShowPem(!showPem)}
            className="btn btn-secondary btn-sm"
          >
            {showPem ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showPem ? t('app.crl.hideRawPem', 'Hide Raw PEM') : t('app.crl.viewRawPem', 'View Raw PEM')}</span>
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={downloadPem}
              title={t('app.winCertStore.certCard.pemTooltip', 'Privacy Enhanced Mail (Base64 Text). Standard for Linux and web servers.')}
              className="btn btn-download-pem"
            >
              <Download size={14} /> {t('app.crl.downloadPem', 'Download PEM')}
            </button>
            <button
              onClick={downloadDer}
              title={t('app.winCertStore.certCard.derTooltip', 'Distinguished Encoding Rules (Raw Binary). Standard for Windows and Java.')}
              className="btn btn-download-der"
            >
              <Download size={14} /> {t('app.crl.downloadDer', 'Download DER')}
            </button>
          </div>
        </div>

        {showPem && (
          <div style={{ marginTop: '1rem', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 8, top: 8 }}>
              <CopyButton value={crl.pem} />
            </div>
            <pre style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '1rem', overflowX: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)', maxHeight: '280px' }}>
              {crl.pem}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function getIssuerCN(issuer: string): string {
  if (!issuer) return '';
  return issuer.match(/CN=([^,]+)/)?.[1]?.trim() ||
    issuer.match(/O=([^,]+)/)?.[1]?.trim() ||
    issuer;
}

interface CrlErrorInfo {
  fileName: string;
  code: string;
  subject?: string;
  action?: {
    labelKey: string;
    defaultLabel: string;
    targetMode: AppMode;
  } | null;
}

export function CrlInspector({ onNavigate }: { onNavigate?: (mode: AppMode) => void } = {}) {
  const { t } = useTranslation();
  const [loadedCrls, setLoadedCrls] = useState<LoadedCRL[]>([]);
  const [activeCrlId, setActiveCrlId] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<CrlErrorInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const activeItem = useMemo(() => {
    return loadedCrls.find(c => c.id === activeCrlId) || (loadedCrls.length > 0 ? loadedCrls[0] : null);
  }, [loadedCrls, activeCrlId]);

  const hasSample = useMemo(() => {
    return loadedCrls.some(c => c.isSample || c.name === 'sample_revocation_list.crl');
  }, [loadedCrls]);

  const processFiles = useCallback(async (files: File[] | FileList) => {
    const fileList = Array.from(files);
    if (!fileList.length) return;

    const newItems: LoadedCRL[] = [];
    let lastAddedId: string | null = null;

    for (const file of fileList) {
      try {
        const parsed = await parseCrlFile(file);
        // Check if this CRL is already loaded by SHA-256 fingerprint
        const alreadyLoaded = loadedCrls.find(c => c.crl.fingerprintSha256 === parsed.fingerprintSha256) ||
                              newItems.find(c => c.crl.fingerprintSha256 === parsed.fingerprintSha256);
        if (alreadyLoaded) {
          lastAddedId = alreadyLoaded.id;
          continue;
        }

        const item: LoadedCRL = {
          id: 'crl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
          name: file.name,
          crl: parsed,
          isSample: false,
        };
        newItems.push(item);
        lastAddedId = item.id;
        setErrorInfo(null);
      } catch (err: any) {
        let code = err.message || 'Unknown structure';
        let subject: string | undefined;
        let action: { labelKey: string; defaultLabel: string; targetMode: AppMode } | null = null;

        if (err.message?.startsWith('ERR_CERT_DER_NOT_CRL')) {
          code = 'ERR_CERT_DER_NOT_CRL';
          subject = err.message.includes(':') ? err.message.split(':').slice(1).join(':').trim() : undefined;
          action = { labelKey: 'app.crl.goToTrustStore', defaultLabel: 'Open in Trust Store Inspector', targetMode: 'trust-store' };
        } else if (err.message === 'ERR_CERT_NOT_CRL') {
          action = { labelKey: 'app.crl.goToTrustStore', defaultLabel: 'Open in Trust Store Inspector', targetMode: 'trust-store' };
        } else if (err.message === 'ERR_CSR_NOT_CRL') {
          action = { labelKey: 'app.crl.goToCsrInspector', defaultLabel: 'Open in CSR Inspector', targetMode: 'csr-inspector' };
        } else if (err.message === 'ERR_TRUST_STORE_NOT_CRL') {
          action = { labelKey: 'app.crl.goToTrustStore', defaultLabel: 'Open in Trust Store Inspector', targetMode: 'trust-store' };
        }

        setErrorInfo({
          fileName: file.name,
          code,
          subject,
          action
        });
      }
    }

    if (newItems.length > 0) {
      setLoadedCrls(prev => [...prev, ...newItems]);
    }
    if (lastAddedId) {
      setActiveCrlId(lastAddedId);
    }
  }, [loadedCrls]);

  const loadSampleCrl = useCallback(() => {
    const existing = loadedCrls.find(c => c.isSample || c.name === 'sample_revocation_list.crl');
    if (existing) {
      setActiveCrlId(existing.id);
      return;
    }
    try {
      const parsed = parseCrlText(SAMPLE_CRL_PEM);
      const item: LoadedCRL = {
        id: 'sample-crl-' + Date.now(),
        name: 'sample_revocation_list.crl',
        crl: parsed,
        isSample: true,
      };
      setLoadedCrls(prev => {
        if (prev.some(c => c.isSample || c.name === 'sample_revocation_list.crl')) {
          return prev;
        }
        return [...prev, item];
      });
      setActiveCrlId(item.id);
      setErrorInfo(null);
    } catch (err: any) {
      setErrorInfo({
        fileName: 'sample_revocation_list.crl',
        code: err.message || 'Unknown error'
      });
    }
  }, [loadedCrls]);

  const removeCrl = (id: string) => {
    setLoadedCrls(prev => {
      const remaining = prev.filter(c => c.id !== id);
      if (activeCrlId === id) {
        const removedIdx = prev.findIndex(c => c.id === id);
        const next = remaining[removedIdx] || remaining[removedIdx - 1] || remaining[0] || null;
        setActiveCrlId(next ? next.id : null);
      }
      return remaining;
    });
  };

  const clearAll = () => {
    setLoadedCrls([]);
    setActiveCrlId(null);
    setErrorInfo(null);
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeItem) return;
    const targetId = activeItem.id;
    try {
      const parsed = await parseCrlFile(file);
      setLoadedCrls(prev => prev.map(c => c.id === targetId ? {
        id: targetId,
        name: file.name,
        crl: parsed,
        isSample: false
      } : c));
      setErrorInfo(null);
    } catch (err: any) {
      let code = err.message || 'Unknown structure';
      let subject: string | undefined;
      let action: { labelKey: string; defaultLabel: string; targetMode: AppMode } | null = null;

      if (err.message?.startsWith('ERR_CERT_DER_NOT_CRL')) {
        code = 'ERR_CERT_DER_NOT_CRL';
        subject = err.message.includes(':') ? err.message.split(':').slice(1).join(':').trim() : undefined;
        action = { labelKey: 'app.crl.goToTrustStore', defaultLabel: 'Open in Trust Store Inspector', targetMode: 'trust-store' };
      } else if (err.message === 'ERR_CERT_NOT_CRL') {
        action = { labelKey: 'app.crl.goToTrustStore', defaultLabel: 'Open in Trust Store Inspector', targetMode: 'trust-store' };
      } else if (err.message === 'ERR_CSR_NOT_CRL') {
        action = { labelKey: 'app.crl.goToCsrInspector', defaultLabel: 'Open in CSR Inspector', targetMode: 'csr-inspector' };
      } else if (err.message === 'ERR_TRUST_STORE_NOT_CRL') {
        action = { labelKey: 'app.crl.goToTrustStore', defaultLabel: 'Open in Trust Store Inspector', targetMode: 'trust-store' };
      }

      setErrorInfo({
        fileName: file.name,
        code,
        subject,
        action
      });
    } finally {
      e.target.value = '';
    }
  };

  const localizedError = useMemo(() => {
    if (!errorInfo) return null;
    let errorDetail = errorInfo.code;
    if (errorInfo.code === 'ERR_CERT_DER_NOT_CRL') {
      errorDetail = errorInfo.subject
        ? t('app.crl.certDerNotCrl', {
            subject: errorInfo.subject,
            defaultValue: `This file is an X.509 Certificate in DER format (Subject: ${errorInfo.subject}), not a Certificate Revocation List (CRL). Please upload a valid .crl file, or inspect this certificate in the Trust Store Inspector.`
          })
        : t('app.crl.certDerNotCrlSimple', 'This file is an X.509 Certificate in DER format, not a Certificate Revocation List (CRL). Please upload a valid .crl file, or inspect this certificate in the Trust Store Inspector.');
    } else if (errorInfo.code === 'ERR_CERT_NOT_CRL') {
      errorDetail = t('app.crl.certNotCrl', 'This file contains an X.509 Certificate, not a Certificate Revocation List (CRL). Please upload a valid .crl file, or inspect this certificate in the Trust Store Inspector.');
    } else if (errorInfo.code === 'ERR_CSR_NOT_CRL') {
      errorDetail = t('app.crl.csrNotCrl', 'This file contains a Certificate Signing Request (CSR), not a Certificate Revocation List (CRL). Please inspect this file in the CSR Inspector.');
    } else if (errorInfo.code === 'ERR_TRUST_STORE_NOT_CRL') {
      errorDetail = t('app.crl.trustStoreNotCrl', 'This file is a KeyStore / Trust Store, not a Certificate Revocation List (CRL). Please inspect this file in the Trust Store Inspector.');
    } else if (errorInfo.code === 'ERR_KEY_NOT_CRL') {
      errorDetail = t('app.crl.keyNotCrl', 'This file contains a Private Key, not a Certificate Revocation List (CRL).');
    } else if (errorInfo.code === 'ERR_PEM_NO_CRL') {
      errorDetail = t('app.crl.pemNoCrl', "The PEM file does not contain a Certificate Revocation List (CRL). Expected 'BEGIN X509 CRL' or 'BEGIN CRL'.");
    } else if (errorInfo.code === 'ERR_INVALID_FORMAT') {
      errorDetail = t('app.crl.invalidFormat', 'File is not a valid PEM or DER Certificate Revocation List.');
    }

    return t('app.crl.parseError', {
      name: errorInfo.fileName,
      error: errorDetail,
      defaultValue: `Failed to parse "${errorInfo.fileName}": ${errorDetail}`
    });
  }, [errorInfo, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          <Trans i18nKey="app.crl.title" components={[<LearningTerm key="crl" termId="crl">{""}</LearningTerm>]} />
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
          <Trans
            i18nKey="app.crl.description"
            components={[
              <LearningTerm key="x509" termId="x509">{""}</LearningTerm>,
              <LearningTerm key="crl" termId="crl">{""}</LearningTerm>
            ]}
          />
        </p>
      </div>

      {localizedError && errorInfo && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          padding: '0.75rem 1rem',
          background: errorInfo.action ? 'var(--warning-bg)' : 'rgba(239, 68, 68, 0.12)',
          borderRadius: '10px',
          borderLeft: errorInfo.action ? '3px solid var(--warning-color)' : '3px solid #ef4444',
          color: errorInfo.action ? 'var(--text-primary)' : '#ef4444'
        }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flex: 1, minWidth: '240px' }}>
            {errorInfo.action ? (
              <Info size={16} color="var(--warning-color)" style={{ flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '0.88rem', lineHeight: 1.45 }}>{localizedError}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {errorInfo.action && onNavigate && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate(errorInfo.action!.targetMode)}
                style={{
                  fontSize: '0.82rem',
                  padding: '0.35rem 0.85rem',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                {errorInfo.action.targetMode === 'trust-store' && <FolderOpen size={14} />}
                {errorInfo.action.targetMode === 'csr-inspector' && <FileKey size={14} />}
                {t(errorInfo.action.labelKey, errorInfo.action.defaultLabel)}
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorInfo(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: errorInfo.action ? 'var(--text-secondary)' : '#ef4444',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                opacity: 0.8
              }}
              title={t('common.clear', 'Clear')}
              aria-label={t('common.clear', 'Clear')}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Hidden multiple-file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".crl,.pem,.der"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden single-file replace input */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept=".crl,.pem,.der"
        style={{ display: 'none' }}
        onChange={handleReplaceFile}
      />

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--text-accent)' : 'var(--border-color)'}`,
          borderRadius: '12px',
          background: isDragging ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255, 255, 255, 0.02)',
          padding: '3.5rem 2rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          marginBottom: loadedCrls.length > 0 ? '2rem' : 0,
        }}
      >
        <Upload size={48} style={{ color: 'var(--text-accent)', marginBottom: '1rem', opacity: 0.8 }} />
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
          {t('app.crl.dropZoneTitle', 'Drop a CRL file here or click to browse')}
        </h3>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.88rem' }}>
          {t('app.crl.dropZoneDesc', 'Supports standard PEM and DER formatted Certificate Revocation Lists (.crl, .pem, .der)')}
        </p>
        <div style={{ marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              loadSampleCrl();
            }}
            disabled={hasSample}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              opacity: hasSample ? 0.5 : 1,
              cursor: hasSample ? 'not-allowed' : 'pointer'
            }}
            title={hasSample ? t('app.crl.sampleAlreadyLoaded', 'Sample CRL is already loaded') : undefined}
          >
            <Sparkles size={14} style={{ color: 'var(--text-accent)' }} />
            {t('app.crl.trySampleCrl', 'Try Sample CRL')}
          </button>
        </div>
      </div>

      {loadedCrls.length > 0 && (
        <div style={{ marginTop: '2rem' }} className="animate-fade-in">
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', letterSpacing: '0.06em' }}>
              {t('app.crl.loadedFiles', 'Loaded Files')} ({loadedCrls.length})
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} /> {t('app.crl.addCrl', 'Add CRL')}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                onClick={clearAll}
              >
                <X size={13} /> {t('common.clearAll', 'Clear All')}
              </button>
            </div>
          </div>

          {/* Certificate Tabs Row */}
          <div className="chain-cert-tabs-container" style={{ marginBottom: '1.5rem' }}>
            <span style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              flexShrink: 0,
              marginRight: '0.25rem'
            }}>
              <ShieldAlert size={14} style={{ color: '#f43f5e' }} />
              {t('app.crl.tabsLabel', 'CRLs')} ({loadedCrls.length}):
            </span>
            {loadedCrls.map(item => {
              const isActive = activeItem?.id === item.id;
              const issuerCn = getIssuerCN(item.crl.issuer) || item.name;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveCrlId(item.id)}
                  className={`chain-cert-tab role-crl ${item.crl.isExpired ? 'status-error' : ''} ${isActive ? 'active' : ''}`}
                  title={item.name}
                >
                  {isActive && <span className="tab-active-dot" />}
                  <ShieldAlert size={13} className="tab-role-icon" />
                  <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{issuerCn}</span>
                  {item.isSample && (
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: 'rgba(234, 179, 8, 0.2)',
                      color: '#eab308',
                      fontWeight: 600,
                      marginLeft: 2
                    }}>
                      {t('app.crl.sampleTag', 'Sample')}
                    </span>
                  )}
                  <span
                    className="tab-action-btn btn-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCrl(item.id);
                    }}
                    title={t('common.remove', 'Remove')}
                  >
                    <X size={12} />
                  </span>
                  {isActive && <span className="tab-accent-line" />}
                </button>
              );
            })}
          </div>

          {/* Active CRL Details */}
          {activeItem && (
            <CRLDetails
              key={activeItem.id}
              crl={activeItem.crl}
              fileName={activeItem.name}
              isSample={activeItem.isSample}
              onReplace={() => replaceFileInputRef.current?.click()}
              onClear={() => removeCrl(activeItem.id)}
            />
          )}
        </div>
      )}
    </div>
  );
}

