import { translations } from '@/lib/translations';

describe('translations - language support', () => {
  it('should have English translations', () => {
    expect(translations.en).toBeDefined();
    expect(translations.en.channels).toBe('Channels');
    expect(translations.en.movies).toBe('Movies');
    expect(translations.en.series).toBe('Series');
  });

  it('should have French translations (English fallback)', () => {
    expect(translations.fr).toBeDefined();
    expect(translations.fr.channels).toBe('Channels');
    expect(translations.fr.movies).toBe('Movies');
    expect(translations.fr.series).toBe('Series');
  });

  it('should have Arabic translations (English fallback)', () => {
    expect(translations.ar).toBeDefined();
    expect(translations.ar.channels).toBe('Channels');
    expect(translations.ar.movies).toBe('Movies');
    expect(translations.ar.series).toBe('Series');
  });

  it('should have same keys in all languages', () => {
    const enKeys = Object.keys(translations.en).sort();
    const frKeys = Object.keys(translations.fr).sort();
    const arKeys = Object.keys(translations.ar).sort();

    expect(frKeys).toEqual(enKeys);
    expect(arKeys).toEqual(enKeys);
  });

  it('should have all required translation keys in all languages', () => {
    const requiredKeys = [
      'channels',
      'movies',
      'series',
      'settings',
      'search',
      'favorites',
      'player',
      'exit',
      'save',
      'cancel',
    ];

    requiredKeys.forEach(key => {
      expect(translations.en[key as keyof typeof translations.en]).toBeDefined();
      expect(translations.fr[key as keyof typeof translations.fr]).toBeDefined();
      expect(translations.ar[key as keyof typeof translations.ar]).toBeDefined();
    });
  });

  it('should have non-empty translations in all languages', () => {
    const languages = ['en', 'fr', 'ar'] as const;

    languages.forEach(lang => {
      const langTranslations = translations[lang];
      Object.keys(langTranslations).forEach(key => {
        const value = langTranslations[key as keyof typeof langTranslations];
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
      });
    });
  });
});

describe('SupportedLanguage type', () => {
  it('should include all supported languages', () => {
    const supportedLanguages = ['en', 'fr', 'ar'];
    supportedLanguages.forEach(lang => {
      expect(translations[lang as keyof typeof translations]).toBeDefined();
    });
  });
});
