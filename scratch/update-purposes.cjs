const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');
const locales = ['en', 'bs', 'de', 'id', 'pl', 'sr-Cyrl'];

const purposeTranslations = {
  en: {
    digitalsignature: "Digital Signature",
    certificatesign: "Certificate Sign",
    crlsign: "CRL Sign",
    codesigning: "Code Signing",
    serverauthentication: "Server Authentication",
    clientauthentication: "Client Authentication",
    emailprotection: "Email Protection",
    timestamping: "Time Stamping",
    generalpurpose: "General Purpose",
    notspecified: "Not Specified",
    keyencipherment: "Key Encipherment",
    dataencipherment: "Data Encipherment",
    secureemail: "Secure Email",
    smartcardlogon: "Smart Card Logon",
    ipsecendsystem: "IPsec End System",
    ipsectunnel: "IPsec Tunnel",
    ipsecuser: "IPsec User",
    anypurpose: "Any Purpose"
  },
  'sr-Cyrl': {
    digitalsignature: "Дигитални потпис",
    certificatesign: "Потписивање сертификата",
    crlsign: "ЦРЛ потпис",
    codesigning: "Потписивање кода",
    serverauthentication: "Аутентификација сервера",
    clientauthentication: "Аутентификација клијента",
    emailprotection: "Заштита е-поште",
    timestamping: "Временски жиг",
    generalpurpose: "Општа намена",
    notspecified: "Није наведено",
    keyencipherment: "Шифровање кључа",
    dataencipherment: "Шифровање података",
    secureemail: "Сигурна е-пошта",
    smartcardlogon: "Пријава паметном картицом",
    ipsecendsystem: "ИПсец крајњи систем",
    ipsectunnel: "ИПсец тунел",
    ipsecuser: "ИПсец корисник",
    anypurpose: "Било која намена"
  },
  bs: {
    digitalsignature: "Digitalni potpis",
    certificatesign: "Potpisivanje certifikata",
    crlsign: "CRL potpis",
    codesigning: "Potpisivanje koda",
    serverauthentication: "Autentifikacija servera",
    clientauthentication: "Autentifikacija klijenta",
    emailprotection: "Zaštita e-pošte",
    timestamping: "Vremenski žig",
    generalpurpose: "Opća namjena",
    notspecified: "Nije navedeno",
    keyencipherment: "Šifriranje ključa",
    dataencipherment: "Šifriranje podataka",
    secureemail: "Sigurna e-pošta",
    smartcardlogon: "Prijava pametnom karticom",
    ipsecendsystem: "IPsec krajnji sistem",
    ipsectunnel: "IPsec tunel",
    ipsecuser: "IPsec korisnik",
    anypurpose: "Bilo koja namjena"
  },
  de: {
    digitalsignature: "Digitale Signatur",
    certificatesign: "Zertifikatsignatur",
    crlsign: "CRL-Signatur",
    codesigning: "Code-Signatur",
    serverauthentication: "Serverauthentifizierung",
    clientauthentication: "Clientauthentifizierung",
    emailprotection: "E-Mail-Schutz",
    timestamping: "Zeitstempel",
    generalpurpose: "Allgemeiner Zweck",
    notspecified: "Nicht angegeben",
    keyencipherment: "Schlüsselverschlüsselung",
    dataencipherment: "Datenverschlüsselung",
    secureemail: "Sichere E-Mail",
    smartcardlogon: "Smartcard-Anmeldung",
    ipsecendsystem: "IPsec-Endsystem",
    ipsectunnel: "IPsec-Tunnel",
    ipsecuser: "IPsec-Benutzer",
    anypurpose: "Jeder Zweck"
  },
  id: {
    digitalsignature: "Tanda Tangan Digital",
    certificatesign: "Tanda Tangan Sertifikat",
    crlsign: "Tanda Tangan CRL",
    codesigning: "Penandatanganan Kode",
    serverauthentication: "Otentikasi Server",
    clientauthentication: "Otentikasi Klien",
    emailprotection: "Perlindungan Email",
    timestamping: "Stempel Waktu",
    generalpurpose: "Tujuan Umum",
    notspecified: "Tidak Ditentukan",
    keyencipherment: "Enkripsi Kunci",
    dataencipherment: "Enkripsi Data",
    secureemail: "Email Aman",
    smartcardlogon: "Logon Kartu Pintar",
    ipsecendsystem: "Sistem Akhir IPsec",
    ipsectunnel: "Terowongan IPsec",
    ipsecuser: "Pengguna IPsec",
    anypurpose: "Tujuan Apapun"
  },
  pl: {
    digitalsignature: "Podpis cyfrowy",
    certificatesign: "Podpis certyfikatu",
    crlsign: "Podpis CRL",
    codesigning: "Podpisywanie kodu",
    serverauthentication: "Uwierzytelnianie serwera",
    clientauthentication: "Uwierzytelnianie klienta",
    emailprotection: "Ochrona e-mail",
    timestamping: "Znacznik czasu",
    generalpurpose: "Cel ogólny",
    notspecified: "Nie określono",
    keyencipherment: "Szyfrowanie klucza",
    dataencipherment: "Szyfrowanie danych",
    secureemail: "Bezpieczny e-mail",
    smartcardlogon: "Logowanie kartą inteligentną",
    ipsecendsystem: "System końcowy IPsec",
    ipsectunnel: "Tunel IPsec",
    ipsecuser: "Użytkownik IPsec",
    anypurpose: "Dowolny cel"
  }
};

for (const locale of locales) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    if (!data.app.winCertStore.purposes) {
      data.app.winCertStore.purposes = {};
    }
    
    // Merge new translations
    data.app.winCertStore.purposes = {
      ...data.app.winCertStore.purposes,
      ...purposeTranslations[locale]
    };
    
    fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated purposes for ${locale}`);
  }
}
