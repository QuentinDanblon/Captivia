'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import {
  collectContacts,
  currentMedications,
  sortByDateDesc,
  type CarnetExport,
} from '@/lib/carnet';
import { buildCarnetHtml, carnetFileName, isShareCancelled, shareCarnetFile } from '@/lib/carnet-share';
import { localDayKey } from '@/lib/dates';
import { animalDetailPath, isNative } from '@/lib/platform';
import { CARNET_CSS } from './print-styles';

type Status = 'loading' | 'ready' | 'premium' | 'notFound' | 'error';

interface SpeciesInfo {
  scientificName?: string;
  canonicalName?: string;
  vernacularName?: string;
}

const EMPTY = '—';

const noopSubscribe = () => () => {};
/** `isNative()` lu après l'hydratation (le HTML exporté est celui du web). */
const useIsNative = () => useSyncExternalStore(noopSubscribe, isNative, () => false);

function Section({
  title,
  keepTogether,
  children,
}: {
  title: string;
  keepTogether?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`carnet-section${keepTogether ? ' carnet-keep' : ''}`}>
      <h2 className="carnet-h2">{title}</h2>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="carnet-table-wrap">
      <table className="carnet-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Carnet imprimable d'un animal ; `id` vient de la route web `[id]` ou du `?id=` de l'app mobile. */
export default function CarnetPrintView({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [carnet, setCarnet] = useState<CarnetExport | null>(null);
  const [species, setSpecies] = useState<SpeciesInfo | null>(null);
  const native = useIsNative();
  const sheetRef = useRef<HTMLElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      router.push('/login');
      return;
    }
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getCarnetExport(id, token);
        if (cancelled) return;
        setCarnet(data);
        setStatus('ready');
        try {
          const info = (await api.getSpecies(String(data.animal.speciesId))) as SpeciesInfo;
          if (!cancelled) setSpecies(info);
        } catch {
          // Nom d'espèce facultatif : le carnet reste utilisable sans.
        }
      } catch (err) {
        if (cancelled) return;
        const code = (err as { status?: number } | null)?.status;
        setStatus(code === 403 ? 'premium' : code === 404 ? 'notFound' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, token, id, router]);

  // Le titre du document devient le nom de fichier proposé par « Enregistrer en PDF ».
  const animalName = carnet?.animal.name;
  useEffect(() => {
    if (!animalName) return;
    const previous = document.title;
    document.title = `${t('carnetPrint.title')} - ${animalName}`;
    return () => {
      document.title = previous;
    };
  }, [animalName, t]);

  const view = useMemo(() => {
    if (!carnet) return null;
    const s = carnet.sections ?? {};
    const medications = s.medications ?? [];
    const vaccinations = s.vaccinations ?? [];
    const appointments = s.vetAppointments ?? [];
    return {
      healthRecords: sortByDateDesc(s.healthRecords ?? [], (r) => r.date),
      measurements: sortByDateDesc(s.measurements ?? [], (m) => m.measuredAt),
      vaccinations: sortByDateDesc(vaccinations, (v) => v.date),
      treatments: currentMedications(medications),
      appointments: sortByDateDesc(appointments, (a) => a.date),
      contacts: collectContacts(vaccinations, appointments),
    };
  }, [carnet]);

  const fmtDate = (value?: string | null) => {
    if (!value) return EMPTY;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? EMPTY : d.toLocaleDateString(locale, { dateStyle: 'medium' });
  };
  const fmtDateTime = (value?: string | null) => {
    if (!value) return EMPTY;
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? EMPTY
      : d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const text = (value?: string | number | null) =>
    value === null || value === undefined || value === '' ? EMPTY : String(value);

  const sexLabel = (sex?: string) => {
    if (sex === 'male') return t('animals.male');
    if (sex === 'female') return t('animals.female');
    return sex ? t('animals.unknown') : t('carnetPrint.notSpecified');
  };
  const frequencyLabel = (frequency: string, intervalHours?: number | null) => {
    if (frequency === 'daily') return t('animals.medications.frequencyDaily');
    if (frequency === 'weekly') return t('animals.medications.frequencyWeekly');
    if (frequency === 'every_x_hours') {
      return intervalHours
        ? t('carnetPrint.everyHours', { hours: intervalHours })
        : t('animals.medications.frequencyEveryXHours');
    }
    return frequency;
  };
  const healthTypeLabel = (type: string) =>
    ['vaccine', 'surgery', 'specific_food', 'medical_history'].includes(type)
      ? t(`animals.healthRecordTypes.${type}`)
      : type;
  const appointmentStatusLabel = (value: string) =>
    value === 'done'
      ? t('animals.vetAppointments.statusDone')
      : value === 'cancelled'
        ? t('animals.vetAppointments.statusCancelled')
        : t('animals.vetAppointments.statusScheduled');

  // App native : `window.print()` est inopérant dans la WebView → fichier HTML autonome partagé.
  const handleShare = async () => {
    const sheet = sheetRef.current;
    if (!sheet || !carnet) return;
    const title = `${t('carnetPrint.title')} - ${carnet.animal.name}`;
    setSharing(true);
    setShareError(false);
    try {
      await shareCarnetFile({
        fileName: carnetFileName(carnet.animal.name, localDayKey(new Date())),
        html: buildCarnetHtml({ lang: locale, title, css: CARNET_CSS, bodyHtml: sheet.outerHTML }),
        title,
      });
    } catch (err) {
      if (!isShareCancelled(err)) {
        console.error('Error sharing carnet:', err);
        setShareError(true);
      }
    } finally {
      setSharing(false);
    }
  };

  const backHref = animalDetailPath(id ?? '');
  const backButton = (
    <Link href={backHref} className="carnet-btn">
      <span aria-hidden="true">←</span> {t('carnetPrint.back')}
    </Link>
  );

  let body: ReactNode;
  if (status === 'ready' && carnet && view) {
    const { animal } = carnet;
    const speciesName = species
      ? species.vernacularName || species.canonicalName || species.scientificName
      : undefined;
    const scientific =
      species?.scientificName && species.scientificName !== speciesName
        ? species.scientificName
        : undefined;
    const edited = fmtDateTime(carnet.exportedAt ?? new Date().toISOString());

    body = (
      <>
        <div className="carnet-toolbar carnet-noprint">
          {backButton}
          {native ? (
            <button
              type="button"
              className="carnet-btn carnet-btn-primary"
              onClick={handleShare}
              disabled={sharing}
              aria-busy={sharing}
            >
              {t('carnetPrint.share')}
            </button>
          ) : (
            <button
              type="button"
              className="carnet-btn carnet-btn-primary"
              onClick={() => window.print()}
            >
              {t('carnetPrint.print')}
            </button>
          )}
          <p className="carnet-hint">{t(native ? 'carnetPrint.shareHint' : 'carnetPrint.printHint')}</p>
          {shareError && (
            <p className="carnet-hint carnet-status-error" role="alert">
              {t('carnetPrint.shareError')}
            </p>
          )}
        </div>

        <article className="carnet-sheet" ref={sheetRef}>
          <header className="carnet-header">
            <div className="carnet-brand">Captivia</div>
            <div className="carnet-header-meta">
              <h1 className="carnet-title">{t('carnetPrint.title')}</h1>
              <p className="carnet-edited">{t('carnetPrint.editedOn', { date: edited })}</p>
            </div>
          </header>

          <Section title={t('carnetPrint.identity')} keepTogether>
            <dl className="carnet-identity">
              <div>
                <dt>{t('carnetPrint.name')}</dt>
                <dd>{animal.name}</dd>
              </div>
              <div>
                <dt>{t('animals.species')}</dt>
                <dd>
                  {speciesName ?? `#${animal.speciesId}`}
                  {scientific && <em> ({scientific})</em>}
                </dd>
              </div>
              <div>
                <dt>{t('animals.sex')}</dt>
                <dd>{sexLabel(animal.sex)}</dd>
              </div>
              <div>
                <dt>{t('carnetPrint.birthDate')}</dt>
                <dd>{animal.birthDate ? fmtDate(animal.birthDate) : t('carnetPrint.notSpecified')}</dd>
              </div>
              {animal.microchip && (
                <div>
                  <dt>{t('carnetPrint.microchip')}</dt>
                  <dd>{animal.microchip}</dd>
                </div>
              )}
              {animal.groupName && (
                <div>
                  <dt>{t('animals.family.group')}</dt>
                  <dd>{animal.groupName}</dd>
                </div>
              )}
            </dl>
          </Section>

          <Section title={t('animals.vaccinations.title')}>
            {view.vaccinations.length === 0 ? (
              <p className="carnet-empty">{t('animals.vaccinations.noData')}</p>
            ) : (
              <Table
                headers={[
                  t('animals.vaccinations.name'),
                  t('animals.vaccinations.date'),
                  t('animals.vaccinations.nextDue'),
                  t('animals.vaccinations.batchNumber'),
                  t('animals.vaccinations.vetName'),
                  t('animals.vaccinations.notes'),
                ]}
                rows={view.vaccinations.map((v) => [
                  v.name,
                  fmtDate(v.date),
                  fmtDate(v.nextDueDate),
                  text(v.batchNumber),
                  text(v.vetName),
                  text(v.notes),
                ])}
              />
            )}
          </Section>

          <Section title={t('carnetPrint.currentTreatments')}>
            {view.treatments.length === 0 ? (
              <p className="carnet-empty">{t('carnetPrint.noTreatments')}</p>
            ) : (
              <Table
                headers={[
                  t('animals.medications.name'),
                  t('animals.medications.dose'),
                  t('animals.medications.frequency'),
                  t('animals.medications.startDate'),
                  t('animals.medications.endDate'),
                  t('animals.medications.notes'),
                ]}
                rows={view.treatments.map((m) => [
                  m.name,
                  [m.dose, m.unit].filter(Boolean).join(' ') || EMPTY,
                  frequencyLabel(m.frequency, m.intervalHours),
                  fmtDate(m.startDate),
                  fmtDate(m.endDate),
                  text(m.notes),
                ])}
              />
            )}
          </Section>

          <Section title={t('carnetPrint.healthHistory')}>
            {view.healthRecords.length === 0 ? (
              <p className="carnet-empty">{t('animals.healthRecordEmpty')}</p>
            ) : (
              <Table
                headers={[
                  t('animals.healthRecordDate'),
                  t('carnetPrint.type'),
                  t('carnetPrint.healthTitle'),
                  t('animals.vaccinations.notes'),
                ]}
                rows={view.healthRecords.map((r) => [
                  fmtDate(r.date),
                  healthTypeLabel(r.type),
                  r.title,
                  text(r.notes),
                ])}
              />
            )}
          </Section>

          <Section title={t('animals.measurements.title')}>
            {view.measurements.length === 0 ? (
              <p className="carnet-empty">{t('animals.measurements.noData')}</p>
            ) : (
              <Table
                headers={[
                  t('animals.measurements.date'),
                  t('animals.measurements.weightKg'),
                  t('animals.measurements.heightCm'),
                  t('animals.measurements.notes'),
                ]}
                rows={view.measurements.map((m) => [
                  fmtDate(m.measuredAt),
                  text(m.weightKg),
                  text(m.heightCm),
                  text(m.notes),
                ])}
              />
            )}
          </Section>

          <Section title={t('animals.vetAppointments.title')}>
            {view.appointments.length === 0 ? (
              <p className="carnet-empty">{t('animals.vetAppointments.noData')}</p>
            ) : (
              <Table
                headers={[
                  t('animals.vetAppointments.date'),
                  t('animals.vetAppointments.vetName'),
                  t('animals.vetAppointments.reason'),
                  t('animals.vetAppointments.location'),
                  t('carnetPrint.status'),
                ]}
                rows={view.appointments.map((a) => [
                  fmtDateTime(a.date),
                  a.vetName,
                  text(a.reason),
                  text(a.location),
                  appointmentStatusLabel(a.status),
                ])}
              />
            )}
          </Section>

          <Section title={t('carnetPrint.contacts')} keepTogether>
            {view.contacts.length === 0 ? (
              <p className="carnet-empty">{t('carnetPrint.noContacts')}</p>
            ) : (
              <ul className="carnet-contacts">
                {view.contacts.map((c) => (
                  <li key={c.name}>
                    <strong>{c.name}</strong>
                    {c.locations.length > 0 && ` - ${c.locations.join(' / ')}`}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <p className="carnet-disclaimer">{t('carnetPrint.disclaimer')}</p>
        </article>
      </>
    );
  } else if (status === 'loading') {
    body = (
      <p className="carnet-status" role="status">
        {t('carnetPrint.loading')}
      </p>
    );
  } else {
    const message =
      status === 'premium'
        ? t('animals.carnet.premiumRequired')
        : status === 'notFound'
          ? t('animals.notFound')
          : t('carnetPrint.loadError');
    body = (
      <>
        <div className="carnet-toolbar">{backButton}</div>
        <p className="carnet-status carnet-status-error" role="alert">
          {message}
        </p>
      </>
    );
  }

  return (
    <div className="carnet-page">
      <style>{CARNET_CSS}</style>
      {body}
    </div>
  );
}
