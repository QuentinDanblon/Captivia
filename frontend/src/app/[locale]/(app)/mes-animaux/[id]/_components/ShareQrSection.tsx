'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Animal } from '@/lib/api';

interface Props {
  animal: Animal;
  token: string | null;
  locale: string;
}

export default function ShareQrSection({ animal, token, locale }: Props) {
  const t = useTranslations();
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  // W0-06 — partage public (QR) en opt-in ; l'URL est construite par le backend
  const [publicLink, setPublicLink] = useState<Awaited<ReturnType<typeof api.getAnimalPublicLink>> | null>(null);
  const [publicLinkBusy, setPublicLinkBusy] = useState(false);
  const [publicLinkError, setPublicLinkError] = useState('');

  // W0-06 — charge l'état du partage public (désactivé par défaut)
  const publicLinkAnimalId = animal?.id;
  const publicLinkLocale = locale;
  useEffect(() => {
    if (!publicLinkAnimalId || !token || !publicLinkLocale) return;
    let cancelled = false;
    api
      .getAnimalPublicLink(publicLinkAnimalId, token, publicLinkLocale)
      .then((state) => {
        if (!cancelled) setPublicLink(state);
      })
      .catch(() => {
        if (!cancelled) setPublicLink(null);
      });
    return () => {
      cancelled = true;
    };
  }, [publicLinkAnimalId, token, publicLinkLocale]);

  const updatePublicLink = async (body: { enabled?: boolean; showHealth?: boolean }) => {
    if (!animal || !token || !locale || publicLinkBusy) return;
    setPublicLinkBusy(true);
    setPublicLinkError('');
    try {
      const state = await api.updateAnimalPublicLink(animal.id, token, body, locale);
      setPublicLink(state);
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      setPublicLinkError(
        msg.includes('premium') || msg.includes('403') || msg.includes('forbidden')
          ? t('publicLink.premiumRequired')
          : t('publicLink.updateError'),
      );
    } finally {
      setPublicLinkBusy(false);
    }
  };

  const regeneratePublicLink = async () => {
    if (!animal || !token || !locale || publicLinkBusy) return;
    if (typeof window !== 'undefined' && !window.confirm(t('publicLink.regenerateConfirm'))) return;
    setPublicLinkBusy(true);
    setPublicLinkError('');
    try {
      const state = await api.regenerateAnimalPublicLink(animal.id, token, locale);
      setPublicLink(state);
      setQrDataUrl('');
      setQrUrl('');
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      setPublicLinkError(
        msg.includes('premium') || msg.includes('403') || msg.includes('forbidden')
          ? t('publicLink.premiumRequired')
          : t('publicLink.updateError'),
      );
    } finally {
      setPublicLinkBusy(false);
    }
  };

  const handleOpenQR = async () => {
    // L'URL du QR est celle renvoyée par l'API (jamais window.location.origin)
    if (!animal || !publicLink?.enabled || !publicLink.url) return;
    setQrLoading(true);
    setShowQRModal(true);
    setQrDataUrl('');
    setQrUrl('');
    setQrError('');
    try {
      const url = publicLink.url;
      const QRCodeModule = await import('qrcode');
      const dataUrl = await QRCodeModule.default.toDataURL(url, { width: 280, margin: 2 });
      setQrDataUrl(dataUrl);
      setQrUrl(url);
    } catch (e) {
      console.error('QR error:', e);
      setQrError(e instanceof Error ? e.message : t('premiumLock.qrCodeError'));
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <>
    {/* QR code */}
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
        {t('premiumLock.qrCode')}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t('premiumLock.qrCodeHelp')}
      </p>
      {/* W0-06 — partage public en opt-in (désactivé par défaut) */}
      <div className="mb-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            role="switch"
            className="mt-1 h-5 w-5 accent-emerald-600"
            checked={!!publicLink?.enabled}
            disabled={publicLinkBusy || !publicLink}
            onChange={(e) => updatePublicLink({ enabled: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-medium text-gray-800 dark:text-white">
              {t('publicLink.enableLabel')}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {t('publicLink.enableHelp')}
            </span>
          </span>
        </label>
        {publicLink?.enabled && (
          <>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                role="switch"
                className="mt-1 h-5 w-5 accent-emerald-600"
                checked={publicLink.showHealth}
                disabled={publicLinkBusy}
                onChange={(e) => updatePublicLink({ showHealth: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-gray-800 dark:text-white">
                  {t('publicLink.showHealthLabel')}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {t('publicLink.showHealthHelp')}
                </span>
              </span>
            </label>
            <button
              type="button"
              onClick={regeneratePublicLink}
              disabled={publicLinkBusy}
              className="w-full py-2 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-70"
            >
              {t('publicLink.regenerate')}
            </button>
          </>
        )}
        {!publicLink?.enabled && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('publicLink.disabledHint')}</p>
        )}
        {publicLinkError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{publicLinkError}</p>
        )}
      </div>
      <button
        type="button"
        onClick={handleOpenQR}
        disabled={qrLoading || !publicLink?.enabled}
        className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-70 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        {qrLoading ? t('common.loading') : t('premiumLock.qrCodeButton')}
      </button>
    </div>
      <div className="contents">
        {/* QR code modal */}
        {showQRModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-[384px]">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('premiumLock.qrCode')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('premiumLock.qrCodeHelp')}</p>
              {qrLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent" />
                </div>
              ) : qrDataUrl ? (
                <div className="flex flex-col items-center">
                  <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 rounded-lg bg-white p-2" />
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 break-all text-center max-w-full">{qrUrl}</p>
                </div>
              ) : qrError ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm text-center">
                  {qrError}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="mt-4 w-full py-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
