// ============================================
// MODULE D — Modèles de routines par défaut par espèce
// ============================================
import type { Prisma } from '@prisma/client';
// Les modèles sont générés par CATÉGORIE à partir de SpeciesProfile.category
// (lue en base par seed-prod.ts) : une même catégorie → mêmes modèles proposés
// à la création d'un animal. Aucune donnée inventée par espèce.
//
// Catégories connues :
//  - reptile    -> nourrissage quotidien + UVB 12h/jour + nettoyage hebdo
//  - mammifère  -> nourrissage 2x/jour + nettoyage quotidien
//  - oiseau     -> nourrissage quotidien + nettoyage 2x/semaine
//  - poisson    -> nourrissage quotidien + changement d'eau hebdo
//  - amphibien  -> pulvérisation quotidienne + nettoyage hebdo
//  - insecte    -> nourrissage 2x/semaine + nettoyage hebdo
//  - arachnide  -> mêmes modèles que insecte (petits terrariums)
//  - défaut     -> nourrissage quotidien (catégorie inconnue)
//
// Le format `schedule` suit le format frontend des routines :
// { time: "08:00", recurrence: "daily"|"weekly", days?: [...], durationHours?: n }

export type RoutineTemplateType =
  | 'nourrissage'
  | 'entretien'
  | 'uvb'
  | 'controle'
  | 'changement_eau'
  | 'nettoyage_habitat'
  | 'litiere'
  | 'promenade'
  | 'exercice'
  | 'brossage'
  | 'hygiene'
  | 'entrainement'
  | 'controle_materiel';

export type RoutineTemplateFrequency =
  | 'daily'
  | 'every_2_days'
  | 'every_3_days'
  | 'weekly'
  | 'monthly'
  | 'once'
  | 'hourly'
  | 'custom';

export interface SpeciesRoutineTemplateData {
  type: RoutineTemplateType;
  name: string;
  frequency: RoutineTemplateFrequency;
  schedule: Prisma.InputJsonValue;
  order: number;
}

export type RoutineCategory =
  | 'reptile'
  | 'mammifere'
  | 'oiseau'
  | 'poisson'
  | 'amphibien'
  | 'insecte'
  | 'arachnide'
  | 'defaut';

const CATEGORY_TEMPLATES: Record<RoutineCategory, SpeciesRoutineTemplateData[]> = {
  // Reptiles : nourrissage quotidien + UVB 12h + nettoyage hebdo
  reptile: [
    {
      type: 'nourrissage',
      name: 'Nourrissage quotidien',
      frequency: 'daily',
      schedule: { time: '08:00', recurrence: 'daily' },
      order: 0,
    },
    {
      type: 'uvb',
      name: 'Lampe UVB (12h/jour)',
      frequency: 'daily',
      schedule: { time: '08:00', recurrence: 'daily', durationHours: 12 },
      order: 1,
    },
    {
      type: 'entretien',
      name: 'Nettoyage du terrarium',
      frequency: 'weekly',
      schedule: { time: '10:00', recurrence: 'weekly', days: ['monday'] },
      order: 2,
    },
  ],
  // Mammifères : nourrissage 2x/jour + nettoyage quotidien
  mammifere: [
    {
      type: 'nourrissage',
      name: 'Nourrissage du matin',
      frequency: 'daily',
      schedule: { time: '08:00', recurrence: 'daily' },
      order: 0,
    },
    {
      type: 'nourrissage',
      name: 'Nourrissage du soir',
      frequency: 'daily',
      schedule: { time: '18:00', recurrence: 'daily' },
      order: 1,
    },
    {
      type: 'entretien',
      name: 'Nettoyage quotidien (litière/cage)',
      frequency: 'daily',
      schedule: { time: '09:00', recurrence: 'daily' },
      order: 2,
    },
  ],
  // Oiseaux : nourrissage quotidien + nettoyage 2x/semaine
  oiseau: [
    {
      type: 'nourrissage',
      name: 'Nourrissage quotidien',
      frequency: 'daily',
      schedule: { time: '08:00', recurrence: 'daily' },
      order: 0,
    },
    {
      type: 'entretien',
      name: 'Nettoyage de la cage',
      frequency: 'weekly',
      schedule: { time: '10:00', recurrence: 'weekly', days: ['monday'] },
      order: 1,
    },
    {
      type: 'entretien',
      name: 'Nettoyage de la cage',
      frequency: 'weekly',
      schedule: { time: '10:00', recurrence: 'weekly', days: ['thursday'] },
      order: 2,
    },
  ],
  // Poissons : nourrissage quotidien + changement d'eau hebdo
  poisson: [
    {
      type: 'nourrissage',
      name: 'Nourrissage quotidien',
      frequency: 'daily',
      schedule: { time: '08:00', recurrence: 'daily' },
      order: 0,
    },
    {
      type: 'entretien',
      name: "Changement d'eau",
      frequency: 'weekly',
      schedule: { time: '11:00', recurrence: 'weekly', days: ['saturday'] },
      order: 1,
    },
  ],
  // Amphibiens : pulvérisation quotidienne + nettoyage hebdo
  amphibien: [
    {
      type: 'entretien',
      name: 'Pulvérisation du terrarium',
      frequency: 'daily',
      schedule: { time: '09:00', recurrence: 'daily' },
      order: 0,
    },
    {
      type: 'entretien',
      name: 'Nettoyage du terrarium',
      frequency: 'weekly',
      schedule: { time: '10:00', recurrence: 'weekly', days: ['monday'] },
      order: 1,
    },
  ],
  // Insectes : nourrissage 2x/semaine + nettoyage hebdo
  insecte: [
    {
      type: 'nourrissage',
      name: 'Nourrissage',
      frequency: 'weekly',
      schedule: { time: '18:00', recurrence: 'weekly', days: ['monday'] },
      order: 0,
    },
    {
      type: 'nourrissage',
      name: 'Nourrissage',
      frequency: 'weekly',
      schedule: { time: '18:00', recurrence: 'weekly', days: ['thursday'] },
      order: 1,
    },
    {
      type: 'entretien',
      name: 'Nettoyage du terrarium',
      frequency: 'weekly',
      schedule: { time: '10:00', recurrence: 'weekly', days: ['monday'] },
      order: 2,
    },
  ],
  // Arachnides : mêmes besoins de routine que les insectes
  arachnide: [
    {
      type: 'nourrissage',
      name: 'Nourrissage',
      frequency: 'weekly',
      schedule: { time: '18:00', recurrence: 'weekly', days: ['monday'] },
      order: 0,
    },
    {
      type: 'nourrissage',
      name: 'Nourrissage',
      frequency: 'weekly',
      schedule: { time: '18:00', recurrence: 'weekly', days: ['thursday'] },
      order: 1,
    },
    {
      type: 'entretien',
      name: 'Nettoyage du terrarium',
      frequency: 'weekly',
      schedule: { time: '10:00', recurrence: 'weekly', days: ['monday'] },
      order: 2,
    },
  ],
  // Catégorie inconnue : défaut raisonnable — nourrissage quotidien
  defaut: [
    {
      type: 'nourrissage',
      name: 'Nourrissage quotidien',
      frequency: 'daily',
      schedule: { time: '08:00', recurrence: 'daily' },
      order: 0,
    },
  ],
};

