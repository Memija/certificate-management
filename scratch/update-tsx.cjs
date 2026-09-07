const fs = require("fs");
const path = require("path");
const file = path.join(process.cwd(), "src/TrustStoreInspector.tsx");
let content = fs.readFileSync(file, "utf8");

// 1. FORMAT_LABELS
content = content.replace(/label: 'DER Certificate'/g, 'labelKey: "app.trustStore.format.x509Der", fallback: "DER Certificate"');
content = content.replace(/label: 'PEM Certificate'/g, 'labelKey: "app.trustStore.format.x509Pem", fallback: "PEM Certificate"');
content = content.replace(/label: 'PEM Bundle'/g, 'labelKey: "app.trustStore.format.pemBundle", fallback: "PEM Bundle"');
content = content.replace(/label: 'PKCS#7 Chain'/g, 'labelKey: "app.trustStore.format.pkcs7", fallback: "PKCS#7 Chain"');
content = content.replace(/label: 'PKCS#12 \/ PFX'/g, 'labelKey: "app.trustStore.format.pkcs12", fallback: "PKCS#12 / PFX"');
content = content.replace(/label: 'Java KeyStore'/g, 'labelKey: "app.trustStore.format.jks", fallback: "Java KeyStore"');
content = content.replace(/label: 'Unknown Format'/g, 'labelKey: "app.trustStore.format.unknown", fallback: "Unknown Format"');

// In FileTrustStore
content = content.replace(/const fmtInfo = FORMAT_LABELS\[store.format\] \?\? FORMAT_LABELS\['Unknown'\];/g, 
  'const { t } = useTranslation();\n  const fmtInfo = FORMAT_LABELS[store.format] ?? FORMAT_LABELS["Unknown"];\n  const fmtLabel = t(fmtInfo.labelKey, fmtInfo.fallback);');
content = content.replace(/fmtInfo\.label/g, 'fmtLabel');

// CertificateDetails
content = content.replace(/<div className="details-label">Subject<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.subject", "Subject")}</div>');
content = content.replace(/<div className="details-label">Issuer<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.issuer", "Issuer")}</div>');
content = content.replace(/<div className="details-label">Valid From<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.validFrom", "Valid From")}</div>');
content = content.replace(/<div className="details-label">Valid To<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.validTo", "Valid To")}</div>');
content = content.replace(/<div className="details-label">Serial<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.serial", "Serial")}</div>');
content = content.replace(/<div className="details-label">Version<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.version", "Version")}</div>');
content = content.replace(/<div className="details-label">Sig\. Algorithm<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.sigAlgorithm", "Sig. Algorithm")}</div>');
content = content.replace(/<div className="details-label">Public Key<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.publicKey", "Public Key")}</div>');
content = content.replace(/<div className="details-label">SHA-1<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.sha1", "SHA-1")}</div>');
content = content.replace(/<div className="details-label">SHA-256<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.sha256", "SHA-256")}</div>');
content = content.replace(/<div className="details-label">CT Log Lookup<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.ctLogLookup", "CT Log Lookup")}</div>');
content = content.replace(/Search on crt\.sh/g, '{t("app.trustStore.certDetails.searchOnCrtSh", "Search on crt.sh")}');
content = content.replace(/<div className="details-label">Purposes<\/div>/g, '<div className="details-label">{t("app.trustStore.certDetails.purposes", "Purposes")}</div>');
content = content.replace(/View Extensions \(\{cert\.extensions\.length\}\)/g, '{t("app.trustStore.certDetails.viewExtensions", "View Extensions")} ({cert.extensions.length})');
content = content.replace(/\{showPem \? 'Hide PEM' : 'View PEM'\}/g, '{showPem ? t("app.trustStore.certDetails.hidePem", "Hide PEM") : t("app.trustStore.certDetails.viewPem", "View PEM")}');

// DropZone
content = content.replace(/function DropZone\(\{ onFiles \}: \{ onFiles: \(files: File\[\]\) => void \}\) \{/g, 
  'function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {\n  const { t } = useTranslation();');
content = content.replace(/Drop certificate files here/g, '{t("app.trustStore.inspector.dropFilesHere", "Drop certificate files here")}');
content = content.replace(/or click to browse/g, '{t("app.trustStore.inspector.orClickToBrowse", "or click to browse")}');

// TrustStoreInspector
content = content.replace(/export function TrustStoreInspector\(\) \{/g, 
  'export function TrustStoreInspector() {\n  const { t } = useTranslation();');
content = content.replace(/<h2 style={{ margin: 0, marginBottom: '0\.25rem' }}>Trust Store Inspector<\/h2>/g, '<h2 style={{ margin: 0, marginBottom: "0.25rem" }}>{t("app.trustStore.inspector.title", "Trust Store Inspector")}</h2>');
content = content.replace(/Load any certificate file or keystore to inspect its contents — 100% client-side, nothing leaves your machine\./g, '{t("app.trustStore.inspector.subtitle", "Load any certificate file or keystore to inspect its contents — 100% client-side, nothing leaves your machine.")}');
content = content.replace(/Parsing file\(s\)…/g, '{t("app.trustStore.inspector.parsingFiles", "Parsing file(s)…")}');
content = content.replace(/Loaded Files \(\{loadedFiles\.length\}\)/g, '{t("app.trustStore.inspector.loadedFiles", "Loaded Files")} ({loadedFiles.length})');
content = content.replace(/Clear All/g, '{t("app.trustStore.inspector.clearAll", "Clear All")}');
content = content.replace(/Decryption failed\./g, '\" + t("app.trustStore.inspector.decryptionFailed", "Decryption failed.") + \"');
content = content.replace(/Unknown error/g, '\" + t("app.trustStore.inspector.unknownError", "Unknown error") + \"');

// FileTrustStore additions
content = content.replace(/This file is password-protected\. Enter the password to decrypt and inspect its certificates\./g, '{t("app.trustStore.inspector.passwordProtectedDesc", "This file is password-protected. Enter the password to decrypt and inspect its certificates.")}');
content = content.replace(/placeholder="Enter keystore password…"/g, 'placeholder={t("app.trustStore.inspector.passwordPlaceholder", "Enter keystore password…")}');
content = content.replace(/>\s*Unlock\s*<\/button>/g, '>{t("app.trustStore.inspector.unlock", "Unlock")}</button>');
content = content.replace(/\{store\.entries\.length\} cert\{store\.entries\.length !== 1 \? 's' : ''\}/g, '{store.entries.length} {store.entries.length !== 1 ? t("app.trustStore.inspector.certsCount_other", "certs") : t("app.trustStore.inspector.certsCount_one", "cert")}');
content = content.replace(/No certificates could be extracted from this file\./g, '{t("app.trustStore.inspector.noCertsExtracted", "No certificates could be extracted from this file.")}');
content = content.replace(/Valid to \{new Date\(entry\.certificate\.validTo\)\.toLocaleDateString\(\)\}/g, '{t("app.trustStore.inspector.validTo", "Valid to {{date}}", { date: new Date(entry.certificate.validTo).toLocaleDateString() })}');
content = content.replace(/Select a certificate from the list/g, '{t("app.trustStore.inspector.selectCert", "Select a certificate from the list")}');


fs.writeFileSync(file, content, "utf8");
console.log("TSX Update Complete");
