'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { QrCode } from 'lucide-react';
import { api, type Animal } from '@/lib/api';
import { Button, Card, Modal, Skeleton, SkeletonGroup } from '@/components/ui';
import { FormError, SectionError } from './parts';

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

  const switchClass = 'mt-0.5 size-5 shrink-0';

  return (
    <>
      <Card as="section" id="partage" title={t('premiumLock.qrCode')} titleId="share-title" className="scroll-mt-20">
        <p className="m-0 mb-4 text-ui text-ink-2">{t('premiumLock.qrCodeHelp')}</p>
        {/* W0-06 — partage public en opt-in (désactivé par défaut) */}
        <div className="grid gap-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              role="switch"
              className={switchClass}
              checked={!!publicLink?.enabled}
              disabled={publicLinkBusy || !publicLink}
              onChange={(e) => updatePublicLink({ enabled: e.target.checked })}
            />
            <span className="grid gap-0.5">
              <span className="text-ui font-medium text-ink">{t('publicLink.enableLabel')}</span>
              <span className="text-meta text-ink-2">{t('publicLink.enableHelp')}</span>
            </span>
          </label>
          {publicLink?.enabled ? (
            <>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  role="switch"
                  className={switchClass}
                  checked={publicLink.showHealth}
                  disabled={publicLinkBusy}
                  onChange={(e) => updatePublicLink({ showHealth: e.target.checked })}
                />
                <span className="grid gap-0.5">
                  <span className="text-ui font-medium text-ink">{t('publicLink.showHealthLabel')}</span>
                  <span className="text-meta text-ink-2">{t('publicLink.showHealthHelp')}</span>
                </span>
              </label>
              <div>
                <Button variant="quiet" size="sm" onClick={regeneratePublicLink} disabled={publicLinkBusy}>
                  {t('publicLink.regenerate')}
                </Button>
              </div>
            </>
          ) : (
            <p className="m-0 text-meta text-ink-2">{t('publicLink.disabledHint')}</p>
          )}
          <FormError>{publicLinkError}</FormError>
          <div className="border-t border-line pt-4">
            <Button
              variant="secondary"
              onClick={handleOpenQR}
              disabled={qrLoading || !publicLink?.enabled}
              iconStart={<QrCode size={18} strokeWidth={1.75} />}
            >
              {t('premiumLock.qrCodeButton')}
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={showQRModal} onClose={() => setShowQRModal(false)} title={t('premiumLock.qrCode')} description={t('premiumLock.qrCodeHelp')} size="sm">
        {qrLoading ? (
          <SkeletonGroup label={t('common.loading')} className="flex justify-center">
            <Skeleton shape="block" width={256} height={256} />
          </SkeletonGroup>
        ) : qrDataUrl ? (
          <figure className="m-0 grid justify-items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR généré localement (data URL) */}
            <img src={qrDataUrl} alt={t('animals.sheet.qrAlt', { name: animal.name })} className="size-64 rounded-control border border-line" />
            <figcaption className="max-w-full font-mono text-meta break-all text-ink-2">{qrUrl}</figcaption>
          </figure>
        ) : qrError ? (
          <SectionError message={qrError} />
        ) : null}
        <div className="mt-4">
          <Button variant="secondary" fullWidth onClick={() => setShowQRModal(false)}>
            {t('common.close')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
