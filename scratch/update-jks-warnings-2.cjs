const fs = require('fs');
const path = require('path');

const translations = {
  en: {
    jksMacSkipped: 'JKS MAC verification skipped. Private keys are encrypted and require a password.',
    jksPrivKeySkipped: 'Alias "{{alias}}": private key is encrypted.'
  },
  bs: {
    jksMacSkipped: 'JKS MAC provjera preskočena. Privatni ključevi su kriptovani i zahtijevaju lozinku.',
    jksPrivKeySkipped: 'Alias "{{alias}}": privatni ključ je kriptovan.'
  },
  de: {
    jksMacSkipped: 'JKS-MAC-Überprüfung übersprungen. Private Schlüssel sind verschlüsselt und erfordern ein Passwort.',
    jksPrivKeySkipped: 'Alias "{{alias}}": privater Schlüssel ist verschlüsselt.'
  },
  id: {
    jksMacSkipped: 'Verifikasi MAC JKS dilewati. Kunci privat dienkripsi dan memerlukan kata sandi.',
    jksPrivKeySkipped: 'Alias "{{alias}}": kunci privat dienkripsi.'
  },
  pl: {
    jksMacSkipped: 'Pominięto weryfikację MAC JKS. Klucze prywatne są zaszyfrowane i wymagają hasła.',
    jksPrivKeySkipped: 'Alias "{{alias}}": klucz prywatny jest zaszyfrowany.'
  },
  'sr-Cyrl': {
    jksMacSkipped: 'JKS MAC провера прескочена. Приватни кључеви су криптовани и захтевају лозинку.',
    jksPrivKeySkipped: 'Alias "{{alias}}": приватни кључ је криптован.'
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
