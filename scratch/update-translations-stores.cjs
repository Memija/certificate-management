const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const translations = {
  en: {
    refresh: "Refresh",
    loadingStore: "Loading {{storeLabel}}...",
    stores: {
      Root: { label: "Trusted Root CAs", desc: "Self-signed root certificate authorities" },
      CA: { label: "Intermediate CAs", desc: "Intermediate certificate authorities" },
      My: { label: "Personal", desc: "Your personal certificates with private keys" },
      TrustedPublisher: { label: "Trusted Publishers", desc: "Trusted code-signing publishers" },
      Disallowed: { label: "Untrusted", desc: "Explicitly distrusted / revoked certificates" }
    }
  },
  bs: {
    refresh: "Osvježi",
    loadingStore: "Učitavam {{storeLabel}}...",
    stores: {
      Root: { label: "Pouzdani korijenski CA", desc: "Samopotpisani korijenski certifikacijski autoriteti" },
      CA: { label: "Srednji CA", desc: "Srednji certifikacijski autoriteti" },
      My: { label: "Lično", desc: "Vaši lični certifikati s privatnim ključevima" },
      TrustedPublisher: { label: "Pouzdani izdavači", desc: "Pouzdani izdavači za potpisivanje koda" },
      Disallowed: { label: "Nepouzdano", desc: "Eksplicitno nepouzdani / opozvani certifikati" }
    }
  },
  de: {
    refresh: "Aktualisieren",
    loadingStore: "Lade {{storeLabel}}...",
    stores: {
      Root: { label: "Vertrauenswürdige Stamm-CAs", desc: "Selbstsignierte Stammzertifizierungsstellen" },
      CA: { label: "Zwischen-CAs", desc: "Zwischenzertifizierungsstellen" },
      My: { label: "Persönlich", desc: "Ihre persönlichen Zertifikate mit privaten Schlüsseln" },
      TrustedPublisher: { label: "Vertrauenswürdige Herausgeber", desc: "Vertrauenswürdige Code-Signing-Herausgeber" },
      Disallowed: { label: "Nicht vertrauenswürdig", desc: "Explizit nicht vertrauenswürdige / widerrufene Zertifikate" }
    }
  },
  id: {
    refresh: "Segarkan",
    loadingStore: "Memuat {{storeLabel}}...",
    stores: {
      Root: { label: "CA Akar Tepercaya", desc: "Otoritas sertifikat akar yang ditandatangani sendiri" },
      CA: { label: "CA Menengah", desc: "Otoritas sertifikat menengah" },
      My: { label: "Pribadi", desc: "Sertifikat pribadi Anda dengan kunci privat" },
      TrustedPublisher: { label: "Penerbit Tepercaya", desc: "Penerbit penandatanganan kode yang tepercaya" },
      Disallowed: { label: "Tidak Dipercaya", desc: "Sertifikat yang secara eksplisit tidak dipercaya / dicabut" }
    }
  },
  pl: {
    refresh: "Odśwież",
    loadingStore: "Ładowanie {{storeLabel}}...",
    stores: {
      Root: { label: "Zaufane główne urzędy certyfikacji", desc: "Urzędy certyfikacji z certyfikatem z podpisem własnym" },
      CA: { label: "Pośrednie urzędy certyfikacji", desc: "Pośrednie urzędy certyfikacji" },
      My: { label: "Osobiste", desc: "Twoje osobiste certyfikaty z kluczami prywatnymi" },
      TrustedPublisher: { label: "Zaufani wydawcy", desc: "Zaufani wydawcy podpisujący kod" },
      Disallowed: { label: "Niezaufane", desc: "Wyraźnie niezaufane / unieważnione certyfikaty" }
    }
  },
  'sr-Cyrl': {
    refresh: "Освежи",
    loadingStore: "Учитавам {{storeLabel}}...",
    stores: {
      Root: { label: "Поуздани коренски ЦА", desc: "Самопотписани коренски сертификациони ауторитети" },
      CA: { label: "Средњи ЦА", desc: "Средњи сертификациони ауторитети" },
      My: { label: "Лично", desc: "Ваши лични сертификати са приватним кључевима" },
      TrustedPublisher: { label: "Поуздани издавачи", desc: "Поуздани издавачи за потписивање кода" },
      Disallowed: { label: "Непоуздано", desc: "Експлицитно непоуздани / повучени сертификати" }
    }
  }
};

for (const [locale, translationsForLocale] of Object.entries(translations)) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    
    if (!data.app) data.app = {};
    if (!data.app.winCertStore) data.app.winCertStore = {};
    
    data.app.winCertStore.refresh = translationsForLocale.refresh;
    data.app.winCertStore.loadingStore = translationsForLocale.loadingStore;
    data.app.winCertStore.stores = translationsForLocale.stores;
    
    fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated winCertStore strings for ${locale}`);
  }
}
