import React, { useState, useEffect, useRef } from 'react';
import { useM3uStore } from '@/store/m3u.store';
import { M3uAccount, M3uFormData, M3uSourceType } from './m3u.types';
import { useTranslation } from '@/hooks/useTranslation';
import { parseM3u } from '@/utils/m3uParser';
import { X, Save, Download, Upload, Trash2 } from 'lucide-react';
import { getSavedM3uUrls, addSavedM3uUrl, removeSavedM3uUrl, importSavedM3uUrls, exportSavedM3uUrls, DEFAULT_M3U_URLS } from '@/utils/m3uUrlManager';

interface M3uFormProps {
  account?: M3uAccount | null;
  onClose: () => void;
}

export const M3uForm: React.FC<M3uFormProps> = ({ account, onClose }) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addM3u, updateM3u } = useM3uStore();

  const [importExportStatus, setImportExportStatus] = useState<string | null>(null);
  const m3uFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<M3uFormData>({
    name: '',
    sourceType: 'url',
    url: '',
    serverUrl: '',
    username: '',
    password: '',
    description: '',
    tags: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        sourceType: account.sourceType,
        url: account.url || '',
        serverUrl: account.serverUrl || '',
        username: account.username || '',
        password: account.password || '',
        description: account.description || '',
        tags: account.tags || [],
      });
    }
    modalRef.current?.focus();
  }, [account]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    setIsSubmitting(true);
    try {
      if (account) {
        updateM3u(account.id, { ...formData, name: formData.name.trim() } as any);
      } else {
        addM3u({
          name: formData.name.trim(),
          sourceType: formData.sourceType,
          url: formData.url || undefined,
          serverUrl: formData.serverUrl || undefined,
          username: formData.username || undefined,
          password: formData.password || undefined,
          description: formData.description,
          tags: formData.tags,
          isActive: false,
        });
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        const channels = parseM3u(content);
        addM3u({
          name: file.name.replace(/\.m3u8?$/i, ''),
          sourceType: 'file',
          description: `${file.name} (${channels.length} channels)`,
          tags: [],
          channels,
          channelCount: channels.length,
          isActive: false,
        });
        onClose();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const update = (field: keyof M3uFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        data-tv-container="modal"
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg border border-slate-700/50 overflow-hidden"
      >
        <div className="p-4 md:p-6 border-b border-slate-700/50 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-bold text-white">
            {account ? 'Edit M3U Playlist' : 'Add M3U Playlist'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700/50 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Name</label>
            <input
              data-tv-focusable
              value={formData.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="My Playlist"
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"
            />
          </div>

          {/* Source Type */}
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Source Type</label>
            <div className="flex gap-2">
              {(['url', 'xtream', 'file'] as M3uSourceType[]).map((type) => (
                <button
                  key={type}
                  data-tv-focusable
                  onClick={() => update('sourceType', type)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.sourceType === type
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                  }`}
                >
                  {type === 'url' ? 'M3U URL' : type === 'xtream' ? 'Xtream' : 'Local File'}
                </button>
              ))}
            </div>
          </div>

          {/* M3U URL */}
          {formData.sourceType === 'url' && (
            <div>
              <label className="text-sm text-slate-400 mb-1 block">M3U URL</label>
              <input
                data-tv-focusable
                value={formData.url}
                onChange={(e) => update('url', e.target.value)}
                placeholder="https://example.com/playlist.m3u"
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"
              />
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const found = getSavedM3uUrls().find(s => s.url === val);
                        if (found) {
                          update('url', found.url);
                          update('name', found.name);
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Saved M3U URLs...</option>
                    {getSavedM3uUrls().map((s) => (
                      <option key={s.url} value={s.url}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.url.trim()) {
                        const name = formData.name.trim() || formData.url.split('/').pop() || 'M3U';
                        addSavedM3uUrl(name, formData.url.trim());
                        setImportExportStatus('URL saved');
                        setTimeout(() => setImportExportStatus(null), 2000);
                      }
                    }}
                    disabled={!formData.url.trim()}
                    className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
                    title="Save current URL"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
                {importExportStatus && (
                  <p className="text-xs text-emerald-400">{importExportStatus}</p>
                )}
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1 max-h-32 overflow-y-auto">
                    {getSavedM3uUrls().map((s) => (
                      <div key={s.url} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            update('url', s.url);
                            update('name', s.name);
                          }}
                          className="flex-1 text-left text-xs text-cyan-300 hover:text-white truncate py-1 px-2 rounded hover:bg-slate-700/50 transition-colors"
                          title={s.url}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-slate-500 ml-1 truncate">{s.url}</span>
                        </button>
                        {!DEFAULT_M3U_URLS.some(d => d.url === s.url) && (
                          <button
                            type="button"
                            onClick={() => {
                              removeSavedM3uUrl(s.url);
                              setImportExportStatus('Removed');
                              setTimeout(() => setImportExportStatus(null), 2000);
                            }}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const json = exportSavedM3uUrls();
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `m3u-urls-${new Date().toISOString().slice(0, 10)}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      setImportExportStatus('Exported');
                      setTimeout(() => setImportExportStatus(null), 2000);
                    }}
                    className="flex-1 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    Export
                  </button>
                  <button
                    type="button"
                    onClick={() => m3uFileInputRef.current?.click()}
                    className="flex-1 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Import
                  </button>
                </div>
                <input
                  ref={m3uFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const count = importSavedM3uUrls(ev.target?.result as string);
                      setImportExportStatus(`Imported ${count} URL(s)`);
                      setTimeout(() => setImportExportStatus(null), 3000);
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Xtream */}
          {formData.sourceType === 'xtream' && (
            <>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Server URL</label>
                <input
                  data-tv-focusable
                  value={formData.serverUrl}
                  onChange={(e) => update('serverUrl', e.target.value)}
                  placeholder="http://example.com:8080"
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm text-slate-400 mb-1 block">Username</label>
                  <input
                    data-tv-focusable
                    value={formData.username}
                    onChange={(e) => update('username', e.target.value)}
                    placeholder="username"
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm text-slate-400 mb-1 block">Password</label>
                  <input
                    data-tv-focusable
                    type="password"
                    value={formData.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="password"
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {/* Local File */}
          {formData.sourceType === 'file' && (
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Upload M3U File</label>
              <button
                data-tv-focusable
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-8 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors text-sm"
              >
                Click to select .m3u or .m3u8 file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".m3u,.m3u8"
                onChange={handleFileLoad}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 md:p-6 pt-2 border-t border-slate-700/50">
          <button
            data-tv-focusable
            onClick={onClose}
            className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700/50 transition-colors text-sm"
          >
            {t('cancel')}
          </button>
          <button
            data-tv-focusable
            data-tv-initial
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim() || (formData.sourceType === 'url' && !formData.url) || (formData.sourceType === 'xtream' && (!formData.serverUrl || !formData.username))}
            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 text-sm"
          >
            {isSubmitting ? 'Saving...' : account ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};
