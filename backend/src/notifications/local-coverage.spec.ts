import { LocalCoverageCandidate, localReminderFor } from './local-coverage';

/**
 * Non-régression (revue de sécurité W6-07, constat 1) : un rappel serveur n'est réputé couvert
 * par une notification locale de l'app que si l'app programme CE rappel, à CET instant.
 * Fuseau Europe/Paris, 10/03/2031 (UTC+1) : 08:00 locale = 07:00 UTC.
 */
const TZ = 'Europe/Paris';
const AT_8 = new Date('2031-03-10T07:00:00Z');
const UPDATED = new Date('2031-03-01T12:00:00Z');

const routine = {
  id: 'r1',
  active: true,
  schedule: { time: '08:00', recurrence: 'daily' },
  frequency: 'daily',
  createdAt: new Date('2031-03-01T00:00:00Z'),
  updatedAt: UPDATED,
};
const medication = {
  id: 'm1',
  active: true,
  startDate: new Date('2031-03-01T00:00:00Z'),
  endDate: null,
  frequency: 'daily',
  intervalHours: null,
  updatedAt: UPDATED,
};

const ev = (over: Partial<LocalCoverageCandidate>): LocalCoverageCandidate => ({
  sourceKey: null,
  scheduledAt: AT_8,
  routine: null,
  medication: null,
  ...over,
});

describe('localReminderFor', () => {
  it('RDV vétérinaire : rappel J-3 (08:00) non couvert', () => {
    // RDV le 13/03 à 14:30 ; rappel J-3 le 10/03 à 08:00 : l'app ne programme que le 13 à 14:30.
    expect(
      localReminderFor(ev({ sourceKey: 'appointment:a1' }), TZ),
    ).toBeUndefined();
  });

  it('RDV vétérinaire : rappel du jour J à 08:00 non couvert', () => {
    // Jour du RDV (13/03, 14:30) : rappel serveur à 08:00, notification locale à 14:30.
    expect(
      localReminderFor(
        ev({
          sourceKey: 'appointment:a1',
          scheduledAt: new Date('2031-03-13T07:00:00Z'),
        }),
        TZ,
      ),
    ).toBeUndefined();
  });

  it('vaccin (08:00 compte, 9 h téléphone) et type personnalisé : jamais couverts', () => {
    expect(
      localReminderFor(ev({ sourceKey: 'vaccination:v1' }), TZ),
    ).toBeUndefined();
    expect(
      localReminderFor(ev({ sourceKey: 'pref:Bain' }), TZ),
    ).toBeUndefined();
    expect(localReminderFor(ev({}), TZ)).toBeUndefined();
  });

  it('routine à l’heure programmée par l’app : couverte (instant + date de modification)', () => {
    expect(
      localReminderFor(ev({ sourceKey: 'routine:r1', routine }), TZ),
    ).toEqual({ at: AT_8, sourceUpdatedAt: UPDATED });
  });

  it('routine : autre instant, désactivée, ou clé d’une autre source → non couverte', () => {
    const other = new Date('2031-03-10T08:00:00Z'); // 09:00 locale
    expect(
      localReminderFor(
        ev({ sourceKey: 'routine:r1', routine, scheduledAt: other }),
        TZ,
      ),
    ).toBeUndefined();
    expect(
      localReminderFor(
        ev({ sourceKey: 'routine:r1', routine: { ...routine, active: false } }),
        TZ,
      ),
    ).toBeUndefined();
    expect(
      localReminderFor(ev({ sourceKey: 'routine:autre', routine }), TZ),
    ).toBeUndefined();
    // Avant le jour de création de la routine : absente de l'Agenda.
    expect(
      localReminderFor(
        ev({
          sourceKey: 'routine:r1',
          routine: { ...routine, createdAt: new Date('2031-03-11T00:00:00Z') },
        }),
        TZ,
      ),
    ).toBeUndefined();
  });

  it('médicament quotidien à 08:00 : couvert', () => {
    expect(
      localReminderFor(ev({ sourceKey: 'medication:m1', medication }), TZ),
    ).toEqual({ at: AT_8, sourceUpdatedAt: UPDATED });
  });

  it('médicament hebdomadaire un autre jour, ou toutes les 5 h sans prise à 08:00 : non couvert', () => {
    // Début un mercredi (05/03) ; le 10/03 est un lundi : l'Agenda n'a aucune prise ce jour-là.
    expect(
      localReminderFor(
        ev({
          sourceKey: 'medication:m1',
          medication: {
            ...medication,
            frequency: 'weekly',
            startDate: new Date('2031-03-05T00:00:00Z'),
          },
        }),
        TZ,
      ),
    ).toBeUndefined();
    // Toutes les 5 h depuis le 01/03 08:00 : le 10/03, prises à 02:00, 07:00, 12:00… (pas 08:00).
    expect(
      localReminderFor(
        ev({
          sourceKey: 'medication:m1',
          medication: {
            ...medication,
            frequency: 'every_x_hours',
            intervalHours: 5,
          },
        }),
        TZ,
      ),
    ).toBeUndefined();
    // Toutes les 12 h : 08:00 et 20:00 → le rappel de 08:00 est couvert.
    expect(
      localReminderFor(
        ev({
          sourceKey: 'medication:m1',
          medication: {
            ...medication,
            frequency: 'every_x_hours',
            intervalHours: 12,
          },
        }),
        TZ,
      ),
    ).toEqual({ at: AT_8, sourceUpdatedAt: UPDATED });
    // Traitement terminé la veille : absent de l'Agenda.
    expect(
      localReminderFor(
        ev({
          sourceKey: 'medication:m1',
          medication: {
            ...medication,
            endDate: new Date('2031-03-09T00:00:00Z'),
          },
        }),
        TZ,
      ),
    ).toBeUndefined();
  });
});
