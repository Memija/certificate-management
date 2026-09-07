const fs = require('fs');
const path = require('path');

const localesDir = path.join('c:/Users/Anel_/Documents/antigravity/certificate-management/src/locales');

const translations = {
  en: {
    adminAccess: {
      secureBootDesc: "Reading <0>Secure Boot NVRAM</0> variables requires Administrator privileges. Click below to unlock the system database. You will only be prompted once per session.",
      localMachineDesc: "Reading the <0>LocalMachine</0> certificate store requires Administrator privileges. Click below to elevate — you will only be prompted once per session."
    }
  },
  de: {
    adminAccess: {
      secureBootDesc: "Das Lesen von <0>Secure Boot NVRAM</0>-Variablen erfordert Administratorrechte. Klicken Sie unten, um die Systemdatenbank zu entsperren. Sie werden nur einmal pro Sitzung aufgefordert.",
      localMachineDesc: "Das Lesen des <0>LocalMachine</0>-Zertifikatsspeichers erfordert Administratorrechte. Klicken Sie unten, um die Berechtigung zu erhöhen — Sie werden nur einmal pro Sitzung aufgefordert."
    }
  },
  bs: {
    adminAccess: {
      secureBootDesc: "Čitanje <0>Secure Boot NVRAM</0> varijabli zahtijeva administratorska prava. Kliknite ispod da otključate sistemsku bazu podataka. Bićete upitani samo jednom po sesiji.",
      localMachineDesc: "Čitanje <0>LocalMachine</0> prodavnice certifikata zahtijeva administratorska prava. Kliknite ispod za povišenje nivoa pristupa — bićete upitani samo jednom po sesiji."
    }
  },
  pl: {
    adminAccess: {
      secureBootDesc: "Odczyt zmiennych <0>Secure Boot NVRAM</0> wymaga uprawnień administratora. Kliknij poniżej, aby odblokować systemową bazę danych. Zostaniesz poproszony o to tylko raz w trakcie sesji.",
      localMachineDesc: "Odczyt magazynu certyfikatów <0>LocalMachine</0> wymaga uprawnień administratora. Kliknij poniżej, aby podnieść uprawnienia — zostaniesz poproszony o to tylko raz w trakcie sesji."
    }
  },
  id: {
    adminAccess: {
      secureBootDesc: "Membaca variabel <0>Secure Boot NVRAM</0> membutuhkan hak istimewa Administrator. Klik di bawah untuk membuka kunci basis data sistem. Anda hanya akan diminta sekali per sesi.",
      localMachineDesc: "Membaca penyimpanan sertifikat <0>LocalMachine</0> membutuhkan hak istimewa Administrator. Klik di bawah untuk meningkatkan hak — Anda hanya akan diminta sekali per sesi."
    }
  },
  "sr-Cyrl": {
    adminAccess: {
      secureBootDesc: "Читање <0>Secure Boot NVRAM</0> варијабли захтева администраторска права. Кликните испод да откључате системску базу података. Бићете упитани само једном по сесији.",
      localMachineDesc: "Читање <0>LocalMachine</0> продавнице сертификата захтева администраторска права. Кликните испод за повишење нивоа приступа — бићете упитани само једном по сесији."
    }
  }
};

Object.entries(translations).forEach(([lang, data]) => {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    let rawStr = fs.readFileSync(filePath, 'utf8');
    const fileData = JSON.parse(rawStr);
    
    fileData.app.adminAccess = { ...fileData.app.adminAccess, ...data.adminAccess };
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
    console.log(`Updated ${lang}/translation.json`);
  }
});
