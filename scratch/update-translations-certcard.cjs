const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const translations = {
  en: {
    expired: "Expired",
    expiringSoon: "Expiring Soon",
    rootCA: "Root CA",
    intermediate: "Intermediate",
    subject: "Subject",
    issuer: "Issuer",
    validFrom: "Valid From",
    validTo: "Valid To",
    serialNumber: "Serial Number",
    thumbprint: "Thumbprint",
    ctLogLookup: "CT Log Lookup",
    searchCrtSh: "Search on crt.sh",
    signatureAlg: "Signature Alg.",
    publicKey: "Public Key",
    friendlyName: "Friendly Name",
    purposes: "Purposes",
    extensions: "Extensions",
    critical: "Critical",
    viewPem: "View PEM",
    hidePem: "Hide PEM",
    downloadPem: "Download PEM",
    downloadDer: "Download DER",
    pemTooltip: "Privacy Enhanced Mail (Base64 Text). Standard for Linux and web servers.",
    derTooltip: "Distinguished Encoding Rules (Raw Binary). Standard for Windows and Java."
  },
  bs: {
    expired: "Isteklo",
    expiringSoon: "Uskoro ističe",
    rootCA: "Korijenski CA",
    intermediate: "Srednji",
    subject: "Subjekt",
    issuer: "Izdavač",
    validFrom: "Važi od",
    validTo: "Važi do",
    serialNumber: "Serijski broj",
    thumbprint: "Otisak (Thumbprint)",
    ctLogLookup: "CT Log Pretraga",
    searchCrtSh: "Pretraži na crt.sh",
    signatureAlg: "Algoritam potpisa",
    publicKey: "Javni ključ",
    friendlyName: "Prijateljsko ime",
    purposes: "Svrhe",
    extensions: "Ekstenzije",
    critical: "Kritično",
    viewPem: "Prikaži PEM",
    hidePem: "Sakrij PEM",
    downloadPem: "Preuzmi PEM",
    downloadDer: "Preuzmi DER",
    pemTooltip: "Privacy Enhanced Mail (Base64 Tekst). Standard za Linux i web servere.",
    derTooltip: "Distinguished Encoding Rules (Sirovi Binarni Format). Standard za Windows i Java."
  },
  de: {
    expired: "Abgelaufen",
    expiringSoon: "Läuft bald ab",
    rootCA: "Stamm-CA",
    intermediate: "Zwischenzertifikat",
    subject: "Antragsteller",
    issuer: "Aussteller",
    validFrom: "Gültig von",
    validTo: "Gültig bis",
    serialNumber: "Seriennummer",
    thumbprint: "Fingerabdruck",
    ctLogLookup: "CT-Log Suche",
    searchCrtSh: "Auf crt.sh suchen",
    signatureAlg: "Signaturalgorithmus",
    publicKey: "Öffentlicher Schlüssel",
    friendlyName: "Anzeigename",
    purposes: "Zwecke",
    extensions: "Erweiterungen",
    critical: "Kritisch",
    viewPem: "PEM anzeigen",
    hidePem: "PEM ausblenden",
    downloadPem: "PEM herunterladen",
    downloadDer: "DER herunterladen",
    pemTooltip: "Privacy Enhanced Mail (Base64 Text). Standard für Linux und Webserver.",
    derTooltip: "Distinguished Encoding Rules (Rohes Binärformat). Standard für Windows und Java."
  },
  id: {
    expired: "Kedaluwarsa",
    expiringSoon: "Segera Kedaluwarsa",
    rootCA: "CA Akar",
    intermediate: "Menengah",
    subject: "Subjek",
    issuer: "Penerbit",
    validFrom: "Berlaku Dari",
    validTo: "Berlaku Sampai",
    serialNumber: "Nomor Seri",
    thumbprint: "Sidik Jari",
    ctLogLookup: "Pencarian CT Log",
    searchCrtSh: "Cari di crt.sh",
    signatureAlg: "Algoritma Tanda Tangan",
    publicKey: "Kunci Publik",
    friendlyName: "Nama Ramah",
    purposes: "Tujuan",
    extensions: "Ekstensi",
    critical: "Kritis",
    viewPem: "Lihat PEM",
    hidePem: "Sembunyikan PEM",
    downloadPem: "Unduh PEM",
    downloadDer: "Unduh DER",
    pemTooltip: "Privacy Enhanced Mail (Teks Base64). Standar untuk Linux dan server web.",
    derTooltip: "Distinguished Encoding Rules (Biner Mentah). Standar untuk Windows dan Java."
  },
  pl: {
    expired: "Wygasł",
    expiringSoon: "Wkrótce wygasa",
    rootCA: "Główny urząd certyfikacji",
    intermediate: "Pośredni",
    subject: "Podmiot",
    issuer: "Wystawca",
    validFrom: "Ważny od",
    validTo: "Ważny do",
    serialNumber: "Numer seryjny",
    thumbprint: "Odcisk palca",
    ctLogLookup: "Wyszukiwanie w logach CT",
    searchCrtSh: "Szukaj w crt.sh",
    signatureAlg: "Algorytm podpisu",
    publicKey: "Klucz publiczny",
    friendlyName: "Przyjazna nazwa",
    purposes: "Cele",
    extensions: "Rozszerzenia",
    critical: "Krytyczne",
    viewPem: "Pokaż PEM",
    hidePem: "Ukryj PEM",
    downloadPem: "Pobierz PEM",
    downloadDer: "Pobierz DER",
    pemTooltip: "Privacy Enhanced Mail (Tekst Base64). Standard dla systemów Linux i serwerów WWW.",
    derTooltip: "Distinguished Encoding Rules (Surowy format binarny). Standard dla systemów Windows i Java."
  },
  'sr-Cyrl': {
    expired: "Истекло",
    expiringSoon: "Ускоро истиче",
    rootCA: "Коренски ЦА",
    intermediate: "Средњи",
    subject: "Субјект",
    issuer: "Издавач",
    validFrom: "Важи од",
    validTo: "Важи до",
    serialNumber: "Серијски број",
    thumbprint: "Отисак (Thumbprint)",
    ctLogLookup: "ЦТ Лог Претрага",
    searchCrtSh: "Претражи на црт.сх",
    signatureAlg: "Алгоритам потписа",
    publicKey: "Јавни кључ",
    friendlyName: "Пријатељско име",
    purposes: "Сврхе",
    extensions: "Екстензије",
    critical: "Критично",
    viewPem: "Прикажи ПЕМ",
    hidePem: "Сакриј ПЕМ",
    downloadPem: "Преузми ПЕМ",
    downloadDer: "Преузми ДЕР",
    pemTooltip: "Privacy Enhanced Mail (Base64 Текст). Стандард за Линукс и веб сервере.",
    derTooltip: "Distinguished Encoding Rules (Сирови Бинарни Формат). Стандард за Виндовс и Јава."
  }
};

for (const [locale, translationsForLocale] of Object.entries(translations)) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    
    if (!data.app) data.app = {};
    if (!data.app.winCertStore) data.app.winCertStore = {};
    if (!data.app.winCertStore.certCard) data.app.winCertStore.certCard = {};
    
    data.app.winCertStore.certCard = translationsForLocale;
    
    fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated certCard strings for ${locale}`);
  }
}
