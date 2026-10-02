'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Animal } from '@/lib/api';

interface Props {
  animal: Animal;
  token: string | null;
  onToast: (msg: string) => void;
}

export default function CarnetExportSection({ animal, token, onToast }: Props) {
  const t = useTranslations();
  const [exportingCarnet, setExportingCarnet] = useState(false);

  const handleExportCarnet = async () => {
    if (!animal || !token) return;
    setExportingCarnet(true);
    try {
      const blobUrl = await api.exportCarnet(animal.id, token);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `carnet-${animal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      onToast(t('animals.carnet.exportSuccess'));
    } catch (err) {
      console.error('Error exporting carnet:', err);
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('premium')) {
        onToast(t('animals.carnet.premiumRequired'));
      } else {
        onToast(t('animals.carnet.exportError'));
      }
    } finally {
      setExportingCarnet(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
        {t('animals.carnet.export')}
      </h2>
      <button
        type="button"
        onClick={handleExportCarnet}
        disabled={exportingCarnet}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
      >
        {exportingCarnet ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            {t('common.loading')}
          </>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        {!exportingCarnet && t('animals.carnet.export')}
      </button>
    </div>
  );
}
