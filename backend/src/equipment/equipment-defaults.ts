/** Matériel de base : chiens/chats sourcés et habitat propre à chaque autre espèce. */
import type { Prisma } from '@prisma/client';

export interface EquipmentContext {
  speciesId: number;
  scientificName: string;
  category: string;
  habitats: {
    habitatType: string;
    activityEnrichment: string;
    lightNeeds: string;
    sources: Prisma.JsonValue | null;
  }[];
}

export interface EquipmentItem {
  id: string;
  speciesId: number | null;
  category: string;
  label: string;
  labelKey?: string;
  size: string | null;
}

export const DOG_EQUIPMENT_SOURCE =
  'https://www.gov.uk/government/publications/code-of-practice-for-the-welfare-of-dogs';
export const CAT_EQUIPMENT_SOURCE =
  'https://www.gov.uk/government/publications/code-of-practice-for-the-welfare-of-cats';

/** Les races ont le même nom scientifique que leur espèce ; aucun test sur « chat »/« chien » dans le nom commun. */
export function domesticGroup(scientificName: string): 'dog' | 'cat' | null {
  const name = scientificName.toLowerCase().trim();
  if (['canis familiaris', 'canis lupus familiaris'].includes(name))
    return 'dog';
  if (name === 'felis catus') return 'cat';
  return null;
}

export function equipmentDefaults(species: EquipmentContext): {
  recommendations: EquipmentItem[];
  sources: Prisma.JsonValue[];
} {
  const recommendations: EquipmentItem[] = [];
  const sources: Prisma.JsonValue[] = [];
  const add = (category: string, label: string, labelKey?: string) =>
    recommendations.push({
      id: `habitat-${species.speciesId}-${category}`,
      speciesId: species.speciesId,
      category,
      label,
      ...(labelKey ? { labelKey } : {}),
      size: null,
    });
  const group = domesticGroup(species.scientificName);
  if (group) {
    add('couchage', 'Panier ou coussin adapté à la taille', 'bed');
    add('gamelle', 'Gamelles pour la nourriture et l’eau', 'bowls');
    if (group === 'dog') add('jouet', 'Jouets adaptés au chien', 'dogToys');
    else {
      add('litiere', 'Bac à litière', 'litterTray');
      add('griffoir', 'Griffoir stable', 'scratchingPost');
    }
    sources.push(group === 'dog' ? DOG_EQUIPMENT_SOURCE : CAT_EQUIPMENT_SOURCE);
    return { recommendations, sources };
  }

  // Sans habitat documenté, aucun équipement d'une autre espèce n'est proposé.
  const habitat = species.habitats[0];
  if (!habitat) return { recommendations, sources };
  const housing: Record<string, [string, string]> = {
    terrarium: ['Terrarium adapté à l’espèce', 'terrarium'],
    vivarium: ['Vivarium adapté à l’espèce', 'vivarium'],
    aquarium: ['Aquarium adapté à l’espèce', 'aquarium'],
    aquaterrarium: ['Aquaterrarium adapté à l’espèce', 'aquaterrarium'],
    cage: ['Cage adaptée à l’espèce', 'cage'],
    voliere: ['Volière adaptée à l’espèce', 'aviary'],
    enclos: ['Enclos adapté à l’espèce', 'enclosure'],
    bassin: ['Bassin adapté à l’espèce', 'pond'],
  };
  const type = habitat.habitatType
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const enclosure = housing[type];
  if (enclosure) add(type, enclosure[0], enclosure[1]);
  // On conserve les aménagements de la fiche sourcée, sans inventer de dimensions ni d'accessoires universels.
  if (
    /perchoir|branche|cachette|plante|roue|substrat|abri/i.test(
      habitat.activityEnrichment,
    )
  ) {
    add('decoration', habitat.activityEnrichment);
  }
  if (/uvb/i.test(habitat.lightNeeds)) add('uvb', habitat.lightNeeds);
  if (Array.isArray(habitat.sources)) {
    sources.push(
      ...habitat.sources.filter(
        (source) =>
          typeof source === 'string' ||
          (source !== null &&
            typeof source === 'object' &&
            !Array.isArray(source) &&
            typeof source.url === 'string'),
      ),
    );
  }
  return { recommendations, sources };
}
