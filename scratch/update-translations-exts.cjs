const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const exts = {
  'KeyUsage': { en: 'Key Usage', bs: 'Upotreba ključa', de: 'Schlüsselverwendung', id: 'Penggunaan Kunci', pl: 'Użycie klucza', 'sr-Cyrl': 'Употреба кључа' },
  'BasicConstraints': { en: 'Basic Constraints', bs: 'Osnovna ograničenja', de: 'Basisbeschränkungen', id: 'Batasan Dasar', pl: 'Podstawowe ograniczenia', 'sr-Cyrl': 'Основна ограничења' },
  'EnhancedKeyUsage': { en: 'Enhanced Key Usage', bs: 'Poboljšana upotreba ključa', de: 'Erweiterte Schlüsselverwendung', id: 'Penggunaan Kunci yang Ditingkatkan', pl: 'Rozszerzone użycie klucza', 'sr-Cyrl': 'Побољшана употреба кључа' },
  'CertificatePolicies': { en: 'Certificate Policies', bs: 'Politike certifikata', de: 'Zertifikatsrichtlinien', id: 'Kebijakan Sertifikat', pl: 'Zasady certyfikatów', 'sr-Cyrl': 'Политике сертификата' },
  'AuthorityKeyIdentifier': { en: 'Authority Key Identifier', bs: 'Identifikator ključa autoriteta', de: 'Schlüsselkennung der Zertifizierungsstelle', id: 'Pengidentifikasi Kunci Otoritas', pl: 'Identyfikator klucza urzędu', 'sr-Cyrl': 'Идентификатор кључа ауторитета' },
  'SubjectKeyIdentifier': { en: 'Subject Key Identifier', bs: 'Identifikator ključa subjekta', de: 'Schlüsselkennung des Antragstellers', id: 'Pengidentifikasi Kunci Subjek', pl: 'Identyfikator klucza podmiotu', 'sr-Cyrl': 'Идентификатор кључа субјекта' },
  'CRLDistributionPoints': { en: 'CRL Distribution Points', bs: 'Tačke distribucije CRL-a', de: 'CRL-Verteilungspunkte', id: 'Titik Distribusi CRL', pl: 'Punkty dystrybucji CRL', 'sr-Cyrl': 'Тачке дистрибуције ЦРЛ-а' },
  'AuthorityInformationAccess': { en: 'Authority Information Access', bs: 'Pristup informacijama autoriteta', de: 'Zugriff auf Informationen der Zertifizierungsstelle', id: 'Akses Informasi Otoritas', pl: 'Dostęp do informacji o urzędzie', 'sr-Cyrl': 'Приступ информацијама ауторитета' },
  'SubjectAlternativeName': { en: 'Subject Alternative Name', bs: 'Alternativno ime subjekta', de: 'Alternativer Name des Antragstellers', id: 'Nama Alternatif Subjek', pl: 'Alternatywna nazwa podmiotu', 'sr-Cyrl': 'Алтернативно име субјекта' }
};

for (const [locale] of Object.entries(exts['KeyUsage'])) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    if (!data.app.winCertStore.extensions) {
      data.app.winCertStore.extensions = {};
    }
    for (const [extKey, translations] of Object.entries(exts)) {
      data.app.winCertStore.extensions[extKey] = translations[locale];
    }
    fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated extensions for ${locale}`);
  }
}
