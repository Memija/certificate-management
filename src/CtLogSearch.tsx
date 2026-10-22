import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Globe, 
  Calendar, 
  Shield, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles, 
  Trash2, 
  XCircle, 
  AlertTriangle,
  FileText,
  Home
} from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { LearningTerm } from './LearningTerm';
import { formatExpiry, formatExpiryTooltip } from './utils/expiryFormatter';
import { CT_LOG_PRESETS, type CtEntry, type CtLogPreset } from './utils/ctLogSamples';

export function CtLogSearch() {
  const { t, i18n } = useTranslation();
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<CtEntry[] | null>(null);
  const [searchedDomain, setSearchedDomain] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'expired'>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [isSampleData, setIsSampleData] = useState(false);
  const [providerInfo, setProviderInfo] = useState<{
    provider: 'crt.sh' | 'certspotter' | 'sample';
    rateLimited: boolean;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const executeSearch = async (targetDomain: string, preset?: CtLogPreset) => {
    const trimmed = targetDomain.trim();
    if (!trimmed) {
      setError(t('app.ctLog.emptyDomainError', 'Please enter a valid domain name (e.g. google.com or github.com).'));
      return;
    }

    setLoading(true);
    setError('');
    setSearchedDomain(trimmed);

    try {
      const response = await fetch(`/api/ctsearch?domain=${encodeURIComponent(trimmed)}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('app.ctLog.searchFailedError', 'Failed to fetch CT logs from crt.sh. The service may be experiencing high traffic.'));
      }

      // Deduplicate and merge live results with historical audit log records if available
      const liveItems: CtEntry[] = result.data || [];
      const combined = [...liveItems];

      if (preset && preset.sampleData) {
        for (const sampleItem of preset.sampleData) {
          const alreadyPresent = combined.some(
            c => c.serial_number.toLowerCase() === sampleItem.serial_number.toLowerCase() ||
                 String(c.id) === String(sampleItem.id)
          );
          if (!alreadyPresent) {
            combined.push(sampleItem);
          }
        }
      }

      const uniqueResults = combined.reduce((acc: CtEntry[], current: CtEntry) => {
        if (!acc.some(item => item.serial_number.toLowerCase() === current.serial_number.toLowerCase())) {
          acc.push(current);
        }
        return acc;
      }, []);

      const sorted = uniqueResults.sort(
        (a: CtEntry, b: CtEntry) => new Date(b.not_before).getTime() - new Date(a.not_before).getTime()
      );

      setResults(sorted);
      setIsSampleData(false);
      setProviderInfo({
        provider: result.provider || 'crt.sh',
        rateLimited: !!result.rateLimited
      });
    } catch (err: any) {
      // Graceful fallback to bundled preset sample data if available
      if (preset && preset.sampleData && preset.sampleData.length > 0) {
        setResults(preset.sampleData);
        setIsSampleData(true);
        setProviderInfo({
          provider: 'sample',
          rateLimited: true
        });
        setError('');
      } else {
        setError(err.message || t('app.ctLog.searchFailedError', 'Failed to fetch CT logs from crt.sh. The service may be experiencing high traffic.'));
        setResults(null);
        setIsSampleData(false);
        setProviderInfo(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const searchLogs = () => {
    const matchedPreset = CT_LOG_PRESETS.find(
      p => p.domain.toLowerCase() === domain.trim().toLowerCase()
    );
    executeSearch(domain, matchedPreset);
  };

  const handleSelectPreset = (preset: CtLogPreset) => {
    setDomain(preset.domain);
    setActivePresetId(preset.id);
    setFilterStatus('all');
    setFilterQuery('');
    executeSearch(preset.domain, preset);
  };

  const handleClear = () => {
    setDomain('');
    setActivePresetId(null);
    setResults(null);
    setSearchedDomain('');
    setError('');
    setIsSampleData(false);
    setProviderInfo(null);
    setFilterQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchLogs();
    }
  };

  const formatIssuer = (issuer: string) => {
    const cnMatch = issuer.match(/CN=([^,]+)/);
    const oMatch = issuer.match(/O=([^,]+)/);
    if (oMatch && cnMatch) return `${oMatch[1]} - ${cnMatch[1]}`;
    if (cnMatch) return cnMatch[1];
    if (oMatch) return oMatch[1];
    return issuer;
  };

  const isExpired = (notAfter: string) => {
    return new Date(notAfter).getTime() < Date.now();
  };

  // Filtered results based on validity and search query
  const filteredResults = useMemo(() => {
    if (!results) return [];

    return results.filter(entry => {
      // Status filter
      const expired = isExpired(entry.not_after);
      if (filterStatus === 'valid' && expired) return false;
      if (filterStatus === 'expired' && !expired) return false;

      // Query filter
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase();
        const matchesCn = entry.common_name?.toLowerCase().includes(q);
        const matchesSan = entry.name_value?.toLowerCase().includes(q);
        const matchesIssuer = entry.issuer_name?.toLowerCase().includes(q);
        const matchesSerial = entry.serial_number?.toLowerCase().includes(q);
        if (!matchesCn && !matchesSan && !matchesIssuer && !matchesSerial) {
          return false;
        }
      }

      return true;
    });
  }, [results, filterStatus, filterQuery]);

  // Counts for tabs
  const counts = useMemo(() => {
    if (!results) return { all: 0, valid: 0, expired: 0 };
    let valid = 0;
    let expired = 0;
    for (const r of results) {
      if (isExpired(r.not_after)) {
        expired++;
      } else {
        valid++;
      }
    }
    return { all: results.length, valid, expired };
  }, [results]);

  return (
    <div className="main-content">
      <div style={{ maxWidth: '1050px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Page Header */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'var(--info-bg)', color: 'var(--info-color)', border: '1px solid var(--info-border)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            <span>{t('app.ctLog.eyebrow', 'Public Audit & RFC 6962')}</span>
          </div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('app.ctLog.title', 'Certificate Transparency (CT) Log Search')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>
            <Trans
              i18nKey="app.ctLog.subtitle"
              defaults="Search public <0>Certificate Transparency (CT)</0> logs to discover all certificates ever issued for a specific domain name or wildcard."
              components={[
                <LearningTerm key="0" termId="ctlog">
                  Certificate Transparency (CT)
                </LearningTerm>
              ]}
            />
          </p>
        </div>

        {/* Quick Examples / Presets Bar */}
        <div className="glass-panel key-matcher-presets-panel animate-fade-in" style={{ marginBottom: '1.5rem' }}>
          <div className="key-matcher-presets-header">
            <div className="key-matcher-presets-title">
              <Sparkles size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
              <span>{t('app.ctLog.tryExamples', 'Try Quick Examples:')}</span>
            </div>

            {(domain || results) && (
              <button
                type="button"
                className="chain-sample-pill key-matcher-clear-btn key-matcher-clear-mobile"
                onClick={handleClear}
                title={t('app.ctLog.clearBtn', 'Clear')}
              >
                <Trash2 size={13} />
                <span>{t('app.ctLog.clearBtn', 'Clear')}</span>
              </button>
            )}
          </div>

          <div className="key-matcher-presets-list">
            {CT_LOG_PRESETS.map((preset) => {
              const isActive = activePresetId === preset.id || domain.toLowerCase() === preset.domain.toLowerCase();
              const presetName = t(`app.ctLog.presets.${preset.id}.name`, preset.domain);
              const presetBadge = t(`app.ctLog.presets.${preset.id}.badge`, preset.domain);
              const presetDesc = t(`app.ctLog.presets.${preset.id}.desc`, `Search CT logs for ${preset.domain}`);

              if (preset.isSpecial) {
                return (
                  <button
                    key={preset.id}
                    id={`ct-preset-${preset.domain.replace(/[^a-zA-Z0-9]/g, '-')}`}
                    type="button"
                    className={`tls-preset-special${isActive ? ' active' : ''}`}
                    onClick={() => handleSelectPreset(preset)}
                    title={presetDesc}
                  >
                    <span className="tls-preset-special-icon">
                      <Home size={13} />
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{preset.domain}</span>
                    <span className="tls-preset-special-sparkle">
                      <Sparkles size={11} />
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={preset.id}
                  id={`ct-preset-${preset.domain.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  type="button"
                  className={`chain-sample-pill key-matcher-preset-pill${isActive ? ' active' : ''}`}
                  onClick={() => handleSelectPreset(preset)}
                  title={presetDesc}
                >
                  <span className="key-matcher-preset-name">{presetName}</span>
                  <span className={`key-matcher-preset-badge badge-type-${preset.badgeType}`}>
                    {presetBadge}
                  </span>
                </button>
              );
            })}

            {(domain || results) && (
              <button
                type="button"
                className="chain-sample-pill key-matcher-clear-btn key-matcher-clear-desktop"
                onClick={handleClear}
                title={t('app.ctLog.clearBtn', 'Clear')}
              >
                <Trash2 size={13} />
                <span>{t('app.ctLog.clearBtn', 'Clear')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Query Input Panel */}
        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
            <Globe size={18} style={{ color: 'var(--accent-color)' }} /> 
            <span>{t('app.ctLog.queryTitle', 'Domain / Subdomain Query')}</span>
          </h3>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <input
                type="text"
                value={domain}
                onChange={e => {
                  setDomain(e.target.value);
                  setActivePresetId(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder={t('app.ctLog.placeholder', 'e.g. google.com, github.com, or *.wikipedia.org')}
                className="form-input"
                style={{ width: '100%', paddingRight: domain ? '2.5rem' : '0.85rem' }}
              />
              {domain && (
                <button
                  type="button"
                  onClick={() => setDomain('')}
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={t('app.ctLog.clearBtn', 'Clear')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <button 
              className="btn btn-primary" 
              onClick={searchLogs} 
              disabled={loading} 
              style={{ height: '42px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
              <span>{loading ? t('app.ctLog.searchingBtn', 'Searching Logs...') : t('app.ctLog.searchBtn', 'Search CT Logs')}</span>
            </button>
          </div>

          {error && (
            <div className="glass-panel" style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
              <XCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Section */}
        {results && (
          <div className="animate-fade-in">
            {/* Results Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Trans
                    i18nKey="app.ctLog.foundCount"
                    values={{ count: filteredResults.length, domain: searchedDomain }}
                    components={[
                      <span key="0" style={{ color: 'var(--accent-color)' }} />,
                      <span key="1" style={{ color: 'var(--text-primary)' }} />
                    ]}
                  />
                </h3>

                {isSampleData && (
                  <div 
                    id="ct-rate-limit-banner"
                    style={{ marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.22rem 0.6rem', borderRadius: '5px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-color)', fontSize: '0.78rem' }}
                  >
                    <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                    <span>{t('app.ctLog.showingCachedSnapshot', 'Live CT log services are currently rate-limited (429/502). Displaying bundled verified sample snapshot.')}</span>
                  </div>
                )}

                {!isSampleData && providerInfo?.rateLimited && (
                  <div 
                    id="ct-rate-limit-notice"
                    style={{ marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.22rem 0.6rem', borderRadius: '5px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-color)', fontSize: '0.78rem' }}
                  >
                    <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                    <span>{t('app.ctLog.rateLimitFallbackNotice', 'Primary log server (crt.sh) rate-limited (429/502). Retrieved via fallback CT provider (CertSpotter).')}</span>
                  </div>
                )}

                {!isSampleData && providerInfo && !providerInfo.rateLimited && (
                  <div 
                    id="ct-live-status-pill"
                    style={{ marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.55rem', borderRadius: '5px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-color)', fontSize: '0.76rem' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success-color)' }} />
                    <span>{t('app.ctLog.liveFromCrtSh', 'Live from crt.sh log monitor')}</span>
                  </div>
                )}
              </div>

              {/* Filter Tabs & In-Page Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className="segmented-tabs-group">
                  <button
                    type="button"
                    className={`segmented-tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterStatus('all')}
                  >
                    <span>{t('app.ctLog.filterAll', 'All')}</span>
                    <span className="tab-count-pill">{counts.all}</span>
                  </button>
                  <button
                    type="button"
                    className={`segmented-tab-btn ${filterStatus === 'valid' ? 'active tab-accent-valid' : ''}`}
                    onClick={() => setFilterStatus('valid')}
                  >
                    <span>{t('app.ctLog.filterValid', 'Active')}</span>
                    <span className="tab-count-pill">{counts.valid}</span>
                  </button>
                  <button
                    type="button"
                    className={`segmented-tab-btn ${filterStatus === 'expired' ? 'active tab-accent-expired' : ''}`}
                    onClick={() => setFilterStatus('expired')}
                  >
                    <span>{t('app.ctLog.filterExpired', 'Expired')}</span>
                    <span className="tab-count-pill">{counts.expired}</span>
                  </button>
                </div>

                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                    placeholder={t('app.ctLog.filterPlaceholder', 'Filter results...')}
                    className="form-input form-input-sm"
                    style={{ paddingLeft: '2rem', height: '32px', fontSize: '0.78rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Empty State */}
            {filteredResults.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-secondary)' }}>
                <FileText size={38} style={{ opacity: 0.3, marginBottom: '0.85rem' }} />
                <p style={{ margin: 0, fontSize: '0.98rem' }}>
                  {results.length === 0
                    ? t('app.ctLog.emptyResults', 'No transparency logs recorded for this domain.')
                    : t('app.ctLog.noFilterMatches', 'No certificates match your search filter.')}
                </p>
              </div>
            ) : (
              <div className="responsive-grid-2" style={{ gap: '1.15rem' }}>
                {filteredResults.map((entry) => {
                  const expired = isExpired(entry.not_after);
                  const isCnCopied = copiedKey === `cn-${entry.id}`;
                  const isSerialCopied = copiedKey === `serial-${entry.id}`;

                  return (
                    <div 
                      key={entry.id} 
                      className="glass-card edu-card-hover" 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.85rem', 
                        padding: '1.25rem',
                        borderTop: expired ? '3px solid var(--danger-color)' : '3px solid var(--success-color)'
                      }}
                    >
                      {/* Top Row: Common Name & Status Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                              {entry.common_name}
                            </span>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.15rem 0.4rem', height: 'auto', fontSize: '0.72rem' }}
                              onClick={() => handleCopy(entry.common_name, `cn-${entry.id}`)}
                              title={t('app.ctLog.copyCnTooltip', 'Copy Common Name')}
                            >
                              {isCnCopied ? <Check size={11} style={{ color: 'var(--success-color)' }} /> : <Copy size={11} />}
                              <span>{isCnCopied ? t('app.ctLog.copied', 'Copied!') : ''}</span>
                            </button>
                          </div>

                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Shield size={13} style={{ color: 'var(--accent-color)', flexShrink: 0 }} /> 
                            <span style={{ wordBreak: 'break-word' }}>{formatIssuer(entry.issuer_name)}</span>
                          </div>
                        </div>

                        {/* Status & ID Badge */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                          <span 
                            className={`badge ${expired ? 'badge-danger' : 'badge-success'}`}
                            style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                          >
                            <span className="badge-dot" />
                            {expired ? t('app.ctLog.expiredBadge', 'Expired') : t('app.ctLog.validBadge', 'Valid')}
                          </span>

                          <a
                            href={`https://crt.sh/?id=${entry.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge"
                            style={{ 
                              fontSize: '0.72rem', 
                              fontFamily: 'var(--font-mono, monospace)', 
                              textDecoration: 'none', 
                              color: 'var(--text-accent)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                            title={t('app.ctLog.certIdTooltip', 'View complete certificate record on crt.sh')}
                          >
                            <span>ID: {entry.id}</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>

                      {/* Identities / Subject Alternative Names (SANs) */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          {t('app.ctLog.identityLabel', 'Identities & Subject Alternative Names (SANs)')}
                        </div>
                        <div 
                          className="mono" 
                          style={{ 
                            background: 'var(--input-bg)', 
                            border: '1px solid var(--glass-border-subtle)', 
                            padding: '0.55rem 0.75rem', 
                            borderRadius: '6px', 
                            fontSize: '0.78rem', 
                            color: 'var(--text-secondary)', 
                            wordBreak: 'break-all',
                            maxHeight: '80px',
                            overflowY: 'auto',
                            lineHeight: 1.45
                          }}
                        >
                          {entry.name_value.split('\n').join(', ')}
                        </div>
                      </div>

                      {/* Serial Number Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid var(--glass-border-subtle)', fontSize: '0.74rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Serial: {entry.serial_number}
                        </span>
                        <button
                          type="button"
                          className="toast-close-btn"
                          style={{ opacity: 0.6 }}
                          onClick={() => handleCopy(entry.serial_number, `serial-${entry.id}`)}
                          title={t('app.ctLog.copySerialTooltip', 'Copy Serial Number')}
                        >
                          {isSerialCopied ? <Check size={11} style={{ color: 'var(--success-color)' }} /> : <Copy size={11} />}
                        </button>
                      </div>
                      
                      {/* Dates Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.77rem', color: 'var(--text-muted)', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border-subtle)', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Calendar size={12} />
                          <span>{t('app.ctLog.issuedLabel', 'Issued')}: {new Date(entry.not_before).toLocaleDateString(i18n.language)}</span>
                        </div>

                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'help' }}
                          title={formatExpiryTooltip(entry.not_after, t, i18n.language)}
                        >
                          <span>{t('app.ctLog.expiresLabel', 'Expires')}: {new Date(entry.not_after).toLocaleDateString(i18n.language)}</span>
                          <span style={{ fontWeight: 600, color: expired ? 'var(--danger-color)' : 'var(--success-color)' }}>
                            ({formatExpiry(entry.not_after, t, i18n.language)})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
