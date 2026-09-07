const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const locales = ['en', 'bs', 'de', 'id', 'pl', 'sr-Cyrl'];

for (const locale of locales) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    if (data.app && data.app.winCertStore && data.app.winCertStore.extensions) {
      const exts = data.app.winCertStore.extensions;
      const newExts = { ...exts };
      for (const [key, val] of Object.entries(exts)) {
        const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
        newExts[lowerKey] = val; // e.g. keyUsage
        newExts[key.toLowerCase()] = val; // e.g. keyusage
      }
      data.app.winCertStore.extensions = newExts;
      fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
      console.log(`Added camelCase aliases for ${locale}`);
    }
  }
}
