// Modification d'un animal : corps du PATCH et parents proposés (logique pure, testée).
import type { Animal, AnimalParent } from '@/lib/api';

/** Valeurs du formulaire « Modifier l'animal » (chaînes brutes des champs). */
export interface AnimalEditValues {
  name: string;
  birthDate: string;
  sex: string;
  notes: string;
  photoUrl: string;
  fatherId: string;
  motherId: string;
  groupName: string;
}

/**
 * Corps du PATCH : un champ facultatif vidé est envoyé à `null` (effacé), jamais `undefined`
 * (ignoré par l'API) ; père et mère ne sont envoyés que s'ils ont changé, pour qu'un lien
 * devenu incohérent (sexe modifié depuis) ne bloque pas l'enregistrement du reste.
 */
export function buildAnimalUpdate(animal: Animal, values: AnimalEditValues): Record<string, unknown> {
  const photo = values.photoUrl.trim();
  const body: Record<string, unknown> = {
    name: values.name.trim(),
    birthDate: values.birthDate || null,
    notes: values.notes.trim() || null,
    photos: photo ? [photo] : [],
    groupName: values.groupName.trim() || null,
  };
  if (values.sex) body.sex = values.sex;
  if (values.fatherId !== (animal.fatherId ?? '')) body.fatherId = values.fatherId || null;
  if (values.motherId !== (animal.motherId ?? '')) body.motherId = values.motherId || null;
  return body;
}

/**
 * Parents proposés : animaux de la même espèce, de sexe compatible (inconnu accepté). Le parent
 * actuel est toujours conservé dans la liste. Avant chargement (`null`), seul le parent actuel.
 */
export function parentCandidates(
  animal: Animal,
  candidates: Animal[] | null,
  role: 'father' | 'mother',
): Array<Pick<AnimalParent, 'id' | 'name'>> {
  const currentId = role === 'father' ? animal.fatherId : animal.motherId;
  const current = role === 'father' ? animal.father : animal.mother;
  const excludedSex = role === 'father' ? 'female' : 'male';
  const list: Array<Pick<AnimalParent, 'id' | 'name'>> = (candidates ?? []).filter(
    (a) =>
      a.id === currentId ||
      (a.id !== animal.id && a.speciesId === animal.speciesId && a.sex !== excludedSex),
  );
  if (currentId && !list.some((a) => a.id === currentId) && current) list.unshift(current);
  return list;
}
