"use client";

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../lib/i18n';


export type Direction = 'ltr' | 'rtl';

export function useDirection() {
  const { i18n } = useTranslation();
  const [direction, setDirection] = useState<Direction>('ltr');

  const currentLang = i18n.language || 'fr';

  useEffect(() => {
    const isArabic = currentLang.startsWith('ar');
    const dir: Direction = isArabic ? 'rtl' : 'ltr';
    setDirection(dir);

    // Apply direction and lang attributes to the <html> tag
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('dir', dir);
      root.setAttribute('lang', isArabic ? 'ar' : 'fr');

      // Add/remove .rtl class to <html> for tailored layout tweaks in CSS
      if (isArabic) {
        root.classList.add('rtl');
      } else {
        root.classList.remove('rtl');
      }
    }
  }, [currentLang]);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', lang);
      
      // Update URL query parameter without page reload
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState({}, '', url.toString());
    }
  };

  return {
    language: currentLang,
    direction,
    isRTL: direction === 'rtl',
    changeLanguage,
  };
}

export default useDirection;
