'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileText } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, type Animal } from '@/lib/api';
import { animalCarnetPath } from '@/lib/platform';
import { Button, Card, buttonClasses } from '@/components/ui';
import { localDayKey } from '@/lib/dates';
import { isPremiumLocked } from './sectionErrors';

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
      a.download = `carnet-${animal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${localDayKey(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      onToast(t('animals.carnet.exportSuccess'));
    } catch (err) {
      console.error('Error exporting carnet:', err);
      if (isPremiumLocked(err)) {
        onToast(t('animals.carnet.premiumRequired'));
      } else {
        onToast(t('animals.carnet.exportError'));
      }
    } finally {
      setExportingCarnet(false);
    }
  };

  return (
    <Card as="section" id="carnet" title={t('animals.sheet.carnetTitle')} titleId="carnet-title" className="scroll-mt-20">
      <p className="m-0 mb-4 text-ui text-ink-2">{t('animals.sheet.carnetText')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={animalCarnetPath(animal.id)} className={buttonClasses({ variant: 'secondary' })}>
          <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
          {t('animals.sheet.openCarnet')}
        </Link>
        <Button variant="quiet" onClick={handleExportCarnet} loading={exportingCarnet} iconStart={<Download size={18} strokeWidth={1.75} />}>
          {t('animals.carnet.export')}
        </Button>
      </div>
    </Card>
  );
}
