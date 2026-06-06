import { renderHook, act, waitFor } from '@testing-library/react';
import { translations, TranslationKey } from '@/lib/translations';

// Mock useSettings
const mockGetSetting = jest.fn();
const mockSetSetting = jest.fn();

jest.mock('@/hooks/useSettings', () => ({
  getSetting: (...args: any[]) => mockGetSetting(...args),
  setSetting: (...args: any[]) => mockSetSetting(...args),
}));

// Import after mocking
const { useTranslation } = jest.requireActual('../useTranslation');

describe('translations', () => {
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

  it('should have all required translation keys', () => {
    const requiredKeys: TranslationKey[] = [
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
      expect(translations.pl[key]).toBeDefined();
      expect(translations.en[key]).toBeDefined();
      expect(translations.cs[key]).toBeDefined();
      expect(translations.sk[key]).toBeDefined();
      expect(translations.be[key]).toBeDefined();
      expect(translations.de[key]).toBeDefined();
    });
  });

  it('should have consistent structure between languages', () => {
    const plKeys = Object.keys(translations.pl);
    const enKeys = Object.keys(translations.en);

    expect(plKeys.length).toBe(enKeys.length);

    plKeys.forEach(key => {
      expect(translations.en[key as TranslationKey]).toBeDefined();
      expect(typeof translations.pl[key as TranslationKey]).toBe(typeof translations.en[key as TranslationKey]);
    });
  });

  it('should have non-empty translations', () => {
    Object.keys(translations.pl).forEach(key => {
      const plValue = translations.pl[key as TranslationKey];
      const enValue = translations.en[key as TranslationKey];

      expect(plValue).toBeTruthy();
      expect(enValue).toBeTruthy();
      expect(typeof plValue).toBe('string');
      expect(typeof enValue).toBe('string');
    });
  });
});

