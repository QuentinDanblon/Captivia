import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateNotificationPreferencesDto } from './notification-preferences.dto';

const errorsFor = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(UpdateNotificationPreferencesDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

describe('UpdateNotificationPreferencesDto', () => {
  it('snooze absent : accepté (champ facultatif)', () => {
    expect(errorsFor({ types: {} })).toEqual([]);
  });

  it.each([
    ['null (NaN sérialisé par JSON)', null],
    ['décimal', 7.5],
    ['négatif', -5],
    ['texte', '15'],
  ])('snooze %s : refusé en 400, jamais une erreur 500', (_label, snooze) => {
    expect(errorsFor({ snooze })).toEqual(['snooze']);
  });

  it('snooze entier dans les bornes : accepté', () => {
    expect(errorsFor({ snooze: 15 })).toEqual([]);
  });

  it('heure vide ou « une seule fois » sans date valide : refusés', () => {
    expect(
      errorsFor({ typeSchedules: { Bain: { time: '', recurrence: 'daily' } } }),
    ).toEqual(['typeSchedules']);
    expect(
      errorsFor({
        typeSchedules: {
          Bain: { time: '08:00', recurrence: 'once', date: '' },
        },
      }),
    ).toEqual(['typeSchedules']);
  });

  it('libellé de plus de 60 caractères : refusé', () => {
    expect(errorsFor({ types: { ['x'.repeat(61)]: true } })).toEqual(['types']);
  });
});
