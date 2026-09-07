const fs = require('fs');
const path = require('path');

const translations = {
  en: { unlock: 'Unlock' },
  bs: { unlock: 'Otključaj' },
  de: { unlock: 'Entsperren' },
  id: { unlock: 'Buka Kunci' },
  pl: { unlock: 'Odblokuj' },
  'sr-Cyrl': { unlock: 'Откључај' }
};

for (const [lang, t] of Object.entries(translations)) {
  const p = path.join(process.cwd(), 'src/locales', lang, 'translation.json');
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    
    if (!data.app.trustStore.inspector) data.app.trustStore.inspector = {};
    data.app.trustStore.inspector.unlock = t.unlock;
    
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  }
}
console.log('Translations updated!');
