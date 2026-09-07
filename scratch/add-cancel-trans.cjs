const fs = require('fs');
const path = require('path');

const localesDir = path.join('c:/Users/Anel_/Documents/antigravity/certificate-management/src/locales');

const translations = {
  en: {
    userCanceled: "You cancelled the Administrator prompt. We cannot access the secure data without it. Please try again if you wish to proceed."
  },
  de: {
    userCanceled: "Sie haben die Administrator-Eingabeaufforderung abgebrochen. Ohne diese können wir nicht auf die sicheren Daten zugreifen. Bitte versuchen Sie es erneut, wenn Sie fortfahren möchten."
  },
  bs: {
    userCanceled: "Otkazali ste upit za Administratora. Ne možemo pristupiti sigurnim podacima bez toga. Molimo pokušajte ponovo ako želite nastaviti."
  },
  pl: {
    userCanceled: "Anulowałeś monit o uprawnienia administratora. Bez nich nie możemy uzyskać dostępu do bezpiecznych danych. Spróbuj ponownie, jeśli chcesz kontynuować."
  },
  id: {
    userCanceled: "Anda membatalkan prompt Administrator. Kami tidak dapat mengakses data aman tanpanya. Silakan coba lagi jika Anda ingin melanjutkan."
  },
  "sr-Cyrl": {
    userCanceled: "Отказaли сте упит за Администратора. Не можемо приступити сигурним подацима без тога. Молимо покушајте поново ако желите да наставите."
  }
};

Object.entries(translations).forEach(([lang, data]) => {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    let rawStr = fs.readFileSync(filePath, 'utf8');
    const fileData = JSON.parse(rawStr);
    
    fileData.app.adminAccess.userCanceled = data.userCanceled;
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
    console.log(`Updated ${lang}/translation.json`);
  }
});
