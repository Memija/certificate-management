const fs = require('fs');
const path = require('path');

const localesDir = path.join('c:/Users/Anel_/Documents/antigravity/certificate-management/src/locales');

const translations = {
  en: {
    checkTaskbarUac: "Please check your taskbar for a Windows <0>UAC</0> prompt. We only need to do this once to read the secure variables into memory."
  },
  de: {
    checkTaskbarUac: "Bitte überprüfen Sie Ihre Taskleiste auf eine Windows <0>UAC</0>-Aufforderung. Wir müssen dies nur einmal tun, um die sicheren Variablen in den Speicher zu lesen."
  },
  bs: {
    checkTaskbarUac: "Molimo provjerite traku zadataka za Windows <0>UAC</0> upit. Ovo moramo uraditi samo jednom kako bismo učitali sigurne varijable u memoriju."
  },
  pl: {
    checkTaskbarUac: "Sprawdź pasek zadań, czy nie ma monitu Windows <0>UAC</0>. Musimy to zrobić tylko raz, aby wczytać bezpieczne zmienne do pamięci."
  },
  id: {
    checkTaskbarUac: "Silakan periksa bilah tugas Anda untuk prompt <0>UAC</0> Windows. Kita hanya perlu melakukan ini sekali untuk membaca variabel aman ke dalam memori."
  },
  "sr-Cyrl": {
    checkTaskbarUac: "Молимо проверите траку задатака за Windows <0>UAC</0> упит. Ово морамо урадити само једном како бисмо учитали сигурне варијабле у меморију."
  }
};

Object.entries(translations).forEach(([lang, data]) => {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    let rawStr = fs.readFileSync(filePath, 'utf8');
    const fileData = JSON.parse(rawStr);
    
    fileData.app.adminAccess.checkTaskbarUac = data.checkTaskbarUac;
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
    console.log(`Updated ${lang}/translation.json`);
  }
});
