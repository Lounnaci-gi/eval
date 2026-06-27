import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import frTranslation from '../locales/fr.json';
import arTranslation from '../locales/ar.json';

const resources = {
  fr: { translation: frTranslation },
  ar: { translation: arTranslation },
};

// Determine default language
let defaultLng = 'fr';

if (typeof window !== 'undefined') {
  // 1. Check URL query param ?lang=
  const params = new URLSearchParams(window.location.search);
  const queryLang = params.get('lang');
  if (queryLang === 'fr' || queryLang === 'ar') {
    defaultLng = queryLang;
    localStorage.setItem('i18nextLng', queryLang);
  } else {
    // 2. Check localStorage
    const saved = localStorage.getItem('i18nextLng');
    if (saved === 'fr' || saved === 'ar') {
      defaultLng = saved;
    } else {
      // 3. Check browser language
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'ar') {
        defaultLng = 'ar';
      }
    }
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLng,
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Avoid Next.js SSR hydration/suspense mismatches
    },
  });

export default i18n;
