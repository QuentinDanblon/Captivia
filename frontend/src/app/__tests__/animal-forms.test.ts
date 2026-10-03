import type { Animal } from '@/lib/api';
import {
  isSuspiciousChange,
  optionalText,
  parseDecimal,
  parseIntervalHours,
  parseOffspringCount,
} from '@/app/[locale]/(app)/mes-animaux/[id]/_components/formValues';
import { buildAnimalUpdate, parentCandidates } from '@/app/[locale]/(app)/mes-animaux/[id]/_components/animalEdit';

/** Formulaires de la fiche animal : valeurs envoyées à l'API, bornes des DTO. */
describe('valeurs des formulaires', () => {
  it('intervalle : saisie libre, validé de 1 à 24 à l’enregistrement', () => {
    expect(parseIntervalHours('')).toBeNull();
    expect(parseIntervalHours('6')).toBe(6);
    expect(parseIntervalHours('24')).toBe(24);
    expect(parseIntervalHours('0')).toBeNull();
    expect(parseIntervalHours('25')).toBeNull();
    expect(parseIntervalHours('1.5')).toBeNull();
  });

  it('décimal : virgule ou point (« 4,25 » ne devient jamais 425)', () => {
    expect(parseDecimal('4,25')).toBe(4.25);
    expect(parseDecimal('4.25')).toBe(4.25);
    expect(parseDecimal(' ')).toBeNull();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,000.5')).toBeNaN();
    expect(parseDecimal('-2')).toBeNaN();
  });

  it('nombre de petits : entier de 0 à 100', () => {
    expect(parseOffspringCount('0')).toBe(0);
    expect(parseOffspringCount('100')).toBe(100);
    expect(parseOffspringCount('101')).toBeNull();
    expect(parseOffspringCount('')).toBeNull();
    expect(parseOffspringCount('2.5')).toBeNull();
  });

  it('champ facultatif vidé : null en modification, omis à la création', () => {
    expect(optionalText('  ', true)).toBeNull();
    expect(optionalText('', false)).toBeUndefined();
    expect(optionalText(' Dr Martin ', true)).toBe('Dr Martin');
  });

  it('pesée : écart d’un facteur 10 signalé', () => {
    expect(isSuspiciousChange(4.2, 42)).toBe(true);
    expect(isSuspiciousChange(4.2, 0.42)).toBe(true);
    expect(isSuspiciousChange(4.2, 4.5)).toBe(false);
    expect(isSuspiciousChange(undefined, 42)).toBe(false);
  });
});

describe('modification d’un animal', () => {
  const animal: Animal = {
    id: 'a1',
    name: 'Nala',
    speciesId: 10,
    birthDate: '2020-05-01',
    sex: 'female',
    notes: 'Calme',
    fatherId: 'p1',
    motherId: null,
    father: { id: 'p1', name: 'Rex' },
  };
  const values = {
    name: ' Nala ',
    birthDate: '2020-05-01',
    sex: 'female',
    notes: 'Calme',
    photoUrl: '',
    fatherId: 'p1',
    motherId: '',
    groupName: '',
  };

  it('parents inchangés : non envoyés (un lien devenu incohérent ne bloque pas l’enregistrement)', () => {
    const body = buildAnimalUpdate(animal, values);
    expect(body).not.toHaveProperty('fatherId');
    expect(body).not.toHaveProperty('motherId');
    expect(body.name).toBe('Nala');
  });

  it('parent modifié ou retiré : envoyé (null pour retirer)', () => {
    expect(buildAnimalUpdate(animal, { ...values, fatherId: '' })).toMatchObject({ fatherId: null });
    expect(buildAnimalUpdate(animal, { ...values, motherId: 'm2' })).toMatchObject({ motherId: 'm2' });
  });

  it('date de naissance et notes vidées : null (effacées), jamais undefined', () => {
    const body = buildAnimalUpdate(animal, { ...values, birthDate: '', notes: '  ' });
    expect(body.birthDate).toBeNull();
    expect(body.notes).toBeNull();
    expect(body.groupName).toBeNull();
  });

  it('parents proposés : même espèce, sexe compatible ; parent actuel conservé ; rien avant chargement', () => {
    const others: Animal[] = [
      { id: 'a1', name: 'Nala', speciesId: 10, sex: 'female' },
      { id: 'm1', name: 'Mia', speciesId: 10, sex: 'female' },
      { id: 'u1', name: 'Pilou', speciesId: 10, sex: 'unknown' },
      { id: 'd1', name: 'Rex le chien', speciesId: 99, sex: 'male' },
      { id: 'p2', name: 'Tom', speciesId: 10, sex: 'male' },
    ];
    expect(parentCandidates(animal, others, 'mother').map((a) => a.id)).toEqual(['m1', 'u1']);
    // Rex (p1) n'est pas dans la liste chargée : conservé en tête, à partir de `animal.father`.
    expect(parentCandidates(animal, others, 'father').map((a) => a.id)).toEqual(['p1', 'u1', 'p2']);
    expect(parentCandidates(animal, null, 'father').map((a) => a.id)).toEqual(['p1']);
    expect(parentCandidates(animal, null, 'mother')).toEqual([]);
  });
});
