const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');
const locales = fs.readdirSync(localesDir);

const newTranslations = {
  signatureList: "Signature List #{{index}}",
  type: "Type",
  guid: "GUID",
  listSize: "List Size",
  bytes: "bytes",
  signatures: "Signatures",
  rawX509: "Raw X.509 Certificate",
  rootCa: "Root CA",
  intermediateCa: "Intermediate CA",
  leafCert: "Leaf Certificate",
  expired: "Expired",
  ownerGuid: "Owner GUID",
  rawHexData: "Raw Hex Data:",
  subject: "Subject",
  issuer: "Issuer",
  validFrom: "Valid From",
  validTo: "Valid To",
  serialNumber: "Serial Number",
  version: "Version",
  signatureAlgorithm: "Signature Algorithm",
  publicKey: "Public Key",
  bits: "bits",
  sha1Fingerprint: "SHA-1 Fingerprint",
  sha256Fingerprint: "SHA-256 Fingerprint",
  purposes: "Purposes",
  extensions: "Extensions",
  unknownSignatureType: "Hash / Binary Signature"
};

for (const locale of locales) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    
    if (!data.app) data.app = {};
    if (!data.app.certDetails) data.app.certDetails = {};
    
    for (const [key, value] of Object.entries(newTranslations)) {
      if (!data.app.certDetails[key]) {
        data.app.certDetails[key] = value;
      }
    }
    
    fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated ${locale}`);
  }
}
