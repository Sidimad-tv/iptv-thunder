import { useState, useEffect, useCallback } from 'react';
import { translations, SupportedLanguage, TranslationKey } from '@/lib/translations';
import { getSetting, setSetting } from '@/hooks/useSettings';

// Global state for language synchronization
let globalLanguage: SupportedLanguage = 'en';
const listeners = new Set<(lang: SupportedLanguage) => void>();

const subscribe = (callback: (lang: SupportedLanguage) => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const notifyListeners = (lang: SupportedLanguage) => {
  globalLanguage = lang;
  listeners.forEach(cb => cb(lang));
};

export const useTranslation = () => {
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(globalLanguage);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLang = await getSetting('language');
        if (savedLang && ['en', 'fr', 'ar'].includes(savedLang)) {
          setCurrentLang(savedLang);
          globalLanguage = savedLang;
        }
      } catch (error) {
        console.error('[useTranslation] Error loading language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();

    // Subscribe to language changes from other components
    const unsubscribe = subscribe((lang) => {
      setCurrentLang(lang);
    });

    return () => { unsubscribe(); };
  }, []);

  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>): string => {
    let text: string = translations[currentLang]?.[key] || translations['en']?.[key] || key;
    if (values) {
      Object.entries(values).forEach(([k, v]) => {
        text = text.replaceAll(`{{${k}}}`, String(v));
      });
    }
    return text;
  }, [currentLang]);

  const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
    try {
      await setSetting('language', lang);
      setCurrentLang(lang);
      notifyListeners(lang);
    } catch (error) {
      console.error('[useTranslation] Error saving language:', error);
    }
  }, []);

  return { t, currentLang, changeLanguage, isLoading };
};

// Reset global language state (for testing)
export const _resetLanguageState = (lang: SupportedLanguage = 'en') => {
  globalLanguage = lang;
  listeners.clear();
};
