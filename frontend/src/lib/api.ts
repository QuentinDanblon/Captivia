import { API_URL } from './config';

const NETWORK_ERROR_MESSAGES = ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource'];

/** Message renvoyé quand le backend n’est pas joignable (à utiliser pour afficher une bannière au lieu de faire planter l’app). */
export const BACKEND_UNAVAILABLE_MESSAGE =
  'Le service est momentanément indisponible. Veuillez réessayer dans quelques instants.';

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && NETWORK_ERROR_MESSAGES.some((m) => (err as Error).message?.includes(m));
}

/** Indique si l’erreur correspond à un backend injoignable (pour affichage soft dans l’UI). */
export function isBackendUnavailable(err: unknown): boolean {
  return err instanceof Error && err.message === BACKEND_UNAVAILABLE_MESSAGE;
}

/** W0-06 — état du partage public (QR) d'un animal ; `url` est construite par le backend. */
export interface PublicLinkState {
  enabled: boolean;
  showHealth: boolean;
  slug: string | null;
  url: string | null;
}

/** W0-06 — profil public (liste blanche renvoyée par GET /public/animal/:slug). */
export interface PublicAnimalProfile {
  name: string;
  species: { commonName: string; scientificName: string } | null;
  sex: string | null;
  birthYear: number | null;
  photo: string | null;
  /** Présent uniquement si le propriétaire a activé « Afficher les vaccins ». */
  vaccinations?: Array<{ name: string; date: string }>;
}

/** Délai maximal d'une requête vers l'API (le navigateur n'en impose pas de raisonnable). */
const REQUEST_TIMEOUT_MS = 15_000;

/** Erreur HTTP renvoyée par l'API : `status` permet aux appelants de distinguer 401 / 403 / 404… */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface RequestOptions {
  /** Délai maximal en ms (15 s par défaut). */
  timeoutMs?: number;
  /**
   * Émettre `auth:logout` sur une réponse 401. Par défaut : uniquement si la requête porte un
   * en-tête Authorization. À désactiver pour les endpoints où 401 signifie autre chose qu'une
   * session expirée (ex. mot de passe actuel incorrect). Jamais déclenché sur 403.
   */
  logoutOn401?: boolean;
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function hasAuthorization(init?: RequestInit): boolean {
  const headers = init?.headers;
  if (!headers) return false;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) return headers.has('Authorization');
  if (Array.isArray(headers)) return headers.some(([k]) => k.toLowerCase() === 'authorization');
  return Object.keys(headers).some((k) => k.toLowerCase() === 'authorization');
}

function isTimeoutError(err: unknown): boolean {
  const name = typeof err === 'object' && err !== null ? (err as { name?: string }).name : undefined;
  return name === 'TimeoutError' || name === 'AbortError';
}

/** Session expirée / invalide : AuthContext écoute cet événement et vide la session. */
function notifyUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:logout'));
  }
}

async function safeFetch(url: string, init?: RequestInit, options: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, logoutOn401 } = options;
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: init?.signal ?? timeoutSignal(timeoutMs) });
  } catch (err) {
    if (isNetworkError(err) || isTimeoutError(err)) {
      throw new Error(BACKEND_UNAVAILABLE_MESSAGE);
    }
    throw err;
  }
  if (response.status === 401 && (logoutOn401 ?? hasAuthorization(init))) {
    notifyUnauthorized();
  }
  return response;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function errorMessage(data: unknown, response: Response): string {
  const raw = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(raw) && raw.length > 0) return raw.map(String).join(' ; ');
  if (typeof raw === 'string' && raw) return raw;
  return response.statusText || `Erreur ${response.status}`;
}

