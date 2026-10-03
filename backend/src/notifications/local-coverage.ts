import {
  MedicationOccurrenceSource,
  RoutineOccurrenceSource,
  medicationOccurrencesOn,
  routineOccurrencesOn,
  routinePlan,
} from '../agenda/agenda-occurrences';
import {
  localDay,
  makeLocalTimeResolver,
  resolveTimeZone,
} from '../common/timezone';
import type { LocalReminderRef } from './push-sender';

/** Rappel serveur et état ACTUEL de sa source (lu avec le rappel par le scheduler). */
export interface LocalCoverageCandidate {
  sourceKey: string | null;
  scheduledAt: Date;
  routine:
    | (RoutineOccurrenceSource & {
        id: string;
        active: boolean;
        updatedAt: Date;
      })
    | null;
  medication:
    | (MedicationOccurrenceSource & {
        id: string;
        active: boolean;
        updatedAt: Date;
      })
    | null;
}

/**
 * Le rappel serveur `ev` est-il un rappel que l'app programme AUSSI en notification locale, au
 * même instant (W6-07, revue de sécurité, constat 1) ? Si oui, renvoie l'instant et la date de
 * dernière modification de la source (comparée par l'expéditeur natif à l'état des soins que
 * l'appareil a programmé) ; sinon `undefined` : le push part vers tous les appareils.
 *
 * L'app programme ses rappels à partir de l'Agenda, qui ne contient, par source :
 * - routine : ses occurrences (`routineOccurrencesOn`, mêmes règles que le générateur) → couvert
 *   si l'instant du rappel en fait partie ;
 * - médicament : ses prises (`medicationOccurrencesOn`) → couvert si l'instant du rappel en fait
 *   partie (pas un médicament hebdomadaire un autre jour, ni une prise toutes les N heures
 *   décalée de 08:00) ;
 * - RDV vétérinaire : UNE notification à l'heure du RDV, alors que le serveur envoie des rappels
 *   J-N et le rappel du jour à 08:00 → jamais couvert ;
 * - vaccin : échéance « journée entière », rappelée par l'app à 9 h dans le fuseau du TÉLÉPHONE,
 *   le serveur à 08:00 dans le fuseau du compte → jamais couvert ;
 * - types personnalisés (`pref:`) : absents de l'Agenda → jamais couverts.
 * Une source désactivée (ou disparue) n'est plus dans l'Agenda : pas couverte.
 */
export function localReminderFor(
  ev: LocalCoverageCandidate,
  timeZone: string | null | undefined,
): LocalReminderRef | undefined {
  const at = ev.scheduledAt;
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) return undefined;
  const tz = resolveTimeZone(timeZone);
  const day = localDay(at, tz);
  const resolve = makeLocalTimeResolver(tz);
  const matches = (instants: Date[]) =>
    instants.some((d) => d.getTime() === at.getTime());

  const { routine, medication, sourceKey } = ev;
  if (routine && sourceKey === `routine:${routine.id}` && routine.active) {
    const plan = routinePlan(routine, tz);
    if (plan && matches(routineOccurrencesOn(plan, day, resolve))) {
      return { at, sourceUpdatedAt: routine.updatedAt };
    }
    return undefined;
  }
  if (
    medication &&
    sourceKey === `medication:${medication.id}` &&
    medication.active
  ) {
    if (matches(medicationOccurrencesOn(medication, day, resolve))) {
      return { at, sourceUpdatedAt: medication.updatedAt };
    }
  }
  return undefined;
}
