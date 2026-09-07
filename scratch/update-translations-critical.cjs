const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const translations = {
  en: { critical: "(Critical)" },
  bs: { critical: "(Kritično)" },
  de: { critical: "(Kritisch)" },
  id: { critical: "(Kritis)" },
  pl: { critical: "(Krytyczne)" },
  'sr-Cyrl': { critical: "(Критично)" }
};

for (const [locale, translationsForLocale] of Object.entries(translations)) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    
    if (!data.app) data.app = {};
    if (!data.app.certDetails) data.app.certDetails = {};
    
    data.app.certDetails.critical = translationsForLocale.critical;
    
    fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated critical for ${locale}`);
  }
}
