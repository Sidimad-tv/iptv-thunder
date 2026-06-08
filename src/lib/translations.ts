import { en } from './i18n/en';
import { fr } from './i18n/fr';
import { ar } from './i18n/ar';

export const translations = {
  en,
  fr,
  ar,
} as const;

export type Language = keyof typeof translations;
export type SupportedLanguage = 'en' | 'fr' | 'ar';
export type TranslationKey = keyof typeof en;
