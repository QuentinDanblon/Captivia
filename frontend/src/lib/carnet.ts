/**
 * Carnet de santé imprimable : types de l'export backend (`GET /users/me/animals/:id/carnet/export`)
 * et petites fonctions pures utilisées par la page `mes-animaux/[id]/carnet`.
 */
import type { Animal, AnimalMeasurement, Medication, VetAppointment, Vaccination } from './api';

export interface CarnetHealthRecord {
  id: string;
  type: string;
  title: string;
  date: string;
  notes?: string | null;
}

/** Animal tel que renvoyé dans l'export (`puce` : champ facultatif, absent du schéma actuel). */
export type CarnetAnimal = Animal & { microchip?: string | null };

export interface CarnetExport {
  exportedAt?: string;
  animal: CarnetAnimal;
  sections: {
    healthRecords?: CarnetHealthRecord[];
    measurements?: AnimalMeasurement[];
    vaccinations?: Vaccination[];
    medications?: Medication[];
    vetAppointments?: VetAppointment[];
  };
}

export interface CarnetContact {
  name: string;
  locations: string[];
}

function time(value: string | null | undefined): number {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/** Traitements en cours : actifs et sans date de fin dépassée. */
export function currentMedications(medications: Medication[], now: Date = new Date()): Medication[] {
  return medications.filter((m) => {
    if (!m.active) return false;
    if (!m.endDate) return true;
    const end = time(m.endDate);
    return end === 0 || end >= now.getTime();
  });
}

/** Vétérinaires distincts (insensible à la casse) cités dans les vaccins et les rendez-vous. */
export function collectContacts(
  vaccinations: Vaccination[],
  appointments: VetAppointment[]
): CarnetContact[] {
  const byKey = new Map<string, CarnetContact>();
  const add = (rawName?: string | null, rawLocation?: string | null) => {
    const name = rawName?.trim();
    if (!name) return;
    const key = name.toLowerCase();
    const contact = byKey.get(key) ?? { name, locations: [] };
    const location = rawLocation?.trim();
    if (location && !contact.locations.includes(location)) contact.locations.push(location);
    byKey.set(key, contact);
  };
  vaccinations.forEach((v) => add(v.vetName));
  appointments.forEach((a) => add(a.vetName, a.location));
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Tri décroissant par date (le plus récent d'abord), sans muter le tableau d'origine. */
export function sortByDateDesc<T>(items: T[], getDate: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => time(getDate(b)) - time(getDate(a)));
}
