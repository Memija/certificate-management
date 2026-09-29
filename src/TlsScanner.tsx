import React, { useState } from 'react';
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
  CheckCircle2,
  ArrowRight,
  ArrowDown,
  Eye,
  EyeOff,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Key,
  Calendar,
  Clock,
  Sparkles,
  Award,
  Home,
} from 'lucide-react';
import * as forge from 'node-forge';
import { useToast } from './ToastContext';
import { formatExtensionValue } from './utils/purposeFormatter';

const DN_LABELS: Record<string, string> = {
  CN: 'Common Name',
  O: 'Organization',
  OU: 'Organizational Unit',
  C: 'Country',
  ST: 'State / Province',
  L: 'Locality',
  STREET: 'Street Address',
  POSTALCODE: 'Postal Code',
  SERIALNUMBER: 'Serial Number',
  E: 'Email',
  EMAILADDRESS: 'Email',
};

function parseDnEntries(dn: any, t?: any): { key: string; label: string; value: string }[] {
  if (!dn) return [];
  const entries: { key: string; label: string; value: string }[] = [];

  const getLabel = (k: string) => {
    const upper = k.toUpperCase();
    if (!t) return DN_LABELS[upper] || upper;
    const dnKeyMap: Record<string, string> = {
      CN: 'cn',
      O: 'o',
      OU: 'ou',
      C: 'c',
      ST: 'st',
      L: 'l',
      STREET: 'street',
      POSTALCODE: 'postalCode',
      SERIALNUMBER: 'serialNumber',
      E: 'email',
      EMAILADDRESS: 'email',
    };
    const subKey = dnKeyMap[upper];
    if (subKey) {
      return t(`app.tlsScanner.dnFields.${subKey}`, DN_LABELS[upper] || upper);
    }
    return DN_LABELS[upper] || upper;
  };

  if (typeof dn === 'object') {
    for (const [k, v] of Object.entries(dn)) {
      if (!v) continue;
      const upperKey = k.toUpperCase();
      entries.push({
        key: upperKey,
        label: getLabel(upperKey),
        value: String(v),
      });
    }
    return entries;
  }

  const str = String(dn);
  const parts = str.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      const key = part.substring(0, eqIdx).trim().toUpperCase();
      const val = part.substring(eqIdx + 1).trim();
      entries.push({
        key,
        label: getLabel(key),
        value: val,
      });
    } else {
      entries.push({ key: 'RAW', label: t ? t('app.tlsScanner.rawDn', 'Raw') : 'Raw', value: part });
    }
  }

  return entries;
}

function calculateValidityProgress(validFromStr: string, validToStr: string) {
  const from = new Date(validFromStr).getTime();
  const to = new Date(validToStr).getTime();
  const now = Date.now();

  if (isNaN(from) || isNaN(to) || to <= from) {
    return { percent: 100, isExpired: now > to, isExpiringSoon: false, daysRemaining: 0, daysExpired: 0 };
  }

  const total = to - from;
  const elapsed = Math.max(0, now - from);
  const percent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  const daysRemaining = Math.max(0, Math.ceil((to - now) / (1000 * 60 * 60 * 24)));
  const daysExpired = now > to ? Math.max(1, Math.ceil((now - to) / (1000 * 60 * 60 * 24))) : 0;
  const isExpired = now > to;
  const isExpiringSoon = !isExpired && daysRemaining <= 30;

  return { percent, isExpired, isExpiringSoon, daysRemaining, daysExpired };
}

function formatAuthError(err: string | null | undefined, t: any): { title: string; detail?: string } {
  if (!err) return { title: t('app.tlsScanner.metrics.untrusted', 'Validation Issue') };

  const code = String(err).trim();
  switch (code) {
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
      return {
        title: t('app.tlsScanner.authErrors.depthZero', 'Self-Signed Leaf Certificate'),
        detail: 'DEPTH_ZERO_SELF_SIGNED_CERT',
      };
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return {
        title: t('app.tlsScanner.authErrors.selfSignedInChain', 'Self-Signed CA in Chain'),
        detail: 'SELF_SIGNED_CERT_IN_CHAIN',
      };
    case 'CERT_HAS_EXPIRED':
      return {
        title: t('app.tlsScanner.authErrors.expired', 'Certificate Expired'),
        detail: 'CERT_HAS_EXPIRED',
      };
    case 'CERT_NOT_YET_VALID':
      return {
        title: t('app.tlsScanner.authErrors.notYetValid', 'Certificate Not Yet Valid'),
        detail: 'CERT_NOT_YET_VALID',
      };
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return {
        title: t('app.tlsScanner.authErrors.leafSig', 'Unable to Verify Signature'),
        detail: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      };
    case 'UNABLE_TO_GET_ISSUER_CERT':
    case 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':
      return {
        title: t('app.tlsScanner.authErrors.missingIssuer', 'Untrusted / Missing Issuer CA'),
        detail: code,
      };
    case 'HOSTNAME_MISMATCH':
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return {
        title: t('app.tlsScanner.authErrors.hostnameMismatch', 'Hostname Mismatch'),
        detail: code,
      };
    default:
      return {
        title: code.replace(/_/g, ' '),
        detail: code,
      };
  }
}

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

function formatKeyDescription(cert: any, t?: any): string {
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
  return t ? t('app.tlsScanner.unknownKey', 'Unknown Public Key') : 'Unknown Public Key';
}

