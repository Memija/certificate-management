const fs = require('fs');

const translations = {
  en: {
    p1: 'Load any certificate file or keystore to inspect its contents.',
    p2: '100% client-side, nothing leaves your machine.'
  },
  bs: {
    p1: 'Učitajte bilo koju datoteku certifikata ili keystore da pregledate njen sadržaj.',
    p2: '100% na strani klijenta, ništa ne napušta vaš računar.'
  },
  de: {
    p1: 'Laden Sie eine beliebige Zertifikatsdatei oder einen Keystore, um deren Inhalt zu überprüfen.',
    p2: '100 % clientseitig, nichts verlässt Ihren Computer.'
  },
  id: {
    p1: 'Muat berkas sertifikat atau keystore apa pun untuk memeriksa isinya.',
    p2: '100% sisi klien, tidak ada yang keluar dari komputer Anda.'
  },
  pl: {
    p1: 'Załaduj dowolny plik certyfikatu lub magazyn kluczy (keystore), aby sprawdzić jego zawartość.',
    p2: '100% po stronie klienta, nic nie opuszcza Twojego komputera.'
  },
  'sr-Cyrl': {
    p1: 'Учитајте било коју датотеку сертификата или keystore да бисте прегледали њен садржај.',
    p2: '100% на страни клијента, ништа не напушта ваш рачунар.'
  }
};

for (const [lang, t] of Object.entries(translations)) {
  const filePath = `src/locales/${lang}/translation.json`;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!data.app) data.app = {};
  if (!data.app.trustStore) data.app.trustStore = {};
  if (!data.app.trustStore.inspector) data.app.trustStore.inspector = {};

  data.app.trustStore.inspector.subtitle = {
    p1: t.p1,
    p2: t.p2
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Updated ${filePath}`);
}