/**
 * Point d'entrée unique des appels JSON : vérifie `res.ok`, applique le timeout de 15 s, lève
 * `ApiError {status, message}` et signale les sessions expirées (401 authentifié -> `auth:logout`).
 * Un corps vide ou non JSON sur une réponse OK donne `{}`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- conserve les signatures exportées (réponses non typées)
async function request<T = any>(url: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const response = await safeFetch(url, init, options);
  const data = await readJson(response);
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(data, response));
  }
  return data as T;
}

export interface SearchSpeciesFilters {
  limit?: number;
  offset?: number;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  rank?: string;
  iucnStatus?: string;
  country?: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  unit?: string | null;
  frequency: 'daily' | 'every_x_hours' | 'weekly';
  intervalHours?: number | null;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
  active: boolean;
}

export interface VetAppointment {
  id: string;
  vetName: string;
  reason?: string | null;
  date: string;
  location?: string | null;
  notes?: string | null;
  status: 'scheduled' | 'done' | 'cancelled';
  reminderDays: number[];
}

export interface AnimalMeasurement {
  id: string;
  weightKg?: number | null;
  heightCm?: number | null;
  measuredAt: string;
  notes?: string | null;
}

export interface Vaccination {
  id: string;
  name: string;
  date: string;
  nextDueDate?: string | null;
  batchNumber?: string | null;
  vetName?: string | null;
  notes?: string | null;
}

export interface BreedingRecord {
  id: string;
  eventType: 'heat' | 'mating' | 'pregnancy' | 'birth' | 'weaning';
  date: string;
  partnerName?: string | null;
  offspringCount?: number | null;
  notes?: string | null;
}

export interface SpeciesReproduction {
  id: string;
  speciesId: number;
  season?: string | null;
  gestationDays?: number | null;
  incubationDays?: number | null;
  litterSizeMin?: number | null;
  litterSizeMax?: number | null;
  sexualMaturityMonths?: number | null;
  breedingDifficulty?: string | null;
  notes?: string | null;
}

/** Référence parente d'un animal (père/mère) renvoyée par le backend (module F). */
export interface AnimalParent {
  id: string;
  name: string;
  sex?: string;
  photos?: string[];
}

/** Animal du user (module F : parenté + groupe/enclos). */
export interface Animal {
  id: string;
  name: string;
  speciesId: number;
  birthDate?: string;
  sex?: string;
  photos?: string[];
  notes?: string;
  publicSlug?: string;
  fatherId?: string | null;
  motherId?: string | null;
  groupName?: string | null;
  father?: AnimalParent | null;
  mother?: AnimalParent | null;
}

/** Routine par défaut proposée pour une espèce (module D). */
export interface SpeciesRoutineTemplate {
  id: string;
  speciesId: number;
  type: string;
  name?: string | null;
  frequency: string;
  schedule: Record<string, unknown> | null;
  order: number;
}

