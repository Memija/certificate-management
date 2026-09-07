const fs = require('fs');
const path = require('path');

const localesDir = path.join('c:/Users/Anel_/Documents/antigravity/certificate-management/src/locales');

const translations = {
  en: {
    assessmentTitle: "Secure Boot System Assessment"
  },
  de: {
    assessmentTitle: "Secure Boot Systembewertung"
  },
  bs: {
    assessmentTitle: "Procjena sistema sigurnog pokretanja (Secure Boot)"
  },
  pl: {
    assessmentTitle: "Ocena systemu bezpiecznego rozruchu (Secure Boot)"
  },
  id: {
    assessmentTitle: "Penilaian Sistem Secure Boot"
  },
  "sr-Cyrl": {
    assessmentTitle: "Процена система сигурног покретања (Secure Boot)"
  }
};

Object.entries(translations).forEach(([lang, data]) => {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    let rawStr = fs.readFileSync(filePath, 'utf8');
    const fileData = JSON.parse(rawStr);
    
    // Add to app.secureBoot
    if (!fileData.app.secureBoot) {
        fileData.app.secureBoot = {};
    }
    fileData.app.secureBoot.assessmentTitle = data.assessmentTitle;
    
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
    console.log(`Updated ${lang}/translation.json`);
  }
});
