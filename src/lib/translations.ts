import { pl } from './i18n/pl';
import { en } from './i18n/en';
import { cs } from './i18n/cs';
import { sk } from './i18n/sk';
import { be } from './i18n/be';
import { de } from './i18n/de';

export const translations = {
  pl,
  en,
  cs,
  sk,
  be,
  de,
} as const;

export type Language = keyof typeof translations;
export type SupportedLanguage = 'pl' | 'en' | 'cs' | 'sk' | 'be' | 'de';
export type TranslationKey = keyof typeof pl;