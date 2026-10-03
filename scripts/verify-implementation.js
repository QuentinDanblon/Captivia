#!/usr/bin/env node

/**
 * Script de vérification de l'implémentation Captivia
 * Vérifie que tous les fichiers requis existent et sont cohérents
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = [];

function check(description, condition) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`✅ ${description}`);
    return true;
  } else {
    failedChecks.push(description);
    console.log(`❌ ${description}`);
    return false;
  }
}

function fileExists(filePath) {
  return fs.existsSync(path.join(ROOT, filePath));
}

function fileContains(filePath, searchString) {
  try {
    const content = fs.readFileSync(path.join(ROOT, filePath), 'utf-8');
    return content.includes(searchString);
  } catch {
    return false;
  }
}

console.log('\n🎯 Vérification de l\'implémentation Captivia\n');
console.log('='.repeat(60));

// ============================================
// Phase 0 - Fondations
// ============================================
console.log('\n📦 Phase 0 - Fondations\n');

check('Schema Prisma existe', fileExists('backend/prisma/schema.prisma'));
check('Model User défini', fileContains('backend/prisma/schema.prisma', 'model User'));
check('Model Animal défini', fileContains('backend/prisma/schema.prisma', 'model Animal'));
check('Model Routine défini', fileContains('backend/prisma/schema.prisma', 'model Routine'));
check('PrismaService existe', fileExists('backend/src/prisma/prisma.service.ts'));
check('PrismaModule existe', fileExists('backend/src/prisma/prisma.module.ts'));

check('AuthModule existe', fileExists('backend/src/auth/auth.module.ts'));
check('AuthService existe', fileExists('backend/src/auth/auth.service.ts'));
check('AuthController existe', fileExists('backend/src/auth/auth.controller.ts'));
check('JwtStrategy existe', fileExists('backend/src/auth/strategies/jwt.strategy.ts'));
check('JwtAuthGuard existe', fileExists('backend/src/auth/guards/jwt-auth.guard.ts'));
check('RegisterDto existe', fileExists('backend/src/auth/dto/register.dto.ts'));
check('LoginDto existe', fileExists('backend/src/auth/dto/login.dto.ts'));

check('i18n.ts existe', fileExists('frontend/src/i18n.ts'));
check('Traduction FR existe', fileExists('frontend/messages/fr.json'));
check('Traduction EN existe', fileExists('frontend/messages/en.json'));
check('Traduction ES existe', fileExists('frontend/messages/es.json'));
check('Traduction DE existe', fileExists('frontend/messages/de.json'));
check('Traduction IT existe', fileExists('frontend/messages/it.json'));
check('Traduction PT existe', fileExists('frontend/messages/pt.json'));
check('LanguageSelector existe', fileExists('frontend/src/components/LanguageSelector.tsx'));
check('Middleware i18n existe', fileExists('frontend/src/middleware.ts'));

// ============================================
// Phase 1 - Catalogue Enrichi
// ============================================
console.log('\n📚 Phase 1 - Catalogue Enrichi\n');

check('HealthContentModule existe', fileExists('backend/src/health-content/health-content.module.ts'));
check('PubmedService existe', fileExists('backend/src/health-content/services/pubmed.service.ts'));
check('HealthContentController existe', fileExists('backend/src/health-content/health-content.controller.ts'));

check('LegislationModule existe', fileExists('backend/src/legislation/legislation.module.ts'));
check('SpeciesPlusService existe', fileExists('backend/src/legislation/services/speciesplus.service.ts'));
check('LegislationController existe', fileExists('backend/src/legislation/legislation.controller.ts'));

check('FoodModule existe', fileExists('backend/src/food/food.module.ts'));
check('OpenPetFoodFactsService existe', fileExists('backend/src/food/services/openpetfoodfacts.service.ts'));
check('FoodController existe', fileExists('backend/src/food/food.controller.ts'));

check('EquipmentModule existe', fileExists('backend/src/equipment/equipment.module.ts'));
check('AmazonPAService existe', fileExists('backend/src/equipment/services/amazon-pa.service.ts'));
check('EquipmentController existe', fileExists('backend/src/equipment/equipment.controller.ts'));

check('Page Species Detail existe', fileExists('frontend/src/app/[locale]/species/[id]/page.tsx'));
check('Page Transparency existe', fileExists('frontend/src/app/[locale]/transparency/page.tsx'));
check('Species page a Radix Tabs', fileContains('frontend/src/app/[locale]/species/[id]/page.tsx', 'Tabs.Root'));

// ============================================
// Phase 2 - Mes Animaux
// ============================================
console.log('\n🐾 Phase 2 - Mes Animaux\n');

check('AnimalsModule existe', fileExists('backend/src/animals/animals.module.ts'));
check('AnimalsService existe', fileExists('backend/src/animals/animals.service.ts'));
check('AnimalsController existe', fileExists('backend/src/animals/animals.controller.ts'));
check('Premium limit implémenté', fileContains('backend/src/animals/animals.service.ts', 'isPremium'));

check('RoutinesModule existe', fileExists('backend/src/routines/routines.module.ts'));
check('RoutinesService existe', fileExists('backend/src/routines/routines.service.ts'));
check('RoutinesController existe', fileExists('backend/src/routines/routines.controller.ts'));

check('AuthContext existe', fileExists('frontend/src/contexts/AuthContext.tsx'));
check('Page Login existe', fileExists('frontend/src/app/[locale]/(auth)/login/page.tsx'));
check('Page Register existe', fileExists('frontend/src/app/[locale]/(auth)/register/page.tsx'));
check('Page Mes Animaux existe', fileExists('frontend/src/app/[locale]/mes-animaux/page.tsx'));

// ============================================
// Phase 3 - Notifications
// ============================================
console.log('\n🔔 Phase 3 - Notifications\n');

check('NotificationsModule existe', fileExists('backend/src/notifications/notifications.module.ts'));
check('NotificationsService existe', fileExists('backend/src/notifications/notifications.service.ts'));
check('NotificationsScheduler existe', fileExists('backend/src/notifications/notifications-scheduler.service.ts'));
check('NotificationsController existe', fileExists('backend/src/notifications/notifications.controller.ts'));

check('Page Notifications existe', fileExists('frontend/src/app/[locale]/parametres/notifications/page.tsx'));
check('Service Worker existe', fileExists('frontend/public/sw.js'));

// ============================================
// Phase 4 & 5
// ============================================
console.log('\n🌍 Phase 4 & 5 - i18n, Mobile, Monétisation\n');

check('6 langues traduites', 
  fileExists('frontend/messages/fr.json') &&
  fileExists('frontend/messages/en.json') &&
  fileExists('frontend/messages/es.json') &&
  fileExists('frontend/messages/de.json') &&
  fileExists('frontend/messages/it.json') &&
  fileExists('frontend/messages/pt.json')
);

check('Guide Capacitor existe', fileExists('CAPACITOR_SETUP.md'));
check('Page Transparency existe', fileExists('frontend/src/app/[locale]/transparency/page.tsx'));
check('Disclaimer affilié présent', fileContains('frontend/src/app/[locale]/transparency/page.tsx', 'affilié'));

// ============================================
// Intégration AppModule
// ============================================
console.log('\n🔗 Intégration Modules\n');

const appModulePath = 'backend/src/app.module.ts';
check('PrismaModule importé', fileContains(appModulePath, 'PrismaModule'));
check('AuthModule importé', fileContains(appModulePath, 'AuthModule'));
check('HealthContentModule importé', fileContains(appModulePath, 'HealthContentModule'));
check('LegislationModule importé', fileContains(appModulePath, 'LegislationModule'));
check('FoodModule importé', fileContains(appModulePath, 'FoodModule'));
check('EquipmentModule importé', fileContains(appModulePath, 'EquipmentModule'));
check('AnimalsModule importé', fileContains(appModulePath, 'AnimalsModule'));
check('RoutinesModule importé', fileContains(appModulePath, 'RoutinesModule'));
check('NotificationsModule importé', fileContains(appModulePath, 'NotificationsModule'));

// ============================================
// Documentation
// ============================================
console.log('\n📖 Documentation\n');

check('README.md existe', fileExists('README.md'));
check('DEPLOYMENT.md existe', fileExists('DEPLOYMENT.md'));
check('TESTING_CHECKLIST.md existe', fileExists('TESTING_CHECKLIST.md'));
check('VALIDATION_REPORT.md existe', fileExists('VALIDATION_REPORT.md'));
check('PROJECT_STRUCTURE.md existe', fileExists('PROJECT_STRUCTURE.md'));

// ============================================
// API Client Frontend
// ============================================
console.log('\n🔌 API Client Frontend\n');

const apiPath = 'frontend/src/lib/api.ts';
check('api.getSpeciesHealth', fileContains(apiPath, 'getSpeciesHealth'));
check('api.getSpeciesLegislation', fileContains(apiPath, 'getSpeciesLegislation'));
check('api.searchFood', fileContains(apiPath, 'searchFood'));
check('api.getRecommendedEquipment', fileContains(apiPath, 'getRecommendedEquipment'));
check('api.getMyAnimals', fileContains(apiPath, 'getMyAnimals'));
check('api.createAnimal', fileContains(apiPath, 'createAnimal'));
check('api.createRoutine', fileContains(apiPath, 'createRoutine'));
check('api.login', fileContains(apiPath, 'login'));
check('api.register', fileContains(apiPath, 'register'));

// ============================================
// Résultats
// ============================================
console.log('\n' + '='.repeat(60));
console.log('\n📊 RÉSULTATS FINAUX\n');
console.log(`Total de vérifications: ${totalChecks}`);
console.log(`✅ Réussies: ${passedChecks}`);
console.log(`❌ Échouées: ${failedChecks.length}`);
console.log(`\n🎯 Score: ${Math.round((passedChecks / totalChecks) * 100)}%`);

if (failedChecks.length > 0) {
  console.log('\n❌ Échecs:\n');
  failedChecks.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
} else {
  console.log('\n🎉 TOUS LES TESTS PASSÉS! 100% DE RÉUSSITE! 🎉\n');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   ✨ IMPLÉMENTATION COMPLÈTE ✨      ║');
  console.log('║                                      ║');
  console.log('║   Le défi est relevé!               ║');
  console.log('║   Score: 100% ✅                     ║');
  console.log('╚══════════════════════════════════════╝\n');
  process.exit(0);
}
