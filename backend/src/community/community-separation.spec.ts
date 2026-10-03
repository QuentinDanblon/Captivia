import { readdirSync, readFileSync, statSync } from 'fs';
import * as path from 'path';

/**
 * Séparation stricte entre la communauté (contenu public) et le carnet de santé (privé) :
 * aucun fichier de `src/community/` ne lit une table du carnet, ni l'adresse e-mail d'un compte
 * dans une réponse publique. Garde-fou statique, complété par les tests e2e (aucune fuite).
 */
const ROOT = __dirname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [full] : [];
  });
}

const HEALTH_DELEGATES = [
  'animalHealthRecord',
  'medication',
  'vaccination',
  'vetAppointment',
  'animalMeasurement',
  'breedingRecord',
  'routine',
  'actionLog',
  'notificationEvent',
];

const HEALTH_RELATIONS = [
  'healthRecords',
  'medications',
  'vaccinations',
  'vetAppointments',
  'measurements',
  'breedingRecords',
  'routines',
  'history',
  'notes',
];

describe('Séparation communauté / carnet de santé', () => {
  const files = sources(ROOT);

  it('inspecte bien les sources du module', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(HEALTH_DELEGATES)('aucun accès Prisma à « %s »', (delegate) => {
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      expect({ file, hit: new RegExp(`\\.${delegate}\\.`).test(code) }).toEqual(
        {
          file,
          hit: false,
        },
      );
    }
  });

  it.each(HEALTH_RELATIONS)(
    'aucune sélection de la relation ou du champ « %s » d’un animal',
    (relation) => {
      for (const file of files) {
        const code = readFileSync(file, 'utf8');
        expect({
          file,
          hit: new RegExp(`\\b${relation}\\s*:\\s*(true|\\{)`).test(code),
        }).toEqual({
          file,
          hit: false,
        });
      }
    },
  );

  it("l'animal lié n'expose que son nom et son espèce", () => {
    const presenter = readFileSync(
      path.join(ROOT, 'community.presenter.ts'),
      'utf8',
    );
    const block =
      /export const animalSelect = \{([\s\S]*?)\} satisfies/.exec(
        presenter,
      )?.[1] ?? '';
    expect(block.replace(/\s+/g, ' ').trim()).toBe(
      'name: true, speciesProfile: { select: { commonNameFr: true, scientificName: true } },',
    );
  });

  it("aucune réponse publique ne sélectionne l'e-mail (seule la notification de modération le lit)", () => {
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      const hits = code.match(/\bemail\s*:\s*true/g) ?? [];
      const allowed =
        path.basename(file) === 'community-moderation.service.ts' ? 1 : 0;
      expect({ file, hits: hits.length }).toEqual({ file, hits: allowed });
    }
  });
});
