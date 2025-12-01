// Internationalization utility
// Loads and manages translations for the application

import enTranslations from '../data/i18n/en.json';

type TranslationKey = string;
type Translations = typeof enTranslations;

// Supported languages
export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt';

// Language data cache
const translationsCache: Record<string, Translations> = {
  en: enTranslations,
};

// Current language (default: English)
let currentLanguage: Language = 'en';

// Callbacks for language change
const languageChangeCallbacks: Set<() => void> = new Set();

/**
 * Get the current language
 */
export function getCurrentLanguage(): Language {
  return currentLanguage;
}

/**
 * Set the current language
 * @param lang Language code
 */
export async function setLanguage(lang: Language): Promise<void> {
  if (lang === currentLanguage && translationsCache[lang]) {
    return; // Already loaded
  }

  // Load translation file if not cached
  if (!translationsCache[lang]) {
    try {
      const translations = await import(`../data/i18n/${lang}.json`);
      translationsCache[lang] = translations.default;
    } catch (error) {
      console.warn(`Failed to load language ${lang}, falling back to English`);
      currentLanguage = 'en';
      return;
    }
  }

  currentLanguage = lang;
  
  // Save to localStorage
  localStorage.setItem('preferredLanguage', lang);
  
  // Notify all listeners
  languageChangeCallbacks.forEach(callback => callback());
}

/**
 * Get a translated string by key path
 * Supports nested keys with dot notation (e.g., "menu.playOnline")
 * @param key Translation key path
 * @param params Optional parameters to replace placeholders
 * @returns Translated string
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const translations = translationsCache[currentLanguage] || translationsCache.en;
  
  // Navigate through nested object using dot notation
  const keys = key.split('.');
  let value: any = translations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Key not found, return the key itself as fallback
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }
  
  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string for key: ${key}`);
    return key;
  }
  
  // Replace placeholders with parameters
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match;
    });
  }
  
  return value;
}

/**
 * Initialize i18n system
 * Loads language from localStorage or uses browser language
 */
export async function initI18n(): Promise<void> {
  // Try to get language from localStorage
  const savedLang = localStorage.getItem('preferredLanguage') as Language;
  
  if (savedLang && translationsCache[savedLang]) {
    await setLanguage(savedLang);
    return;
  }
  
  // Try to detect browser language
  const browserLang = navigator.language.split('-')[0] as Language;
  if (browserLang && browserLang !== 'en') {
    await setLanguage(browserLang);
    return;
  }
  
  // Default to English
  await setLanguage('en');
}

/**
 * Subscribe to language changes
 * @param callback Function to call when language changes
 * @returns Unsubscribe function
 */
export function onLanguageChange(callback: () => void): () => void {
  languageChangeCallbacks.add(callback);
  return () => {
    languageChangeCallbacks.delete(callback);
  };
}

// Initialize on module load
initI18n().catch(console.error);

