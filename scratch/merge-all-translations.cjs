const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');
const locales = ['en', 'bs', 'de', 'id', 'pl', 'sr-Cyrl'];

const translations = {
  en: {
    common: {
      error: "Error",
      copiedToClipboard: "Copied to clipboard",
      copyToClipboard: "Copy to clipboard",
      clear: "Clear"
    },
    app: {
      winCertStore: {
        storeLocation: "Store Location:",
        locations: {
          CurrentUser: "Current User",
          LocalMachine: "Local Machine"
        },
        purposes: {
          digitalsignature: "Digital Signature",
          certificatesign: "Certificate Sign",
          certificatesigning: "Certificate Signing",
          crlsign: "CRL Sign",
          crlsigning: "CRL Signing",
          offlinecrlsigning: "Off-line CRL Signing",
          nonrepudiation: "Non-Repudiation",
          keyagreement: "Key Agreement",
          encipheronly: "Encipher Only",
          decipheronly: "Decipher Only",
          keyencipherment: "Key Encipherment",
          dataencipherment: "Data Encipherment",
          codesigning: "Code Signing",
          serverauthentication: "Server Authentication",
          clientauthentication: "Client Authentication",
          emailprotection: "Email Protection",
          secureemail: "Secure Email",
          timestamping: "Time Stamping",
          smartcardlogon: "Smart Card Logon",
          ipsecendsystem: "IPsec End System",
          ipsectunnel: "IPsec Tunnel",
          ipsecuser: "IPsec User",
          anypurpose: "Any Purpose",
          generalpurpose: "General Purpose",
          generalpurposenotspecified: "General Purpose / Not Specified",
          notspecified: "Not Specified",
          nonespecified: "None specified",
          microsofttrustlistsigning: "Microsoft Trust List Signing",
          encryptingfilesystem: "Encrypting File System",
          windowshardwaredriververification: "Windows Hardware Driver Verification",
          windowssystemcomponentverification: "Windows System Component Verification",
          oemwindowssystemcomponentverification: "OEM Windows System Component Verification",
          embeddedwindowssystemcomponentverification: "Embedded Windows System Component Verification",
          windowsrtverification: "Windows RT Verification",
          documentsigning: "Document Signing",
          lifetimesigning: "Lifetime Signing",
          ocspsigning: "OCSP Signing",
          privatekeyarchival: "Private Key Archival",
          directoryserviceemailreplication: "Directory Service Email Replication",
          keyrecoveryagent: "Key Recovery Agent",
          certificaterequestagent: "Certificate Request Agent",
          domaincontrollerauthentication: "Domain Controller Authentication",
          kerberosauthentication: "Kerberos Authentication",
          smartcardsubsystem: "Smart Card Subsystem"
        }
      },
      chain: {
        subjectDn: "Subject DN",
        issuerDn: "Issuer DN",
        serialNumber: "Serial Number",
        validity: "Validity",
        publicKey: "Public Key",
        sha256: "SHA-256 Fingerprint",
        keyUsages: "Key Usages",
        noneSpecified: "None specified",
        extensions: "Extensions",
        viewPem: "View PEM",
        hidePem: "Hide PEM",
        closeInspector: "Close Inspector",
        configured: "Configured"
      },
      crl: {
        expiredBadge: "Expired CRL",
        activeBadge: "Active CRL",
        revokedCount: "{{count}} Revoked Certificates",
        overviewTitle: "CRL Overview & Issuer",
        issuerDn: "Issuer DN",
        version: "Version",
        thisUpdate: "This Update",
        nextUpdate: "Next Update",
        sha256: "SHA-256 Fingerprint",
        revokedEntriesTitle: "Revoked Certificate Entries"
      },
      csr: {
        validSignature: "Self-Signature Valid",
        invalidSignature: "Self-Signature Invalid",
        subjectTitle: "Subject",
        fullDn: "Full DN",
        cryptoDetailsTitle: "Cryptographic Details",
        publicKey: "Public Key",
        signatureAlgorithm: "Signature Algorithm",
        signatureOid: "Signature OID",
        requestedPurposes: "Requested Purposes",
        sha256Fingerprint: "SHA-256 Fingerprint"
      },
      dashboard: {
        inDays: "in {{days}}d",
        agoDays: "{{days}}d ago",
        certCount_one: "{{count}} certificate",
        certCount_other: "{{count}} certificates",
        copyThumbprint: "Click to copy thumbprint",
        copiedThumbprint: "Copied thumbprint for {{name}}"
      }
    }
  },
  bs: {
    common: {
      error: "Greška",
      copiedToClipboard: "Kopirano u međuspremnik",
      copyToClipboard: "Kopiraj u međuspremnik",
      clear: "Očisti"
    },
    app: {
      winCertStore: {
        storeLocation: "Lokacija skladišta:",
        locations: {
          CurrentUser: "Trenutni korisnik",
          LocalMachine: "Lokalni računar"
        },
        purposes: {
          digitalsignature: "Digitalni potpis",
          certificatesign: "Potpisivanje certifikata",
          certificatesigning: "Potpisivanje certifikata",
          crlsign: "CRL potpis",
          crlsigning: "CRL potpisivanje",
          offlinecrlsigning: "Vanmrežno CRL potpisivanje",
          nonrepudiation: "Neporicanje",
          keyagreement: "Dogovaranje ključa",
          encipheronly: "Samo šifriranje",
          decipheronly: "Samo dešifriranje",
          keyencipherment: "Šifriranje ključa",
          dataencipherment: "Šifriranje podataka",
          codesigning: "Potpisivanje koda",
          serverauthentication: "Autentifikacija servera",
          clientauthentication: "Autentifikacija klijenta",
          emailprotection: "Zaštita e-pošte",
          secureemail: "Sigurna e-pošta",
          timestamping: "Vremenski žig",
          smartcardlogon: "Prijava pametnom karticom",
          ipsecendsystem: "IPsec krajnji sistem",
          ipsectunnel: "IPsec tunel",
          ipsecuser: "IPsec korisnik",
          anypurpose: "Bilo koja namjena",
          generalpurpose: "Opća namjena",
          generalpurposenotspecified: "Opća namjena / Nije navedeno",
          notspecified: "Nije navedeno",
          nonespecified: "Nije navedeno",
          microsofttrustlistsigning: "Potpisivanje Microsoft liste povjerenja",
          encryptingfilesystem: "Šifriranje datotečnog sistema (EFS)",
          windowshardwaredriververification: "Verifikacija upravljačkih programa hardvera",
          windowssystemcomponentverification: "Verifikacija komponenti Windows sistema",
          oemwindowssystemcomponentverification: "OEM verifikacija komponenti sistema",
          embeddedwindowssystemcomponentverification: "Ugrađena verifikacija komponenti sistema",
          windowsrtverification: "Windows RT verifikacija",
          documentsigning: "Potpisivanje dokumenata",
          lifetimesigning: "Trajno potpisivanje",
          ocspsigning: "OCSP potpisivanje",
          privatekeyarchival: "Arhiviranje privatnog ključa",
          directoryserviceemailreplication: "Replikacija e-pošte direktorija",
          keyrecoveryagent: "Agent za oporavak ključa",
          certificaterequestagent: "Agent za zahtjeve certifikata",
          domaincontrollerauthentication: "Autentifikacija kontrolera domene",
          kerberosauthentication: "Kerberos autentifikacija",
          smartcardsubsystem: "Podsistem pametnih kartica"
        }
      },
      chain: {
        subjectDn: "DN subjekta",
        issuerDn: "DN izdavača",
        serialNumber: "Serijski broj",
        validity: "Period važenja",
        publicKey: "Javni ključ",
        sha256: "SHA-256 otisak",
        keyUsages: "Upotrebe ključa",
        noneSpecified: "Nije navedeno",
        extensions: "Ekstenzije",
        viewPem: "Prikaži PEM",
        hidePem: "Sakrij PEM",
        closeInspector: "Zatvori inspektor",
        configured: "Konfigurisano"
      },
      crl: {
        expiredBadge: "Istekla CRL",
        activeBadge: "Aktivna CRL",
        revokedCount: "{{count}} Opozvanih certifikata",
        overviewTitle: "CRL Pregled i Izdavač",
        issuerDn: "DN izdavača",
        version: "Verzija",
        thisUpdate: "Ovo ažuriranje",
        nextUpdate: "Sljedeće ažuriranje",
        sha256: "SHA-256 otisak",
        revokedEntriesTitle: "Stavke opozvanih certifikata"
      },
      csr: {
        validSignature: "Vlastiti potpis ispravan",
        invalidSignature: "Vlastiti potpis neispravan",
        subjectTitle: "Subjekt",
        fullDn: "Puni DN",
        cryptoDetailsTitle: "Kriptografski detalji",
        publicKey: "Javni ključ",
        signatureAlgorithm: "Algoritam potpisa",
        signatureOid: "OID potpisa",
        requestedPurposes: "Zatražene svrhe",
        sha256Fingerprint: "SHA-256 otisak"
      },
      dashboard: {
        inDays: "za {{days}}d",
        agoDays: "prije {{days}}d",
        certCount_one: "{{count}} certifikat",
        certCount_other: "{{count}} certifikata",
        copyThumbprint: "Kliknite za kopiranje otiska",
        copiedThumbprint: "Kopiran otisak za {{name}}"
      }
    }
  },
  de: {
    common: {
      error: "Fehler",
      copiedToClipboard: "In die Zwischenablage kopiert",
      copyToClipboard: "In die Zwischenablage kopieren",
      clear: "Löschen"
    },
    app: {
      winCertStore: {
        storeLocation: "Speicherort:",
        locations: {
          CurrentUser: "Aktueller Benutzer",
          LocalMachine: "Lokaler Computer"
        },
        purposes: {
          digitalsignature: "Digitale Signatur",
          certificatesign: "Zertifikatsignatur",
          certificatesigning: "Zertifikatsignatur",
          crlsign: "CRL-Signatur",
          crlsigning: "CRL-Signatur",
          offlinecrlsigning: "Offline-CRL-Signatur",
          nonrepudiation: "Nichtabstreitbarkeit",
          keyagreement: "Schlüsselvereinbarung",
          encipheronly: "Nur Verschlüsselung",
          decipheronly: "Nur Entschlüsselung",
          keyencipherment: "Schlüsselverschlüsselung",
          dataencipherment: "Datenverschlüsselung",
          codesigning: "Code-Signatur",
          serverauthentication: "Serverauthentifizierung",
          clientauthentication: "Clientauthentifizierung",
          emailprotection: "E-Mail-Schutz",
          secureemail: "Sichere E-Mail",
          timestamping: "Zeitstempel",
          smartcardlogon: "Smartcard-Anmeldung",
          ipsecendsystem: "IPsec-Endsystem",
          ipsectunnel: "IPsec-Tunnel",
          ipsecuser: "IPsec-Benutzer",
          anypurpose: "Jeder Zweck",
          generalpurpose: "Allgemeiner Zweck",
          generalpurposenotspecified: "Allgemeiner Zweck / Nicht angegeben",
          notspecified: "Nicht angegeben",
          nonespecified: "Nicht angegeben",
          microsofttrustlistsigning: "Signieren von Microsoft-Vertrauenslisten",
          encryptingfilesystem: "Verschlüsselndes Dateisystem (EFS)",
          windowshardwaredriververification: "Verifizierung von Windows-Hardwaretreibern",
          windowssystemcomponentverification: "Verifizierung von Windows-Systemkomponenten",
          oemwindowssystemcomponentverification: "OEM-Windows-Systemkomponenten-Verifizierung",
          embeddedwindowssystemcomponentverification: "Embedded-Windows-Systemkomponenten-Verifizierung",
          windowsrtverification: "Windows RT-Verifizierung",
          documentsigning: "Dokumentsignatur",
          lifetimesigning: "Lebenszeit-Signatur",
          ocspsigning: "OCSP-Signatur",
          privatekeyarchival: "Archivierung privater Schlüssel",
          directoryserviceemailreplication: "Verzeichnisdienst-E-Mail-Replikation",
          keyrecoveryagent: "Schlüsselwiederherstellungs-Agent",
          certificaterequestagent: "Zertifikatanforderungs-Agent",
          domaincontrollerauthentication: "Domänencontroller-Authentifizierung",
          kerberosauthentication: "Kerberos-Authentifizierung",
          smartcardsubsystem: "Smartcard-Subsystem"
        }
      },
      chain: {
        subjectDn: "Subjekt-DN",
        issuerDn: "Aussteller-DN",
        serialNumber: "Seriennummer",
        validity: "Gültigkeit",
        publicKey: "Öffentlicher Schlüssel",
        sha256: "SHA-256-Fingerabdruck",
        keyUsages: "Schlüsselverwendungen",
        noneSpecified: "Nicht angegeben",
        extensions: "Erweiterungen",
        viewPem: "PEM anzeigen",
        hidePem: "PEM verbergen",
        closeInspector: "Inspektor schließen",
        configured: "Konfiguriert"
      },
      crl: {
        expiredBadge: "Abgelaufene CRL",
        activeBadge: "Aktive CRL",
        revokedCount: "{{count}} gesperrte Zertifikate",
        overviewTitle: "CRL-Übersicht & Aussteller",
        issuerDn: "Aussteller-DN",
        version: "Version",
        thisUpdate: "Dieses Update",
        nextUpdate: "Nächstes Update",
        sha256: "SHA-256-Fingerabdruck",
        revokedEntriesTitle: "Gesperrte Zertifikatseinträge"
      },
      csr: {
        validSignature: "Selbstsignatur gültig",
        invalidSignature: "Selbstsignatur ungültig",
        subjectTitle: "Subjekt",
        fullDn: "Vollständiger DN",
        cryptoDetailsTitle: "Kryptografische Details",
        publicKey: "Öffentlicher Schlüssel",
        signatureAlgorithm: "Signaturalgorithmus",
        signatureOid: "Signatur-OID",
        requestedPurposes: "Angeforderte Zwecke",
        sha256Fingerprint: "SHA-256-Fingerabdruck"
      },
      dashboard: {
        inDays: "in {{days}} T.",
        agoDays: "vor {{days}} T.",
        certCount_one: "{{count}} Zertifikat",
        certCount_other: "{{count}} Zertifikate",
        copyThumbprint: "Klicken zum Kopieren des Fingerabdrucks",
        copiedThumbprint: "Fingerabdruck für {{name}} kopiert"
      }
    }
  },
  pl: {
    common: {
      error: "Błąd",
      copiedToClipboard: "Skopiowano do schowka",
      copyToClipboard: "Kopiuj do schowka",
      clear: "Wyczyść"
    },
    app: {
      winCertStore: {
        storeLocation: "Lokalizacja magazynu:",
        locations: {
          CurrentUser: "Bieżący użytkownik",
          LocalMachine: "Komputer lokalny"
        },
        purposes: {
          digitalsignature: "Podpis cyfrowy",
          certificatesign: "Podpis certyfikatu",
          certificatesigning: "Podpisywanie certyfikatów",
          crlsign: "Podpis CRL",
          crlsigning: "Podpisywanie CRL",
          offlinecrlsigning: "Podpisywanie CRL offline",
          nonrepudiation: "Niezaprzeczalność",
          keyagreement: "Uzgodnienie klucza",
          encipheronly: "Tylko szyfrowanie",
          decipheronly: "Tylko deszyfrowanie",
          keyencipherment: "Szyfrowanie klucza",
          dataencipherment: "Szyfrowanie danych",
          codesigning: "Podpisywanie kodu",
          serverauthentication: "Uwierzytelnianie serwera",
          clientauthentication: "Uwierzytelnianie klienta",
          emailprotection: "Ochrona e-mail",
          secureemail: "Bezpieczny e-mail",
          timestamping: "Znacznik czasu",
          smartcardlogon: "Logowanie kartą inteligentną",
          ipsecendsystem: "System końcowy IPsec",
          ipsectunnel: "Tunel IPsec",
          ipsecuser: "Użytkownik IPsec",
          anypurpose: "Dowolny cel",
          generalpurpose: "Cel ogólny",
          generalpurposenotspecified: "Cel ogólny / Nie określono",
          notspecified: "Nie określono",
          nonespecified: "Nie określono",
          microsofttrustlistsigning: "Podpisywanie listy zaufania Microsoft",
          encryptingfilesystem: "System szyfrowania plików (EFS)",
          windowshardwaredriververification: "Weryfikacja sterowników sprzętowych Windows",
          windowssystemcomponentverification: "Weryfikacja składników systemu Windows",
          oemwindowssystemcomponentverification: "Weryfikacja składników systemu OEM Windows",
          embeddedwindowssystemcomponentverification: "Weryfikacja składników wbudowanego systemu Windows",
          windowsrtverification: "Weryfikacja systemu Windows RT",
          documentsigning: "Podpisywanie dokumentów",
          lifetimesigning: "Podpisywanie dożywotnie",
          ocspsigning: "Podpisywanie OCSP",
          privatekeyarchival: "Archiwizacja klucza prywatnego",
          directoryserviceemailreplication: "Replikacja poczty e-mail usługi katalogowej",
          keyrecoveryagent: "Agent odzyskiwania klucza",
          certificaterequestagent: "Agent żądań certyfikatów",
          domaincontrollerauthentication: "Uwierzytelnianie kontrolera domeny",
          kerberosauthentication: "Uwierzytelnianie Kerberos",
          smartcardsubsystem: "Podsystem kart inteligentnych"
        }
      },
      chain: {
        subjectDn: "DN podmiotu",
        issuerDn: "DN wystawcy",
        serialNumber: "Numer seryjny",
        validity: "Ważność",
        publicKey: "Klucz publiczny",
        sha256: "Odcisk palca SHA-256",
        keyUsages: "Użycie klucza",
        noneSpecified: "Nie określono",
        extensions: "Rozszerzenia",
        viewPem: "Pokaż PEM",
        hidePem: "Ukryj PEM",
        closeInspector: "Zamknij inspektor",
        configured: "Skonfigurowano"
      },
      crl: {
        expiredBadge: "Wygasła lista CRL",
        activeBadge: "Aktywna lista CRL",
        revokedCount: "{{count}} odwołanych certyfikatów",
        overviewTitle: "Przegląd CRL i wystawca",
        issuerDn: "DN wystawcy",
        version: "Wersja",
        thisUpdate: "Ta aktualizacja",
        nextUpdate: "Następna aktualizacja",
        sha256: "Odcisk palca SHA-256",
        revokedEntriesTitle: "Pozycje odwołanych certyfikatów"
      },
      csr: {
        validSignature: "Własny podpis poprawny",
        invalidSignature: "Własny podpis niepoprawny",
        subjectTitle: "Podmiot",
        fullDn: "Pełny DN",
        cryptoDetailsTitle: "Szczegóły kryptograficzne",
        publicKey: "Klucz publiczny",
        signatureAlgorithm: "Algorytm podpisu",
        signatureOid: "OID podpisu",
        requestedPurposes: "Żądane cele",
        sha256Fingerprint: "Odcisk palca SHA-256"
      },
      dashboard: {
        inDays: "za {{days}} dni",
        agoDays: "{{days}} dni temu",
        certCount_one: "{{count}} certyfikat",
        certCount_other: "{{count}} certyfikatów",
        copyThumbprint: "Kliknij, aby skopiować odcisk",
        copiedThumbprint: "Skopiowano odcisk dla {{name}}"
      }
    }
  },
  'sr-Cyrl': {
    common: {
      error: "Грешка",
      copiedToClipboard: "Копирано у међуспремник",
      copyToClipboard: "Копирај у међуспремник",
      clear: "Очисти"
    },
    app: {
      winCertStore: {
        storeLocation: "Локација складишта:",
        locations: {
          CurrentUser: "Тренутни корисник",
          LocalMachine: "Локални рачунар"
        },
        purposes: {
          digitalsignature: "Дигитални потпис",
          certificatesign: "Потписивање сертификата",
          certificatesigning: "Потписивање сертификата",
          crlsign: "ЦРЛ потпис",
          crlsigning: "ЦРЛ потписивање",
          offlinecrlsigning: "Ванмрежно ЦРЛ потписивање",
          nonrepudiation: "Непорецивост",
          keyagreement: "Договарање кључа",
          encipheronly: "Само шифровање",
          decipheronly: "Само дешифровање",
          keyencipherment: "Шифровање кључа",
          dataencipherment: "Шифровање података",
          codesigning: "Потписивање кода",
          serverauthentication: "Аутентификација сервера",
          clientauthentication: "Аутентификација клијента",
          emailprotection: "Заштита е-поште",
          secureemail: "Сигурна е-пошта",
          timestamping: "Временски жиг",
          smartcardlogon: "Пријава паметном картицом",
          ipsecendsystem: "ИПсец крајњи систем",
          ipsectunnel: "ИПсец тунел",
          ipsecuser: "ИПсец корисник",
          anypurpose: "Било која намена",
          generalpurpose: "Општа намена",
          generalpurposenotspecified: "Општа намена / Није наведено",
          notspecified: "Није наведено",
          nonespecified: "Није наведено",
          microsofttrustlistsigning: "Потписивање Мајкрософт листе поверења",
          encryptingfilesystem: "Шифровање система датотека (ЕФС)",
          windowshardwaredriververification: "Верификација драјвера хардвера",
          windowssystemcomponentverification: "Верификација компоненти Windows система",
          oemwindowssystemcomponentverification: "ОЕМ верификација компоненти система",
          embeddedwindowssystemcomponentverification: "Уграђена верификација компоненти система",
          windowsrtverification: "Windows RT верификација",
          documentsigning: "Потписивање докумената",
          lifetimesigning: "Трајно потписивање",
          ocspsigning: "ОЦСП потписивање",
          privatekeyarchival: "Архивирање приватног кључа",
          directoryserviceemailreplication: "Репликација е-поште директоријума",
          keyrecoveryagent: "Агент за опоравак кључа",
          certificaterequestagent: "Агент за захтеве сертификата",
          domaincontrollerauthentication: "Аутентификација контролера домена",
          kerberosauthentication: "Керберос аутентификација",
          smartcardsubsystem: "Подсистем паметних картица"
        }
      },
      chain: {
        subjectDn: "ДН субјекта",
        issuerDn: "ДН издавача",
        serialNumber: "Серијски број",
        validity: "Период важења",
        publicKey: "Јавни кључ",
        sha256: "SHA-256 отисак",
        keyUsages: "Употребе кључа",
        noneSpecified: "Није наведено",
        extensions: "Екстензије",
        viewPem: "Прикажи ПЕМ",
        hidePem: "Сакриј ПЕМ",
        closeInspector: "Затвори инспектор",
        configured: "Конфигурисано"
      },
      crl: {
        expiredBadge: "Истекла ЦРЛ",
        activeBadge: "Активна ЦРЛ",
        revokedCount: "{{count}} опозваних сертификата",
        overviewTitle: "ЦРЛ Преглед и Издавач",
        issuerDn: "ДН издавача",
        version: "Верзија",
        thisUpdate: "Ово ажурирање",
        nextUpdate: "Следеће ажурирање",
        sha256: "SHA-256 отисак",
        revokedEntriesTitle: "Ставке опозваних сертификата"
      },
      csr: {
        validSignature: "Сопствени потпис исправан",
        invalidSignature: "Сопствени потпис неисправан",
        subjectTitle: "Субјект",
        fullDn: "Пуни ДН",
        cryptoDetailsTitle: "Криптографски детаљи",
        publicKey: "Јавни кључ",
        signatureAlgorithm: "Алгоритам потписа",
        signatureOid: "ОИД потписа",
        requestedPurposes: "Затражене сврхе",
        sha256Fingerprint: "SHA-256 отисак"
      },
      dashboard: {
        inDays: "за {{days}}д",
        agoDays: "пре {{days}}д",
        certCount_one: "{{count}} сертификат",
        certCount_other: "{{count}} сертификата",
        copyThumbprint: "Кликните за копирање отиска",
        copiedThumbprint: "Копиран отисак за {{name}}"
      }
    }
  },
  id: {
    common: {
      error: "Kesalahan",
      copiedToClipboard: "Disalin ke papan klip",
      copyToClipboard: "Salin ke papan klip",
      clear: "Hapus"
    },
    app: {
      winCertStore: {
        storeLocation: "Lokasi Penyimpanan:",
        locations: {
          CurrentUser: "Pengguna Saat Ini",
          LocalMachine: "Komputer Lokal"
        },
        purposes: {
          digitalsignature: "Tanda Tangan Digital",
          certificatesign: "Tanda Tangan Sertifikat",
          certificatesigning: "Penandatanganan Sertifikat",
          crlsign: "Tanda Tangan CRL",
          crlsigning: "Penandatanganan CRL",
          offlinecrlsigning: "Penandatanganan CRL Luar Jaringan",
          nonrepudiation: "Nonsangkal (Non-Repudiation)",
          keyagreement: "Persetujuan Kunci",
          encipheronly: "Hanya Enkripsi",
          decipheronly: "Hanya Dekripsi",
          keyencipherment: "Enkripsi Kunci",
          dataencipherment: "Enkripsi Data",
          codesigning: "Penandatanganan Kode",
          serverauthentication: "Otentikasi Server",
          clientauthentication: "Otentikasi Klien",
          emailprotection: "Perlindungan Email",
          secureemail: "Email Aman",
          timestamping: "Stempel Waktu",
          smartcardlogon: "Logon Kartu Pintar",
          ipsecendsystem: "Sistem Akhir IPsec",
          ipsectunnel: "Terowongan IPsec",
          ipsecuser: "Pengguna IPsec",
          anypurpose: "Tujuan Apapun",
          generalpurpose: "Tujuan Umum",
          generalpurposenotspecified: "Tujuan Umum / Tidak Ditentukan",
          notspecified: "Tidak Ditentukan",
          nonespecified: "Tidak Ditentukan",
          microsofttrustlistsigning: "Penandatanganan Daftar Kepercayaan Microsoft",
          encryptingfilesystem: "Sistem Berkas Terenkripsi (EFS)",
          windowshardwaredriververification: "Verifikasi Driver Perangkat Keras Windows",
          windowssystemcomponentverification: "Verifikasi Komponen Sistem Windows",
          oemwindowssystemcomponentverification: "Verifikasi Komponen Sistem Windows OEM",
          embeddedwindowssystemcomponentverification: "Verifikasi Komponen Sistem Windows Tertanam",
          windowsrtverification: "Verifikasi Windows RT",
          documentsigning: "Penandatanganan Dokumen",
          lifetimesigning: "Penandatanganan Seumur Hidup",
          ocspsigning: "Penandatanganan OCSP",
          privatekeyarchival: "Pengarsipan Kunci Privat",
          directoryserviceemailreplication: "Replikasi Email Layanan Direktori",
          keyrecoveryagent: "Agen Pemulihan Kunci",
          certificaterequestagent: "Agen Permintaan Sertifikat",
          domaincontrollerauthentication: "Otentikasi Pengontrol Domain",
          kerberosauthentication: "Otentikasi Kerberos",
          smartcardsubsystem: "Subsistem Kartu Pintar"
        }
      },
      chain: {
        subjectDn: "DN Subjek",
        issuerDn: "DN Penerbit",
        serialNumber: "Nomor Seri",
        validity: "Masa Berlaku",
        publicKey: "Kunci Publik",
        sha256: "Sidik Jari SHA-256",
        keyUsages: "Penggunaan Kunci",
        noneSpecified: "Tidak ditentukan",
        extensions: "Ekstensi",
        viewPem: "Lihat PEM",
        hidePem: "Sembunyikan PEM",
        closeInspector: "Tutup Inspektur",
        configured: "Dikonfigurasi"
      },
      crl: {
        expiredBadge: "CRL Kedaluwarsa",
        activeBadge: "CRL Aktif",
        revokedCount: "{{count}} Sertifikat Dicabut",
        overviewTitle: "Ikhtisar CRL & Penerbit",
        issuerDn: "DN Penerbit",
        version: "Versi",
        thisUpdate: "Pembaruan Ini",
        nextUpdate: "Pembaruan Berikutnya",
        sha256: "Sidik Jari SHA-256",
        revokedEntriesTitle: "Entri Sertifikat Dicabut"
      },
      csr: {
        validSignature: "Tanda Tangan Mandiri Valid",
        invalidSignature: "Tanda Tangan Mandiri Tidak Valid",
        subjectTitle: "Subjek",
        fullDn: "DN Lengkap",
        cryptoDetailsTitle: "Rincian Kriptografi",
        publicKey: "Kunci Publik",
        signatureAlgorithm: "Algoritma Tanda Tangan",
        signatureOid: "OID Tanda Tangan",
        requestedPurposes: "Tujuan yang Diminta",
        sha256Fingerprint: "Sidik Jari SHA-256"
      },
      dashboard: {
        inDays: "dalam {{days}}h",
        agoDays: "{{days}}h yang lalu",
        certCount_one: "{{count}} sertifikat",
        certCount_other: "{{count}} sertifikat",
        copyThumbprint: "Klik untuk menyalin sidik jari",
        copiedThumbprint: "Sidik jari disalin untuk {{name}}"
      }
    }
  }
};

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      if (!target[key]) Object.assign(target, { [key]: {} });
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

for (const loc of locales) {
  const filePath = path.join(localesDir, loc, 'translation.json');
  if (!fs.existsSync(filePath)) continue;
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const patch = translations[loc];
  if (patch) {
    deepMerge(existing, patch);
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
    console.log(`Successfully merged translations for: ${loc}`);
  }
}
