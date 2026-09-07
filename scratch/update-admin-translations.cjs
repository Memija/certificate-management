const fs = require('fs');
const path = require('path');

const localesDir = path.join('c:/Users/Anel_/Documents/antigravity/certificate-management/src/locales');

const translations = {
  en: {
    adminAccess: {
      title: "Administrator Access Required",
      waiting: "Waiting for Administrator Approval…",
      checkTaskbar: "Check your taskbar for a Windows UAC prompt.",
      secureBootDesc: "Reading Secure Boot NVRAM variables requires Administrator privileges. Click below to unlock the system database. You will only be prompted once per session.",
      localMachineDesc: "Reading the LocalMachine certificate store requires Administrator privileges. Click below to elevate — you will only be prompted once per session.",
      unlockSecureBoot: "Unlock Secure Boot Variables",
      unlockLocalMachine: "Unlock LocalMachine Store"
    }
  },
  de: {
    adminAccess: {
      title: "Administratorzugriff erforderlich",
      waiting: "Warten auf Administrator-Genehmigung…",
      checkTaskbar: "Überprüfen Sie Ihre Taskleiste auf eine Windows UAC-Aufforderung.",
      secureBootDesc: "Das Lesen von Secure Boot NVRAM-Variablen erfordert Administratorrechte. Klicken Sie unten, um die Systemdatenbank zu entsperren. Sie werden nur einmal pro Sitzung aufgefordert.",
      localMachineDesc: "Das Lesen des LocalMachine-Zertifikatsspeichers erfordert Administratorrechte. Klicken Sie unten, um die Berechtigung zu erhöhen — Sie werden nur einmal pro Sitzung aufgefordert.",
      unlockSecureBoot: "Secure Boot-Variablen entsperren",
      unlockLocalMachine: "LocalMachine-Speicher entsperren"
    }
  },
  bs: {
    adminAccess: {
      title: "Potreban je Administratorski Pristup",
      waiting: "Čekanje na Odobrenje Administratora…",
      checkTaskbar: "Provjerite traku zadataka za Windows UAC upit.",
      secureBootDesc: "Čitanje Secure Boot NVRAM varijabli zahtijeva administratorska prava. Kliknite ispod da otključate sistemsku bazu podataka. Bićete upitani samo jednom po sesiji.",
      localMachineDesc: "Čitanje LocalMachine prodavnice certifikata zahtijeva administratorska prava. Kliknite ispod za povišenje nivoa pristupa — bićete upitani samo jednom po sesiji.",
      unlockSecureBoot: "Otključaj Secure Boot Varijable",
      unlockLocalMachine: "Otključaj LocalMachine Prodavnicu"
    }
  },
  pl: {
    adminAccess: {
      title: "Wymagany Dostęp Administratora",
      waiting: "Oczekiwanie na zatwierdzenie przez administratora…",
      checkTaskbar: "Sprawdź pasek zadań, czy nie ma monitu Windows UAC.",
      secureBootDesc: "Odczyt zmiennych Secure Boot NVRAM wymaga uprawnień administratora. Kliknij poniżej, aby odblokować systemową bazę danych. Zostaniesz poproszony o to tylko raz w trakcie sesji.",
      localMachineDesc: "Odczyt magazynu certyfikatów LocalMachine wymaga uprawnień administratora. Kliknij poniżej, aby podnieść uprawnienia — zostaniesz poproszony o to tylko raz w trakcie sesji.",
      unlockSecureBoot: "Odblokuj Zmienne Secure Boot",
      unlockLocalMachine: "Odblokuj Magazyn LocalMachine"
    }
  },
  id: {
    adminAccess: {
      title: "Akses Administrator Diperlukan",
      waiting: "Menunggu Persetujuan Administrator…",
      checkTaskbar: "Periksa bilah tugas Anda untuk prompt UAC Windows.",
      secureBootDesc: "Membaca variabel Secure Boot NVRAM membutuhkan hak istimewa Administrator. Klik di bawah untuk membuka kunci basis data sistem. Anda hanya akan diminta sekali per sesi.",
      localMachineDesc: "Membaca penyimpanan sertifikat LocalMachine membutuhkan hak istimewa Administrator. Klik di bawah untuk meningkatkan hak — Anda hanya akan diminta sekali per sesi.",
      unlockSecureBoot: "Buka Kunci Variabel Secure Boot",
      unlockLocalMachine: "Buka Kunci Penyimpanan LocalMachine"
    }
  },
  "sr-Cyrl": {
    adminAccess: {
      title: "Потребан је Администраторски Приступ",
      waiting: "Чекање на Одобрење Администратора…",
      checkTaskbar: "Проверите траку задатака за Windows UAC упит.",
      secureBootDesc: "Читање Secure Boot NVRAM варијабли захтева администраторска права. Кликните испод да откључате системску базу података. Бићете упитани само једном по сесији.",
      localMachineDesc: "Читање LocalMachine продавнице сертификата захтева администраторска права. Кликните испод за повишење нивоа приступа — бићете упитани само једном по сесији.",
      unlockSecureBoot: "Откључај Secure Boot Варијабле",
      unlockLocalMachine: "Откључај LocalMachine Продавницу"
    }
  }
};

Object.entries(translations).forEach(([lang, data]) => {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    let rawStr = fs.readFileSync(filePath, 'utf8');
    const fileData = JSON.parse(rawStr);
    
    fileData.app = { ...fileData.app, ...data };
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
    console.log(`Updated ${lang}/translation.json`);
  }
});
