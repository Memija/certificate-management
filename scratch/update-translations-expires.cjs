const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const translations = {
  en: "Expires",
  bs: "Ističe",
  de: "Läuft ab",
  id: "Kedaluwarsa",
  pl: "Wygasa",
  'sr-Cyrl': "Истиче"
};

for (const [locale, val] of Object.entries(translations)) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    data.app.winCertStore.certCard.expires = val;
    fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated expires for ${locale}`);
  }
}
