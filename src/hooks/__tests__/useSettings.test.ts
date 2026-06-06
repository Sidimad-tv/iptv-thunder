import { translations } from '@/lib/translations';

describe('translations - language support', () => {
  it('should have Polish translations', () => {
    expect(translations.pl).toBeDefined();
    expect(translations.pl.channels).toBe('Kanały TV');
    expect(translations.pl.movies).toBe('Filmy');
    expect(translations.pl.series).toBe('Seriale');
  });

  it('should have English translations', () => {
    expect(translations.en).toBeDefined();
    expect(translations.en.channels).toBe('Channels');
    expect(translations.en.movies).toBe('Movies');
    expect(translations.en.series).toBe('Series');
  });

  it('should have Czech translations', () => {
    expect(translations.cs).toBeDefined();
    expect(translations.cs.channels).toBe('TV kanály');
    expect(translations.cs.movies).toBe('Filmy');
    expect(translations.cs.series).toBe('Seriály');
    expect(translations.cs.settings).toBe('Nastavení');
  });

  it('should have Slovak translations', () => {
    expect(translations.sk).toBeDefined();
    expect(translations.sk.channels).toBe('TV kanály');
    expect(translations.sk.movies).toBe('Filmy');
    expect(translations.sk.series).toBe('Seriály');
    expect(translations.sk.settings).toBe('Nastavenia');
  });

  it('should have Belarusian translations', () => {
    expect(translations.be).toBeDefined();
    expect(translations.be.channels).toBe('ТВ каналы');
    expect(translations.be.movies).toBe('Фільмы');
    expect(translations.be.series).toBe('Серыялы');
    expect(translations.be.settings).toBe('Налады');
  });

  it('should have German translations', () => {
    expect(translations.de).toBeDefined();
    expect(translations.de.channels).toBe('TV-Kanäle');
    expect(translations.de.movies).toBe('Filme');
    expect(translations.de.series).toBe('Serien');
    expect(translations.de.settings).toBe('Einstellungen');
  });

  it('should have same keys in all languages', () => {
    const plKeys = Object.keys(translations.pl).sort();
    const enKeys = Object.keys(translations.en).sort();
    const csKeys = Object.keys(translations.cs).sort();
    const skKeys = Object.keys(translations.sk).sort();
    const beKeys = Object.keys(translations.be).sort();
    const deKeys = Object.keys(translations.de).sort();

    expect(plKeys).toEqual(enKeys);
    expect(plKeys).toEqual(csKeys);
    expect(plKeys).toEqual(skKeys);
    expect(plKeys).toEqual(beKeys);
    expect(plKeys).toEqual(deKeys);
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
      expect(translations.pl[key as keyof typeof translations.pl]).toBeDefined();
      expect(translations.en[key as keyof typeof translations.en]).toBeDefined();
      expect(translations.cs[key as keyof typeof translations.cs]).toBeDefined();
      expect(translations.sk[key as keyof typeof translations.sk]).toBeDefined();
      expect(translations.be[key as keyof typeof translations.be]).toBeDefined();
      expect(translations.de[key as keyof typeof translations.de]).toBeDefined();
    });
  });

  it('should have non-empty translations in all languages', () => {
    const languages = ['pl', 'en', 'cs', 'sk', 'be', 'de'] as const;

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
    const supportedLanguages = ['pl', 'en', 'cs', 'sk', 'be', 'de'];
    supportedLanguages.forEach(lang => {
      expect(translations[lang as keyof typeof translations]).toBeDefined();
    });
  });
});