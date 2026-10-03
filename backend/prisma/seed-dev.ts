import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { main as seedProd, prisma as prismaProd } from './seed-prod';

// ============================================
// SEED DEV — Fixtures de démonstration uniquement
// ============================================
// Usage : `npm run seed:dev`
// 1. Exécute d'abord le seed PROD (données éditoriales, sûr, idempotent).
// 2. Crée ensuite les fixtures de DÉMO ci-dessous :
//    - testUser        dev@example.com / <voir credentials en commentaire>   ⚠️ A SUPPRIMER EN PROD
//    - testAnimal      Rango (gecko léopard, ID explicite test-animal-rango)
//    - testRoutine     nourrissage hebdo (mar/ven 19:00)
//    - NotificationPreference du testUser
// Ce script ne doit JAMAIS être exécuté en production.

const prisma = new PrismaClient();

// GBIF species IDs (alignés sur seed-prod)
const SPECIES_IDS = {
  GECKO_LEOPARD: 5221172, // Eublepharis macularius
};

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-dev interdit en production');
  }
  console.log('🌱 Starting DEV seed (demo fixtures)...');

  // (a) Données éditoriales d'abord (seed PROD)
  await seedProd();

  // (b) Fixtures de démo — ⚠️ A SUPPRIMER EN PROD
  console.log('👤 Seeding test User, Animal, NotificationPreference, Routine...');

  // ⚠️ A SUPPRIMER EN PROD : compte de démo avec mot de passe en dur
  const passwordHash = await bcrypt.hash('DevPassword123!', 10);

  const testUser = await prisma.user.upsert({
    where: { email: 'dev@example.com' },
    update: { isPremium: true },
    create: {
      email: 'dev@example.com',
      passwordHash,
      locale: 'fr',
      isPremium: true,
    },
  });

  console.log(`✅ Created test user: ${testUser.email}`);

  // ⚠️ A SUPPRIMER EN PROD : animal de démo (ID explicite, OK en dev)
  const testAnimal = await prisma.animal.upsert({
    where: { id: 'test-animal-rango' },
    update: {},
    create: {
      id: 'test-animal-rango',
      userId: testUser.id,
      speciesId: SPECIES_IDS.GECKO_LEOPARD,
      name: 'Rango',
      birthDate: new Date('2023-06-15'),
      sex: 'male',
      notes: 'Gecko léopard très docile, mange bien',
    },
  });

  console.log(`✅ Created test animal: ${testAnimal.name}`);

  // Préférences de notification du testUser
  await prisma.notificationPreference.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      types: {
        nourrissage: true,
        nettoyage: true,
        uvb: true,
        sante: true,
      },
      schedule: {
        start: '08:00',
        end: '22:00',
      },
      snooze: 15,
    },
  });

  console.log('✅ Created notification preferences');

  // Routine de démo — format schedule compatible scheduler
  // (normalizeSchedule lit schedule.days, schedule.time et schedule.recurrence)
  await prisma.routine.upsert({
    where: { id: 'test-routine-feeding' },
    update: {},
    create: {
      id: 'test-routine-feeding',
      animalId: testAnimal.id,
      type: 'nourrissage',
      frequency: 'weekly',
      schedule: {
        days: ['tuesday', 'friday'],
        time: '19:00',
        recurrence: 'weekly',
      },
      active: true,
    },
  });

  console.log('✅ Created sample routine');

  console.log('\n🎉 DEV seed completed successfully!');
  console.log('\n📋 Test credentials (DEV ONLY):');
  console.log('   Email: dev@example.com');
  console.log('   Password: <voir code source seed-dev.ts>');
}

main()
  .catch((e) => {
    console.error('❌ Seed dev failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await prismaProd.$disconnect();
  });