/** Normalise une catégorie : minuscules + suppression des accents. */
function normalizeCategory(category: string): string {
  return category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Mots-clés de classification (les catégories réelles de SpeciesProfile sont
// variées : 'mammifère', 'Serpent constricteur', 'Lézard gecko', 'Perroquet',
// 'Rongeur-Muridé', 'Poeciliidé', 'Phasmatodea', 'Tarentule', …).
const CATEGORY_KEYWORDS: ReadonlyArray<readonly [readonly string[], RoutineCategory]> = [
  [['reptile', 'serpent', 'python', 'boa', 'lezard', 'gecko', 'iguane', 'cameleon', 'scinque', 'varan', 'tortue'], 'reptile'],
  [['amphibien', 'grenouille', 'salamandre', 'crapaud', 'triton'], 'amphibien'],
  [['oiseau', 'perroquet', 'galliforme', 'fringillide', 'estrildide', 'rapace', 'passereau', 'canari', 'perruche'], 'oiseau'],
  [['poisson', 'cyprinide', 'characide', 'poeciliide', 'pomacentride', 'osphronemide', 'cichlide', 'guppy', 'neon'], 'poisson'],
  [['arachnide', 'scorpion', 'tarentule', 'araignee', 'mygale'], 'arachnide'],
  [['insecte', 'phasmatodea', 'blattaria', 'mantodea', 'coleoptere', 'fourmi', 'grillon'], 'insecte'],
  [['mammifere', 'rongeur', 'felide', 'canide', 'equide', 'lagomorphe', 'mustellide', 'procyonide', 'camelide', 'tubulidente', 'pholidote', 'lapin', 'hamster', 'cochon'], 'mammifere'],
];

/** Classe une catégorie SpeciesProfile vers une RoutineCategory (défaut si inconnue). */
export function classifyCategory(category: string): RoutineCategory {
  const normalized = normalizeCategory(category);
  for (const [keywords, routineCategory] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return routineCategory;
    }
  }
  return 'defaut';
}

/** Retourne les modèles de routines pour la catégorie d'une espèce (jamais vide). */
export function getRoutineTemplatesForCategory(category: string): SpeciesRoutineTemplateData[] {
  return CATEGORY_TEMPLATES[classifyCategory(category)];
}
