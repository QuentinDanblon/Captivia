/**
 * Migration de données 20261003170000_medication_reminders_cleanup : suppression des rappels de
 * médicament `pending` générés à tort (ancien rappel quotidien d'un traitement hebdomadaire ou
 * « toutes les N heures »). Le script est rejoué sur des données construites ici : il doit
 * supprimer exactement les rappels erronés, conserver le reste, et être idempotent.
 * Prérequis : DATABASE_URL pointe vers une base migrée ET seedée.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

jest.setTimeout(60000);

const MIGRATION_SQL = readFileSync(
  join(
    __dirname,
    '../prisma/migrations/20261003170000_medication_reminders_cleanup/migration.sql',
  ),
  'utf8',
);

describe('Migration — nettoyage des rappels de médicament erronés', () => {
  const prisma = new PrismaClient();
  const userIds: string[] = [];
  /** id d'événement → doit survivre au nettoyage ? */
  const expected = new Map<string, boolean>();

  async function setup(timezone: string) {
    const species = await prisma.speciesProfile.findFirstOrThrow({
      select: { speciesId: true },
    });
    const user = await prisma.user.create({
      data: {
        email: `med-cleanup-${randomUUID()}@example.test`,
        passwordHash: 'x',
        timezone,
      },
    });
    userIds.push(user.id);
    const animal = await prisma.animal.create({
      data: { userId: user.id, speciesId: species.speciesId, name: 'Kaa' },
    });
    const med = (frequency: string, intervalHours: number | null = null) =>
      prisma.medication.create({
        data: {
          animalId: animal.id,
          name: frequency,
          dose: '1',
          frequency,
          intervalHours,
          // Mercredi 05/03/2031 (Paris : UTC+1 jusqu'au 30/03/2031, puis UTC+2).
          startDate: new Date('2031-03-05T00:00:00Z'),
        },
      });
    const event = async (
      medicationId: string,
      iso: string,
      keep: boolean,
      status = 'pending',
    ) => {
      const ev = await prisma.notificationEvent.create({
        data: {
          userId: user.id,
          type: 'medication',
          label: 'test',
          scheduledAt: new Date(iso),
          status,
          medicationId,
          animalId: animal.id,
          sourceKey: `medication:${medicationId}`,
        },
      });
      expected.set(ev.id, keep);
    };
    return { user, animal, med, event };
  }

  beforeAll(async () => {
    await prisma.$connect();

    const paris = await setup('Europe/Paris');
    const weekly = await paris.med('weekly');
    await paris.event(weekly.id, '2031-03-12T07:00:00Z', true); // mercredi 08:00
    await paris.event(weekly.id, '2031-03-13T07:00:00Z', false); // jeudi : erroné
    await paris.event(weekly.id, '2031-03-14T07:00:00Z', true, 'done'); // traité : conservé
    await paris.event(weekly.id, '2031-03-15T07:00:00Z', true, 'skipped');
    await paris.event(weekly.id, '2031-04-02T06:00:00Z', true); // mercredi 08:00 CEST
    await paris.event(weekly.id, '2031-04-03T06:00:00Z', false); // jeudi CEST : erroné

    const every5 = await paris.med('every_x_hours', 5);
    await paris.event(every5.id, '2031-03-05T07:00:00Z', true); // ancre 08:00
    await paris.event(every5.id, '2031-03-05T12:00:00Z', true); // +5 h
    await paris.event(every5.id, '2031-03-06T08:00:00Z', true); // +25 h
    await paris.event(every5.id, '2031-03-06T07:00:00Z', false); // 08:00 du lendemain : hors grille

    const daily = await paris.med('daily');
    await paris.event(daily.id, '2031-03-13T07:00:00Z', true);

    // Fuseau inconnu : repli Europe/Paris, sans erreur.
    const invalid = await setup('Invalid/Zone');
    const weeklyInvalid = await invalid.med('weekly');
    await invalid.event(weeklyInvalid.id, '2031-03-12T07:00:00Z', true);
    await invalid.event(weeklyInvalid.id, '2031-03-13T07:00:00Z', false);

    // Fuseau d'un autre continent : jour de semaine LOCAL (Wed 05/03 à New York = 12:00Z à 08:00 EST).
    const ny = await setup('America/New_York');
    const weeklyNy = await ny.med('weekly');
    await ny.event(weeklyNy.id, '2031-03-12T12:00:00Z', true); // mercredi 08:00 EDT
    await ny.event(weeklyNy.id, '2031-03-13T12:00:00Z', false);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function remaining(): Promise<Set<string>> {
    const rows = await prisma.notificationEvent.findMany({
      where: { id: { in: [...expected.keys()] } },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  it('supprime exactement les rappels pending hors des prises du médicament', async () => {
    await prisma.$executeRawUnsafe(MIGRATION_SQL);
    const left = await remaining();
    for (const [id, keep] of expected) {
      expect([id, left.has(id)]).toEqual([id, keep]);
    }
  });

  it('est idempotente (seconde exécution : rien de plus)', async () => {
    const before = await remaining();
    await prisma.$executeRawUnsafe(MIGRATION_SQL);
    expect(await remaining()).toEqual(before);
  });
});
