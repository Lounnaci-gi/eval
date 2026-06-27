"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useDirection from '../hooks/useDirection';
import LanguageSwitcher from '../components/LanguageSwitcher';

// Dummy list of subscribers for the demo
const initialSubscribers = [
  { id: 1, name: "Ahmed Belkacem", email: "ahmed@example.dz", balance: 14500.50, joinDate: "2024-03-15", status: "Active" },
  { id: 2, name: "Marie Dubois", email: "marie@example.fr", balance: 8320.00, joinDate: "2025-01-10", status: "Active" },
  { id: 3, name: "Yacine Touati", email: "yacine@example.dz", balance: 0.00, joinDate: "2025-05-20", status: "Inactive" },
];

export default function I18nDemoPage() {
  const { t, i18n } = useTranslation();
  const { direction, isRTL } = useDirection();
  
  // State for user creation form
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Pitfalls demo state
  const [nameInput, setNameInput] = useState('Yacine');
  const [pluralCount, setPluralCount] = useState(1);

  const currentLocale = i18n.language === 'ar' ? 'ar-DZ' : 'fr-FR';

  // Localized Formatting functions
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(currentLocale, {
      style: 'currency',
      currency: 'DZD',
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat(currentLocale, {
      dateStyle: 'long',
    }).format(new Date(dateStr));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');
    setTimeout(() => {
      setLoading(false);
      setSuccessMessage(t('dashboard.form.success'));
      setUsername('');
      setDisplayName('');
      setPassword('');
      setIsAdmin(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))] p-6 md:p-12 transition-all duration-300">
      
      {/* 1. Header with LanguageSwitcher */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 pb-6 border-b border-[rgb(var(--color-border))]">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[rgb(var(--color-accent))] tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
            {t('dashboard.welcome')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <a
            href="/"
            className="px-3 py-1.5 rounded-lg border border-[rgb(var(--color-border))] text-sm hover:bg-[rgb(var(--color-bg-tertiary))] transition-all duration-200"
          >
            ← Back to Dashboard
          </a>
        </div>
      </header>

      {/* Grid Layout for Form, Table and i18n Pitfalls Demo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form & Pitfalls (lg:span-5) */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          
          {/* A. User creation Form */}
          <section className="bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 text-[rgb(var(--color-text-primary))]">
              {t('dashboard.form.title')}
            </h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-secondary))] mb-1.5">
                  {t('dashboard.form.username')}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  dir="auto"
                  placeholder="e.g. ahmed_dz"
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border-strong))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] bg-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-secondary))] mb-1.5">
                  {t('dashboard.form.displayName')}
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  dir="auto"
                  placeholder="e.g. Ahmed"
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border-strong))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] bg-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-secondary))] mb-1.5">
                  {t('dashboard.form.password')}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border-strong))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] bg-transparent"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="w-4 h-4 rounded text-[rgb(var(--color-accent))] focus:ring-[rgb(var(--color-accent))] border-[rgb(var(--color-border-strong))]"
                />
                <label htmlFor="isAdmin" className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                  {t('dashboard.form.isAdmin')}
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent-hover))] text-white font-bold rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {loading ? t('dashboard.form.loading') : t('dashboard.form.submit')}
              </button>

              {successMessage && (
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-sm rounded-lg border border-emerald-200">
                  {successMessage}
                </div>
              )}
            </form>
          </section>

          {/* B. i18n Pitfalls Showcase (Common Traps & Solutions) */}
          <section className="bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 text-amber-600 dark:text-amber-400">
              {isRTL ? "تجنب الأخطاء الشائعة في الترجمة" : "Pièges i18n & Solutions"}
            </h2>
            
            <div className="space-y-4 text-sm">
              {/* String Concatenation Trap */}
              <div className="border-b border-[rgb(var(--color-border))] pb-4">
                <h3 className="font-semibold text-text-primary mb-1">
                  1. {isRTL ? "دمج النصوص (String Concatenation)" : "Concaténation vs Interpolation"}
                </h3>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    dir="auto"
                    className="px-2 py-1 text-xs border border-[rgb(var(--color-border))] rounded w-24 bg-transparent"
                    placeholder="Nom"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 rounded border border-red-200">
                    <span className="font-bold">Mauvais (Hardcoded) :</span>
                    <p className="mt-1">
                      {isRTL ? "مرحبا " + nameInput : "Bonjour " + nameInput}
                    </p>
                  </div>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-200">
                    <span className="font-bold">Bon (Traduction interpolée) :</span>
                    <p className="mt-1">
                      {isRTL ? `مرحباً يا ${nameInput}` : `Bonjour ${nameInput}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Number and Date Formatting */}
              <div className="border-b border-[rgb(var(--color-border))] pb-4">
                <h3 className="font-semibold text-text-primary mb-1">
                  2. {isRTL ? "تنسيق الأرقام والتواريخ" : "Format des Nombres et Dates"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 rounded border border-red-200">
                    <span className="font-bold">Mauvais (Brut) :</span>
                    <p className="mt-1">Solde: 14500.50 DZD</p>
                    <p className="mt-0.5">Date: 2024-03-15</p>
                  </div>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-200">
                    <span className="font-bold">Bon (Intl API - {currentLocale}) :</span>
                    <p className="mt-1">Solde: {formatCurrency(14500.50)}</p>
                    <p className="mt-0.5">Date: {formatDate("2024-03-15")}</p>
                  </div>
                </div>
              </div>

              {/* Pluralization Showcase */}
              <div>
                <h3 className="font-semibold text-text-primary mb-2">
                  3. {isRTL ? "صيغ الجمع المعقدة" : "Gestion des Pluriels"}
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setPluralCount(c => Math.max(0, c - 1))}
                    className="px-2 py-0.5 bg-bg-tertiary border border-[rgb(var(--color-border))] rounded text-xs"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm w-8 text-center">{pluralCount}</span>
                  <button
                    onClick={() => setPluralCount(c => c + 1)}
                    className="px-2 py-0.5 bg-bg-tertiary border border-[rgb(var(--color-border))] rounded text-xs"
                  >
                    +
                  </button>
                </div>
                <div className="p-3 bg-[rgb(var(--color-bg-tertiary))] rounded-lg border border-[rgb(var(--color-border))] text-xs space-y-1">
                  <p>
                    <strong>Français :</strong> {pluralCount} {pluralCount > 1 ? "utilisateurs trouvés" : pluralCount === 1 ? "utilisateur trouvé" : "aucun utilisateur"}
                  </p>
                  <p dir="rtl">
                    <strong className="ml-1">العربية (6 صيغ للجمع) :</strong>
                    {pluralCount === 0 ? "لا يوجد مستخدمون" :
                     pluralCount === 1 ? "مستخدم واحد" :
                     pluralCount === 2 ? "مستخدمان" :
                     pluralCount >= 3 && pluralCount <= 10 ? `${pluralCount} مستخدمين` :
                     pluralCount >= 11 && pluralCount <= 99 ? `${pluralCount} مستخدماً` :
                     `${pluralCount} مستخدم`}
                  </p>
                </div>
              </div>

            </div>
          </section>

        </div>

        {/* Right Column: Data Table (lg:span-7) */}
        <div className="lg:col-span-7">
          
          <section className="bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[rgb(var(--color-text-primary))]">
                {t('dashboard.table.title')}
              </h2>
              <span className="px-2.5 py-1 bg-[rgb(var(--color-brand-100))] text-[rgb(var(--color-brand-700))] rounded-full text-xs font-semibold">
                3 Subscribers
              </span>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left rtl:text-right border-collapse">
                <thead>
                  <tr className="border-b border-[rgb(var(--color-border))] text-xs uppercase tracking-wider text-[rgb(var(--color-text-secondary))]">
                    <th className="py-3 px-4 text-start font-semibold">{t('dashboard.table.name')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('dashboard.table.email')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{isRTL ? "الرصيد" : "Solde"}</th>
                    <th className="py-3 px-4 text-start font-semibold">{isRTL ? "تاريخ الانضمام" : "Rejoint le"}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('dashboard.table.status')}</th>
                    <th className="py-3 px-4 text-end font-semibold">{t('dashboard.table.action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--color-border))]">
                  {initialSubscribers.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[rgb(var(--color-bg-tertiary))] transition-colors duration-150">
                      <td className="py-3.5 px-4 font-medium text-[rgb(var(--color-text-primary))]">{sub.name}</td>
                      <td className="py-3.5 px-4 text-[rgb(var(--color-text-secondary))]">{sub.email}</td>
                      <td className="py-3.5 px-4 font-mono font-medium text-[rgb(var(--color-text-primary))]">
                        {formatCurrency(sub.balance)}
                      </td>
                      <td className="py-3.5 px-4 text-[rgb(var(--color-text-secondary))]">
                        {formatDate(sub.joinDate)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          sub.status === 'Active' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-end">
                        <div className="inline-flex gap-2">
                          <button className="text-xs text-[rgb(var(--color-accent))] hover:underline cursor-pointer">
                            {t('dashboard.table.edit')}
                          </button>
                          <button className="text-xs text-red-600 hover:underline cursor-pointer">
                            {t('dashboard.table.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RTL Layout Card direction demo */}
            <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/20 border border-[rgb(var(--color-border))] rounded-xl">
              <h3 className="font-bold text-sm text-[rgb(var(--color-text-primary))] mb-2">
                {isRTL ? "تجربة خصائص الاتجاهات CSS (Logical Properties)" : "Démonstration des propriétés logiques CSS"}
              </h3>
              <p className="text-xs text-[rgb(var(--color-text-secondary))] leading-relaxed mb-4">
                {isRTL 
                  ? "لاحظ كيف تتبادل العناصر ترتيبها تلقائياً عند تغيير اللغة بفضل استخدام flex و flex-row بدلاً من row-reverse المرمزة بشكل ثابت، وكيف تتبدل أيقونة السهم في الاتجاه المناسب."
                  : "Remarquez comment les éléments permutent automatiquement en fonction de la langue grâce aux propriétés Flexbox ordinaires et propriétés CSS logiques, ainsi que la rotation automatique de la flèche."}
              </p>
              
              <div className="flex items-center justify-between p-3 bg-white dark:bg-black/20 rounded-lg border border-[rgb(var(--color-border))]">
                <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                  {isRTL ? "استمر إلى التقرير التالي" : "Continuer vers le rapport suivant"}
                </span>
                
                {/* RTL directional icon flipping demo */}
                <button className="flex items-center justify-center w-8 h-8 rounded-full bg-[rgb(var(--color-accent))] text-white hover:bg-[rgb(var(--color-accent-hover))] transition-all duration-200">
                  <svg className="w-4 h-4 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

          </section>

        </div>

      </div>

      {/* Test checklist Section */}
      <footer className="mt-12 p-6 bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] rounded-2xl">
        <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))] mb-3">
          {isRTL ? "قائمة مراجعة اختبار RTL" : "Checklist de test i18n & RTL"}
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[rgb(var(--color-text-secondary))]">
          <li className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <span><strong>Attribut HTML :</strong> L'élément <code>&lt;html&gt;</code> doit avoir <code>dir="rtl"</code> et <code>lang="ar"</code> en mode arabe.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <span><strong>Orientation :</strong> La mise en page doit basculer horizontalement. Les barres de navigation et éléments de liste s'alignent à droite.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <span><strong>Icônes :</strong> Les icônes de navigation directionnelles (comme les flèches) doivent être inversées (rotation de 180°).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <span><strong>Saisie :</strong> Les champs de formulaire doivent s'aligner dynamiquement selon le texte saisi grâce à <code>dir="auto"</code>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <span><strong>Formatage :</strong> Les montants monétaires affichent <code>د.ج.</code> en arabe et les dates utilisent le format arabe standard.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <span><strong>Persistence :</strong> La langue sélectionnée doit persister au rafraîchissement via <code>localStorage</code>.</span>
          </li>
        </ul>
      </footer>

    </div>
  );
}
