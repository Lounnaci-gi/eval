"use client";

import React from 'react';
import useDirection from '../hooks/useDirection';

export function LanguageSwitcher() {
  const { language, changeLanguage, isRTL } = useDirection();

  const toggleLanguage = () => {
    changeLanguage(language === 'fr' ? 'ar' : 'fr');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-bg-tertiary))] transition-all duration-200 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
      aria-label={isRTL ? "تغيير اللغة إلى الفرنسية" : "Changer la langue en Arabe"}
      title={isRTL ? "Changer la langue" : "تغيير اللغة"}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {language === 'fr' ? (
          <>
            <span className="text-base" role="img" aria-label="Drapeau Français">🇫🇷</span>
            <span>Français</span>
          </>
        ) : (
          <>
            <span className="text-base" role="img" aria-label="علم الجزائر">🇩🇿</span>
            <span className="font-semibold">العربية</span>
          </>
        )}
      </span>

      {/* Dynamic bidirectional arrows icon */}
      <svg
        className="w-4 h-4 text-[rgb(var(--color-text-secondary))] transition-transform duration-200 rtl-flip"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </svg>
    </button>
  );
}

export default LanguageSwitcher;
