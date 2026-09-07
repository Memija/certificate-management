const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');

const translations = {
  en: {
    stats: {
      total: "Total",
      valid: "Valid",
      expired: "Expired",
      expiringSoon: "Expiring Soon"
    },
    filters: {
      sortBy: "Sort by:",
      sortDefault: "Default Store Order",
      sortExpiry: "Expiry Date (Soonest first)",
      sortName: "Subject Name (Alphabetical)",
      timelineAll: "All Time",
      timeline30Days: "Expiring in < 30 days",
      timelineExpired: "Expired Only",
      searchPlaceholder: "Filter by subject, issuer, or thumbprint…",
      noMatch: "No certificates match your filter."
    }
  },
  bs: {
    stats: {
      total: "Ukupno",
      valid: "Važeće",
      expired: "Isteklo",
      expiringSoon: "Uskoro ističe"
    },
    filters: {
      sortBy: "Poredaj po:",
      sortDefault: "Zadani redoslijed",
      sortExpiry: "Datum isteka (Najprije najbliži)",
      sortName: "Naziv subjekta (Abecedno)",
      timelineAll: "Sve",
      timeline30Days: "Ističe za < 30 dana",
      timelineExpired: "Samo istekle",
      searchPlaceholder: "Filtriraj po subjektu, izdavaču ili otisku…",
      noMatch: "Nijedan certifikat ne odgovara vašem filteru."
    }
  },
  de: {
    stats: {
      total: "Gesamt",
      valid: "Gültig",
      expired: "Abgelaufen",
      expiringSoon: "Läuft bald ab"
    },
    filters: {
      sortBy: "Sortieren nach:",
      sortDefault: "Standardreihenfolge",
      sortExpiry: "Ablaufdatum (Bald ablaufende zuerst)",
      sortName: "Antragstellername (Alphabetisch)",
      timelineAll: "Alle",
      timeline30Days: "Läuft in < 30 Tagen ab",
      timelineExpired: "Nur abgelaufene",
      searchPlaceholder: "Nach Antragsteller, Aussteller oder Fingerabdruck filtern…",
      noMatch: "Keine Zertifikate entsprechen Ihrem Filter."
    }
  },
  id: {
    stats: {
      total: "Total",
      valid: "Valid",
      expired: "Kedaluwarsa",
      expiringSoon: "Segera Kedaluwarsa"
    },
    filters: {
      sortBy: "Urutkan berdasarkan:",
      sortDefault: "Urutan Toko Default",
      sortExpiry: "Tanggal Kedaluwarsa (Paling cepat)",
      sortName: "Nama Subjek (Alfabetis)",
      timelineAll: "Semua Waktu",
      timeline30Days: "Kedaluwarsa dalam < 30 hari",
      timelineExpired: "Hanya Kedaluwarsa",
      searchPlaceholder: "Saring berdasarkan subjek, penerbit, atau sidik jari…",
      noMatch: "Tidak ada sertifikat yang cocok dengan filter Anda."
    }
  },
  pl: {
    stats: {
      total: "Razem",
      valid: "Ważne",
      expired: "Wygasłe",
      expiringSoon: "Wkrótce wygasa"
    },
    filters: {
      sortBy: "Sortuj według:",
      sortDefault: "Domyślna kolejność",
      sortExpiry: "Data wygaśnięcia (Najwcześniejsze na początku)",
      sortName: "Nazwa podmiotu (Alfabetycznie)",
      timelineAll: "Wszystko",
      timeline30Days: "Wygasa za < 30 dni",
      timelineExpired: "Tylko wygasłe",
      searchPlaceholder: "Filtruj według podmiotu, wystawcy lub odcisku palca…",
      noMatch: "Brak certyfikatów pasujących do filtra."
    }
  },
  'sr-Cyrl': {
    stats: {
      total: "Укупно",
      valid: "Важеће",
      expired: "Истекло",
      expiringSoon: "Ускоро истиче"
    },
    filters: {
      sortBy: "Сортирај по:",
      sortDefault: "Подразумевани редослед",
      sortExpiry: "Датум истека (Најпре најближи)",
      sortName: "Назив субјекта (Абецедно)",
      timelineAll: "Све",
      timeline30Days: "Истиче за < 30 дана",
      timelineExpired: "Само истекле",
      searchPlaceholder: "Филтрирај по субјекту, издавачу или отиску…",
      noMatch: "Ниједан сертификат не одговара вашем филтеру."
    }
  }
};

for (const [locale, dataExt] of Object.entries(translations)) {
  const transPath = path.join(localesDir, locale, 'translation.json');
  if (fs.existsSync(transPath)) {
    const data = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    
    if (!data.app.winCertStore) data.app.winCertStore = {};
    
    data.app.winCertStore.stats = dataExt.stats;
    data.app.winCertStore.filters = dataExt.filters;
    
    fs.writeFileSync(transPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated stats and filters strings for ${locale}`);
  }
}
