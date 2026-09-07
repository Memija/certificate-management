const fs = require('fs');
const path = require('path');

const translations = {
  en: {
    jksMacSkipped: 'JKS MAC verification skipped - certificates are readable without a password. Private key entries are never displayed.',
    jksPrivKeySkipped: 'Alias "{{alias}}": private key entry - skipped (keys are never displayed).'
  },
  bs: {
    jksMacSkipped: 'JKS MAC provjera preskočena - certifikati su čitljivi bez lozinke. Unosi privatnih ključeva se nikada ne prikazuju.',
    jksPrivKeySkipped: 'Alias "{{alias}}": unos privatnog ključa - preskočen (ključevi se nikada ne prikazuju).'
  },
  de: {
    jksMacSkipped: 'JKS-MAC-Überprüfung übersprungen - Zertifikate sind ohne Passwort lesbar. Private Schlüsseleinträge werden nie angezeigt.',
    jksPrivKeySkipped: 'Alias "{{alias}}": privater Schlüsseleintrag - übersprungen (Schlüssel werden nie angezeigt).'
  },
  id: {
    jksMacSkipped: 'Verifikasi MAC JKS dilewati - sertifikat dapat dibaca tanpa kata sandi. Entri kunci privat tidak pernah ditampilkan.',
    jksPrivKeySkipped: 'Alias "{{alias}}": entri kunci privat - dilewati (kunci tidak pernah ditampilkan).'
  },
  pl: {
    jksMacSkipped: 'Pominięto weryfikację MAC JKS - certyfikaty są czytelne bez hasła. Wpisy klucza prywatnego nigdy nie są wyświetlane.',
    jksPrivKeySkipped: 'Alias "{{alias}}": wpis klucza prywatnego - pominięto (klucze nigdy nie są wyświetlane).'
  },
  'sr-Cyrl': {
    jksMacSkipped: 'JKS MAC провера прескочена - сертификати су читљиви без лозинке. Уноси приватних кључева се никада не приказују.',
    jksPrivKeySkipped: 'Alias "{{alias}}": унос приватног кључа - прескочен (кључеви се никада не приказују).'
  }
};

for (const [lang, t] of Object.entries(translations)) {
  const p = path.join(process.cwd(), 'src/locales', lang, 'translation.json');
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    
    if (!data.app.trustStore.warnings) data.app.trustStore.warnings = {};
    data.app.trustStore.warnings.jksMacSkipped = t.jksMacSkipped;
    data.app.trustStore.warnings.jksPrivKeySkipped = t.jksPrivKeySkipped;
    
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  }
}
console.log('Translations updated!');
