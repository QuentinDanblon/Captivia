// Jest setup - runs before each test file
import { setExternalHttpAdapterOverride } from '../src/external/http/http-adapter-override';
import { createFakeExternalAdapter } from './utils/fake-external-adapter';

// Aucune suite ne doit joindre un service tiers (GBIF, Open Pet Food Facts, PubMed…) :
// le client HTTP partagé utilise un transport hors-ligne à base de fixtures (déterminisme,
// pas de timeout réseau). Les tests de résilience injectent leur propre adaptateur.
setExternalHttpAdapterOverride(createFakeExternalAdapter());
