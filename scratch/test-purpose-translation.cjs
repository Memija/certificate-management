const fs = require('fs');
const path = require('path');

const bsJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'locales', 'bs', 'translation.json'), 'utf-8'));
const deJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'locales', 'de', 'translation.json'), 'utf-8'));
const plJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'locales', 'pl', 'translation.json'), 'utf-8'));
const srJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'locales', 'sr-Cyrl', 'translation.json'), 'utf-8'));

function mockT(localeJson) {
  return (key, fallback) => {
    const parts = key.split('.');
    let cur = localeJson;
    for (const p of parts) {
      if (cur && cur[p]) cur = cur[p];
      else return fallback;
    }
    return cur || fallback;
  };
}

const tBs = mockT(bsJson);
const tDe = mockT(deJson);
const tPl = mockT(plJson);
const tSr = mockT(srJson);

// Replicate purposeFormatter logic:
const rawPurposes = [
  'Digital Signature',
  'Non-Repudiation',
  'Certificate Signing',
  'Off-line CRL Signing',
  'CRL Signing'
];

function translate(p, t) {
  const norm = p.replace(/\s*\([0-9a-fA-F]+\)/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return t(`app.winCertStore.purposes.${norm}`, p);
}

console.log('--- Bosnian (bs) ---');
rawPurposes.forEach(p => console.log(`${p} => ${translate(p, tBs)}`));

console.log('\n--- German (de) ---');
rawPurposes.forEach(p => console.log(`${p} => ${translate(p, tDe)}`));

console.log('\n--- Polish (pl) ---');
rawPurposes.forEach(p => console.log(`${p} => ${translate(p, tPl)}`));

console.log('\n--- Serbian Cyrillic (sr-Cyrl) ---');
rawPurposes.forEach(p => console.log(`${p} => ${translate(p, tSr)}`));