function parseExtensionNode(e: any): { id: string; oid: string; name: string; critical: boolean; value: string } {
  let ext: any;
  try {
    ext = (forge.pki as any).certificateExtensionFromAsn1(e);
  } catch {
    const rawOid = forge.asn1.derToOid(e.value[0].value);
    ext = { id: rawOid };
  }

  const oid: string = ext.id || forge.asn1.derToOid(e.value[0].value);
  const critical: boolean = typeof ext.critical === 'boolean'
    ? ext.critical
    : (e.value.length === 3 ? !!e.value[1].value : false);
  let name: string = ext.name || (forge.pki.oids as any)[oid] || oid;
  let valStr = '';

  // 1. Key Usage (2.5.29.15)
  if (ext.name === 'keyUsage' || oid === '2.5.29.15') {
    name = 'keyUsage';
    const usages: string[] = [];
    if (ext.digitalSignature) usages.push('Digital Signature');
    if (ext.nonRepudiation) usages.push('Non-Repudiation');
    if (ext.keyEncipherment) usages.push('Key Encipherment');
    if (ext.dataEncipherment) usages.push('Data Encipherment');
    if (ext.keyAgreement) usages.push('Key Agreement');
    if (ext.keyCertSign) usages.push('Certificate Signing');
    if (ext.cRLSign) usages.push('CRL Signing');
    if (ext.encipherOnly) usages.push('Encipher Only');
    if (ext.decipherOnly) usages.push('Decipher Only');
    valStr = usages.join(', ');
  }
  // 2. Extended Key Usage (2.5.29.37)
  else if (ext.name === 'extKeyUsage' || oid === '2.5.29.37') {
    name = 'extKeyUsage';
    const ekus: string[] = [];
    if (ext.serverAuth) ekus.push('Server Authentication (1.3.6.1.5.5.7.3.1)');
    if (ext.clientAuth) ekus.push('Client Authentication (1.3.6.1.5.5.7.3.2)');
    if (ext.codeSigning) ekus.push('Code Signing (1.3.6.1.5.5.7.3.3)');
    if (ext.emailProtection) ekus.push('Email Protection (1.3.6.1.5.5.7.3.4)');
    if (ext.timeStamping) ekus.push('Time Stamping (1.3.6.1.5.5.7.3.8)');
    if (ext.ocspSigning) ekus.push('OCSP Signing (1.3.6.1.5.5.7.3.9)');

    try {
      const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
      const innerAsn1 = forge.asn1.fromDer(valAsn1.value);
      if (innerAsn1.value && Array.isArray(innerAsn1.value)) {
        innerAsn1.value.forEach((item: any) => {
          const itemOid = forge.asn1.derToOid(item.value);
          const knownOids: Record<string, string> = {
            '1.3.6.1.5.5.7.3.1': 'Server Authentication (1.3.6.1.5.5.7.3.1)',
            '1.3.6.1.5.5.7.3.2': 'Client Authentication (1.3.6.1.5.5.7.3.2)',
            '1.3.6.1.5.5.7.3.3': 'Code Signing (1.3.6.1.5.5.7.3.3)',
            '1.3.6.1.5.5.7.3.4': 'Email Protection (1.3.6.1.5.5.7.3.4)',
            '1.3.6.1.5.5.7.3.8': 'Time Stamping (1.3.6.1.5.5.7.3.8)',
            '1.3.6.1.5.5.7.3.9': 'OCSP Signing (1.3.6.1.5.5.7.3.9)',
          };
          const label = knownOids[itemOid] || itemOid;
          if (!ekus.includes(label)) ekus.push(label);
        });
      }
    } catch {}
    valStr = ekus.join(', ');
  }
  // 3. Basic Constraints (2.5.29.19)
  else if (ext.name === 'basicConstraints' || oid === '2.5.29.19') {
    name = 'basicConstraints';
    valStr = 'Is CA: ' + (ext.cA ? 'Yes' : 'No') + (ext.pathLenConstraint !== undefined ? ', Path Length Constraint: ' + ext.pathLenConstraint : '');
  }
  // 4. Subject Alternative Name (2.5.29.17)
  else if (ext.name === 'subjectAltName' || oid === '2.5.29.17') {
    name = 'subjectAltName';
    if (ext.altNames && ext.altNames.length > 0) {
      valStr = ext.altNames.map((an: any) => {
        const prefix = an.type === 2 ? 'DNS:' : an.type === 7 ? 'IP:' : an.type === 1 ? 'email:' : an.type === 6 ? 'URI:' : '';
        return prefix + an.value;
      }).join(', ');
    } else {
      valStr = '';
    }
  }
  // 5. Subject Key Identifier (2.5.29.14)
  else if (ext.name === 'subjectKeyIdentifier' || oid === '2.5.29.14') {
    name = 'subjectKeyIdentifier';
    try {
      const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
      let bytes = valAsn1.value;
      try {
        const inner = forge.asn1.fromDer(bytes);
        if (inner && inner.value && typeof inner.value === 'string') bytes = inner.value;
      } catch {}
      const hex = forge.util.bytesToHex(bytes).toUpperCase().match(/.{2}/g);
      valStr = hex ? hex.join(':') : forge.util.bytesToHex(bytes).toUpperCase();
    } catch {
      valStr = ext.value || '';
    }
  }
  // 6. Authority Key Identifier (2.5.29.35)
  else if (ext.name === 'authorityKeyIdentifier' || oid === '2.5.29.35') {
    name = 'authorityKeyIdentifier';
    try {
      const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
      const inner = forge.asn1.fromDer(valAsn1.value);
      const keyIdObj = inner.value && Array.isArray(inner.value)
        ? inner.value.find((item: any) => item.tagClass === 128 && item.type === 0)
        : null;
      if (keyIdObj && typeof keyIdObj.value === 'string') {
        const hex = forge.util.bytesToHex(keyIdObj.value).toUpperCase().match(/.{2}/g);
        valStr = 'KeyID: ' + (hex ? hex.join(':') : forge.util.bytesToHex(keyIdObj.value).toUpperCase());
      } else if (typeof valAsn1.value === 'string') {
        const hex = forge.util.bytesToHex(valAsn1.value).toUpperCase().match(/.{2}/g);
        valStr = hex ? hex.join(':') : forge.util.bytesToHex(valAsn1.value).toUpperCase();
      }
    } catch {
      valStr = ext.value || '';
    }
  }
  // 7. Authority Information Access (1.3.6.1.5.5.7.1.1)
  else if (ext.name === 'authorityInfoAccess' || oid === '1.3.6.1.5.5.7.1.1') {
    name = 'authorityInfoAccess';
    const items: string[] = [];
    try {
      const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
      const inner = forge.asn1.fromDer(valAsn1.value);
      if (inner.value && Array.isArray(inner.value)) {
        inner.value.forEach((accessDesc: any) => {
          const methodOid = forge.asn1.derToOid(accessDesc.value[0].value);
          const location = accessDesc.value[1].value;
          const methodNames: Record<string, string> = {
            '1.3.6.1.5.5.7.48.1': 'OCSP',
            '1.3.6.1.5.5.7.48.2': 'CA Issuers',
          };
          const method = methodNames[methodOid] || methodOid;
          items.push(method + ' - URI:' + location);
        });
      }
    } catch {}
    valStr = items.length > 0 ? items.join('\n') : (typeof ext.value === 'string' ? ext.value : '');
  }
  // 8. CRL Distribution Points (2.5.29.31)
  else if (ext.name === 'cRLDistributionPoints' || oid === '2.5.29.31') {
    name = 'cRLDistributionPoints';
    const uris: string[] = [];
    try {
      const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
      const inner = forge.asn1.fromDer(valAsn1.value);
      const findUris = (node: any) => {
        if (!node) return;
        if (typeof node.value === 'string' && (node.value.startsWith('http') || node.value.startsWith('ldap'))) {
          uris.push('URI:' + node.value);
        } else if (Array.isArray(node.value)) {
          node.value.forEach(findUris);
        }
      };
      findUris(inner);
    } catch {}
    valStr = uris.length > 0 ? uris.join('\n') : (typeof ext.value === 'string' ? ext.value : '');
  }
  // 9. Certificate Policies (2.5.29.32)
  else if (ext.name === 'certificatePolicies' || oid === '2.5.29.32') {
    name = 'certificatePolicies';
    const policies: string[] = [];
    try {
      const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
      const inner = forge.asn1.fromDer(valAsn1.value);
      if (inner.value && Array.isArray(inner.value)) {
        inner.value.forEach((polInfo: any, idx: number) => {
          const polOid = forge.asn1.derToOid(polInfo.value[0].value);
          let policyText = '[' + (idx + 1) + ']Certificate Policy: Policy Identifier=' + polOid;
          if (polInfo.value[1] && polInfo.value[1].value && Array.isArray(polInfo.value[1].value)) {
            polInfo.value[1].value.forEach((qual: any, qIdx: number) => {
              const qualOid = forge.asn1.derToOid(qual.value[0].value);
              const qualVal = qual.value[1] && qual.value[1].value;
              if (qualOid === '1.3.6.1.5.5.7.2.1') {
                policyText += '\n[' + (idx + 1) + ',' + (qIdx + 1) + ']Policy Qualifier Info: CPS: ' + qualVal;
              }
            });
          }
          policies.push(policyText);
        });
      }
    } catch {}
    valStr = policies.length > 0 ? policies.join('\n') : (typeof ext.value === 'string' ? ext.value : '');
  }
  // 10. Timestamp List (SCTs - 1.3.6.1.4.1.11129.2.4.2)
  else if (oid === '1.3.6.1.4.1.11129.2.4.2' || ext.name === 'timestampList') {
    name = 'timestampList';
    try {
      const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
      let bytes = valAsn1.value;
      try {
        const inner = forge.asn1.fromDer(bytes);
        if (inner && inner.value && typeof inner.value === 'string') bytes = inner.value;
      } catch {}
      valStr = 'Embedded Signed Certificate Timestamps (' + bytes.length + ' bytes)';
    } catch {
      valStr = 'Embedded Signed Certificate Timestamps';
    }
  }
  // General Fallback
  else {
    const rawVal = typeof ext.value === 'string' ? ext.value : '';
    const isBinary = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(rawVal);
    if (isBinary || !rawVal) {
      try {
        const valObj = e.value.length === 3 ? e.value[2] : e.value[1];
        const hex = forge.util.bytesToHex(valObj.value).toUpperCase().match(/.{2}/g);
        valStr = hex ? hex.join(' ') : forge.util.bytesToHex(valObj.value).toUpperCase();
      } catch {
        valStr = rawVal ? forge.util.bytesToHex(rawVal).toUpperCase() : '';
      }
    } else {
      valStr = rawVal;
    }
  }

  return {
    id: oid,
    oid,
    name,
    critical,
    value: valStr,
  };
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
  const { t } = useTranslation();
  const [host, setHost] = useState('');
  const [port, setPort] = useState(443);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [copiedPemIdx, setCopiedPemIdx] = useState<number | null>(null);

  const { showToast } = useToast();
  const [activeCertIdx, setActiveCertIdx] = useState<number>(0);
  const [openPemSet, setOpenPemSet] = useState<Set<number>>(new Set());
  const [openExtSet, setOpenExtSet] = useState<Set<number>>(new Set());
  const [openRawDnSet, setOpenRawDnSet] = useState<Set<number>>(new Set());
  const [sanFilter, setSanFilter] = useState<Record<number, string>>({});
  const [copiedAll, setCopiedAll] = useState(false);

  const copyText = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    showToast(`${label}: ${t('common.copiedToClipboard', 'Copied to clipboard')}`, 'success');
  };

  const copyPem = (pem: string, idx: number) => {
    navigator.clipboard.writeText(pem);
    setCopiedPemIdx(idx);
    showToast(t('common.copiedToClipboard', 'Copied to clipboard'), 'success');
    setTimeout(() => setCopiedPemIdx(null), 2000);
  };

  const downloadPem = (pem: string, subjectCN: string) => {
    const blob = new Blob([pem], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCn = (subjectCN || 'certificate').replace(/[^a-zA-Z0-9.-]/g, '_');
    a.download = `${safeCn}.pem`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('app.tlsScanner.downloadPem', 'Download PEM'), 'success');
  };

  const copyAllPem = () => {
    if (!scanResult?.chain || scanResult.chain.length === 0) return;
    const fullChainPem = scanResult.chain.map((c: any) => c.pem).filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(fullChainPem);
    setCopiedAll(true);
    showToast(t('app.tlsScanner.copiedFullChain', 'Full certificate chain copied to clipboard'), 'success');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const downloadAllPem = () => {
    if (!scanResult?.chain || scanResult.chain.length === 0) return;
    const fullChainPem = scanResult.chain.map((c: any) => c.pem).filter(Boolean).join('\n\n');
    const blob = new Blob([fullChainPem], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeHost = (host || 'tls').replace(/[^a-zA-Z0-9.-]/g, '_');
    a.download = `${safeHost}_chain.pem`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('app.tlsScanner.downloadedFullChain', 'Chain bundle downloaded'), 'success');
  };

  const togglePem = (idx: number) => {
    setOpenPemSet(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleExt = (idx: number) => {
    setOpenExtSet(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleRawDn = (idx: number) => {
    setOpenRawDnSet(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

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
              c.extensions = extSeq.value.map(parseExtensionNode);
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

  const presets = [
    {
      label: 'home-management.dev',
      host: 'home-management.dev',
      port: 443,
      isSpecial: true,
    },
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
            {t('app.tlsScanner.title', 'Remote TLS Scanner')}
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
                placeholder={t('app.tlsScanner.hostPlaceholder', 'e.g. google.com or https://api.github.com')}
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
            {presets.map(p => {
              if (p.isSpecial) {
                return (
                  <button
                    key={p.host}
                    id={`tls-preset-${p.host.replace(/[^a-zA-Z0-9]/g, '-')}`}
                    type="button"
                    className="tls-preset-special"
                    onClick={() => {
                      setHost(p.host);
                      setPort(p.port);
                      scan(p.host, p.port);
                    }}
                    title={`${p.host}:${p.port}`}
                  >
                    <span className="tls-preset-special-icon">
                      <Home size={13} />
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{p.label}</span>
                    <span className="tls-preset-special-sparkle">
                      <Sparkles size={11} />
                    </span>
                  </button>
                );
              }
              return (
                <button
                  key={p.host}
                  id={`tls-preset-${p.host.replace(/[^a-zA-Z0-9]/g, '-')}`}
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
              );
            })}
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
                  <div className="metric-val" style={{ fontSize: '0.92rem', overflowWrap: 'anywhere', wordBreak: 'break-all', lineHeight: 1.25 }}>
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
                  {scanResult.authorized ? (
                    <div
                      className="metric-val"
                      style={{
                        fontSize: '0.95rem',
                        color: 'var(--success-color)',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {t('app.tlsScanner.metrics.trusted', 'Trusted by System Store')}
                    </div>
                  ) : (
                    <div style={{ minWidth: 0, width: '100%' }}>
                      <div
                        className="metric-val"
                        style={{
                          fontSize: '0.92rem',
                          color: 'var(--danger-color)',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          lineHeight: 1.25,
                        }}
                      >
                        {formatAuthError(scanResult.authorizationError, t).title}
                      </div>
                      {formatAuthError(scanResult.authorizationError, t).detail && (
                        <div
                          className="mono"
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--danger-color)',
                            opacity: 0.85,
                            marginTop: '0.2rem',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-all',
                            lineHeight: 1.2,
                          }}
                          title={scanResult.authorizationError}
                        >
                          {formatAuthError(scanResult.authorizationError, t).detail}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-wrap purple">
                  <Layers size={22} />
                </div>
                <div className="metric-info">
                  <div className="metric-label">{t('app.tlsScanner.metrics.chainLength', 'Chain Depth')}</div>
                  <div className="metric-val" style={{ fontSize: '1.35rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    <span>{scanResult.chain?.length || 0}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                      {t('app.tlsScanner.metrics.certs', 'Certificates')}
                    </span>
                  </div>
                  <div className="metric-sub" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {scanResult.chain?.length === 1
                      ? t('app.tlsScanner.metrics.singleCert', 'Single Leaf / Self-Signed')
                      : t('app.tlsScanner.metrics.chainBreakdown', '1 Leaf · {{count}} Intermediate / Root', { count: Math.max(0, (scanResult.chain?.length || 1) - 1) })}
                  </div>
                </div>
              </div>
            </div>

            <div>
              {/* Header with Title, Count, Trust Badge and Batch Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="metric-icon-wrap purple"
                    style={{ width: 42, height: 42, borderRadius: 12 }}
                  >
                    <LinkIcon size={20} />
                  </div>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>{t('app.tlsScanner.presentedChain', 'Presented Certificate Chain')}</span>
                      <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>
                        {scanResult.chain.length} {t('app.tlsScanner.metrics.certs', 'Certificates')}
                      </span>
                      {scanResult.authorized ? (
                        <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                          <CheckCircle2 size={12} /> {t('app.tlsScanner.chainTrusted', 'Chain of Trust Verified')}
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                          <AlertTriangle size={12} /> {t('app.tlsScanner.chainWarning', 'Trust Path Warning')}
                        </span>
                      )}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {scanResult.authorized
                        ? t('app.tlsScanner.chainTrustedSub', 'Complete trusted cryptographic chain from end-entity to trust anchor')
                        : t('app.tlsScanner.chainUntrustedSub', 'Certificates presented by the remote server during TLS handshake')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={copyAllPem}
                    title={t('app.tlsScanner.copyAllPem', 'Copy entire certificate chain (PEM format)')}
                  >
                    {copiedAll ? <Check size={14} style={{ color: 'var(--success-color)' }} /> : <Copy size={14} />}
                    <span>{copiedAll ? t('app.tlsScanner.copied', 'Copied!') : t('app.tlsScanner.copyChain', 'Copy Full Chain')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-download-pem btn-sm"
                    onClick={downloadAllPem}
                    title={t('app.tlsScanner.downloadAllPem', 'Download entire certificate chain bundle')}
                  >
                    <Download size={14} />
                    <span>{t('app.tlsScanner.downloadChain', 'Download Bundle')}</span>
                  </button>
                </div>
              </div>

              {/* Interactive Visual Chain Flow (Stepper) */}
              <div className="tls-chain-flow" role="region" aria-label={t('app.tlsScanner.chainStepperAria', 'Certificate Chain Stepper')}>
                {scanResult.chain.map((cert: any, idx: number) => {
                  const isLeaf = idx === 0;
                  const isSelfSigned = cert.issuerCN === cert.subjectCN || cert.issuer === cert.subject;
                  const isRoot = (idx === scanResult.chain.length - 1 && idx > 0) || (isSelfSigned && idx > 0);
                  const isIntermediate = !isLeaf && !isRoot;
                  const { isExpired, isExpiringSoon, daysRemaining } = calculateValidityProgress(cert.valid_from, cert.valid_to);
                  const roleClass = isLeaf ? 'leaf' : isIntermediate ? 'intermediate' : 'root';
                  const isActive = activeCertIdx === idx;

                  return (
                    <React.Fragment key={idx}>
                      <div
                        className={`tls-chain-flow-step ${roleClass} ${isExpired ? 'expired' : ''} ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setActiveCertIdx(idx);
                          const el = document.getElementById(`tls-cert-card-${idx}`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }
                        }}
                        title={t('app.tlsScanner.inspectCertTitle', 'Click to inspect certificate #{{num}}', { num: idx + 1 })}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`chain-node-badge ${isLeaf ? 'badge-leaf' : isIntermediate ? 'badge-intermediate' : 'badge-root'}`}>
                            #{idx + 1} {isLeaf ? t('app.certDetails.leafCert', 'Leaf') : isIntermediate ? t('app.certDetails.intermediateCa', 'Intermediate') : t('app.certDetails.rootCa', 'Root CA')}
                          </span>
                          <span className={`badge ${isExpired ? 'badge-danger' : isExpiringSoon ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                            {isExpired ? (
                              <>
                                <span className="badge-dot pulse" />
                                {t('app.certDetails.expired', 'Expired')}
                              </>
                            ) : (
                              `${daysRemaining}d`
                            )}
                          </span>
                        </div>

                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                            {cert.subjectCN}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>{t('app.tlsScanner.issuer', 'Issuer')}:</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{cert.issuerCN}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border-subtle)', paddingTop: '0.45rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{formatKeyDescription(cert, t)}</span>
                          <span>{new Date(cert.valid_to).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {idx < scanResult.chain.length - 1 && (
                        <div className="tls-chain-flow-arrow">
                          <span className="tls-chain-flow-arrow-pill">
                            <Lock size={10} style={{ color: 'var(--accent-cyan)' }} />
                            <span>{t('app.tlsScanner.issuedBy', 'Signed by')}</span>
                          </span>
                          <ArrowRight size={16} style={{ color: 'var(--text-accent)' }} />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Vertical Stack of Detailed Certificate Cards with Trust Connectors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {scanResult.chain.map((cert: any, idx: number) => {
                  const isLeaf = idx === 0;
                  const isSelfSigned = cert.issuerCN === cert.subjectCN || cert.issuer === cert.subject;
                  const isRoot = (idx === scanResult.chain.length - 1 && idx > 0) || (isSelfSigned && idx > 0);
                  const isIntermediate = !isLeaf && !isRoot;
                  const roleClass = isLeaf ? 'leaf' : isIntermediate ? 'intermediate' : 'root';
                  const { percent, isExpired, isExpiringSoon, daysRemaining, daysExpired } = calculateValidityProgress(cert.valid_from, cert.valid_to);
                  const isPemOpen = openPemSet.has(idx);
                  const isExtOpen = openExtSet.has(idx);
                  const isRawDn = openRawDnSet.has(idx);
                  const filter = (sanFilter[idx] || '').toLowerCase().trim();
                  const filteredSans = (cert.subjectAltNames || []).filter((s: string) => !filter || s.toLowerCase().includes(filter));
                  const subjectEntries = parseDnEntries(cert.subject, t);
                  const issuerEntries = parseDnEntries(cert.issuer, t);

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                      {idx > 0 && (
                        <div className="tls-card-connector" style={{ marginBottom: '1rem' }}>
                          <div className="tls-card-connector-line" />
                          <div className="tls-card-connector-badge">
                            <Lock size={13} style={{ color: 'var(--accent-cyan)' }} />
                            <span>{t('app.tlsScanner.signedAndIssuedBy', 'Signed & Issued by CA')}</span>
                            <ArrowDown size={13} style={{ color: 'var(--accent-cyan)' }} />
                          </div>
                          <div className="tls-card-connector-line" />
                        </div>
                      )}

                      <div
                        id={`tls-cert-card-${idx}`}
                        className={`tls-cert-card ${roleClass} ${isExpired ? 'expired' : ''}`}
                      >
                        {/* Card Header */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '1rem',
                            flexWrap: 'wrap',
                            gap: '1rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                            <div
                              className={`metric-icon-wrap ${isExpired ? 'danger' : isLeaf ? 'purple' : isIntermediate ? 'info' : 'success'}`}
                              style={{ width: 44, height: 44, borderRadius: 12, marginTop: 2 }}
                            >
                              {isLeaf ? <Globe size={22} /> : isIntermediate ? <ShieldCheck size={22} /> : <Award size={22} />}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                                <span className={`chain-node-badge ${isLeaf ? 'badge-leaf' : isIntermediate ? 'badge-intermediate' : 'badge-root'}`}>
                                  #{idx + 1} {isLeaf ? t('app.certDetails.leafCert', 'Leaf Certificate') : isIntermediate ? t('app.certDetails.intermediateCa', 'Intermediate CA') : t('app.certDetails.rootCa', 'Root CA / Anchor')}
                                </span>
                                {cert.ca && !isLeaf && (
                                  <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>CA</span>
                                )}
                                {isSelfSigned && idx > 0 && (
                                  <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>{t('app.tlsScanner.selfSigned', 'Self-Signed')}</span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                  {cert.subjectCN}
                                </strong>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0.15rem 0.4rem', height: 'auto', fontSize: '0.72rem' }}
                                  onClick={() => copyText(cert.subjectCN, t('app.tlsScanner.commonName', 'Common Name'))}
                                  title={t('app.tlsScanner.copyCn', 'Copy Common Name')}
                                >
                                  <Copy size={11} />
                                </button>
                              </div>

                              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span>{t('app.tlsScanner.issuer', 'Issuer')}:</span>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{cert.issuerCN}</span>
                                {idx < scanResult.chain.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveCertIdx(idx + 1);
                                      document.getElementById(`tls-cert-card-${idx + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-accent-2)',
                                      cursor: 'pointer',
                                      padding: '0 0.25rem',
                                      fontSize: '0.75rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                    }}
                                    title={t('app.tlsScanner.jumpToIssuer', 'Jump to Issuer Certificate')}
                                  >
                                    <span>#{idx + 2}</span>
                                    <ExternalLink size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span
                              className={`badge ${isExpired ? 'badge-danger' : isExpiringSoon ? 'badge-warning' : 'badge-success'}`}
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
                            >
                              {isExpired ? (
                                <>
                                  <span className="badge-dot pulse" />
                                  {daysExpired > 0
                                    ? t('app.tlsScanner.expiredDaysAgo', { count: daysExpired, defaultValue: `Expired ${daysExpired} days ago` })
                                    : t('app.certDetails.expired', 'Expired')}
                                </>
                              ) : (
                                <>
                                  <Clock size={12} />
                                  <span>{t('app.tlsScanner.daysRemaining', { count: daysRemaining, defaultValue: `${daysRemaining} days remaining` })}</span>
                                </>
                              )}
                            </span>

                            {cert.pem && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => copyPem(cert.pem, idx)}
                                  title={t('app.tlsScanner.copyPem', 'Copy PEM to Clipboard')}
                                >
                                  {copiedPemIdx === idx ? <Check size={13} style={{ color: 'var(--success-color)' }} /> : <Copy size={13} />}
                                  {copiedPemIdx === idx ? t('app.tlsScanner.copied', 'Copied!') : t('app.tlsScanner.copyPem', 'Copy PEM')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-download-pem btn-sm"
                                  onClick={() => downloadPem(cert.pem, cert.subjectCN)}
                                  title={t('app.tlsScanner.downloadPem', 'Download PEM')}
                                >
                                  <Download size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => togglePem(idx)}
                                  title={isPemOpen ? t('app.tlsScanner.hidePem', 'Hide PEM') : t('app.tlsScanner.viewPem', 'View PEM')}
                                >
                                  {isPemOpen ? <EyeOff size={13} /> : <Eye size={13} />}
                                  <span>PEM</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Validity Timeline Progress Bar */}
                        <div className="tls-validity-bar-wrap">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Calendar size={13} style={{ color: 'var(--text-accent)' }} />
                              <strong style={{ color: 'var(--text-primary)' }}>{t('app.tlsScanner.lifespan', 'Certificate Lifespan')}</strong>
                              <span>({percent}% {t('app.tlsScanner.elapsed', 'elapsed')})</span>
                            </span>
                            <span
                              style={{
                                color: isExpired ? 'var(--danger-color)' : isExpiringSoon ? 'var(--warning-color)' : 'var(--success-color)',
                                fontWeight: 600,
                              }}
                            >
                              {isExpired
                                ? (daysExpired > 0
                                    ? t('app.tlsScanner.expiredDaysAgo', { count: daysExpired, defaultValue: `Expired ${daysExpired} days ago` })
                                    : t('app.certDetails.expired', 'Expired'))
                                : t('app.tlsScanner.daysLeft', { count: daysRemaining, defaultValue: `${daysRemaining} days left` })}
                            </span>
                          </div>

                          <div className="tls-validity-bar-track">
                            <div
                              className={`tls-validity-bar-fill ${isExpired ? 'danger' : isExpiringSoon ? 'warning' : 'normal'}`}
                              style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            <span>
                              <strong>{t('app.tlsScanner.validFrom', 'Valid From')}:</strong> {new Date(cert.valid_from).toLocaleString()}
                            </span>
                            <span>
                              <strong>{t('app.tlsScanner.validTo', 'Valid To')}:</strong>{' '}
                              <span style={{ color: isExpired ? 'var(--danger-color)' : undefined, fontWeight: isExpired ? 600 : undefined }}>
                                {new Date(cert.valid_to).toLocaleString()}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Modern 4-Box Cryptographic Parameters Grid */}
                        <div className="tls-params-grid">
                          <div className="tls-param-box">
                            <div className="tls-param-label">
                              <Cpu size={12} style={{ color: 'var(--accent-color)' }} />
                              {t('app.tlsScanner.publicKey', 'Public Key')}
                            </div>
                            <div className="tls-param-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                              {formatKeyDescription(cert, t)}
                            </div>
                          </div>

                          <div className="tls-param-box">
                            <div className="tls-param-label">
                              <Shield size={12} style={{ color: 'var(--accent-cyan)' }} />
                              {cert.ca ? t('app.tlsScanner.caClassification', 'CA Classification') : t('app.tlsScanner.keyPurpose', 'Key Purpose')}
                            </div>
                            <div className="tls-param-val" style={{ fontSize: '0.82rem' }}>
                              {cert.ca
                                ? t('app.tlsScanner.caClassificationDesc', 'Certificate Authority (Issues Certificates)')
                                : t('app.tlsScanner.keyPurposeDesc', 'Server Authentication (TLS / SSL)')}
                            </div>
                          </div>

                          <div className="tls-param-box">
                            <div className="tls-param-label">
                              <Key size={12} style={{ color: 'var(--purple-color)' }} />
                              {t('app.tlsScanner.serialNumber', 'Serial Number')}
                            </div>
                            <div
                              className="tls-param-val"
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cert.serialNumber}</span>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.2rem' }}
                                onClick={() => copyText(cert.serialNumber, t('app.tlsScanner.serialNumber', 'Serial Number'))}
                                title={t('app.tlsScanner.copySerialNumber', 'Copy Serial Number')}
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          </div>

                          <div className="tls-param-box">
                            <div className="tls-param-label">
                              <Sparkles size={12} style={{ color: 'var(--text-accent)' }} />
                              {t('app.tlsScanner.fingerprint256', 'SHA-256 Fingerprint')}
                            </div>
                            <div
                              className="tls-param-val"
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {cert.fingerprint256 ? `${cert.fingerprint256.substring(0, 23)}...` : 'N/A'}
                              </span>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.2rem' }}
                                onClick={() => copyText(cert.fingerprint256, t('app.tlsScanner.fingerprint256', 'SHA-256 Fingerprint'))}
                                title={t('app.tlsScanner.copyFingerprint', 'Copy Full Fingerprint')}
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Subject & Issuer Distinguished Names Breakdown */}
                        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {/* Subject DN */}
                          <div style={{ padding: '0.85rem 1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border-subtle)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {t('app.tlsScanner.subjectDn', 'Subject Distinguished Name')}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRawDn(idx)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-accent-2)', cursor: 'pointer', fontSize: '0.72rem' }}
                              >
                                {isRawDn ? t('app.tlsScanner.structuredDn', 'View Structured') : t('app.tlsScanner.rawDn', 'View Raw')}
                              </button>
                            </div>

                            {isRawDn ? (
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                {formatDn(cert.subject)}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {subjectEntries.map((e, sIdx) => (
                                  <span key={sIdx} className="tls-dn-chip">
                                    <span className="tls-dn-tag" title={e.label}>{e.key}:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{e.value}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Issuer DN */}
                          <div style={{ padding: '0.85rem 1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border-subtle)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {t('app.tlsScanner.issuerDn', 'Issuer Distinguished Name')}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRawDn(idx)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-accent-2)', cursor: 'pointer', fontSize: '0.72rem' }}
                              >
                                {isRawDn ? t('app.tlsScanner.structuredDn', 'View Structured') : t('app.tlsScanner.rawDn', 'View Raw')}
                              </button>
                            </div>

                            {isRawDn ? (
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                {formatDn(cert.issuer)}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {issuerEntries.map((e, sIdx) => (
                                  <span key={sIdx} className="tls-dn-chip">
                                    <span className="tls-dn-tag" title={e.label}>{e.key}:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{e.value}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Subject Alternative Names (SANs) */}
                        {cert.subjectAltNames && cert.subjectAltNames.length > 0 && (
                          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-accent)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Globe size={14} />
                                {t('app.tlsScanner.sanTitle', 'Subject Alternative Names (SANs)')} ({cert.subjectAltNames.length})
                              </span>

                              {cert.subjectAltNames.length > 6 && (
                                <div style={{ position: 'relative', width: 200 }}>
                                  <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                  <input
                                    type="text"
                                    placeholder={t('app.tlsScanner.searchSans', 'Filter domains...')}
                                    value={sanFilter[idx] || ''}
                                    onChange={e => setSanFilter(prev => ({ ...prev, [idx]: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '0.25rem 0.5rem 0.25rem 1.7rem',
                                      fontSize: '0.75rem',
                                      background: 'var(--input-bg)',
                                      border: '1px solid var(--glass-border-subtle)',
                                      borderRadius: 6,
                                      color: 'var(--text-primary)',
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: 180, overflowY: 'auto', padding: '0.2rem' }}>
                              {filteredSans.map((san: string, sIdx: number) => (
                                <span
                                  key={sIdx}
                                  className="badge"
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.76rem',
                                    background: 'var(--badge-bg, rgba(255,255,255,0.05))',
                                    border: '1px solid var(--glass-border-subtle)',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => copyText(san, t('app.tlsScanner.domainSan', 'Domain SAN'))}
                                  title={t('app.tlsScanner.clickToCopyDomain', 'Click to copy domain')}
                                >
                                  {san}
                                </span>
                              ))}
                              {filteredSans.length === 0 && (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  {t('app.tlsScanner.noSansMatch', 'No SAN domains matching search filter')}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* X.509 Extensions Accordion */}
                        {cert.extensions && cert.extensions.length > 0 && (
                          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border-subtle)' }}>
                            <button
                              type="button"
                              onClick={() => toggleExt(idx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-accent)',
                                fontSize: '0.86rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: 0,
                              }}
                            >
                              {isExtOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              <span>{t('app.tlsScanner.viewExtensions', 'View Extensions')} ({cert.extensions.length})</span>
                            </button>

                            {isExtOpen && (
                              <div
                                className="details-grid"
                                style={{
                                  background: 'var(--card-bg)',
                                  border: '1px solid var(--glass-border-subtle)',
                                  padding: '1rem 1.25rem',
                                  borderRadius: 10,
                                  marginTop: '0.75rem',
                                }}
                              >
                                {cert.extensions.map((ext: any, i: number) => (
                                  <div key={i} style={{ display: 'contents' }}>
                                    <div className="details-label" style={{ fontSize: '0.8rem' }}>
                                      {t([
                                        `app.winCertStore.extensions.${ext.name.replace(/\s+/g, '')}`,
                                        `app.winCertStore.extensions.${ext.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
                                        `app.winCertStore.extensions.${(ext.name || '').toLowerCase()}`,
                                        `app.winCertStore.extensions.${(ext.oid || '').replace(/\./g, '_')}`,
                                      ] as any, ext.name || ext.oid) as string}
                                    </div>
                                    <div className="details-value">
                                      <div style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span>OID: <span style={{ fontFamily: 'var(--font-mono)' }}>{ext.oid}</span></span>
                                        {ext.critical && (
                                          <span className="badge badge-danger" style={{ fontSize: '0.65em' }}>
                                            {t('app.certDetails.critical', 'Critical')}
                                          </span>
                                        )}
                                      </div>
                                      {ext.value && (
                                        <div
                                          className="mono"
                                          style={{
                                            wordBreak: 'break-word',
                                            whiteSpace: 'pre-wrap',
                                            fontSize: '0.78rem',
                                            marginTop: '0.25rem',
                                            color: 'var(--text-muted)',
                                            lineHeight: '1.4',
                                          }}
                                        >
                                          {formatExtensionValue(ext.name, ext.oid, String(ext.value), t)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Raw PEM Viewer */}
                        {cert.pem && isPemOpen && (
                          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                {t('app.tlsScanner.pemFormatTitle', 'X.509 Certificate (PEM Format)')}
                              </span>
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => copyPem(cert.pem, idx)}
                                >
                                  <Copy size={11} /> {t('common.copy', 'Copy')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-download-pem btn-sm"
                                  onClick={() => downloadPem(cert.pem, cert.subjectCN)}
                                >
                                  <Download size={11} /> {t('common.download', 'Download')}
                                </button>
                              </div>
                            </div>
                            <pre
                              className="code-block"
                              style={{
                                fontSize: '0.78rem',
                                maxHeight: 220,
                                overflowY: 'auto',
                                background: 'rgba(0, 0, 0, 0.45)',
                                padding: '0.85rem',
                                borderRadius: 8,
                                border: '1px solid var(--glass-border-subtle)',
                              }}
                            >
                              {cert.pem}
                            </pre>
                          </div>
                        )}
                      </div>
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
