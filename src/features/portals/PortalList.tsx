// =========================
// 🌐 PORTAL LIST COMPONENT
// =========================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePortalsStore } from '@/store/portals.store';
import { useTranslation } from '@/hooks/useTranslation';
import { PortalAccount } from './portals.types';
import { PortalForm } from './PortalForm';
import { PortalTest } from './PortalTest';
import { fetchLatestBlogPortals, fetchPortalsFromUrl, getSavedImportUrls, addSavedImportUrl, removeSavedImportUrl, getBlogSources, addBlogSource, removeBlogSource, exportBlogSources, importBlogSources, BlogPortalEntry, DEFAULT_BLOG_POSTS } from '@/utils/portalImporter';
import { invoke } from '@tauri-apps/api/core';
import { useM3uStore } from '@/store/m3u.store';
import { CheckCircle, Circle, Plus, Target, RefreshCw, Edit, Trash2, X, Globe, Monitor, Download, Upload, History, FileText, Trash, Save } from 'lucide-react';

export const PortalList: React.FC = () => {
  const { t, currentLang } = useTranslation();
  const [editingPortal, setEditingPortal] = useState<PortalAccount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testingPortal, setTestingPortal] = useState<string | null>(null);
  const [activeMenuPortal, setActiveMenuPortal] = useState<string | null>(null);
  const [deletingPortal, setDeletingPortal] = useState<PortalAccount | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importEntries, setImportEntries] = useState<BlogPortalEntry[] | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [showSavedUrls, setShowSavedUrls] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [showBlogSources, setShowBlogSources] = useState(false);
  const [showAddBlogSource, setShowAddBlogSource] = useState(false);
  const [blogSourceName, setBlogSourceName] = useState('');
  const [blogSourceUrl, setBlogSourceUrl] = useState('');
  const blogFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    portals,
    activePortalId,
    deletePortal,
    setActivePortal,
    addPortal,
  } = usePortalsStore();

  const addM3u = useM3uStore(s => s.addM3u);

  const testingPortalData = usePortalsStore(s =>
    testingPortal ? s.portals.find(p => p.id === testingPortal) : undefined
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const lastPortalRef = useRef<string | null>(null);
  const portalCardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const testingPortalRef = useRef<string | null>(null);
  const editingPortalRef = useRef<string | null>(null);

  // Focus management using useCallback and refs
  const focusMenuButton = useCallback(() => {
    if (menuRef.current) {
      const firstButton = menuRef.current.querySelector('[data-tv-initial]') as HTMLElement;
      if (firstButton) {
        firstButton.focus();
      } else {
        const firstButtonAny = menuRef.current.querySelector('button') as HTMLElement;
        if (firstButtonAny) {
          firstButtonAny.focus();
        }
      }
    }
  }, []);

  const focusPortalCard = useCallback((portalId: string) => {
    // Don't restore focus if a modal is open (e.g., PortalTest, PortalForm)
    const openModal = document.querySelector('[data-tv-container]:not([data-tv-container="main"]):not([data-tv-container="navigation"])');
    if (openModal) {
      return;
    }

    const portalCard = portalCardRefs.current.get(portalId);
    if (portalCard) {
      portalCard.focus();
    }
  }, []);

  const focusAddButton = useCallback(() => {
    if (addButtonRef.current) {
      addButtonRef.current.focus();
    }
  }, []);

  // Auto-focus first menu button when menu opens, restore focus when closes
  useEffect(() => {
    if (activeMenuPortal) {
      lastPortalRef.current = activeMenuPortal;
      focusMenuButton();
    } else if (lastPortalRef.current) {
      focusPortalCard(lastPortalRef.current);
    }
  }, [activeMenuPortal, focusMenuButton, focusPortalCard]);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!activeMenuPortal) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking on the portal card (data-portal-id)
      // or inside the menu itself
      const isPortalCard = target.closest('[data-portal-id]') !== null;
      const isInsideMenu = menuRef.current?.contains(target) ?? false;

      if (!isPortalCard && !isInsideMenu) {
        setActiveMenuPortal(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuPortal(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuPortal]);

  const handleEdit = (portal: PortalAccount) => {
    editingPortalRef.current = portal.id;
    setEditingPortal(portal);
    setShowForm(true);
  };

  const handleDelete = (portal: PortalAccount) => {
    setDeletingPortal(portal);
  };

  const confirmDelete = () => {
    if (deletingPortal) {
      deletePortal(deletingPortal.id);
      setDeletingPortal(null);

      // Restore focus after delete modal closes
      // If there are still portals, focus the first one
      if (portals.length > 1) {
        const firstPortal = portals.find(p => p.id !== deletingPortal.id);
        if (firstPortal) {
          focusPortalCard(firstPortal.id);
        }
      } else {
        // No portals left, focus the "Add Portal" button
        focusAddButton();
      }
    }
  };

  const cancelDelete = () => {
    setDeletingPortal(null);

    // Restore focus to the portal card after canceling delete
    if (deletingPortal) {
      focusPortalCard(deletingPortal.id);
    }
  };

  const handleSetActive = (portal: PortalAccount) => {
    setActivePortal(portal.id);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPortal(null);
  };

  const handleFetchPortals = async () => {
    setImporting(true);
    try {
      const entries = await fetchLatestBlogPortals();
      setImportEntries(entries);
    } catch (e) {
      setImportEntries([]);
    } finally {
      setImporting(false);
    }
  };

  const handleFetchFromBlogSource = async (url: string) => {
    setImporting(true);
    try {
      const entries = await fetchPortalsFromUrl(url);
      setImportEntries(entries);
      setShowUrlImport(false);
    } catch (e) {
      alert('Failed to fetch: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const handleBlogFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const count = importBlogSources(ev.target?.result as string);
        setExportStatus(`Imported ${count} blog source(s)`);
        setTimeout(() => setExportStatus(null), 3000);
        setShowBlogSources(false);
        setTimeout(() => setShowBlogSources(true), 10);
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportBlogUrls = () => {
    const json = exportBlogSources();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blog-sources-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportStatus('Blog URLs exported');
    setTimeout(() => setExportStatus(null), 3000);
  };

  const handleConfirmImport = () => {
    if (!importEntries) return;
    let added = 0;
    for (const entry of importEntries) {
      if (entry.type === 'm3u' && entry.m3uUrl) {
        addM3u({
          name: entry.name,
          sourceType: 'url',
          url: entry.m3uUrl,
          isActive: false,
        });
        added++;
      } else if (entry.type === 'mac' && entry.mac) {
        const dup = portals.some(
          p => p.mac.toLowerCase() === entry.mac!.toLowerCase() && p.portalUrl === entry.portalUrl
        );
        if (!dup) {
          addPortal({
            name: entry.name,
            login: '',
            password: '',
            portalUrl: entry.portalUrl,
            mac: entry.mac,
            isActive: false,
          });
          added++;
        }
      }
    }
    setImportEntries(null);
    if (added > 0) focusAddButton();
  };

  const handleCancelImport = () => {
    setImportEntries(null);
    focusAddButton();
  };

  const handleExport = async () => {
    try {
      const data = JSON.stringify({ portals, exportedAt: new Date().toISOString() }, null, 2);
      const path = await invoke<string>('export_portals', { data, exportType: 'mac' });
      setExportStatus(`Exported to: ${path}`);
      setTimeout(() => setExportStatus(null), 5000);
    } catch {
      // Fallback: browser blob download
      const data = JSON.stringify({ portals, exportedAt: new Date().toISOString() }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portals-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('Downloaded (check browser downloads)');
      setTimeout(() => setExportStatus(null), 5000);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const entries: BlogPortalEntry[] = (json.portals || json || []).map((p: any) => ({
          name: p.name || p.portalUrl || 'Unknown',
          portalUrl: p.portalUrl || '',
          mac: p.mac || '',
        })).filter((e: BlogPortalEntry) => e.portalUrl && e.mac);
        setImportEntries(entries);
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportFromUrl = async (url?: string) => {
    const targetUrl = url || importUrl.trim();
    if (!targetUrl) return;
    setImporting(true);
    try {
      const entries = await fetchPortalsFromUrl(targetUrl);
      setImportEntries(entries);
      addSavedImportUrl(targetUrl);
      setShowUrlImport(false);
      setImportUrl('');
    } catch (e) {
      alert('Failed to fetch: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const uniquePortalsCount = importEntries
    ? importEntries.filter(e => {
        if (e.type === 'mac') {
          return !portals.some(p => p.mac?.toLowerCase() === e.mac?.toLowerCase() && p.portalUrl === e.portalUrl);
        }
        return true; // M3U entries are always new
      }).length
    : 0;

  const getStatusColor = (portal: PortalAccount) => {
    if (portal.id === activePortalId) return 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-400/30 shadow-xl shadow-emerald-500/20';
    return 'dark:bg-slate-800/50 bg-white/50 hover:dark:bg-slate-700/60 hover:bg-gray-200/60 dark:border-slate-700/50 border-gray-300/50 hover:dark:border-slate-600/50 hover:border-gray-400/50';
  };

  const getStatusIcon = (portal: PortalAccount) => {
    if (portal.id === activePortalId) return <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />;
    return <Circle className="w-5 h-5 md:w-6 md:h-6 text-slate-400" />;
  };

  const renderBlogSourcesContent = (onCloseParent?: () => void) => (
    <div className="py-2 px-2 space-y-1 max-h-64 overflow-y-auto">
      <button
        onClick={() => { onCloseParent?.(); setShowBlogSources(false); handleFetchPortals(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-violet-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        Fetch all
      </button>
      {getBlogSources().map((source) => (
        <div key={source.url} className="flex items-center gap-1">
          <button
            onClick={() => { onCloseParent?.(); setShowBlogSources(false); handleFetchFromBlogSource(source.url); }}
            className="flex-1 text-left text-xs text-white hover:bg-slate-700 rounded-lg px-3 py-2 transition-colors truncate"
            title={source.url}
          >
            <div className="font-medium">{source.name}</div>
            <div className="text-slate-400 truncate">{source.url}</div>
          </button>
          {!DEFAULT_BLOG_POSTS.some(d => d.url === source.url) && (
            <button
              onClick={() => { removeBlogSource(source.url); setShowBlogSources(false); setTimeout(() => setShowBlogSources(true), 10); }}
              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors shrink-0"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      {showAddBlogSource && (
        <div className="space-y-2 px-3 py-2">
          <input
            type="text"
            value={blogSourceName}
            onChange={(e) => setBlogSourceName(e.target.value)}
            placeholder="Source name"
            className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
          />
          <input
            type="text"
            value={blogSourceUrl}
            onChange={(e) => setBlogSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={() => { addBlogSource(blogSourceName, blogSourceUrl); setBlogSourceName(''); setBlogSourceUrl(''); setShowAddBlogSource(false); }}
            disabled={!blogSourceName.trim() || !blogSourceUrl.trim()}
            className="w-full px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
          >
            <Save className="w-3 h-3 inline mr-1" />
            Save
          </button>
        </div>
      )}
      <button
        onClick={() => setShowAddBlogSource(!showAddBlogSource)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cyan-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        {showAddBlogSource ? 'Cancel' : 'Add custom'}
      </button>
      <div className="border-t border-slate-600 my-1" />
      <button
        onClick={() => { onCloseParent?.(); setShowBlogSources(false); handleExportBlogUrls(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export blog URLs
      </button>
      <button
        onClick={() => blogFileInputRef.current?.click()}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        Import blog URLs
      </button>
    </div>
  );

  return (
    <div data-tv-container="main" className="p-4 md:p-8 overflow-x-hidden">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 md:mb-12">
        <div className="flex flex-wrap justify-between items-start gap-4 md:gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r dark:from-white dark:via-slate-200 dark:to-slate-400 from-slate-900 via-slate-700 to-slate-500 bg-clip-text text-transparent">
              {t('managePortals')}
            </h1>
            <p className="dark:text-slate-400 text-slate-600 text-sm md:text-base lg:text-lg max-w-xl">
              {t('portalDescription')}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              ref={addButtonRef}
              id="add-portal-btn"
              data-tv-focusable
              data-tv-id="add-portal-btn"
              data-tv-index={100}
              data-tv-group="portals-content"
              data-tv-initial
              tabIndex={0}
              onClick={() => setShowForm(true)}
              className="group relative px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl md:rounded-2xl font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 flex items-center gap-2 md:gap-3 overflow-hidden text-sm md:text-base"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Plus className="relative w-5 h-5 md:w-6 md:h-6 group-hover:rotate-90 transition-transform duration-300" />
              <span className="relative">{t('addPortal')}</span>
            </button>
            <button
              onClick={handleExport}
              className="group relative px-3 md:px-4 py-3 md:py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl md:rounded-2xl font-semibold shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 flex items-center gap-1 md:gap-2 overflow-hidden text-sm md:text-base"
              title="Export all portals as JSON"
            >
              <Upload className="relative w-4 h-4 md:w-5 md:h-5" />
              <span className="relative hidden sm:inline whitespace-nowrap">Export</span>
            </button>
            {portals.length > 0 && (
              <button
                onClick={() => setDeletingAll(true)}
                className="group relative px-3 md:px-4 py-3 md:py-4 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl md:rounded-2xl font-semibold shadow-xl shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 flex items-center gap-1 md:gap-2 overflow-hidden text-sm md:text-base"
                title="Delete all portals"
              >
                <Trash2 className="relative w-4 h-4 md:w-5 md:h-5" />
                <span className="relative hidden sm:inline whitespace-nowrap">Delete All</span>
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => { if (showUrlImport) setShowBlogSources(false); setShowUrlImport(!showUrlImport); }}
                disabled={importing}
                className="group relative px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl md:rounded-2xl font-semibold shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 flex items-center gap-2 md:gap-3 overflow-hidden text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Download className={`relative w-4 h-4 md:w-5 md:h-5 ${importing ? 'animate-bounce' : ''}`} />
                <span className="relative whitespace-nowrap">{importing ? 'Fetching...' : 'Import'}</span>
              </button>

              {/* Import dropdown */}
              {showUrlImport && (
                <div className="absolute right-0 top-full mt-2 z-30 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
                  <button
                    onClick={() => setShowBlogSources(!showBlogSources)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-slate-700 transition-colors"
                  >
                    <Download className="w-4 h-4 text-violet-400" />
                    <span className="flex-1 text-left">From blog</span>
                    <svg className={`w-3 h-3 transition-transform ${showBlogSources ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showBlogSources && (
                    <div className="border-t border-slate-600">
                      {renderBlogSourcesContent(() => setShowUrlImport(false))}
                    </div>
                  )}
                  <button
                    onClick={() => { setShowUrlImport(false); fileInputRef.current?.click(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-slate-700 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-cyan-400" />
                    From file
                  </button>
                  <div className="border-t border-slate-600" />
                  <div className="px-4 py-3">
                    <p className="text-xs text-slate-400 mb-2">From URL</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-700 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleImportFromUrl()}
                      />
                      <button
                        onClick={() => handleImportFromUrl()}
                        disabled={importing || !importUrl.trim()}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                      >
                        Go
                      </button>
                    </div>
                    {/* Saved URLs */}
                    {getSavedImportUrls().length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => setShowSavedUrls(!showSavedUrls)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                        >
                          <History className="w-3 h-3" />
                          Saved URLs ({getSavedImportUrls().length})
                        </button>
                        {showSavedUrls && (
                          <div className="mt-1 space-y-1 max-h-24 overflow-y-auto">
                            {getSavedImportUrls().map((saved) => (
                              <div key={saved} className="flex items-center gap-1">
                                <button
                                  onClick={() => { setImportUrl(saved); handleImportFromUrl(saved); }}
                                  className="flex-1 text-left text-xs text-violet-300 hover:text-white truncate py-1 px-2 rounded hover:bg-slate-700 transition-colors"
                                  title={saved}
                                >
                                  {saved}
                                </button>
                                <button
                                  onClick={() => { removeSavedImportUrl(saved); setShowSavedUrls(false); setTimeout(() => setShowSavedUrls(true), 10); }}
                                  className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                  title="Remove"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Import from blogs button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowUrlImport(false);
                  setShowBlogSources(!showBlogSources);
                }}
                disabled={importing}
                className="group relative px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl md:rounded-2xl font-semibold shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 flex items-center gap-2 md:gap-3 overflow-hidden text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Globe className={`relative w-4 h-4 md:w-5 md:h-5 ${importing ? 'animate-bounce' : ''}`} />
                <span className="relative whitespace-nowrap">{importing ? 'Fetching...' : 'Import from blogs'}</span>
              </button>

              {showBlogSources && !showUrlImport && (
                <div className="absolute right-0 top-full mt-2 z-30 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
                  {renderBlogSourcesContent()}
                </div>
              )}
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelected}
              className="hidden"
            />
            <input
              ref={blogFileInputRef}
              type="file"
              accept=".json"
              onChange={handleBlogFileImport}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Export status toast */}
      {exportStatus && (
        <div className="max-w-7xl mx-auto mb-4 text-center text-sm font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-xl py-2 px-4">
          {exportStatus}
        </div>
      )}

      {/* Portals Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {portals.map((portal, portalIndex) => (
            <div
              key={portal.id}
              ref={(el) => {
                if (el) portalCardRefs.current.set(portal.id, el);
              }}
              data-tv-id={portal.id}
              data-portal-id={portal.id}
              data-tv-focusable
              data-tv-index={portalIndex}
              data-tv-group="portals-content"
              data-tv-disabled={activeMenuPortal === portal.id ? true : undefined}
              tabIndex={activeMenuPortal === portal.id ? -1 : 0}
              onKeyDown={(e) => {
                // TV remote: Enter opens action menu, Escape closes it
                if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
                  e.preventDefault();
                  setActiveMenuPortal(portal.id);
                } else if (e.key === 'Escape' || e.key === 'Back') {
                  e.preventDefault();
                  setActiveMenuPortal(null);
                }
              }}
              onClick={() => setActiveMenuPortal(portal.id)}
              className={`group relative backdrop-blur-xl rounded-2xl md:rounded-3xl p-4 md:p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer ${getStatusColor(portal)} dark:border border-white/10 border-gray-300/20 ${activeMenuPortal === portal.id ? 'pointer-events-none' : ''}`}
            >
            {/* Header */}
            <div className="flex justify-between items-start mb-4 md:mb-6 min-w-0">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-xl md:text-2xl backdrop-blur-sm border border-emerald-400/20 flex-shrink-0">
                  {getStatusIcon(portal)}
                </div>
                <div className="space-y-1 min-w-0 overflow-hidden">
                  <h3 className="font-bold text-base md:text-lg lg:text-xl dark:text-white text-slate-900 tracking-tight truncate">{portal.name}</h3>
                  {portal.description && (
                    <p className="text-xs md:text-sm dark:text-slate-400 text-slate-600 truncate">{portal.description}</p>
                  )}
                </div>
              </div>

              {/* Action Menu Overlay */}
              {activeMenuPortal === portal.id && (
                <div
                  ref={menuRef}
                  className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur-md rounded-2xl md:rounded-3xl flex flex-col items-center justify-center gap-2 md:gap-3 p-3 md:p-4 pointer-events-auto"
                  data-tv-container="portal-actions"
                >
                  <p className="text-white font-semibold mb-1 md:mb-2 text-sm md:text-base truncate px-2">{portal.name}</p>
                  <div className="flex flex-col gap-2 w-full max-w-[180px] md:max-w-[200px]">
                    {portal.id !== activePortalId && (
                      <button
                        data-tv-id={`${portal.id}-set-active`}
                        data-tv-focusable
                        data-tv-group="portal-actions"
                        data-tv-index={0}
                        data-tv-initial
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); handleSetActive(portal); setActiveMenuPortal(null); }}
                        className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg md:rounded-xl transition-all text-sm md:text-base"
                      >
                        <Target className="w-5 h-5 md:w-6 md:h-6" />
                        <span className="whitespace-nowrap">{t('setActive')}</span>
                      </button>
                    )}
                    <button
                      data-tv-id={`${portal.id}-test`}
                      data-tv-focusable
                      data-tv-group="portal-actions"
                      data-tv-index={portal.id !== activePortalId ? 1 : 0}
                      data-tv-initial={portal.id === activePortalId ? true : undefined}
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); testingPortalRef.current = portal.id; setTestingPortal(portal.id); setActiveMenuPortal(null); }}
                      className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg md:rounded-xl transition-all text-sm md:text-base"
                    >
                      <RefreshCw className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="whitespace-nowrap">{t('testConnection')}</span>
                    </button>
                    <button
                      data-tv-id={`${portal.id}-edit`}
                      data-tv-focusable
                      data-tv-group="portal-actions"
                      data-tv-index={portal.id !== activePortalId ? 2 : 1}
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); handleEdit(portal); setActiveMenuPortal(null); }}
                      className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg md:rounded-xl transition-all text-sm md:text-base"
                    >
                      <Edit className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="whitespace-nowrap">{t('edit')}</span>
                    </button>
                    <button
                      data-tv-id={`${portal.id}-delete`}
                      data-tv-focusable
                      data-tv-group="portal-actions"
                      data-tv-index={portal.id !== activePortalId ? 3 : 2}
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); handleDelete(portal); setActiveMenuPortal(null); }}
                      className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg md:rounded-xl transition-all text-sm md:text-base"
                    >
                      <Trash2 className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="whitespace-nowrap">{t('delete')}</span>
                    </button>
                    <button
                      type="button"
                      data-tv-focusable
                      data-tv-group="portal-actions"
                      data-tv-index={4}
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setActiveMenuPortal(null); }}
                      className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg md:rounded-xl transition-all mt-1 md:mt-2 text-sm md:text-base"
                    >
                      <X className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="whitespace-nowrap">{t('cancel')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Portal Info */}
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <Globe className="dark:text-slate-400 text-slate-600 flex-shrink-0 w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-mono dark:bg-slate-900/50 bg-gray-100/50 px-2 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl dark:text-slate-300 text-slate-700 break-all dark:border border-slate-700/50 border-gray-300/50">
                  {portal.portalUrl}
                </span>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <Monitor className="dark:text-slate-400 text-slate-600 w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-mono dark:text-slate-300 text-slate-700 dark:bg-slate-900/50 bg-gray-100/50 px-2 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl dark:border border-slate-700/50 border-gray-300/50 break-all">{portal.mac}</span>
              </div>

              {/* Tags */}
              {portal.tags && portal.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 md:gap-2 pt-2">
                  {portal.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 md:px-3 py-1 md:py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-400/20 backdrop-blur-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Active Badge */}
              {portal.id === activePortalId && (
                <div className="mt-3 md:mt-4">
                  <span className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs md:text-sm font-semibold rounded-full shadow-lg shadow-emerald-500/25">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-pulse"></span>
                    <span className="whitespace-nowrap">{t('active')}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Last Updated */}
            <div className="mt-4 md:mt-6 pt-3 md:pt-4 dark:border-t border-slate-700/50 border-t-gray-300/50 space-y-1">
              {portal.expiresAt && (
                <p className="text-[10px] md:text-xs dark:text-slate-500 text-slate-500 font-medium">
                  {t('accountExpires')}: {new Date(portal.expiresAt).toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : currentLang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              )}
              <p className="text-[10px] md:text-xs dark:text-slate-500 text-slate-500 font-medium">
                {t('lastUpdated')}: {new Date(portal.updatedAt).toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : currentLang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Help text */}
      {portals.length > 0 && (
        <div className="max-w-7xl mx-auto mt-8 text-center text-sm dark:text-slate-500 text-slate-500">
          {t('clickPortalForActions')}
        </div>
      )}

      {/* Empty State */}
      {portals.length === 0 && (
        <div className="max-w-2xl mx-auto text-center py-12 md:py-20">
          <div className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 rounded-2xl md:rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center backdrop-blur-sm border border-emerald-400/20 shadow-xl shadow-emerald-500/10">
            <Globe className="w-8 h-8 md:w-12 md:h-12 text-emerald-400" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold dark:text-white text-slate-900 mb-2 md:mb-3">
            {t('noResults')}
          </h3>
          <p className="dark:text-slate-400 text-slate-600 text-sm md:text-lg mb-6 md:mb-8 max-w-md mx-auto px-4">
            {t('portalDescription')}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl md:rounded-2xl font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 text-sm md:text-base"
          >
            {t('addPortal')}
          </button>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <PortalForm
          portal={editingPortal}
          onClose={handleFormClose}
        />
      )}

      {/* Test Modal */}
      {testingPortal && (
        <PortalTest
          portal={testingPortalData}
          onClose={() => setTestingPortal(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingPortal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            data-tv-container="modal"
            className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-[95vw] md:max-w-md border border-slate-700/50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-slate-700/50 bg-gradient-to-r from-red-500/10 to-orange-500/10">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-red-500/20 flex items-center justify-center backdrop-blur-sm border border-red-400/20 flex-shrink-0">
                  <Trash2 className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-white">
                    {t('deletePortal')}
                  </h2>
                  <p className="text-xs md:text-sm text-slate-400">{t('areYouSure')}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6">
              <p className="text-sm md:text-base text-slate-300 mb-2">
                {t('deletePortalConfirm')} <span className="font-semibold text-white break-words">"{deletingPortal.name}"</span>?
              </p>
              <p className="text-xs md:text-sm text-slate-500">
                {t('thisActionCannotBeUndone')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 p-4 md:p-6 pt-2 border-t border-slate-700/50">
              <button
                type="button"
                data-tv-focusable
                data-tv-group="delete-confirm"
                data-tv-index={0}
                tabIndex={0}
                onClick={cancelDelete}
                className="w-full sm:w-auto px-4 md:px-5 py-2 md:py-2.5 border border-slate-600 text-slate-300 rounded-lg md:rounded-xl hover:bg-slate-700/50 hover:text-white transition-all duration-200 hover:scale-105 text-sm md:text-base"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                data-tv-focusable
                data-tv-group="delete-confirm"
                data-tv-index={1}
                data-tv-initial
                tabIndex={0}
                onClick={confirmDelete}
                className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg md:rounded-xl font-semibold hover:from-red-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5 flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 text-sm md:text-base"
              >
                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {deletingAll && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-[95vw] md:max-w-md border border-slate-700/50 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-700/50 bg-gradient-to-r from-red-500/10 to-orange-500/10">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-red-500/20 flex items-center justify-center backdrop-blur-sm border border-red-400/20 flex-shrink-0">
                  <Trash2 className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-white">Delete All Portals</h2>
                  <p className="text-xs md:text-sm text-slate-400">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6">
              <p className="text-sm md:text-base text-slate-300 mb-2">
                Are you sure you want to delete all <span className="font-semibold text-white">{portals.length} portal(s)</span>?
              </p>
              <p className="text-xs md:text-sm text-slate-500">
                All portal data including cached channels, EPG, and favorites will be permanently removed.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 p-4 md:p-6 pt-2 border-t border-slate-700/50">
              <button
                onClick={() => setDeletingAll(false)}
                className="w-full sm:w-auto px-4 md:px-5 py-2 md:py-2.5 border border-slate-600 text-slate-300 rounded-lg md:rounded-xl hover:bg-slate-700/50 hover:text-white transition-all duration-200 hover:scale-105 text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const ids = [...portals.map(p => p.id)];
                  setDeletingAll(false);
                  for (const id of ids) {
                    await deletePortal(id);
                  }
                }}
                className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg md:rounded-xl font-semibold hover:from-red-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5 flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 text-sm md:text-base"
              >
                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Results Modal */}
      {importEntries && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            data-tv-container="modal"
            className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-[95vw] md:max-w-lg border border-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-slate-700/50 bg-gradient-to-r from-violet-500/10 to-purple-500/10 flex-shrink-0">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-violet-500/20 flex items-center justify-center backdrop-blur-sm border border-violet-400/20 flex-shrink-0">
                  <Download className="w-5 h-5 md:w-6 md:h-6 text-violet-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-white">Import Results</h2>
                  <p className="text-xs md:text-sm text-slate-400">
                    Found {importEntries.length} item(s) ({uniquePortalsCount} new)
                  </p>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
              {importEntries.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">No items found. The page may have changed or is unreachable.</p>
              )}
              {importEntries.map((entry, i) => {
                const isDup = entry.type === 'mac'
                  ? portals.some(p => p.mac?.toLowerCase() === entry.mac?.toLowerCase() && p.portalUrl === entry.portalUrl)
                  : false;
                return (
                  <div
                    key={`${entry.type}-${entry.portalUrl}-${entry.mac || entry.m3uUrl}-${i}`}
                    className={`flex items-center gap-3 p-2 md:p-3 rounded-lg md:rounded-xl text-xs md:text-sm ${
                      isDup ? 'dark:bg-slate-800/30 bg-gray-100/30 opacity-50' : 'dark:bg-slate-800/50 bg-gray-100/50'
                    }`}
                  >
                    {entry.type === 'm3u' ? (
                      <FileText className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    ) : (
                      <Monitor className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    )}
                    <span className="font-mono text-[10px] md:text-xs dark:text-slate-400 text-slate-500 w-16 md:w-24 flex-shrink-0 truncate">{entry.name}</span>
                    <span className="font-mono text-[10px] md:text-xs dark:text-slate-300 text-slate-600 flex-1 truncate">{entry.type === 'm3u' ? entry.m3uUrl : entry.portalUrl}</span>
                    {entry.type === 'mac' && <span className="font-mono text-[10px] md:text-xs dark:text-slate-300 text-slate-600 w-24 md:w-28 flex-shrink-0">{entry.mac}</span>}
                    {entry.type === 'm3u' && <span className="text-[10px] md:text-xs text-cyan-400 flex-shrink-0">M3U</span>}
                    {isDup && <span className="text-[10px] md:text-xs text-amber-400 flex-shrink-0">dup</span>}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 p-4 md:p-6 pt-2 border-t border-slate-700/50 flex-shrink-0">
              <button
                type="button"
                data-tv-focusable
                data-tv-group="import-confirm"
                data-tv-index={0}
                tabIndex={0}
                onClick={handleCancelImport}
                className="w-full sm:w-auto px-4 md:px-5 py-2 md:py-2.5 border border-slate-600 text-slate-300 rounded-lg md:rounded-xl hover:bg-slate-700/50 hover:text-white transition-all duration-200 hover:scale-105 text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                type="button"
                data-tv-focusable
                data-tv-group="import-confirm"
                data-tv-index={1}
                data-tv-initial
                tabIndex={0}
                onClick={handleConfirmImport}
                disabled={uniquePortalsCount === 0}
                className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg md:rounded-xl font-semibold hover:from-violet-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Download className="w-4 h-4 md:w-5 md:h-5" />
                Add {uniquePortalsCount} item(s)
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
