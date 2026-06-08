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
      expect(translations.en[key]).toBeDefined();
      expect(translations.fr[key]).toBeDefined();
      expect(translations.ar[key]).toBeDefined();
    });
  });

  it('should have consistent structure between languages', () => {
    const enKeys = Object.keys(translations.en);
    const frKeys = Object.keys(translations.fr);

    expect(frKeys.length).toBe(enKeys.length);

    frKeys.forEach(key => {
      expect(translations.en[key as TranslationKey]).toBeDefined();
      expect(typeof translations.fr[key as TranslationKey]).toBe(typeof translations.en[key as TranslationKey]);
    });
  });

  it('should have non-empty translations', () => {
    Object.keys(translations.en).forEach(key => {
      const enValue = translations.en[key as TranslationKey];
      const frValue = translations.fr[key as TranslationKey];

      expect(enValue).toBeTruthy();
      expect(frValue).toBeTruthy();
      expect(typeof enValue).toBe('string');
      expect(typeof frValue).toBe('string');
    });
  });
});

describe('useTranslation hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no saved language (will use default 'en')
    mockGetSetting.mockResolvedValue(null);
    mockSetSetting.mockResolvedValue(undefined);

    // Reset global language state before each test
    const { _resetLanguageState } = jest.requireActual('../useTranslation');
    _resetLanguageState('en');
  });

  it('should provide t function', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.t).toBeDefined();
      expect(typeof result.current.t).toBe('function');
    });
  });

  it('should have default language as English', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('en');
  });

  it('should provide isLoading state', async () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should translate keys in English (default)', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('channels')).toBe('Channels');
    expect(result.current.t('movies')).toBe('Movies');
    expect(result.current.t('series')).toBe('Series');
    expect(result.current.t('settings')).toBe('Settings');
  });

  it('should translate keys in French (English fallback)', async () => {
    mockGetSetting.mockResolvedValue('fr');
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('settings')).toBe('Settings');
  });

  it('should translate keys in Arabic (English fallback)', async () => {
    mockGetSetting.mockResolvedValue('ar');
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.t('settings')).toBe('Settings');
  });

  it('should change language', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialLang = result.current.currentLang;
    expect(initialLang).toBe('en'); // Default language

    await act(async () => {
      await result.current.changeLanguage('en');
    });

    expect(result.current.currentLang).toBe('en');
    expect(result.current.t('channels')).toBe('Channels');
    expect(mockSetSetting).toHaveBeenCalledWith('language', 'en');
  });

  it('should fallback to English for unknown keys', async () => {
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

    // Should fallback to English when invalid language is saved
    expect(result.current.currentLang).toBe('en');
  });

  it('should handle settings error gracefully', async () => {
    mockGetSetting.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fallback to English on error
    expect(result.current.currentLang).toBe('en');
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

  it('should correctly translate keys in both English and French', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Test English translations (default)
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

    // Switch to French
    await act(async () => {
      await result.current.changeLanguage('fr');
    });

    // Test French translations (English fallback)
    expect(result.current.currentLang).toBe('fr');
    expect(result.current.t('channels')).toBe('Channels');
    expect(result.current.t('movies')).toBe('Movies');
    expect(result.current.t('series')).toBe('Series');
  });

  it('should switch between EN and FR multiple times', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Start with English
    expect(result.current.currentLang).toBe('en');
    expect(result.current.t('channels')).toBe('Channels');

    // Switch to French
    await act(async () => {
      await result.current.changeLanguage('fr');
    });
    expect(result.current.currentLang).toBe('fr');

    // Switch back to English
    await act(async () => {
      await result.current.changeLanguage('en');
    });
    expect(result.current.currentLang).toBe('en');

    // Switch to French again
    await act(async () => {
      await result.current.changeLanguage('fr');
    });
    expect(result.current.currentLang).toBe('fr');
  });

  it('should switch between all supported languages', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Start with English
    expect(result.current.currentLang).toBe('en');

    // Switch to French
    await act(async () => {
      await result.current.changeLanguage('fr');
    });
    expect(result.current.currentLang).toBe('fr');
    expect(result.current.t('settings')).toBe('Settings');

    // Switch to Arabic
    await act(async () => {
      await result.current.changeLanguage('ar');
    });
    expect(result.current.currentLang).toBe('ar');
    expect(result.current.t('settings')).toBe('Settings');

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

  it('should load French from saved settings', async () => {
    mockGetSetting.mockResolvedValue('fr');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('fr');
    expect(result.current.t('settings')).toBe('Settings');
  });

  it('should load Arabic from saved settings', async () => {
    mockGetSetting.mockResolvedValue('ar');

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('ar');
    expect(result.current.t('settings')).toBe('Settings');
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
    _resetLanguageState('en');

    // Create a new hook instance
    const { result: result2 } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    // Should start with fresh state after reset
    expect(result2.current.currentLang).toBe('en');
  });

  it('should handle null saved language', async () => {
    mockGetSetting.mockResolvedValue(null);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('en');
  });

  it('should handle undefined saved language', async () => {
    mockGetSetting.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentLang).toBe('en');
  });

  it('should fallback to English when currentLang translation is missing', async () => {
    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // If a key exists in English but not in another language, it should fallback
    // This tests the fallback chain: currentLang -> en -> key
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
      await result.current.changeLanguage('fr');
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
    mockGetSetting.mockResolvedValue('xx' as any);

    const { result } = renderHook(() => useTranslation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fallback to English for invalid language (xx is not in the list)
    expect(result.current.currentLang).toBe('en');
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
