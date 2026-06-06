// =========================
// 🔄 PORTAL TEST COMPONENT
// =========================
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { usePortalsStore } from '@/store/portals.store';
import { PortalAccount, PortalTestResult } from './portals.types';

interface PortalTestProps {
  portal: PortalAccount | undefined;
  onClose: () => void;
}

export const PortalTest: React.FC<PortalTestProps> = ({ portal, onClose }) => {
  const { t } = useTranslation();
  const { updatePortal } = usePortalsStore();
  const [testResult, setTestResult] = useState<PortalTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const testButtonRef = useRef<HTMLButtonElement>(null);

  // Restore focus to test button when test completes
  useEffect(() => {
    if (!isTesting && testResult && testButtonRef.current) {
      // Small delay to ensure button is enabled and focusable
      setTimeout(() => {
        testButtonRef.current?.focus();
      }, 50);
    }
  }, [isTesting, testResult]);

  if (!portal) {
    return null;
  }

  const runTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    const startTime = Date.now();

    try {
      const client = new StalkerClient(portal as any);
      
      // Test profile - may fail on some portals
      let profile = null;
      try {
        profile = await client.getProfileAndAuth();
      } catch (profileErr) {
        console.warn('getProfile failed, continuing:', profileErr);
      }
      
      // Get account info (includes expiration date) - may fail on some portals
      let accountInfo: { phone?: string } = {};
      try {
        accountInfo = await client.getAccountInfo() || {};
      } catch (accountErr) {
        console.warn('getAccountInfo failed, continuing:', accountErr);
      }
      
      // Test channels - get first page only for quick test
      const channelsResult = await client.getChannelsWithPagination('*', 1);

      const responseTime = Date.now() - startTime;

      // Test fails if no channels available
      if (channelsResult.totalItems === 0) {
        setTestResult({
          success: false,
          message: t('noChannelsAvailable'),
          responseTime,
          channels: 0,
          accountInfo,
        });
      } else {
        // Update portal with expiration date from account info
        if (portal && accountInfo?.phone) {
          const parsed = new Date(accountInfo.phone);
          if (!Number.isNaN(parsed.getTime())) {
            updatePortal(portal.id, { expiresAt: parsed });
          }
        }
        
        setTestResult({
          success: true,
          message: t('connectionSuccess'),
          responseTime,
          channels: channelsResult.totalItems,
          profile,
          accountInfo,
        });
      }

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Log detailed error for debugging
      console.error('Portal test error:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      
      setTestResult({
        success: false,
        message: errorMessage,
        responseTime,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusColor = () => {
    if (!testResult) return 'text-slate-400';
    return testResult.success ? 'text-green-400' : 'text-red-400';
  };

  const getStatusIcon = () => {
    if (isTesting) return '🔄';
    if (!testResult) return '❓';
    return testResult.success ? '✅' : '❌';
  };

  const getResponseTimeColor = (time: number) => {
    if (time < 1000) return 'text-green-400';
    if (time < 3000) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div data-tv-container="portal-test" className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-600 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-slate-800 bg-opacity-50">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">
              {t('connectionTest')}
            </h2>
            <button
              data-tv-focusable
              data-tv-group="portal-test"
              data-tv-id="portal-test-close-x"
              data-tv-index={0}
              tabIndex={0}
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Portal Info */}
          <div className="bg-slate-700 bg-opacity-50 rounded-lg p-4 mb-6 border border-slate-600">
            <h3 className="font-semibold text-white mb-2">{portal.name}</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">🌐</span>
                <span className="font-mono text-slate-300">{portal.portalUrl}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">🖥️</span>
                <span className="font-mono text-slate-300">{portal.mac}</span>
              </div>
            </div>
          </div>

          {/* Test Button */}
          <div className="text-center mb-6">
            <button
              ref={testButtonRef}
              data-tv-focusable
              data-tv-group="portal-test"
              data-tv-id="portal-test-button"
              data-tv-index={1}
              data-tv-initial
              tabIndex={0}
              onClick={runTest}
              disabled={isTesting}
              className="px-8 py-3 bg-gradient-to-r from-green-700 to-green-800 text-white rounded-xl hover:from-green-800 hover:to-green-900 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-3 mx-auto shadow-lg"
            >
              {isTesting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t('testing')}
                </>
              ) : (
                <>
                  🔄
                  {t('startTest')}
                </>
              )}
            </button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`rounded-lg p-4 ${
              testResult.success 
                ? 'bg-emerald-900 bg-opacity-25 border border-emerald-700' 
                : 'bg-red-900 bg-opacity-30 border border-red-600'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{getStatusIcon()}</span>
                <div>
                  <h3 className={`font-bold text-lg ${getStatusColor()}`}>
                    {testResult.message}
                  </h3>
                  {testResult.responseTime && (
                    <p className="text-sm text-slate-400">
                      {t('responseTime')} <span className={`font-medium ${getResponseTimeColor(testResult.responseTime)}`}>
                        {testResult.responseTime}ms
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Success Details */}
              {testResult.success && (
                <div className="space-y-2 text-sm">
                  {testResult.profile && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('status')}:</span>
                      <span className="font-medium text-green-400">
                        {testResult.profile.status === 1 || testResult.profile.status === '1' || testResult.profile.status === 'Active' || testResult.profile.status === 'active'
                          ? t('active') 
                          : testResult.profile.status || t('active')}
                      </span>
                    </div>
                  )}
                  {testResult.channels !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('channelCount')}:</span>
                      <span className="font-medium text-green-700">
                        {testResult.channels.toLocaleString('pl-PL')}
                      </span>
                    </div>
                  )}
                  {testResult.accountInfo?.phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('accountExpires')}:</span>
                      <span className="font-medium text-white">
                        {testResult.accountInfo.phone}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Error Details */}
              {!testResult.success && (
                <div className="text-sm text-slate-300 mt-3">
                  <p className="font-medium mb-2">{t('possibleErrorCauses')}</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>{t('invalidPortalUrl')}</li>
                    <li>{t('invalidCredentials')}</li>
                    <li>{t('invalidMac')}</li>
                    <li>{t('portalUnavailable')}</li>
                    <li>{t('networkError')}</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-700 bg-slate-800 bg-opacity-50">
          <div className="flex justify-end">
            <button
              data-tv-focusable
              data-tv-group="portal-test"
              data-tv-id="portal-test-close-footer"
              data-tv-index={2}
              tabIndex={0}
              onClick={onClose}
              className="px-6 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
