import React, { useState, useRef } from 'react';
import { M3uAccount } from './m3u.types';
import { loadM3uContent } from '@/utils/m3uParser';

interface M3uTestProps {
  account: M3uAccount;
  onClose: () => void;
}

interface M3uTestResult {
  success: boolean;
  message: string;
  responseTime: number;
  channels?: number;
}

export const M3uTest: React.FC<M3uTestProps> = ({ account, onClose }) => {
  const [testResult, setTestResult] = useState<M3uTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const testButtonRef = useRef<HTMLButtonElement>(null);

  const runTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      const result = await loadM3uContent(account);
      const channelCount = result.channels.length;

      const responseTime = Date.now() - startTime;

      if (channelCount > 0) {
        setTestResult({
          success: true,
          message: 'Connection successful',
          responseTime,
          channels: channelCount,
        });
      } else {
        setTestResult({
          success: false,
          message: 'No channels found in playlist',
          responseTime,
          channels: 0,
        });
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      setTestResult({
        success: false,
        message: error?.message || error?.toString() || 'Unknown error',
        responseTime,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-600 overflow-hidden">
        <div className="p-6 border-b border-slate-700 bg-slate-800/50">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Test Playlist</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-slate-700/50 rounded-lg p-4 mb-6 border border-slate-600">
            <h3 className="font-semibold text-white mb-2">{account.name}</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">🔗</span>
                <span className="font-mono text-slate-300 truncate">{account.url || account.serverUrl}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">📋</span>
                <span className="font-mono text-slate-300">{account.sourceType.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="text-center mb-6">
            <button
              ref={testButtonRef}
              onClick={runTest}
              disabled={isTesting}
              className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-3 mx-auto shadow-lg"
            >
              {isTesting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  🔄
                  Start Test
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div className={`rounded-lg p-4 ${
              testResult.success
                ? 'bg-emerald-900/25 border border-emerald-700'
                : 'bg-red-900/30 border border-red-600'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{testResult.success ? '✅' : '❌'}</span>
                <div>
                  <h3 className={`font-bold text-lg ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.message}
                  </h3>
                  <p className="text-sm text-slate-400">
                    Response time:{' '}
                    <span className={`font-medium ${
                      testResult.responseTime < 1000 ? 'text-green-400' :
                      testResult.responseTime < 3000 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {testResult.responseTime}ms
                    </span>
                  </p>
                </div>
              </div>

              {testResult.success && testResult.channels !== undefined && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Channels found:</span>
                    <span className="font-medium text-green-400">{testResult.channels.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span className="font-medium text-white">{account.sourceType.toUpperCase()}</span>
                  </div>
                </div>
              )}

              {!testResult.success && (
                <div className="text-sm text-slate-300 mt-3">
                  <p className="font-medium mb-2">Possible causes:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Invalid or expired URL</li>
                    <li>Server unreachable</li>
                    <li>Network error</li>
                    <li>Invalid Xtream credentials</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
