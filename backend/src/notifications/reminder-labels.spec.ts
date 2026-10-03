import {
  medicationLabel,
  reminderTypeLabel,
  routineLabel,
  vaccineDueLabel,
  vetAppointmentLabel,
  vetReminderLabel,
} from './reminder-labels';

/** Libellés envoyés en push et par e-mail : lisibles, traduits, sans émoji ni clé brute. */
describe('reminder-labels', () => {
  const EMOJI = /\p{Extended_Pictographic}/u;

  it('anciennes clés de préférences (« uvb », « sante ») : libellé lisible et traduit', () => {
    expect(reminderTypeLabel('uvb', 'fr')).toBe('UVB / éclairage');
    expect(reminderTypeLabel('sante', 'fr')).toBe('Santé');
    expect(reminderTypeLabel('nourrissage', 'en')).toBe('Feeding');
    expect(reminderTypeLabel('UVB / éclairage', 'de')).toBe(
      'UVB / Beleuchtung',
    );
    expect(reminderTypeLabel('Pondération', 'pt')).toBe('Pesagem');
  });

  it('libellé personnalisé : inchangé ; langue inconnue : français', () => {
    expect(reminderTypeLabel('Brosser Félix', 'en')).toBe('Brosser Félix');
    expect(reminderTypeLabel('toString', 'en')).toBe('toString');
    expect(reminderTypeLabel('sante', 'ja')).toBe('Santé');
    expect(reminderTypeLabel('sante', null)).toBe('Santé');
  });

  it('médicament : dose ET unité', () => {
    expect(medicationLabel({ name: 'Métacam', dose: '0,5', unit: 'ml' })).toBe(
      'Métacam (0,5 ml)',
    );
    expect(medicationLabel({ name: 'Vermifuge', dose: '1', unit: null })).toBe(
      'Vermifuge (1)',
    );
  });

  it('rendez-vous et vaccins : traduits, sans émoji', () => {
    const labels = [
      vetAppointmentLabel('Dr Martin', 'fr'),
      vetReminderLabel('Dr Martin', 1, 'fr'),
      vetReminderLabel('Dr Martin', 7, 'en'),
      vaccineDueLabel('Rage', 'it'),
    ];
    expect(labels).toEqual([
      "Rendez-vous vétérinaire aujourd'hui : Dr Martin",
      'Rendez-vous vétérinaire demain : Dr Martin',
      'Vet appointment in 7 days: Dr Martin',
      'Richiamo vaccino: Rage',
    ]);
    for (const label of labels) expect(label).not.toMatch(EMOJI);
  });

  it('routine sans nom : type traduit ; avec nom : le nom', () => {
    expect(routineLabel({ type: 'uvb', name: null }, 'es')).toBe(
      'UVB / iluminación',
    );
    expect(routineLabel({ type: 'uvb', name: 'Lampe' }, 'es')).toBe('Lampe');
  });
});
