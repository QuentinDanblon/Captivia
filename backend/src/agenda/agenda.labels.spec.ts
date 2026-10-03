import { agendaLabels } from './agenda.labels';

describe('agendaLabels routine type labels', () => {
  it.each(['fr', 'en', 'de', 'es', 'it', 'pt'])(
    'includes the added routine types in %s',
    (locale) => {
      const types = agendaLabels(locale).routineTypes;

      const addedTypes = [
        'changement_eau',
        'nettoyage_habitat',
        'litiere',
        'promenade',
        'exercice',
        'brossage',
        'hygiene',
        'entrainement',
        'controle_materiel',
      ];
      expect(Object.keys(types)).toEqual(expect.arrayContaining(addedTypes));
      for (const type of addedTypes) {
        expect(types[type]).toEqual(expect.any(String));
        expect(types[type].length).toBeGreaterThan(0);
      }
    },
  );
});