export const api = {
  // Species endpoints
  searchSpecies: async (
    query: string,
    limit = 20,
    offset = 0,
    filters?: SearchSpeciesFilters
  ) => {
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (filters) {
      if (filters.kingdom) params.set('kingdom', filters.kingdom);
      if (filters.phylum) params.set('phylum', filters.phylum);
      if (filters.class) params.set('class', filters.class);
      if (filters.order) params.set('order', filters.order);
      if (filters.family) params.set('family', filters.family);
      if (filters.genus) params.set('genus', filters.genus);
      if (filters.rank) params.set('rank', filters.rank);
      if (filters.iucnStatus) params.set('iucnStatus', filters.iucnStatus);
      if (filters.country) params.set('country', filters.country);
    }
    return request<{ results?: unknown[]; total?: number; source?: string }>(
      `${API_URL}/species/search?${params.toString()}`
    );
  },

  getSpecies: async (id: string) => {
    return request(`${API_URL}/species/${id}`);
  },

  getVernacularNames: async (id: string) => {
    return request(`${API_URL}/species/${id}/vernacular`);
  },

  getIucn: async (id: string) => {
    return request(`${API_URL}/species/${id}/iucn`);
  },

  getDistributions: async (id: string) => {
    return request(`${API_URL}/species/${id}/distributions`);
  },

  getMedia: async (id: string) => {
    return request(`${API_URL}/species/${id}/media`);
  },

  getMetrics: async (id: string) => {
    return request(`${API_URL}/species/${id}/metrics`);
  },

  countOccurrences: async (id: string) => {
    return request(`${API_URL}/species/${id}/occurrences/count`);
  },

  // Health endpoints
  getSpeciesHealth: async (id: string, disease?: string, locale = 'fr') => {
    const params = new URLSearchParams();
    if (disease) params.set('disease', disease);
    params.set('locale', locale);
    return request(`${API_URL}/species/${id}/health?${params.toString()}`);
  },

  // Legislation endpoints
  getSpeciesLegislation: async (id: string, country?: string) => {
    const params = country ? `?country=${country}` : '';
    return request(`${API_URL}/species/${id}/legislation${params}`);
  },

  // Food endpoints
  searchFood: async (query: string, category?: string, species?: string) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (category) params.set('category', category);
    if (species) params.set('species', species);
    return request(`${API_URL}/food/search?${params.toString()}`);
  },

  getFoodBySpecies: async (species: string, type?: string) => {
    const encoded = encodeURIComponent(species);
    const params = type ? `?type=${type}` : '';
    return request(`${API_URL}/food/species/${encoded}${params}`);
  },

  // Equipment endpoints
  getRecommendedEquipment: async (
    speciesId?: number,
    category?: string,
    size?: string
  ) => {
    const params = new URLSearchParams();
    if (speciesId) params.set('speciesId', speciesId.toString());
    if (category) params.set('category', category);
    if (size) params.set('size', size);
    return request(`${API_URL}/equipment?${params.toString()}`);
  },

  // Magasins / liens d'affiliation (par catégorie d'espèce)
  getAffiliateStores: async (category?: string, type?: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (type) params.set('type', type);
    const qs = params.toString();
    return request<{ id: string; name: string; url: string; description?: string; categories: string[]; types: string[] }[]>(
      `${API_URL}/affiliate-stores${qs ? `?${qs}` : ''}`
    );
  },

  searchAmazon: async (query: string, category?: string, limit = 10) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (category) params.set('category', category);
    params.set('limit', limit.toString());
    return request(`${API_URL}/amazon/search?${params.toString()}`);
  },

  // Animals endpoints
  getMyAnimals: async (token: string) => {
    return request(`${API_URL}/users/me/animals`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getAnimal: async (id: string, token: string) => {
    const url = `${API_URL}/users/me/animals/${id}`;
    return request(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  createAnimal: async (data: object, token: string) => {
    return request(`${API_URL}/users/me/animals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },

  updateAnimal: async (id: string, data: object, token: string) => {
    return request(`${API_URL}/users/me/animals/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },

  deleteAnimal: async (id: string, token: string) => {
    return request(`${API_URL}/users/me/animals/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  // Descendants (petits) d'un animal (module F)
  getOffspring: async (animalId: string, token: string): Promise<Animal[]> => {
    const data = await request(
      `${API_URL}/users/me/animals/${animalId}/offspring`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return Array.isArray(data) ? (data as Animal[]) : [];
  },

  // Grade & notification events
  getGrade: async (token: string) => {
    return request(`${API_URL}/users/me/grade`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getNotificationEvents: async (token: string, date?: string, refresh = false) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (refresh) params.set('refresh', 'true');
    const qs = params.toString();
    const url = `${API_URL}/users/me/notification-events${qs ? `?${qs}` : ''}`;
    return request(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  setNotificationEventStatus: async (
    eventId: string,
    status: 'done' | 'skipped',
    token: string
  ) => {
    const url = `${API_URL}/users/me/notification-events/${eventId}`;
    return request(
      url,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      }
    );
  },

  deleteNotificationEvent: async (eventId: string, token: string) => {
    const authToken = (token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null))?.trim();
    if (!authToken) throw new Error('Non connecté');
    const id = String(eventId ?? '').trim();
    if (!id) throw new Error('ID du rappel invalide');
    try {
      return await request<{ deleted?: boolean }>(
        `${API_URL}/users/me/notification-events/${id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new ApiError(404, 'Rappel introuvable.');
      }
      throw err;
    }
  },

  // Routines endpoints
  getAnimalRoutines: async (animalId: string, token: string) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/routines`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  },

  getRoutineTemplates: async (animalId: string, token: string) => {
    try {
      const data = await request(
        `${API_URL}/users/me/animals/${animalId}/routine-templates`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return Array.isArray(data) ? (data as SpeciesRoutineTemplate[]) : [];
    } catch (err) {
      // 404 = aucune routine par défaut pour cette espèce → liste vide
      if (err instanceof ApiError && err.status === 404) return [];
      throw err;
    }
  },

  createRoutine: async (animalId: string, data: object, token: string) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/routines`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  updateRoutine: async (
    animalId: string,
    routineId: string,
    data: object,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/routines/${routineId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  deleteRoutine: async (
    animalId: string,
    routineId: string,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/routines/${routineId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  },

  // Health records (carnet de santé)
  getAnimalHealthRecords: async (animalId: string, token: string) => {
    const data = await request(
      `${API_URL}/users/me/animals/${animalId}/health-records`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return Array.isArray(data) ? data : [];
  },

  createAnimalHealthRecord: async (
    animalId: string,
    data: { type: string; title: string; date: string; notes?: string; details?: object },
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/health-records`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  updateAnimalHealthRecord: async (
    animalId: string,
    recordId: string,
    data: { type?: string; title?: string; date?: string; notes?: string; details?: object },
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/health-records/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  deleteAnimalHealthRecord: async (
    animalId: string,
    recordId: string,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/health-records/${recordId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  },

  // Medications (traitements médicaux)
  getMedications: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/medications`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return Array.isArray(data) ? data : [];
  },

  createMedication: async (
    animalId: string,
    data: Partial<Medication>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/medications`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  updateMedication: async (
    animalId: string,
    medicationId: string,
    data: Partial<Medication>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/medications/${medicationId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  deleteMedication: async (
    animalId: string,
    medicationId: string,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/medications/${medicationId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  },

  // Vet appointments (rendez-vous vétérinaires)
  getVetAppointments: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/vet-appointments`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return Array.isArray(data) ? data : [];
  },

  createVetAppointment: async (
    animalId: string,
    data: Partial<VetAppointment>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/vet-appointments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  updateVetAppointment: async (
    animalId: string,
    appointmentId: string,
    data: Partial<VetAppointment>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/vet-appointments/${appointmentId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  deleteVetAppointment: async (
    animalId: string,
    appointmentId: string,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/vet-appointments/${appointmentId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  },

  // Measurements (poids & mesures)
  getMeasurements: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/measurements`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return Array.isArray(data) ? data : [];
  },

  createMeasurement: async (
    animalId: string,
    data: Partial<AnimalMeasurement>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/measurements`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  updateMeasurement: async (
    animalId: string,
    measurementId: string,
    data: Partial<AnimalMeasurement>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/measurements/${measurementId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  deleteMeasurement: async (
    animalId: string,
    measurementId: string,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/measurements/${measurementId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  },

  // Vaccinations
  getVaccinations: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/vaccinations`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return Array.isArray(data) ? data : [];
  },

  createVaccination: async (
    animalId: string,
    data: Partial<Vaccination>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/vaccinations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  updateVaccination: async (
    animalId: string,
    vaccinationId: string,
    data: Partial<Vaccination>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/vaccinations/${vaccinationId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  deleteVaccination: async (
    animalId: string,
    vaccinationId: string,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/vaccinations/${vaccinationId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  },

  // Breeding records (suivi de reproduction)
  getBreedingRecords: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/breeding-records`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return Array.isArray(data) ? data : [];
  },

  createBreedingRecord: async (
    animalId: string,
    data: Partial<BreedingRecord>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/breeding-records`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  updateBreedingRecord: async (
    animalId: string,
    recordId: string,
    data: Partial<BreedingRecord>,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/breeding-records/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  deleteBreedingRecord: async (
    animalId: string,
    recordId: string,
    token: string
  ) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/breeding-records/${recordId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  },

  // Reproduction de l'espèce (public)
  getSpeciesReproduction: async (speciesId: string): Promise<SpeciesReproduction | null> => {
    let data: unknown;
    try {
      data = await request(`${API_URL}/species/${speciesId}/reproduction`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
    if (!data || typeof data !== 'object' || Object.keys(data as object).length === 0) return null;
    return data as SpeciesReproduction;
  },

  // Carnet de santé (export)
  exportCarnet: async (animalId: string, token: string): Promise<string> => {
    // Export potentiellement volumineux : délai plus large que les appels JSON.
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/carnet/export`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      { timeoutMs: 60_000 }
    );
    if (!response.ok) {
      const data = await readJson(response);
      throw new ApiError(response.status, errorMessage(data, response));
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  // History endpoints
  getAnimalHistory: async (animalId: string, token: string, limit = 100) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/history?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  },

  logAction: async (animalId: string, data: object, token: string) => {
    return request(
      `${API_URL}/users/me/animals/${animalId}/history`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
  },

  // Auth endpoints
  register: async (email: string, password: string, locale = 'fr') => {
    const response = await safeFetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, locale }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        (data as { message?: string })?.message ||
        response.statusText ||
        `Erreur ${response.status}`
      );
    }
    return data;
  },

  login: async (email: string, password: string) => {
    const response = await safeFetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        (data as { message?: string })?.message ||
        response.statusText ||
        `Erreur ${response.status}`
      );
    }
    return data;
  },

  forgotPassword: async (email: string) => {
    return request<{ message: string }>(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (token: string, newPassword: string) => {
    return request<{ message: string }>(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
  },

  changePassword: async (
    token: string,
    currentPassword: string,
    newPassword: string
  ) => {
    return request<{ message: string }>(
      `${API_URL}/auth/change-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      // 401 = « mot de passe actuel incorrect » : ce n'est pas une session expirée.
      { logoutOn401: false }
    );
  },

  getProfile: async (token: string) => {
    return request(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  // Subscription (Premium)
  getSubscription: async (token: string) => {
    return request<{ isPremium: boolean; plan?: 'monthly' | 'yearly' }>(`${API_URL}/users/me/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  subscribe: async (plan: 'monthly' | 'yearly', token: string) => {
    return request<{ isPremium: boolean; plan: string }>(`${API_URL}/users/me/subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
    });
  },

  /** État du partage public d'un animal. L'URL est construite par le backend (W0-06). */
  getAnimalPublicLink: async (animalId: string, token: string, locale?: string): Promise<PublicLinkState> => {
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/public-link${qs}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return data as PublicLinkState;
  },

  updateAnimalPublicLink: async (
    animalId: string,
    token: string,
    body: { enabled?: boolean; showHealth?: boolean },
    locale?: string,
  ): Promise<PublicLinkState> => {
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/public-link${qs}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return data as PublicLinkState;
  },

  regenerateAnimalPublicLink: async (animalId: string, token: string, locale?: string): Promise<PublicLinkState> => {
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/public-link/regenerate${qs}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return data as PublicLinkState;
  },

  getPublicAnimal: async (slug: string): Promise<PublicAnimalProfile> => {
    const response = await safeFetch(`${API_URL}/public/animal/${encodeURIComponent(slug)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error((data as { message?: string })?.message || response.statusText) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
    return data as PublicAnimalProfile;
  },
};