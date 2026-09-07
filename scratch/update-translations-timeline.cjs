const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const translations = {
  en: "Timeline:",
  bs: "Vremenska skala:",
  de: "Zeitachse:",
  id: "Linimasa:",
  pl: "Oś czasu:",
  'sr-Cyrl': "Временска скала:"
};

for (const [locale, timelineLabel] of Object.entries(translations)) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    
    if (data.app && data.app.winCertStore && data.app.winCertStore.filters) {
      data.app.winCertStore.filters.timelineLabel = timelineLabel;
      fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
      console.log(`Updated timeline label for ${locale}`);
    }
  }
}
