export const mockCacheService = {
  get: jest.fn(),
  getStale: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  clear: jest.fn(),
  clearKey: jest.fn(),
  getCacheSize: jest.fn(),
  getCacheStats: jest.fn(),
};

export const mockGbifService = {
  searchSpecies: jest.fn(),
  getSpecies: jest.fn(),
  matchSpecies: jest.fn(),
  getVernacularNames: jest.fn(),
  getIucn: jest.fn(),
  getDistributions: jest.fn(),
  getMedia: jest.fn(),
  getMetrics: jest.fn(),
  countOccurrences: jest.fn(),
  checkApiHealth: jest.fn(),
};

export const mockTransformerService = {
  transformSearchResults: jest.fn(),
  transformSpecies: jest.fn(),
  transformVernacularNames: jest.fn(),
  transformMedia: jest.fn(),
  transformDistributions: jest.fn(),
  transformMetrics: jest.fn(),
  transformOccurrenceCount: jest.fn(),
};

export const mockFilterService = {
  applyFilters: jest.fn(),
  buildGbifQuery: jest.fn(),
};

export const mockSpeciesProfileService = {
  searchFromProfile: jest.fn(),
  getBySpeciesId: jest.fn(),
  getScientificName: jest.fn(),
};
