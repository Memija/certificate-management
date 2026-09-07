const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const translations = {
  en: { 
    emptyTitle: "No Certificates Found",
    emptyDesc: "The <1>{{storeLabel}}</1> store is empty for {{location}}."
  },
  bs: { 
    emptyTitle: "Nisu pronađeni certifikati",
    emptyDesc: "<1>{{storeLabel}}</1> spremište je prazno za {{location}}."
  },
  de: { 
    emptyTitle: "Keine Zertifikate gefunden",
    emptyDesc: "Der <1>{{storeLabel}}</1> Speicher ist leer für {{location}}."
  },
  id: { 
    emptyTitle: "Tidak Ada Sertifikat Ditemukan",
    emptyDesc: "Penyimpanan <1>{{storeLabel}}</1> kosong untuk {{location}}."
  },
  pl: { 
    emptyTitle: "Nie znaleziono certyfikatów",
    emptyDesc: "Magazyn <1>{{storeLabel}}</1> jest pusty dla {{location}}."
  },
  'sr-Cyrl': { 
    emptyTitle: "Нису пронађени сертификати",
    emptyDesc: "<1>{{storeLabel}}</1> складиште је празно за {{location}}."
  }
};

for (const [locale, translationsForLocale] of Object.entries(translations)) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    
    if (!data.app) data.app = {};
    if (!data.app.winCertStore) data.app.winCertStore = {};
    
    data.app.winCertStore.emptyTitle = translationsForLocale.emptyTitle;
    data.app.winCertStore.emptyDesc = translationsForLocale.emptyDesc;
    
    fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated winCertStore empty states for ${locale}`);
  }
}
