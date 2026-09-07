const fs = require('fs');
const path = require('path');

const localesDir = path.join('c:/Users/Anel_/Documents/antigravity/certificate-management/src/locales');

const keys = {
  whyReplacedTitle: {
    en: "Why were the 2011 certificates replaced?",
    de: "Warum wurden die 2011-Zertifikate ersetzt?",
    bs: "Zašto su certifikati iz 2011. zamijenjeni?",
    pl: "Dlaczego certyfikaty z 2011 roku zostały wymienione?",
    id: "Mengapa sertifikat 2011 diganti?",
    "sr-Cyrl": "Зашто су сертификати из 2011. замењени?"
  },
  whyReplacedDesc: {
    en: "The original <0>Microsoft Corporation UEFI CA 2011</0> and <1>Windows Production PCA 2011</1> certificates expire in 2026. To prevent millions of devices from failing to boot, Microsoft rolled out \"2023\" replacement certificates via Windows Updates and firmware updates. The old certificates will safely remain expired, while the new ones take over.",
    de: "Die ursprünglichen <0>Microsoft Corporation UEFI CA 2011</0> und <1>Windows Production PCA 2011</1> Zertifikate laufen 2026 ab. Um zu verhindern, dass Millionen von Geräten nicht mehr booten, hat Microsoft \"2023\" Ersatzzertifikate über Windows- und Firmware-Updates bereitgestellt. Die alten Zertifikate bleiben sicher abgelaufen, während die neuen übernehmen.",
    bs: "Originalni <0>Microsoft Corporation UEFI CA 2011</0> i <1>Windows Production PCA 2011</1> certifikati ističu 2026. godine. Kako bi spriječio da se milioni uređaja prestanu pokretati, Microsoft je putem Windows i firmware ažuriranja izdao zamjenske certifikate iz \"2023.\". Stari certifikati će sigurno ostati istekli, dok će novi preuzeti funkciju.",
    pl: "Oryginalne certyfikaty <0>Microsoft Corporation UEFI CA 2011</0> i <1>Windows Production PCA 2011</1> wygasają w 2026 roku. Aby zapobiec awariom milionów urządzeń podczas rozruchu, firma Microsoft udostępniła zastępcze certyfikaty „2023” za pośrednictwem usługi Windows Update i aktualizacji oprogramowania układowego. Stare certyfikaty w bezpieczny sposób pozostaną wygasłe, a nowe przejmą ich funkcje.",
    id: "Sertifikat asli <0>Microsoft Corporation UEFI CA 2011</0> dan <1>Windows Production PCA 2011</1> akan kedaluwarsa pada tahun 2026. Untuk mencegah jutaan perangkat gagal boot, Microsoft meluncurkan sertifikat pengganti \"2023\" melalui Pembaruan Windows dan pembaruan firmware. Sertifikat lama akan dibiarkan kedaluwarsa dengan aman, sementara sertifikat baru mengambil alih.",
    "sr-Cyrl": "Оригинални <0>Microsoft Corporation UEFI CA 2011</0> и <1>Windows Production PCA 2011</1> сертификати истичу 2026. године. Како би спречио да милиони уређаја престану да се покрећу, Мајкрософт је путем Windows и фирмвер ажурирања издао заменске сертификате из \"2023.\". Стари сертификати ће сигурно остати истекли, док ће нови преузети функцију."
  },
  impactWindowsTitle: {
    en: "Impact of Windows Production PCA:",
    de: "Auswirkungen der Windows Production PCA:",
    bs: "Utjecaj Windows Production PCA certifikata:",
    pl: "Wpływ Windows Production PCA:",
    id: "Dampak Windows Production PCA:",
    "sr-Cyrl": "Утицај Windows Production PCA сертификата:"
  },
  impactWindowsDesc: {
    en: "This certificate validates the standard Microsoft Windows bootloader. Without it, standard Windows OS installs will refuse to boot under Secure Boot.",
    de: "Dieses Zertifikat validiert den Standard-Microsoft-Windows-Bootloader. Ohne dieses Zertifikat weigern sich Standard-Windows-Installationen, unter Secure Boot zu booten.",
    bs: "Ovaj certifikat potvrđuje standardni Microsoft Windows bootloader. Bez njega, standardne Windows instalacije će odbiti pokretanje pod funkcijom Secure Boot.",
    pl: "Ten certyfikat weryfikuje standardowy program ładujący system Microsoft Windows. Bez niego standardowe instalacje systemu Windows OS odmówią uruchomienia w ramach Bezpiecznego Rozruchu.",
    id: "Sertifikat ini memvalidasi bootloader Microsoft Windows standar. Tanpanya, instalasi Windows OS standar akan menolak untuk boot di bawah Secure Boot.",
    "sr-Cyrl": "Овај сертификат потврђује стандардни Мајкрософт Windows покретач система (bootloader). Без њега, стандардне инсталације Windows-а ће одбити покретање под Secure Boot-ом."
  },
  impactUefiTitle: {
    en: "Impact of Microsoft UEFI CA:",
    de: "Auswirkungen der Microsoft UEFI CA:",
    bs: "Utjecaj Microsoft UEFI CA certifikata:",
    pl: "Wpływ Microsoft UEFI CA:",
    id: "Dampak Microsoft UEFI CA:",
    "sr-Cyrl": "Утицај Мајкрософт UEFI CA сертификата:"
  },
  impactUefiDesc: {
    en: "This certificate validates third-party bootloaders (such as Linux distributions) and Option ROM firmware on PCIe devices (like Graphics Cards). Without it, you cannot boot Linux, and your GPU might fail to initialize during a Secure Boot startup.",
    de: "Dieses Zertifikat validiert Bootloader von Drittanbietern (wie Linux-Distributionen) und Option-ROM-Firmware auf PCIe-Geräten (wie Grafikkarten). Ohne es können Sie Linux nicht booten, und Ihre GPU könnte sich während eines Secure Boot-Starts nicht initialisieren.",
    bs: "Ovaj certifikat potvrđuje bootloadere trećih strana (kao što su Linux distribucije) i Option ROM firmware na PCIe uređajima (poput grafičkih kartica). Bez njega ne možete pokrenuti Linux, a vaš GPU bi se mogao odbiti inicijalizirati tokom pokretanja pod Secure Boot funkcijom.",
    pl: "Certyfikat ten zatwierdza zewnętrzne programy ładujące (np. dystrybucje systemu Linux) i oprogramowanie wbudowane Opcjonalnych Pamięci ROM w urządzeniach PCIe (np. kartach graficznych). Bez niego nie można uruchomić systemu Linux, a karta graficzna może nie zainicjować się podczas bezpiecznego uruchamiania.",
    id: "Sertifikat ini memvalidasi bootloader pihak ketiga (seperti distribusi Linux) dan firmware Option ROM pada perangkat PCIe (seperti Kartu Grafis). Tanpanya, Anda tidak dapat melakukan boot pada Linux, dan GPU Anda mungkin gagal menginisialisasi selama startup Secure Boot.",
    "sr-Cyrl": "Овај сертификат потврђује покретаче система трећих страна (као што су Линукс дистрибуције) и Option ROM фирмвер на PCIe уређајима (попут графичких картица). Без њега не можете покренути Линукс, а ваш графички процесор (GPU) би се могао одбити иницијализовати током покретања уз Secure Boot."
  },
  functionalTitle: {
    en: "Is Secure Boot Functional?",
    de: "Ist Secure Boot funktionsfähig?",
    bs: "Da li je Secure Boot funkcionalan?",
    pl: "Czy funkcja Secure Boot działa?",
    id: "Apakah Secure Boot Berfungsi?",
    "sr-Cyrl": "Да ли је Secure Boot функционалан?"
  },
  windowsBoot: {
    en: "Windows Boot:",
    de: "Windows-Boot:",
    bs: "Pokretanje Windowsa:",
    pl: "Rozruch systemu Windows:",
    id: "Windows Boot:",
    "sr-Cyrl": "Покретање Windows-а:"
  },
  thirdPartyBoot: {
    en: "Third-Party OS & Hardware:",
    de: "Betriebssystem & Hardware von Drittanbietern:",
    bs: "OS treće strane i hardver:",
    pl: "System operacyjny i sprzęt innych firm:",
    id: "OS & Perangkat Keras Pihak Ketiga:",
    "sr-Cyrl": "Оперативни системи трећих страна и хардвер:"
  },
  validUntil: {
    en: "VALID until {{date}}",
    de: "GÜLTIG bis {{date}}",
    bs: "VAŽI do {{date}}",
    pl: "WAŻNE do {{date}}",
    id: "BERLAKU hingga {{date}}",
    "sr-Cyrl": "ВАЖИ до {{date}}"
  },
  invalid: {
    en: "INVALID",
    de: "UNGÜLTIG",
    bs: "NEVAŽEĆE",
    pl: "NIEWAŻNE",
    id: "TIDAK VALID",
    "sr-Cyrl": "НЕВАЖЕЋЕ"
  },
  governedBy: {
    en: "Governed by: {{subject}}",
    de: "Geregelt durch: {{subject}}",
    bs: "Određuje ga: {{subject}}",
    pl: "Zarządzane przez: {{subject}}",
    id: "Diatur oleh: {{subject}}",
    "sr-Cyrl": "Одређује га: {{subject}}"
  },
  warnExpiringSoon: {
    en: "Certificate is expiring soon (within 30 days): {{subject}}",
    de: "Zertifikat läuft demnächst ab (innerhalb von 30 Tagen): {{subject}}",
    bs: "Certifikat uskoro ističe (u roku od 30 dana): {{subject}}",
    pl: "Certyfikat wygaśnie wkrótce (w ciągu 30 dni): {{subject}}",
    id: "Sertifikat akan segera kedaluwarsa (dalam 30 hari): {{subject}}",
    "sr-Cyrl": "Сертификат ускоро истиче (у року од 30 дана): {{subject}}"
  },
  critNoValidDb: {
    en: "No valid, unexpired certificates found in the Signature Database (db). Your system may fail to boot any operating system.",
    de: "Keine gültigen, nicht abgelaufenen Zertifikate in der Signaturdatenbank (db) gefunden. Ihr System könnte beim Start eines Betriebssystems scheitern.",
    bs: "Nisu pronađeni važeći, neistekli certifikati u Bazi Potpisa (db). Vaš sistem možda neće pokrenuti nijedan operativni sistem.",
    pl: "Nie znaleziono ważnych, niewygasłych certyfikatów w Bazie podpisów (db). Uruchomienie dowolnego systemu operacyjnego na Twoim systemie może się nie powieść.",
    id: "Tidak ada sertifikat yang valid dan belum kedaluwarsa yang ditemukan di Database Tanda Tangan (db). Sistem Anda mungkin gagal melakukan booting pada sistem operasi mana pun.",
    "sr-Cyrl": "Нису пронађени важећи, неистекли сертификати у Бази потписа (db). Ваш систем можда неће покренути ниједан оперативни систем."
  },
  critExpiredWindowsPca: {
    en: "The Windows Production PCA certificate is expired and no valid replacement was found.",
    de: "Das Windows Production PCA-Zertifikat ist abgelaufen und es wurde kein gültiger Ersatz gefunden.",
    bs: "Windows Production PCA certifikat je istekao i nije pronađena odgovarajuća zamjena.",
    pl: "Certyfikat Windows Production PCA wygasł i nie znaleziono dla niego ważnego zastępstwa.",
    id: "Sertifikat Windows Production PCA telah kedaluwarsa dan tidak ditemukan pengganti yang valid.",
    "sr-Cyrl": "Windows Production PCA сертификат је истекао и није пронађена одговарајућа замена."
  },
  warnMissingWindowsPca: {
    en: "Could not find a valid Windows Production PCA certificate. If you use Windows, your system might fail to boot if it relies solely on standard Secure Boot keys.",
    de: "Es konnte kein gültiges Windows Production PCA-Zertifikat gefunden werden. Wenn Sie Windows verwenden, könnte Ihr System nicht booten, wenn es sich ausschließlich auf standardmäßige Secure Boot-Schlüssel stützt.",
    bs: "Nije moguće pronaći važeći Windows Production PCA certifikat. Ako koristite Windows, vaš sistem se možda neće pokrenuti ako se oslanja isključivo na standardne Secure Boot ključeve.",
    pl: "Nie udało się znaleźć ważnego certyfikatu Windows Production PCA. Jeśli korzystasz z systemu Windows, system może się nie uruchomić, jeśli polega on wyłącznie na standardowych kluczach Bezpiecznego Rozruchu.",
    id: "Tidak dapat menemukan sertifikat Windows Production PCA yang valid. Jika Anda menggunakan Windows, sistem Anda mungkin gagal melakukan boot jika hanya mengandalkan kunci Secure Boot standar.",
    "sr-Cyrl": "Није могуће пронаћи важећи Windows Production PCA сертификат. Ако користите Windows, ваш систем се можда неће покренути ако се ослања искључиво на стандардне кључеве за Secure Boot."
  },
  critExpiredUefiCa: {
    en: "The Microsoft/Windows UEFI CA certificate is expired and no valid replacement was found.",
    de: "Das Microsoft/Windows UEFI CA-Zertifikat ist abgelaufen und es wurde kein gültiger Ersatz gefunden.",
    bs: "Microsoft/Windows UEFI CA certifikat je istekao i nije pronađena odgovarajuća zamjena.",
    pl: "Certyfikat Microsoft/Windows UEFI CA wygasł i nie znaleziono dla niego ważnego zastępstwa.",
    id: "Sertifikat Microsoft/Windows UEFI CA telah kedaluwarsa dan tidak ditemukan pengganti yang valid.",
    "sr-Cyrl": "Мајкрософт/Windows UEFI CA сертификат је истекао и није пронађена одговарајућа замена."
  }
};

Object.keys(translations = {en:{}, de:{}, bs:{}, pl:{}, id:{}, "sr-Cyrl":{}});

for (const key in keys) {
  for (const lang in keys[key]) {
    translations[lang][key] = keys[key][lang];
  }
}

Object.entries(translations).forEach(([lang, data]) => {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    let rawStr = fs.readFileSync(filePath, 'utf8');
    const fileData = JSON.parse(rawStr);
    
    if (!fileData.app.secureBoot) {
        fileData.app.secureBoot = {};
    }
    
    // Merge new keys
    for (const k in data) {
      fileData.app.secureBoot[k] = data[k];
    }
    
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
    console.log(`Updated ${lang}/translation.json`);
  }
});
