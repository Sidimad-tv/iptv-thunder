// =========================
// 📝 PORTAL FORM COMPONENT
// =========================
import React, { useState, useEffect, useRef } from 'react';
import { usePortalsStore } from '@/store/portals.store';
import { PortalAccount, PortalFormData } from './portals.types';
import { useToast } from '@/components/ui/Toast';
import { useTranslation, useTVNavigation } from '@/hooks';

interface PortalFormProps {
  portal?: PortalAccount | null;
  onClose: () => void;
}

export const PortalForm: React.FC<PortalFormProps> = ({ portal, onClose }) => {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const macInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [formData, setFormData] = useState<PortalFormData>({
    name: '',
    login: '',
    password: '',
    portalUrl: 'http://',
    mac: '00:1A:79:',
    description: '',
    tags: [],
  });
  
  const [errors, setErrors] = useState<Partial<Record<keyof PortalFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addPortal, updatePortal, portals } = usePortalsStore();

  // TV Navigation - simple isolated instance for this modal
  const { setActiveContainer } = useTVNavigation({
    onBack: onClose,
  });

  // Show keyboard when input is focused on Android TV
  const showKeyboard = () => {
    if ((globalThis as any).AndroidTV?.showKeyboard) {
      (globalThis as any).AndroidTV.showKeyboard();
    }
  };

  const hideKeyboard = () => {
    if ((globalThis as any).AndroidTV?.hideKeyboard) {
      (globalThis as any).AndroidTV.hideKeyboard();
    }
  };

  useEffect(() => {
    const modal = modalRef.current;
    if (modal) {
      setActiveContainer(modal);
    }
    return () => {
      setActiveContainer(null);
      hideKeyboard();
    };
  }, [setActiveContainer]);

  useEffect(() => {
    if (portal) {
      setFormData({
        name: portal.name,
        login: '',
        password: '',
        portalUrl: portal.portalUrl,
        mac: portal.mac,
        description: portal.description || '',
        tags: portal.tags || [],
      });
    }
  }, [portal]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PortalFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('nameRequired');
    }

    if (!formData.portalUrl.trim()) {
      newErrors.portalUrl = t('urlRequired');
    } else if (!isValidUrl(formData.portalUrl)) {
      newErrors.portalUrl = t('invalidUrl');
    }

    if (!formData.mac.trim()) {
      newErrors.mac = t('macRequired');
    } else if (!isValidMac(formData.mac)) {
      newErrors.mac = t('invalidMac');
    } else {
      // Check if MAC address is already used by another portal
      const macExists = portals.some(
        p => p.mac.toLowerCase() === formData.mac.toLowerCase() && p.id !== portal?.id
      );
      if (macExists) {
        newErrors.mac = t('macAlreadyExists');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isValidMac = (mac: string): boolean => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Disable submit button immediately
    if (submitButtonRef.current) {
      submitButtonRef.current.disabled = true;
    }
    
    // Use DOM data attribute for synchronous check
    const form = e.currentTarget as HTMLFormElement;
    if (form.dataset.submitting === 'true') {
      return;
    }
    form.dataset.submitting = 'true';
    
    setIsSubmitting(true);
    
    if (!validateForm()) {
      showToast(t('fixErrors'), 'error');
      setIsSubmitting(false);
      form.dataset.submitting = 'false';
      // Re-enable submit button
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
      }
      // Focus first invalid field
      if (errors.name) {
        nameInputRef.current?.focus();
      } else if (errors.portalUrl) {
        urlInputRef.current?.focus();
      } else if (errors.mac) {
        macInputRef.current?.focus();
      }
      return;
    }

    try {
      if (portal) {
        // Update existing portal
        updatePortal(portal.id, formData);
      } else {
        // Add new portal
        addPortal({ ...formData, isActive: true });
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving portal:', error);
      showToast(t('errorSavingPortal'), 'error');
    } finally {
      setIsSubmitting(false);
      form.dataset.submitting = 'false';
    }
  };

  const handleInputChange = (field: keyof PortalFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div ref={modalRef} data-tv-container="modal" className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700/50">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              {portal ? t('editPortal') : t('addNewPortal')}
            </h2>
            <button
              data-tv-focusable
              tabIndex={0}
              onClick={onClose}
              className="p-2.5 hover:bg-slate-700/50 rounded-xl transition-all duration-200 text-slate-400 hover:text-white hover:scale-110"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="portal-name" className="block text-sm font-medium text-slate-300 mb-2">
              {t('portalName')} *
            </label>
            <input
              ref={nameInputRef}
              id="portal-name"
              data-tv-focusable
              data-tv-initial
              data-tv-group="portal-form"
              data-tv-index="0"
              tabIndex={0}
              type="text"
              inputMode="text"
              autoComplete="off"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              onFocus={showKeyboard}
              className={`w-full px-4 py-2.5 bg-slate-800/50 border rounded-xl text-white placeholder-slate-500 transition-all duration-200 ${
                errors.name ? 'border-red-500' : 'border-slate-700'
              }`}
              placeholder="e.g. My IPTV Portal"
            />
            {errors.name && (
              <p className="mt-1.5 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* URL */}
          <div>
            <label htmlFor="portal-url" className="block text-sm font-medium text-slate-300 mb-2">
              {t('portalUrl')} *
            </label>
            <input
              ref={urlInputRef}
              id="portal-url"
              data-tv-focusable
              data-tv-group="portal-form"
              data-tv-index="1"
              tabIndex={0}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={formData.portalUrl}
              onChange={(e) => handleInputChange('portalUrl', e.target.value)}
              onFocus={showKeyboard}
              className={`w-full px-4 py-2.5 bg-slate-800/50 border rounded-xl text-white placeholder-slate-500 transition-all duration-200 ${
                errors.portalUrl ? 'border-red-500' : 'border-slate-700'
              }`}
              placeholder="http://portal.example.com/"
            />
            {errors.portalUrl && (
              <p className="mt-1.5 text-sm text-red-400">{errors.portalUrl}</p>
            )}
          </div>

            <div>
              <label htmlFor="portal-mac" className="block text-sm font-medium text-slate-300 mb-2">
                {t('macAddress')} *
              </label>
              <input
                ref={macInputRef}
                id="portal-mac"
                data-tv-focusable
                data-tv-group="portal-form"
                data-tv-index="2"
                tabIndex={0}
                type="text"
                inputMode="text"
                autoComplete="off"
                value={formData.mac}
                onChange={(e) => handleInputChange('mac', e.target.value.toUpperCase())}
                onFocus={showKeyboard}
                className={`w-full px-4 py-2.5 bg-slate-800/50 border rounded-xl text-white placeholder-slate-500 font-mono transition-all duration-200 ${
                  errors.mac ? 'border-red-500' : 'border-slate-700'
                }`}
                placeholder="00:1A:79:84:1A:AB"
              />
              {errors.mac && (
                <p className="mt-1.5 text-sm text-red-400">{errors.mac}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {t('format')}: XX:XX:XX:XX:XX:XX
              </p>
            </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
            <button
              type="button"
              data-tv-focusable
              data-tv-group="portal-form"
              data-tv-index="3"
              tabIndex={0}
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-700/50 hover:text-white transition-all duration-200 hover:scale-105"
            >
              {t('cancel')}
            </button>
            <button
              ref={submitButtonRef}
              type="submit"
              data-tv-focusable
              data-tv-group="portal-form"
              data-tv-index="4"
              tabIndex={0}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5 flex items-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t('saving')}
                </>
              ) : (
                <>
                  {portal ? t('save') : t('add')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
