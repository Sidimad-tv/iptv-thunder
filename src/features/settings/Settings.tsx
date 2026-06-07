import React, { useState, useEffect } from 'react';
import { usePortalsStore } from '@/store/portals.store';
import { useEpgServices } from '@/features/epg/epg.hooks';
import { getSettings, setSetting, AppSettings } from '@/hooks/useSettings';
import { getVersion } from '@tauri-apps/api/app';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, MonitorPlay, Tv, Wrench, Info, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/translations';
import { useTheme } from '@/components/theme-provider';
import { clearRecentViewed } from '@/hooks/useRecentItems';
import { useQueryClient } from '@tanstack/react-query';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'general' | 'player' | 'epg' | 'advanced' | 'about';

const useTabs = (t: (key: TranslationKey) => string) => [
  { id: 'general' as const, label: t('general'), icon: <SettingsIcon className="w-4 h-4" /> },
  { id: 'player' as const, label: t('player'), icon: <MonitorPlay className="w-4 h-4" /> },
  { id: 'epg' as const, label: t('epg'), icon: <Tv className="w-4 h-4" /> },
  { id: 'advanced' as const, label: t('advanced'), icon: <Wrench className="w-4 h-4" /> },
  { id: 'about' as const, label: t('about'), icon: <Info className="w-4 h-4" /> },
];

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { t, currentLang, changeLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const TABS = useTabs(t);
  const epgServices = useEpgServices();

  // Show keyboard when input is focused on Android TV
  const showKeyboard = () => {
    if ((globalThis as any).AndroidTV?.showKeyboard) {
      (globalThis as any).AndroidTV.showKeyboard();
    }
  };

  const {
    externalEpgUrl,
    setExternalEpgUrl,
    selectedEpgService,
    setSelectedEpgService,
    getEffectiveEpgUrl
  } = usePortalsStore();

  const activePortal = usePortalsStore(s =>
    s.portals.find(p => p.id === s.activePortalId) ?? null
  );

  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [version, setVersion] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [localTheme, setLocalTheme] = useState(theme);

  const [epgUrl, setEpgUrl] = useState(externalEpgUrl || '');
  const [selectedService, setSelectedService] = useState(selectedEpgService || 'auto');

  // Load data when modal opens or store values change
  useEffect(() => {
    if (isOpen) {
      getSettings().then((s) => {
        setSettings(s);
        // Auto-focus first element after settings are loaded
        setTimeout(() => {
          const firstFocusable = document.querySelector('[data-tv-container="settings-modal"] [data-tv-focusable]') as HTMLElement;
          if (firstFocusable) {
            firstFocusable.focus();
          }
        }, 100);
      });
      getVersion().then(setVersion);
    }
  }, [isOpen]);

  // Sync local state with external sources
  useEffect(() => {
    setEpgUrl(externalEpgUrl || '');
    setSelectedService(selectedEpgService || 'auto');
    setLocalTheme(theme);
  }, [externalEpgUrl, selectedEpgService, theme]);

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    // Update UI immediately (optimistic update)
    setSettings(prev => prev ? { ...prev, [key]: value } : null);

    // Save to Tauri store in background (non-blocking)
    setSetting(key, value).catch(error => {
      console.error('Failed to save setting:', error);
    });
  };

  const handleSave = () => {
    setSelectedEpgService(selectedService);
    if (selectedService === 'custom') {
      setExternalEpgUrl(epgUrl.trim() || null);
    }
    onClose();
  };

  const handleEpgServiceChange = (serviceId: string) => {
    setSelectedService(serviceId);
    setSelectedEpgService(serviceId);
    // For predefined services (not custom), clear custom URL
    if (serviceId !== 'custom') {
      const service = epgServices.find(s => s.id === serviceId);
      if (service?.url) {
        setExternalEpgUrl(service.url);
      } else if (serviceId === 'auto') {
        setExternalEpgUrl(null);
      }
    }
  };

  const handleResetEpg = () => {
    setSelectedService('auto');
    setEpgUrl('');
    setSelectedEpgService('auto');
    setExternalEpgUrl(null);
  };

  const handleClearRecentViewed = async () => {
    if (activePortal) {
      try {
        await clearRecentViewed(activePortal.id);
        // Invalidate the recent-viewed query to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['recent-viewed'] });
      } catch (error) {
        console.error('Failed to clear recent viewed:', error);
      }
    }
  };

  if (!isOpen || !settings) return null;

  const effectiveEpgUrl = getEffectiveEpgUrl();
  const showCustomUrl = selectedService === 'custom';

  return (
    <AnimatePresence>
      {isOpen && (
        <div data-tv-container="settings-modal" className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="dark:bg-slate-900 bg-white dark:border border-slate-700 border-gray-300 rounded-3xl w-[95%] sm:w-full max-w-3xl lg:max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-5 dark:border-b border-slate-700 border-b-gray-300">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-700 rounded-2xl flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-semibold dark:text-white text-slate-900">{t('settings')}</h2>
              </div>
              <button
                data-tv-focusable
                data-tv-id="settings-close-btn"
                data-tv-group="settings-header"
                data-tv-index={0}
                tabIndex={0}
                onClick={onClose}
                className="p-2 dark:hover:bg-slate-800 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 dark:text-slate-400 text-slate-500" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-44 sm:w-56 dark:border-r border-slate-700 border-r-gray-300 dark:bg-slate-950 bg-gray-100 p-3 sm:p-4 flex-shrink-0">
                <div className="space-y-1">
                  {TABS.map((tab, tabIndex) => (
                    <button
                      key={tab.id}
                      data-tv-focusable
                      data-tv-id={`settings-tab-${tab.id}`}
                      data-tv-group="settings-tabs"
                      data-tv-index={tabIndex + 1}
                      data-tv-initial={tabIndex === 0}
                      tabIndex={0}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all ${
                        activeTab === tab.id
                          ? 'dark:bg-slate-800 bg-gray-200 dark:text-white text-slate-900 shadow-sm'
                          : 'dark:hover:bg-slate-800/50 hover:bg-gray-200 dark:text-slate-300 text-slate-600'
                      }`}
                    >
                      {tab.icon}
                      <span className="font-medium">{tab.label as string}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                {activeTab === 'general' && (
                  <div className="max-w-md space-y-8" data-tv-tab="general">
                    <div>
                      <label className="text-sm dark:text-slate-400 text-slate-600 mb-2 block">{t('theme')}</label>
                      <select
                        data-tv-focusable
                        data-tv-id="settings-theme-select"
                        data-tv-group="settings-content"
                        data-tv-initial
                        data-tv-index="10"
                        tabIndex={0}
                        value={localTheme}
                        onChange={(e) => {
                          const newTheme = e.target.value as 'light' | 'dark' | 'system';
                          setLocalTheme(newTheme);
                          setTheme(newTheme);
                        }}
                        onKeyDown={(e: React.KeyboardEvent<HTMLSelectElement>) => {
                          if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
                            e.preventDefault();
                            // Try to open select dropdown using showPicker API
                            const select = e.currentTarget;
                            if ('showPicker' in select) {
                              select.showPicker();
                            } else {
                              // Fallback: focus and expand size to show all options
                              const fallbackSelect = select as HTMLSelectElement;
                              fallbackSelect.size = fallbackSelect.options.length;
                              fallbackSelect.focus();
                            }
                          } else if (e.key === 'Escape' || e.key === 'Back') {
                            // Close expanded select
                            e.currentTarget.size = 0;
                          }
                        }}
                        className="w-full px-4 py-3 dark:bg-slate-800 bg-white dark:border border-slate-700 border-gray-300 rounded-lg dark:text-white text-slate-900"
                      >
                        <option value="dark">{t('dark')}</option>
                        <option value="light">{t('light')}</option>
                        <option value="system">{t('system')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm dark:text-slate-400 text-slate-600 mb-2 block">{t('language')}</label>
                      <select
                        data-tv-focusable
                        data-tv-id="settings-lang-select"
                        data-tv-group="settings-content"
                        data-tv-index="11"
                        tabIndex={0}
                        value={currentLang}
                        onChange={(e) => changeLanguage(e.target.value as 'pl' | 'en' | 'cs' | 'sk' | 'be' | 'de')}
                        onKeyDown={(e: React.KeyboardEvent<HTMLSelectElement>) => {
                          if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
                            e.preventDefault();
                            // Try to open select dropdown using showPicker API
                            const select = e.currentTarget;
                            if ('showPicker' in select) {
                              select.showPicker();
                            } else {
                              // Fallback: focus and expand size to show all options
                              const fallbackSelect = select as HTMLSelectElement;
                              fallbackSelect.size = fallbackSelect.options.length;
                              fallbackSelect.focus();
                            }
                          } else if (e.key === 'Escape' || e.key === 'Back') {
                            // Close expanded select
                            e.currentTarget.size = 0;
                          }
                        }}
                        className="w-full px-4 py-3 dark:bg-slate-800 bg-white dark:border border-slate-700 border-gray-300 rounded-lg dark:text-white text-slate-900"
                      >
                        <option value="pl">Polski</option>
                        <option value="cs">Čeština</option>
                        <option value="sk">Slovenčina</option>
                        <option value="be">Беларуская</option>
                        <option value="de">Deutsch</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'player' && (
                  <div className="max-w-md space-y-8" data-tv-tab="player">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium dark:text-white text-slate-900">{t('autoPlay')}</p>
                        <p className="text-sm dark:text-slate-400 text-slate-600">{t('autoPlayDescription')}</p>
                      </div>
                      <Switch
                        data-tv-focusable="true"
                        data-tv-id="settings-autoplay"
                        data-tv-group="settings-content"
                        data-tv-initial="true"
                        data-tv-index="30"
                        tabIndex={0}
                        checked={settings.autoPlay}
                        onCheckedChange={(v) => updateSetting('autoPlay', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium dark:text-white text-slate-900">{t('autoPlayEpisodes')}</p>
                        <p className="text-sm dark:text-slate-400 text-slate-600">{t('autoPlayEpisodesDescription')}</p>
                      </div>
                      <Switch
                        data-tv-focusable="true"
                        data-tv-id="settings-autoplay-episodes"
                        data-tv-group="settings-content"
                        data-tv-index="31"
                        tabIndex={0}
                        checked={settings.autoPlayEpisodes}
                        onCheckedChange={(v) => updateSetting('autoPlayEpisodes', v)}
                      />
                    </div>

                    <div>
                      <label className="text-sm dark:text-slate-400 text-slate-600 mb-3 block">
                        {t('videoQuality')}
                      </label>
                      <select
                        data-tv-focusable
                        data-tv-id="settings-quality-select"
                        data-tv-group="settings-content"
                        data-tv-index="32"
                        tabIndex={0}
                        value={settings.videoQuality}
                        onChange={(e) => updateSetting('videoQuality', e.target.value as any)}
                        className="w-full px-4 py-3 dark:bg-slate-800 bg-white dark:border border-slate-700 border-gray-300 rounded-lg dark:text-white text-slate-900"
                      >
                        <option value="auto">{t('auto')}</option>
                        <option value="1080p">{t('1080p')}</option>
                        <option value="720p">{t('720p')}</option>
                        <option value="480p">{t('480p')}</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="default-volume" className="text-sm text-slate-400 mb-3 block">
                        {t('defaultVolume')} — {Math.round(settings.volume * 100)}%
                      </label>
                      <input
                        data-tv-focusable
                        data-tv-id="settings-volume"
                        data-tv-group="settings-content"
                        data-tv-index="33"
                        tabIndex={0}
                        id="default-volume"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.volume}
                        onChange={(e) => updateSetting('volume', Number.parseFloat(e.target.value))}
                        className="w-full accent-green-700"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium dark:text-white text-slate-900">{t('hardwareAcceleration')}</p>
                        <p className="text-sm dark:text-slate-400 text-slate-600">{t('hardwareAccelerationDescription')}</p>
                      </div>
                      <Switch
                        data-tv-focusable="true"
                        data-tv-id="settings-hw-accel"
                        data-tv-group="settings-content"
                        data-tv-index="34"
                        tabIndex={0}
                        checked={settings.hardwareAcceleration}
                        onCheckedChange={(v) => updateSetting('hardwareAcceleration', v)}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'epg' && (
                  <div className="max-w-lg space-y-8" data-tv-tab="epg">
                    <div>
                      <label className="text-sm dark:text-slate-400 text-slate-600 mb-2 block">{t('epgSource')}</label>
                      <select
                        data-tv-focusable
                        data-tv-id="settings-epg-service"
                        data-tv-group="settings-content"
                        data-tv-initial
                        data-tv-index="20"
                        tabIndex={0}
                        value={selectedService}
                        onChange={(e) => handleEpgServiceChange(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLSelectElement>) => {
                          if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
                            e.preventDefault();
                            const select = e.currentTarget;
                            if ('showPicker' in select) {
                              select.showPicker();
                            } else {
                              const fallbackSelect = select as HTMLSelectElement;
                              fallbackSelect.size = fallbackSelect.options.length;
                              fallbackSelect.focus();
                            }
                          } else if (e.key === 'Escape' || e.key === 'Back') {
                            e.currentTarget.size = 0;
                          }
                        }}
                        className="w-full px-4 py-3 dark:bg-slate-800 bg-white dark:border border-slate-700 border-gray-300 rounded-lg dark:text-white text-slate-900"
                      >
                        {epgServices.map(service => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {showCustomUrl && (
                      <div>
                        <label htmlFor="custom-epg-url" className="text-sm text-slate-400 mb-2 block">{t('customEpgUrl')}</label>
                        <input
                          id="custom-epg-url"
                          type="url"
                          value={epgUrl}
                          onChange={(e) => {
                            const newUrl = e.target.value;
                            setEpgUrl(newUrl);
                            if (newUrl.trim()) {
                              setExternalEpgUrl(newUrl.trim());
                            }
                          }}
                          onFocus={showKeyboard}
                          placeholder="https://twoj-serwer.pl/epg.xml"
                          className="w-full px-4 py-3 dark:bg-slate-800 bg-white dark:border border-slate-700 border-gray-300 rounded-2xl"
                        />
                      </div>
                    )}

                    <div className="pt-4 dark:border-t border-slate-700 border-t-gray-300">
                      <p className="text-xs dark:text-slate-400 text-slate-600 mb-1">{t('currentEpgUrl')}</p>
                      <p className="text-emerald-400 break-all text-sm font-mono">
                        {effectiveEpgUrl || t('autoEpgFromPortal')}
                      </p>
                    </div>

                    <div className="pt-2">
                      <Button variant="outline" onClick={handleResetEpg}>
                        {t('reset')}
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'advanced' && (
                  <div className="max-w-md space-y-8" data-tv-tab="advanced">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium dark:text-white text-slate-900">{t('debugMode')}</p>
                        <p className="text-sm dark:text-slate-400 text-slate-600">{t('debugModeDescription')}</p>
                      </div>
                      <Switch
                        data-tv-focusable="true"
                        data-tv-id="settings-debug"
                        data-tv-group="settings-content"
                        data-tv-initial="true"
                        data-tv-index="40"
                        tabIndex={0}
                        checked={settings.debugMode}
                        onCheckedChange={(v) => updateSetting('debugMode', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium dark:text-white text-slate-900">{t('hideAdultCategories')}</p>
                        <p className="text-sm dark:text-slate-400 text-slate-600">{t('hideAdultCategoriesDescription')}</p>
                      </div>
                      <Switch
                        data-tv-focusable="true"
                        data-tv-id="settings-hide-adult"
                        data-tv-group="settings-content"
                        data-tv-index="41"
                        tabIndex={0}
                        checked={settings.hideAdultCategories}
                        onCheckedChange={(v) => updateSetting('hideAdultCategories', v)}
                      />
                    </div>

                    <div className="pt-4 dark:border-t border-slate-700 border-t-gray-300">
                      <p className="font-medium dark:text-white text-slate-900 mb-2">{t('clearWatchHistory')}</p>
                      <p className="text-sm dark:text-slate-400 text-slate-600 mb-4">
                        {t('clearWatchHistoryDescription')}
                      </p>
                      <Button
                        data-tv-focusable
                        data-tv-id="settings-clear-history"
                        data-tv-group="settings-content"
                        data-tv-index="41"
                        tabIndex={0}
                        variant="outline"
                        onClick={handleClearRecentViewed}
                        disabled={!activePortal}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('clearHistory')}
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'about' && (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center" data-tv-tab="about">
                    <img
                      src="https://cdn.jsdelivr.net/gh/Sidimadtv/all/sidi/assets/images/logo.png"
                      alt="S!d!m@dtv-STB"
                      className="w-24 h-24 object-contain mb-4"
                    />
                    <h3 className="text-3xl font-bold text-green-500 mb-1 tracking-wider">S!d!m@dtv-STB</h3>
                    <p className="dark:text-slate-400 text-slate-600 mb-6">{t('version')} {version || '—'}</p>
                    
                    <div className="text-sm dark:text-slate-500 text-slate-500 max-w-xs leading-relaxed">
                      {t('appDescription')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div data-tv-group="settings-footer" className="dark:border-t border-slate-700 border-t-gray-300 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex justify-end gap-3">
              <Button
                data-tv-focusable
                data-tv-id="settings-cancel-btn"
                data-tv-index={100}
                tabIndex={0}
                variant="outline"
                onClick={onClose}
              >
                {t('cancel')}
              </Button>
              <Button
                data-tv-focusable
                data-tv-id="settings-save-btn"
                data-tv-index={101}
                tabIndex={0}
                onClick={handleSave}
              >
                {t('saveChanges')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