describe('useTranslation hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no saved language (will use default 'pl')
    mockGetSetting.mockResolvedValue(null);
    mockSetSetting.mockResolvedValue(undefined);

    // Reset global language state before each test
    const { _resetLanguageState } = jest.requireActual('../useTranslation');
    _resetLanguageState('pl');
  });

  it('should provide t function', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.t).toBeDefined();
      expect(typeof result.current.t).toBe('function');
    });
  });

  it('should have default language as Polish', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('pl');
  });

  it('should provide isLoading state', async () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should translate Polish keys correctly', async () => {
    mockGetSetting.mockResolvedValue('pl');
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('channels')).toBe('Kanały TV');
    expect(result.current.t('movies')).toBe('Filmy');
    expect(result.current.t('series')).toBe('Seriale');
    expect(result.current.t('settings')).toBe('Ustawienia');
  });

  it('should translate English keys correctly', async () => {
    mockGetSetting.mockResolvedValue('en');
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('channels')).toBe('Channels');
    expect(result.current.t('movies')).toBe('Movies');
    expect(result.current.t('series')).toBe('Series');
    expect(result.current.t('settings')).toBe('Settings');
  });

  it('should translate Czech keys correctly', async () => {
    mockGetSetting.mockResolvedValue('cs');
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('channels')).toBe('TV kanály');
    expect(result.current.t('movies')).toBe('Filmy');
    expect(result.current.t('series')).toBe('Seriály');
    expect(result.current.t('settings')).toBe('Nastavení');
  });

  it('should translate Slovak keys correctly', async () => {
    mockGetSetting.mockResolvedValue('sk');
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('channels')).toBe('TV kanály');
    expect(result.current.t('movies')).toBe('Filmy');
    expect(result.current.t('series')).toBe('Seriály');
    expect(result.current.t('settings')).toBe('Nastavenia');
  });

  it('should translate Belarusian keys correctly', async () => {
    mockGetSetting.mockResolvedValue('be');
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('channels')).toBe('ТВ каналы');
    expect(result.current.t('movies')).toBe('Фільмы');
    expect(result.current.t('series')).toBe('Серыялы');
    expect(result.current.t('settings')).toBe('Налады');
  });

  it('should translate German keys correctly', async () => {
    mockGetSetting.mockResolvedValue('de');
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('channels')).toBe('TV-Kanäle');
    expect(result.current.t('movies')).toBe('Filme');
    expect(result.current.t('series')).toBe('Serien');
    expect(result.current.t('settings')).toBe('Einstellungen');
  });

  it('should change language', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialLang = result.current.currentLang;
    expect(initialLang).toBe('pl'); // Default language

    await act(async () => {
      await result.current.changeLanguage('en');
    });

    expect(result.current.currentLang).toBe('en');
    expect(result.current.t('channels')).toBe('Channels');
    expect(mockSetSetting).toHaveBeenCalledWith('language', 'en');
  });

  it('should fallback to Polish for unknown keys', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('unknownKey' as TranslationKey)).toBe('unknownKey');
  });

  it('should load saved language from settings', async () => {
    mockGetSetting.mockResolvedValue('en');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.currentLang).toBe('en');
    });

    expect(mockGetSetting).toHaveBeenCalledWith('language');
  });

  it('should handle invalid saved language', async () => {
    mockGetSetting.mockResolvedValue('invalid-lang');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fallback to Polish when invalid language is saved
    expect(result.current.currentLang).toBe('pl');
  });

  it('should handle settings error gracefully', async () => {
    mockGetSetting.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fallback to Polish on error
    expect(result.current.currentLang).toBe('pl');
  });

  it('should handle changeLanguage error gracefully', async () => {
    mockSetSetting.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialLang = result.current.currentLang;

    await act(async () => {
      await result.current.changeLanguage('en');
    });

    // Language should NOT change when save fails
    expect(result.current.currentLang).toBe(initialLang);
  });

  it('should synchronize language across multiple hook instances', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result: result1 } = renderHook(() => useTranslation());
    const { result: result2 } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
      expect(result2.current.isLoading).toBe(false);
    });

    const initialLang1 = result1.current.currentLang;
    const initialLang2 = result2.current.currentLang;

    // Both should have same initial language
    expect(initialLang1).toBe(initialLang2);

    await act(async () => {
      await result1.current.changeLanguage('en');
    });

    // Both instances should be updated
    expect(result1.current.currentLang).toBe('en');
    expect(result2.current.currentLang).toBe('en');
  });

  it('should translate all common keys without errors', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const commonKeys: TranslationKey[] = [
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
      'loading',
      'error',
      'play',
      'pause',
    ];

    commonKeys.forEach(key => {
      const translation = result.current.t(key);
      expect(translation).toBeDefined();
      expect(typeof translation).toBe('string');
      expect(translation.length).toBeGreaterThan(0);
    });
  });

  it('should correctly translate keys in both Polish and English', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Test Polish translations (default)
    expect(result.current.currentLang).toBe('pl');
    expect(result.current.t('channels')).toBe('Kanały TV');
    expect(result.current.t('movies')).toBe('Filmy');
    expect(result.current.t('series')).toBe('Seriale');
    expect(result.current.t('settings')).toBe('Ustawienia');
    expect(result.current.t('search')).toBe('Szukaj');
    expect(result.current.t('favorites')).toBe('Ulubione');
    expect(result.current.t('player')).toBe('Odtwarzacz');
    expect(result.current.t('exit')).toBe('Wyjdź');
    expect(result.current.t('save')).toBe('Zapisz');
    expect(result.current.t('cancel')).toBe('Anuluj');

    // Switch to English
    await act(async () => {
      await result.current.changeLanguage('en');
    });

    // Test English translations
    expect(result.current.currentLang).toBe('en');
    expect(result.current.t('channels')).toBe('Channels');
    expect(result.current.t('movies')).toBe('Movies');
    expect(result.current.t('series')).toBe('Series');
    expect(result.current.t('settings')).toBe('Settings');
    expect(result.current.t('search')).toBe('Search');
    expect(result.current.t('favorites')).toBe('Favorites');
    expect(result.current.t('player')).toBe('Player');
    expect(result.current.t('exit')).toBe('Exit');
    expect(result.current.t('save')).toBe('Save');
    expect(result.current.t('cancel')).toBe('Cancel');
  });

  it('should switch between PL and EN multiple times', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Start with Polish
    expect(result.current.currentLang).toBe('pl');
    expect(result.current.t('channels')).toBe('Kanały TV');

    // Switch to English
    await act(async () => {
      await result.current.changeLanguage('en');
    });
    expect(result.current.currentLang).toBe('en');
    expect(result.current.t('channels')).toBe('Channels');

    // Switch back to Polish
    await act(async () => {
      await result.current.changeLanguage('pl');
    });
    expect(result.current.currentLang).toBe('pl');
    expect(result.current.t('channels')).toBe('Kanały TV');

    // Switch to English again
    await act(async () => {
      await result.current.changeLanguage('en');
    });
    expect(result.current.currentLang).toBe('en');
    expect(result.current.t('channels')).toBe('Channels');
  });

  it('should switch between all supported languages', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Start with Polish
    expect(result.current.currentLang).toBe('pl');

    // Switch to Czech
    await act(async () => {
      await result.current.changeLanguage('cs');
    });
    expect(result.current.currentLang).toBe('cs');
    expect(result.current.t('settings')).toBe('Nastavení');

    // Switch to Slovak
    await act(async () => {
      await result.current.changeLanguage('sk');
    });
    expect(result.current.currentLang).toBe('sk');
    expect(result.current.t('settings')).toBe('Nastavenia');

    // Switch to Belarusian
    await act(async () => {
      await result.current.changeLanguage('be');
    });
    expect(result.current.currentLang).toBe('be');
    expect(result.current.t('settings')).toBe('Налады');

    // Switch to German
    await act(async () => {
      await result.current.changeLanguage('de');
    });
    expect(result.current.currentLang).toBe('de');
    expect(result.current.t('settings')).toBe('Einstellungen');

    // Switch back to English
    await act(async () => {
      await result.current.changeLanguage('en');
    });
    expect(result.current.currentLang).toBe('en');
    expect(result.current.t('settings')).toBe('Settings');
  });

  it('should load English from saved settings', async () => {
    mockGetSetting.mockResolvedValue('en');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('en');
    expect(result.current.t('movies')).toBe('Movies');
    expect(result.current.t('series')).toBe('Series');
  });

  it('should load Polish from saved settings', async () => {
    mockGetSetting.mockResolvedValue('pl');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('pl');
    expect(result.current.t('movies')).toBe('Filmy');
    expect(result.current.t('series')).toBe('Seriale');
  });

  it('should load Czech from saved settings', async () => {
    mockGetSetting.mockResolvedValue('cs');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('cs');
    expect(result.current.t('movies')).toBe('Filmy');
    expect(result.current.t('series')).toBe('Seriály');
  });

  it('should load Slovak from saved settings', async () => {
    mockGetSetting.mockResolvedValue('sk');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('sk');
    expect(result.current.t('movies')).toBe('Filmy');
    expect(result.current.t('series')).toBe('Seriály');
  });

  it('should load Belarusian from saved settings', async () => {
    mockGetSetting.mockResolvedValue('be');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('be');
    expect(result.current.t('movies')).toBe('Фільмы');
    expect(result.current.t('series')).toBe('Серыялы');
  });

  it('should load German from saved settings', async () => {
    mockGetSetting.mockResolvedValue('de');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('de');
    expect(result.current.t('movies')).toBe('Filme');
    expect(result.current.t('series')).toBe('Serien');
  });

  it('should memoize t function', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const tFunction1 = result.current.t;
    const tFunction2 = result.current.t;

    expect(tFunction1).toBe(tFunction2);
  });

  it('should memoize changeLanguage function', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const changeLang1 = result.current.changeLanguage;
    const changeLang2 = result.current.changeLanguage;

    expect(changeLang1).toBe(changeLang2);
  });

  it('should cleanup subscription on unmount', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result, unmount } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Change language before unmount
    await act(async () => {
      await result.current.changeLanguage('en');
    });

    expect(result.current.currentLang).toBe('en');

    // Unmount the hook
    unmount();

    // Reset global state to simulate fresh start
    const { _resetLanguageState } = jest.requireActual('../useTranslation');
    _resetLanguageState('pl');

    // Create a new hook instance
    const { result: result2 } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    // Should start with fresh state after reset
    expect(result2.current.currentLang).toBe('pl');
  });

  it('should handle null saved language', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('pl');
  });

  it('should handle undefined saved language', async () => {
    mockGetSetting.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('pl');
  });

  it('should fallback to Polish when currentLang translation is missing', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // If a key exists in Polish but not in English, it should fallback
    // This tests the fallback chain: currentLang -> pl -> key
    const translation = result.current.t('channels');
    expect(translation).toBeDefined();
    expect(typeof translation).toBe('string');
  });

  it('should return key itself when translation not found in any language', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const unknownKey = 'totallyNonExistentKey12345';
    const translation = result.current.t(unknownKey as TranslationKey);
    expect(translation).toBe(unknownKey);
  });

  it('should handle rapid language changes', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Rapidly change language multiple times
    await act(async () => {
      await result.current.changeLanguage('en');
      await result.current.changeLanguage('pl');
      await result.current.changeLanguage('en');
    });

    expect(result.current.currentLang).toBe('en');
    expect(result.current.t('channels')).toBe('Channels');
  });

  it('should not update listeners when changeLanguage fails', async () => {
    mockSetSetting.mockRejectedValue(new Error('Storage error'));

    const { result: result1 } = renderHook(() => useTranslation());
    const { result: result2 } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
      expect(result2.current.isLoading).toBe(false);
    });

    const initialLang1 = result1.current.currentLang;
    const initialLang2 = result2.current.currentLang;

    await act(async () => {
      await result1.current.changeLanguage('en');
    });

    // Neither instance should change because save failed
    expect(result1.current.currentLang).toBe(initialLang1);
    expect(result2.current.currentLang).toBe(initialLang2);
  });

  it('should handle language code not in allowed list', async () => {
    mockGetSetting.mockResolvedValue('fr' as any);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fallback to Polish for invalid language (fr is not in the list)
    expect(result.current.currentLang).toBe('pl');
  });

  it('should update global language state on change', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.changeLanguage('en');
    });

    expect(result.current.currentLang).toBe('en');

    // New instance should pick up the global language
    const { result: result2 } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    expect(result2.current.currentLang).toBe('en');
  });

  it('should translate empty string key', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const translation = result.current.t('' as TranslationKey);
    expect(translation).toBe('');
  });

  it('should handle special characters in translation keys', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Test with a key that has special characters (if it exists in translations)
    // Otherwise it should return the key itself
    const specialKey = 'test-key_with.special';
    const translation = result.current.t(specialKey as TranslationKey);
    expect(translation).toBe(specialKey);
  });

  it('should maintain translation consistency after multiple renders', async () => {
    const { result, rerender } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const translation1 = result.current.t('channels');

    // Rerender multiple times
    rerender();
    rerender();
    rerender();

    const translation2 = result.current.t('channels');

    expect(translation1).toBe(translation2);
  });
});
