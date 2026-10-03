import { parseSnooze, preferencesErrorKey } from '../notification-preferences';

/** Préférences de notification : rien d'invalide n'est envoyé (400 / 500 de l'API évités). */
describe('préférences de notification', () => {
  const valid = {
    types: { Bain: true },
    typeSchedules: { Bain: { time: '08:00', recurrence: 'daily' } },
    snooze: 15,
  };

  it('réglage complet : envoyable', () => {
    expect(preferencesErrorKey(valid)).toBeNull();
    expect(preferencesErrorKey({ ...valid, typeSchedules: { Bain: { time: '09:30', recurrence: 'once', date: '2026-10-05' } } })).toBeNull();
  });

  it('heure effacée ou « une seule fois » sans date : message traduit', () => {
    expect(preferencesErrorKey({ ...valid, typeSchedules: { Bain: { time: '', recurrence: 'daily' } } })).toBe('notifications.timeRequired');
    expect(preferencesErrorKey({ ...valid, typeSchedules: { Bain: { time: '08:00', recurrence: 'once' } } })).toBe('notifications.dateRequired');
  });

  it('nom de plus de 60 caractères : refusé', () => {
    expect(preferencesErrorKey({ types: { ['x'.repeat(61)]: true } })).toBe('notifications.labelTooLong');
    expect(preferencesErrorKey({ types: { ['x'.repeat(60)]: true } })).toBeNull();
  });

  it('délai de report NaN / null / décimal : refusé (jamais envoyé)', () => {
    expect(preferencesErrorKey({ ...valid, snooze: Number.NaN })).toBe('notifications.snoozeInvalid');
    expect(preferencesErrorKey({ ...valid, snooze: null })).toBe('notifications.snoozeInvalid');
    expect(preferencesErrorKey({ ...valid, snooze: 7.5 })).toBe('notifications.snoozeInvalid');
  });

  it('saisie du délai : champ vide ou hors 5–120 → null', () => {
    expect(parseSnooze('')).toBeNull();
    expect(parseSnooze('4')).toBeNull();
    expect(parseSnooze('121')).toBeNull();
    expect(parseSnooze('abc')).toBeNull();
    expect(parseSnooze(' 30 ')).toBe(30);
  });
});
