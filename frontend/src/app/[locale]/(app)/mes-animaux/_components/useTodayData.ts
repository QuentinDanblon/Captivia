'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Animal, type AnimalMeasurement, type Medication, type Vaccination } from '@/lib/api';
import { fetchAgenda, rangeFromToday, type AgendaItem } from '@/lib/agenda';
import type { SpeciesHealthSheet, SpeciesSheet } from '@/lib/today';

/** Fenêtre de la frise : aujourd'hui et les 7 jours suivants. */
export const TIMELINE_DAYS = 8;
/** Au-delà, le détail (pesées, vaccins, traitements) n'est chargé que pour les premiers animaux. */
const DETAIL_LIMIT = 6;

export interface AnimalDetail {
  /** `null` : non chargé (échec, section refusée) — aucune alerte n'en est tirée. */
  measurements: AnimalMeasurement[] | null;
  vaccinations: Vaccination[] | null;
  medications: Medication[] | null;
}

export interface TodayData {
  status: 'loading' | 'ready' | 'error';
  animals: Animal[];
  details: Record<string, AnimalDetail>;
  species: Record<number, SpeciesSheet | null>;
  speciesHealth: Record<number, SpeciesHealthSheet | null>;
  agenda: AgendaItem[];
  agendaStatus: 'loading' | 'ready' | 'error';
  reload: () => void;
  reloadAgenda: () => void;
}

const settledArray = <T,>(result: PromiseSettledResult<unknown>): T[] | null =>
  result.status === 'fulfilled' && Array.isArray(result.value) ? (result.value as T[]) : null;

/**
 * Données du tableau de bord « Aujourd'hui » : animaux, agenda des 8 prochains jours (API agenda
 * existante), et pour chaque animal ses pesées, vaccins et traitements, plus la fiche de son
 * espèce (nom, binôme, conseil). Une section en échec reste `null` sans bloquer le reste ; un 401
 * est laissé à lib/api (refresh puis `auth:logout` si la session est révoquée), jamais de logout ici.
 */
export function useTodayData(token: string | null, locale: string): TodayData {
  const [status, setStatus] = useState<TodayData['status']>('loading');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [details, setDetails] = useState<Record<string, AnimalDetail>>({});
  const [species, setSpecies] = useState<Record<number, SpeciesSheet | null>>({});
  const [speciesHealth, setSpeciesHealth] = useState<Record<number, SpeciesHealthSheet | null>>({});
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [agendaStatus, setAgendaStatus] = useState<TodayData['agendaStatus']>('loading');
  const seq = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [agendaAttempt, setAgendaAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    const current = ++seq.current;
    const stale = () => current !== seq.current;
    (async () => {
      let list: Animal[];
      try {
        const data = await api.getMyAnimals(token);
        if (stale()) return;
        list = Array.isArray(data) ? (data as Animal[]) : [];
        setAnimals(list);
        setStatus('ready');
      } catch (err) {
        if (stale()) return;
        if (!(err instanceof ApiError && err.status === 401)) console.error('Error fetching animals:', err);
        setStatus('error');
        return;
      }

      const shown = list.slice(0, DETAIL_LIMIT);
      const speciesIds = [...new Set(shown.map((a) => a.speciesId))];
      await Promise.all([
        ...shown.map(async (animal) => {
          const [m, v, d] = await Promise.allSettled([
            api.getMeasurements(animal.id, token),
            api.getVaccinations(animal.id, token),
            api.getMedications(animal.id, token),
          ]);
          if (stale()) return;
          setDetails((prev) => ({
            ...prev,
            [animal.id]: {
              measurements: settledArray<AnimalMeasurement>(m),
              vaccinations: settledArray<Vaccination>(v),
              medications: settledArray<Medication>(d),
            },
          }));
        }),
        ...speciesIds.map(async (id) => {
          const [sheet, health] = await Promise.allSettled([
            api.getSpecies(String(id)),
            api.getSpeciesHealth(String(id), undefined, locale),
          ]);
          if (stale()) return;
          setSpecies((prev) => ({ ...prev, [id]: sheet.status === 'fulfilled' ? (sheet.value as SpeciesSheet) : null }));
          setSpeciesHealth((prev) => ({
            ...prev,
            [id]: health.status === 'fulfilled' ? (health.value as SpeciesHealthSheet) : null,
          }));
        }),
      ]);
    })();
  }, [token, locale, attempt]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nouvel essai : la frise repasse en chargement
    setAgendaStatus('loading');
    const { from, to } = rangeFromToday(TIMELINE_DAYS);
    fetchAgenda(token, from, to)
      .then((res) => {
        if (cancelled) return;
        setAgenda(res.items ?? []);
        setAgendaStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error fetching agenda:', err);
        setAgendaStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token, agendaAttempt]);

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
    setAgendaAttempt((n) => n + 1);
  }, []);
  const reloadAgenda = useCallback(() => setAgendaAttempt((n) => n + 1), []);

  return { status, animals, details, species, speciesHealth, agenda, agendaStatus, reload, reloadAgenda };
}
