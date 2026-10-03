import { reminderLabelKey } from '../reminder-labels';

describe('libellés des types de rappel', () => {
  it('anciennes clés et sujets suggérés : clé traduite', () => {
    expect(reminderLabelKey('uvb')).toBe('notifications.suggested.uvb');
    expect(reminderLabelKey('sante')).toBe('notifications.suggested.health');
    expect(reminderLabelKey('UVB / éclairage')).toBe('notifications.suggested.uvb');
    expect(reminderLabelKey('Pondération')).toBe('notifications.suggested.weighing');
  });

  it('libellé personnalisé ou vide : affiché tel quel', () => {
    expect(reminderLabelKey('Brosser Félix')).toBeUndefined();
    expect(reminderLabelKey(null)).toBeUndefined();
    expect(reminderLabelKey('constructor')).toBeUndefined();
    expect(reminderLabelKey('toString')).toBeUndefined();
  });
});
