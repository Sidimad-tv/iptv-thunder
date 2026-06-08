import React, { useState, useRef } from 'react';
import { useM3uStore } from '@/store/m3u.store';

import { useTranslation } from '@/hooks/useTranslation';
import { M3uAccount, M3uSourceType } from './m3u.types';
import { M3uForm } from './M3uForm';
import { M3uChannelList } from './M3uChannelList';
import { M3uTest } from './M3uTest';
import { fetchLatestBlogPortals, fetchPortalsFromUrl, getBlogSources, addBlogSource, exportBlogSources, getSavedImportUrls, addSavedImportUrl, removeSavedImportUrl, BlogPortalEntry } from '@/utils/portalImporter';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Trash2, Globe, Upload, Edit, Circle, CheckCircle, FileText, Link2, Tv, Database, Play, RefreshCw, Bookmark } from 'lucide-react';

export const M3uList: React.FC = () => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<M3uAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<M3uAccount | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [viewingAccount, setViewingAccount] = useState<M3uAccount | null>(null);
  const [testingAccount, setTestingAccount] = useState<M3uAccount | null>(null);
  const [importing, setImporting] = useState(false);
  const [importEntries, setImportEntries] = useState<BlogPortalEntry[] | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [showBlogSources, setShowBlogSources] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [showSavedUrls, setShowSavedUrls] = useState(true);
  const [blogSourceName, setBlogSourceName] = useState('');
  const [blogSourceUrl, setBlogSourceUrl] = useState('');
  const [showAddBlogSource, setShowAddBlogSource] = useState(false);
  const blogFileInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const {
    accounts,
    activeM3uId,
    deleteM3u,
    setActiveM3u,
  } = useM3uStore();

  const handleExport = async () => {
    try {
      const data = JSON.stringify({ m3uAccounts: accounts, exportedAt: new Date().toISOString() }, null, 2);
      const path = await invoke<string>('export_portals', { data, exportType: 'm3u' });
      setExportStatus(`Exported to: ${path}`);
      setTimeout(() => setExportStatus(null), 5000);
    } catch {
      const data = JSON.stringify({ m3uAccounts: accounts, exportedAt: new Date().toISOString() }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `S!d!m@dtv-Stb-M3U-${new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('Downloaded (check browser downloads)');
      setTimeout(() => setExportStatus(null), 5000);
    }
  };

  const handleFetchAllBlogs = async () => {
    setImporting(true);
    setShowBlogSources(false);
    try {
      const entries = await fetchLatestBlogPortals();
      setImportEntries(entries.filter(e => e.type === 'm3u'));
    } catch { setImportEntries([]); }
    finally { setImporting(false); }
  };

  const handleFetchFromBlog = async (url: string) => {
    setImporting(true);
    setShowBlogSources(false);
    try {
      const entries = await fetchPortalsFromUrl(url);
      setImportEntries(entries.filter(e => e.type === 'm3u'));
    } catch { setImportEntries([]); }
    finally { setImporting(false); }
  };

  const handleImportFromUrl = async (url?: string) => {
    const targetUrl = url || importUrl.trim();
    if (!targetUrl) return;
    setImporting(true);
    setShowUrlImport(false);
    try {
      const entries = await fetchPortalsFromUrl(targetUrl);
      setImportEntries(entries.filter(e => e.type === 'm3u'));
      addSavedImportUrl(targetUrl);
      setImportUrl('');
    } catch { setImportEntries([]); }
    finally { setImporting(false); }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const entries: BlogPortalEntry[] = Array.isArray(json) ? json : json.portals || [];
        setImportEntries(entries.filter((en: BlogPortalEntry) => en.type === 'm3u'));
      } catch { setImportEntries([]); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getIcon = (type: M3uSourceType) => {
    switch (type) {
      case 'url': return <Link2 className="w-4 h-4" />;
      case 'xtream': return <Database className="w-4 h-4" />;
      case 'file': return <FileText className="w-4 h-4" />;
    }
  };

  const getSourceLabel = (type: M3uSourceType) => {
    switch (type) {
      case 'url': return 'M3U URL';
      case 'xtream': return 'Xtream';
      case 'file': return 'Local File';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r dark:from-white dark:via-slate-200 dark:to-slate-400 from-slate-900 via-slate-700 to-slate-500 bg-clip-text text-transparent">
              M3U Playlists
            </h1>
            <p className="dark:text-slate-400 text-slate-600 text-sm md:text-base">
              Manage IPTV playlists (M3U URLs, Xtream codes, local files)
            </p>
          </div>
          <div className="flex gap-3">
            <button
              ref={addButtonRef}
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all hover:scale-105 flex items-center gap-2 text-sm"
            >
              <Plus className="w-5 h-5" />
              <span>Add Playlist</span>
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:scale-105 flex items-center gap-1 text-sm"
              title="Export all M3U accounts"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            {accounts.length > 0 && (
              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                className="px-3 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-semibold shadow-xl shadow-red-500/25 hover:shadow-red-500/40 transition-all hover:scale-105 flex items-center gap-1 text-sm"
                title="Delete all M3U accounts"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete All</span>
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => { setShowBlogSources(!showBlogSources); setShowUrlImport(false); }}
                className="px-3 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-semibold shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all hover:scale-105 flex items-center gap-1 text-sm"
                title="Import M3U URLs from blogs"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline whitespace-nowrap">Import Blogs</span>
              </button>
              {showBlogSources && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-slate-600/50 shadow-2xl z-50 overflow-hidden">
                  <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                    <button
                      onClick={handleFetchAllBlogs}
                      disabled={importing}
                      className="w-full text-left px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {importing ? 'Fetching...' : 'Fetch all blog sources'}
                    </button>
                    <div className="border-t border-slate-700/50 pt-2">
                      <p className="text-xs text-slate-500 px-1 mb-1">Blog sources</p>
                      {getBlogSources().map((source) => (
                        <div key={source.url} className="flex items-center gap-1">
                          <button
                            onClick={() => handleFetchFromBlog(source.url)}
                            className="flex-1 text-left text-xs text-slate-300 hover:text-white truncate py-1.5 px-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                          >
                            <span className="font-medium">{source.name}</span>
                            <span className="text-slate-500 ml-1 truncate block">{source.url}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-700/50 pt-2">
                      {showAddBlogSource ? (
                        <div className="space-y-2">
                          <input
                            value={blogSourceName}
                            onChange={(e) => setBlogSourceName(e.target.value)}
                            placeholder="Source name"
                            className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-xs focus:outline-none focus:border-cyan-500"
                          />
                          <input
                            value={blogSourceUrl}
                            onChange={(e) => setBlogSourceUrl(e.target.value)}
                            placeholder="https://blogspot.com/..."
                            className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-xs focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            onClick={() => {
                              if (blogSourceName.trim() && blogSourceUrl.trim()) {
                                addBlogSource(blogSourceName.trim(), blogSourceUrl.trim());
                                setBlogSourceName('');
                                setBlogSourceUrl('');
                                setShowAddBlogSource(false);
                              }
                            }}
                            disabled={!blogSourceName.trim() || !blogSourceUrl.trim()}
                            className="w-full px-2 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                          >
                            Save source
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddBlogSource(true)}
                          className="w-full text-left px-2 py-1.5 text-cyan-400 hover:text-cyan-300 text-xs transition-colors"
                        >
                          + Add custom blog source
                        </button>
                      )}
                    </div>
                    <div className="border-t border-slate-700/50 pt-2 flex gap-2">
                      <button
                        onClick={() => {
                          const blob = new Blob([exportBlogSources()], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `S!d!m@dtv-Stb-Blog-Sources-${new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')}.json`;
                          document.body.appendChild(a); a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="flex-1 px-2 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-xs transition-colors text-center"
                      >
                        Export blog URLs
                      </button>
                      <button
                        onClick={() => blogFileInputRef.current?.click()}
                        className="flex-1 px-2 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-xs transition-colors text-center"
                      >
                        Import blog URLs
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowUrlImport(!showUrlImport); setShowBlogSources(false); }}
                className="px-3 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 transition-all hover:scale-105 flex items-center gap-1 text-sm"
                title="Import from URL"
              >
                <Link2 className="w-4 h-4" />
                <span className="hidden sm:inline">Import URL</span>
              </button>
              {showUrlImport && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-slate-600/50 shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-slate-500">From blog URL</p>
                    <div className="flex gap-2">
                      <input
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://blogspot.com/..."
                        className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={() => handleImportFromUrl()}
                        disabled={!importUrl.trim() || importing}
                        className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        {importing ? '...' : 'Go'}
                      </button>
                    </div>
                    <div className="border-t border-slate-700/50 pt-2">
                      <button
                        onClick={() => setShowSavedUrls(!showSavedUrls)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
                      >
                        <Bookmark className="w-3 h-3" />
                        Saved URLs ({getSavedImportUrls().length})
                      </button>
                      {showSavedUrls && (
                        <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                          {getSavedImportUrls().map((u) => (
                            <div key={u} className="flex items-center gap-1">
                              <button
                                onClick={() => handleImportFromUrl(u)}
                                className="flex-1 text-left text-xs text-cyan-300 hover:text-white truncate py-1 px-2 rounded hover:bg-slate-700/50"
                              >
                                {u}
                              </button>
                              <button
                                onClick={() => removeSavedImportUrl(u)}
                                className="p-1 text-slate-500 hover:text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-700/50 pt-2 flex gap-2">
                      <button
                        onClick={() => blogFileInputRef.current?.click()}
                        className="flex-1 px-2 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-xs transition-colors text-center"
                      >
                        From file
                      </button>
                      <button
                        onClick={() => {
                          setShowUrlImport(false);
                          setShowBlogSources(true);
                        }}
                        className="flex-1 px-2 py-1.5 bg-slate-600/30 hover:bg-slate-600/50 text-slate-300 rounded-lg text-xs transition-colors text-center"
                      >
                        From blog
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <input ref={blogFileInputRef} type="file" accept=".json" onChange={handleFileSelected} className="hidden" />
          </div>
        </div>
      </div>

      {/* Status toasts */}
      {exportStatus && (
        <div className="max-w-7xl mx-auto mb-4 text-center text-sm font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-xl py-2 px-4">
          {exportStatus}
        </div>
      )}

      {/* M3U Accounts Grid */}
      <div className="max-w-7xl mx-auto overflow-x-hidden">
        {accounts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-400/20">
              <FileText className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-2">No playlists yet</h3>
            <p className="dark:text-slate-400 text-slate-600 text-sm max-w-md mx-auto mb-6">
              Add an M3U URL, Xtream codes, or upload a local M3U file
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold shadow-xl hover:shadow-emerald-500/30 transition-all"
            >
              Add Playlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acct, idx) => (
              <div
                key={acct.id}
                data-tv-id={`m3u-card-${acct.id}`}
                data-tv-focusable
                data-tv-group="m3u-cards"
                data-tv-index={idx}
                tabIndex={0}
                className={`group relative backdrop-blur-xl rounded-2xl p-4 md:p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer dark:border border-white/10 border-gray-300/20 ${
                  acct.id === activeM3uId
                    ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-400/30 shadow-xl shadow-cyan-500/20'
                    : 'dark:bg-slate-800/50 bg-white/50 hover:dark:bg-slate-700/60 hover:bg-gray-200/60 dark:border-slate-700/50 border-gray-300/50'
                }`}
              >
                <div className="flex items-start gap-3 mb-4 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    acct.id === activeM3uId
                      ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/20'
                      : 'dark:bg-slate-700/50 bg-gray-100/50'
                  }`}>
                    {acct.id === activeM3uId
                      ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                      : <Circle className="w-5 h-5 text-slate-400" />
                    }
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <h3 className="font-bold text-base dark:text-white text-slate-900 truncate">{acct.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                        {getIcon(acct.sourceType)}
                        {getSourceLabel(acct.sourceType)}
                      </span>
                      {acct.id === activeM3uId && (
                        <span className="inline-flex items-center text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full animate-pulse">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {acct.url && (
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-3 h-3 dark:text-slate-500 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-mono dark:text-slate-400 text-slate-500 truncate">{acct.url}</span>
                  </div>
                )}
                {acct.serverUrl && (
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-3 h-3 dark:text-slate-500 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-mono dark:text-slate-400 text-slate-500 truncate">{acct.serverUrl}</span>
                  </div>
                )}
                {acct.channelCount !== undefined && (
                  <p className="text-xs dark:text-slate-500 text-slate-500">
                    <Tv className="w-3 h-3 inline mr-1" />
                    {acct.channelCount} channels
                  </p>
                )}

                {acct.tags && acct.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {acct.tags.map((tag, i) => (
                      <span key={i} className="text-xs dark:bg-slate-700/50 bg-gray-100/50 dark:text-slate-400 text-slate-500 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-3 dark:border-t border-slate-700/50 border-t-gray-300/50 flex gap-2 justify-end">
                  {acct.id !== activeM3uId ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveM3u(acct.id); }}
                      className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"
                      title="Set active"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingAccount(acct); }}
                      className={`p-2 rounded-lg transition-colors ${
                        (acct.channels?.length || 0) > 0
                          ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400'
                          : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                      }`}
                      title={(acct.channels?.length || 0) > 0 ? 'View channels' : 'Load channels'}
                    >
                      {(acct.channels?.length || 0) > 0 ? <Play className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setTestingAccount(acct); }}
                    className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                    title="Test connection"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingAccount(acct); setShowForm(true); }}
                    className="p-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingAccount(acct); }}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete All Confirmation */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700/50 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-700/50 bg-gradient-to-r from-red-500/10 to-orange-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-400/20 flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white">Delete All Playlists</h2>
                  <p className="text-xs text-slate-400">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6">
              <p className="text-sm text-slate-300 mb-2">
                Are you sure you want to delete all <span className="font-semibold text-white">{accounts.length} playlist(s)</span>?
              </p>
              <p className="text-xs text-slate-500">
                All M3U accounts and their cached channels will be permanently removed.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-4 md:p-6 pt-2 border-t border-slate-700/50">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700/50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const ids = [...accounts.map(a => a.id)];
                  setShowDeleteAllConfirm(false);
                  for (const id of ids) {
                    deleteM3u(id);
                  }
                }}
                className="px-6 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-orange-600 transition-all flex items-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Results Modal */}
      {importEntries && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 md:p-6 border-b border-slate-700/50 bg-gradient-to-r from-violet-500/10 to-purple-500/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-400/20 flex-shrink-0">
                  <Upload className="w-5 h-5 text-violet-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white">Import Results</h2>
                  <p className="text-xs text-slate-400">Found {importEntries.length} M3U playlist(s)</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
              {importEntries.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">No M3U URLs found on the blog pages.</p>
              )}
              {importEntries.map((entry, i) => {
                const isDup = accounts.some(a => a.url === entry.m3uUrl || a.serverUrl === entry.m3uUrl);
                return (
                  <div key={`m3u-${entry.m3uUrl}-${i}`} className={`flex items-center gap-3 p-2 rounded-lg text-xs ${isDup ? 'bg-slate-800/30 opacity-50' : 'bg-slate-800/50'}`}>
                    <FileText className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    <span className="font-mono text-slate-400 w-20 flex-shrink-0 truncate">{entry.name}</span>
                    <span className="font-mono text-slate-300 flex-1 truncate">{entry.m3uUrl}</span>
                    {isDup && <span className="text-amber-400 flex-shrink-0">dup</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 p-4 md:p-6 pt-2 border-t border-slate-700/50 flex-shrink-0">
              <button onClick={() => setImportEntries(null)} className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700/50 transition-colors text-sm">
                Cancel
              </button>
              <button
                onClick={() => {
                  const m3uEntries = importEntries.filter(e => e.type === 'm3u' && e.m3uUrl && !accounts.some(a => a.url === e.m3uUrl));
                  for (const entry of m3uEntries) {
                    useM3uStore.getState().addM3u({
                      name: entry.name,
                      sourceType: 'url',
                      url: entry.m3uUrl!,
                      isActive: false,
                    });
                  }
                  setImportEntries(null);
                }}
                disabled={importEntries.filter(e => e.type === 'm3u' && e.m3uUrl && !accounts.some(a => a.url === e.m3uUrl)).length === 0}
                className="px-6 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg font-semibold hover:from-violet-600 hover:to-purple-600 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Add {importEntries.filter(e => e.type === 'm3u' && e.m3uUrl && !accounts.some(a => a.url === e.m3uUrl)).length} item(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <M3uForm
          account={editingAccount}
          onClose={() => { setShowForm(false); setEditingAccount(null); }}
        />
      )}

      {/* Channel List Modal */}
      {viewingAccount && (
        <M3uChannelList account={viewingAccount} onClose={() => setViewingAccount(null)} />
      )}

      {/* Test Connection Modal */}
      {testingAccount && (
        <M3uTest account={testingAccount} onClose={() => setTestingAccount(null)} />
      )}

      {/* Delete Confirmation */}
      {deletingAccount && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700/50 p-6">
            <h2 className="text-lg font-bold text-white mb-2">Delete Playlist</h2>
            <p className="text-sm text-slate-300 mb-2">
              Are you sure you want to delete <span className="font-semibold text-white">"{deletingAccount.name}"</span>?
            </p>
            <p className="text-xs text-slate-500 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingAccount(null)}
                className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700/50 transition-colors text-sm"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => { deleteM3u(deletingAccount.id); setDeletingAccount(null); }}
                className="px-6 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-orange-600 transition-all flex items-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
