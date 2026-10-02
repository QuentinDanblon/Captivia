/** URL du backend (port 3001 par défaut, Next.js sur 3000) */
const DEFAULT_API = 'http://localhost:3001';
const BACKEND_PORT = '3001';

function getApiBase(): string {
  // Depuis un autre appareil (ex. téléphone sur le même Wi‑Fi), utiliser la même IP que le frontend
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:${BACKEND_PORT}`;
    }
  }
  const raw = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API;
  const base = (typeof raw === 'string' ? raw : '').trim() || DEFAULT_API;
  if (!/^https?:\/\//i.test(base)) return DEFAULT_API;
  try {
    new URL(base);
    return base;
  } catch {
    return DEFAULT_API;
  }
}
const API_URL = getApiBase();

const NETWORK_ERROR_MESSAGES = ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource'];

/** Message renvoyé quand le backend n’est pas joignable (à utiliser pour afficher une bannière au lieu de faire planter l’app). */
export const BACKEND_UNAVAILABLE_MESSAGE =
  'Backend non connecté. En local, lancez-le avec : cd backend && npm run start:dev (port 3001).';

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

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error(BACKEND_UNAVAILABLE_MESSAGE);
    }
    throw err;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await safeFetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { message?: string })?.message ||
      response.statusText ||
      `Erreur ${response.status}`;
    throw new Error(message);
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
    try {
      const response = await safeFetch(
        `${API_URL}/species/search?${params.toString()}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          (data as { message?: string })?.message ||
          response.statusText ||
          `Erreur ${response.status}`;
        throw new Error(message);
      }
      return data as { results?: unknown[]; total?: number; source?: string };
    } catch (err) {
      const isNetworkError =
        err instanceof TypeError &&
        (err.message === 'Failed to fetch' || err.message === 'Load failed');
      if (isNetworkError) {
        throw new Error(
          'Le serveur de recherche est indisponible. Vérifiez que le backend est démarré (port 3001).'
        );
      }
      throw err;
    }
  },

  getSpecies: async (id: string) => {
    return fetchJson(`${API_URL}/species/${id}`);
  },

  getVernacularNames: async (id: string) => {
    return fetchJson(`${API_URL}/species/${id}/vernacular`);
  },

  getIucn: async (id: string) => {
    return fetchJson(`${API_URL}/species/${id}/iucn`);
  },

  getDistributions: async (id: string) => {
    return fetchJson(`${API_URL}/species/${id}/distributions`);
  },

  getMedia: async (id: string) => {
    return fetchJson(`${API_URL}/species/${id}/media`);
  },

  getMetrics: async (id: string) => {
    const response = await safeFetch(`${API_URL}/species/${id}/metrics`);
    return response.json();
  },

  countOccurrences: async (id: string) => {
    const response = await safeFetch(`${API_URL}/species/${id}/occurrences/count`);
    return response.json();
  },

  // Health endpoints
  getSpeciesHealth: async (id: string, disease?: string, locale = 'fr') => {
    const params = new URLSearchParams();
    if (disease) params.set('disease', disease);
    params.set('locale', locale);
    return fetchJson(`${API_URL}/species/${id}/health?${params.toString()}`);
  },

  // Legislation endpoints
  getSpeciesLegislation: async (id: string, country?: string) => {
    const params = country ? `?country=${country}` : '';
    return fetchJson(`${API_URL}/species/${id}/legislation${params}`);
  },

  // Food endpoints
  searchFood: async (query: string, category?: string, species?: string) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (category) params.set('category', category);
    if (species) params.set('species', species);
    return fetchJson(`${API_URL}/food/search?${params.toString()}`);
  },

  getFoodBySpecies: async (species: string, type?: string) => {
    const encoded = encodeURIComponent(species);
    const params = type ? `?type=${type}` : '';
    return fetchJson(`${API_URL}/food/species/${encoded}${params}`);
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
    return fetchJson(`${API_URL}/equipment?${params.toString()}`);
  },

  // Magasins / liens d'affiliation (par catégorie d'espèce)
  getAffiliateStores: async (category?: string, type?: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (type) params.set('type', type);
    const qs = params.toString();
    return fetchJson<{ id: string; name: string; url: string; description?: string; categories: string[]; types: string[] }[]>(
      `${API_URL}/affiliate-stores${qs ? `?${qs}` : ''}`
    );
  },

  searchAmazon: async (query: string, category?: string, limit = 10) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (category) params.set('category', category);
    params.set('limit', limit.toString());
    return fetchJson(`${API_URL}/amazon/search?${params.toString()}`);
  },

  // Animals endpoints
  getMyAnimals: async (token: string) => {
    const response = await safeFetch(`${API_URL}/users/me/animals`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getAnimal: async (id: string, token: string) => {
    const url = `${API_URL}/users/me/animals/${id}`;
    const response = await safeFetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (data as { message?: string })?.message ||
        response.statusText ||
        `Erreur ${response.status}`;
      throw new Error(message);
    }
    return data;
  },

  createAnimal: async (data: any, token: string) => {
    const response = await safeFetch(`${API_URL}/users/me/animals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (resData as { message?: string })?.message ||
        response.statusText ||
        `Erreur ${response.status}`;
      throw new Error(message);
    }
    return resData;
  },

  updateAnimal: async (id: string, data: any, token: string) => {
    const response = await safeFetch(`${API_URL}/users/me/animals/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (resData as { message?: string })?.message ||
        response.statusText ||
        `Erreur ${response.status}`;
      throw new Error(message);
    }
    return resData;
  },

  deleteAnimal: async (id: string, token: string) => {
    const response = await safeFetch(`${API_URL}/users/me/animals/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (data as { message?: string })?.message ||
        response.statusText ||
        `Erreur ${response.status}`;
      throw new Error(message);
    }
    return data;
  },

  // Descendants (petits) d'un animal (module F)
  getOffspring: async (animalId: string, token: string): Promise<Animal[]> => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/offspring`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (data as { message?: string })?.message ||
        response.statusText ||
        `Erreur ${response.status}`;
      throw new Error(message);
    }
    return Array.isArray(data) ? (data as Animal[]) : [];
  },

  // Grade & notification events
  getGrade: async (token: string) => {
    const response = await safeFetch(`${getApiBase()}/users/me/grade`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  },

  getNotificationEvents: async (token: string, date?: string, refresh = false) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (refresh) params.set('refresh', 'true');
    const qs = params.toString();
    const url = `${getApiBase()}/users/me/notification-events${qs ? `?${qs}` : ''}`;
    const response = await safeFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  },

  setNotificationEventStatus: async (
    eventId: string,
    status: 'done' | 'skipped',
    token: string
  ) => {
    const url = `${getApiBase()}/users/me/notification-events/${eventId}`;
    const response = await safeFetch(
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
    return response.json();
  },

  deleteNotificationEvent: async (eventId: string, token: string) => {
    const authToken = (token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null))?.trim();
    if (!authToken) throw new Error('Non connecté');
    const id = String(eventId ?? '').trim();
    if (!id) throw new Error('ID du rappel invalide');
    const response = await safeFetch(
      `${getApiBase()}/users/me/notification-events/${id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (data as { message?: string })?.message ||
        (response.status === 404 ? 'Rappel introuvable.' : response.statusText) ||
        'Erreur lors de la suppression. Vérifiez que le backend est démarré (port 3001).';
      throw new Error(message);
    }
    return data as { deleted?: boolean };
  },

  // Routines endpoints
  getAnimalRoutines: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/routines`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.json();
  },

  getRoutineTemplates: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/routine-templates`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    // 404 = aucune routine par défaut pour cette espèce → liste vide
    if (response.status === 404) return [];
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (data as { message?: string })?.message ||
        response.statusText ||
        `Erreur ${response.status}`;
      throw new Error(message);
    }
    return Array.isArray(data) ? (data as SpeciesRoutineTemplate[]) : [];
  },

  createRoutine: async (animalId: string, data: any, token: string) => {
    const response = await safeFetch(
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
    return response.json();
  },

  updateRoutine: async (
    animalId: string,
    routineId: string,
    data: any,
    token: string
  ) => {
    const response = await safeFetch(
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
    return response.json();
  },

  deleteRoutine: async (
    animalId: string,
    routineId: string,
    token: string
  ) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/routines/${routineId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.json();
  },

  // Health records (carnet de santé)
  getAnimalHealthRecords: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/health-records`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return Array.isArray(data) ? data : [];
  },

  createAnimalHealthRecord: async (
    animalId: string,
    data: { type: string; title: string; date: string; notes?: string; details?: object },
    token: string
  ) => {
    const response = await safeFetch(
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
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  updateAnimalHealthRecord: async (
    animalId: string,
    recordId: string,
    data: { type?: string; title?: string; date?: string; notes?: string; details?: object },
    token: string
  ) => {
    const response = await safeFetch(
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
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  deleteAnimalHealthRecord: async (
    animalId: string,
    recordId: string,
    token: string
  ) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/health-records/${recordId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { message?: string })?.message || response.statusText);
    }
    return response.json().catch(() => ({}));
  },

  // Medications (traitements médicaux)
  getMedications: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/medications`,
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
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/medications`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  updateMedication: async (
    animalId: string,
    medicationId: string,
    data: Partial<Medication>,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/medications/${medicationId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  deleteMedication: async (
    animalId: string,
    medicationId: string,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/medications/${medicationId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { message?: string })?.message || response.statusText);
    }
    return response.json().catch(() => ({}));
  },

  // Vet appointments (rendez-vous vétérinaires)
  getVetAppointments: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/vet-appointments`,
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
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/vet-appointments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  updateVetAppointment: async (
    animalId: string,
    appointmentId: string,
    data: Partial<VetAppointment>,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/vet-appointments/${appointmentId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  deleteVetAppointment: async (
    animalId: string,
    appointmentId: string,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/vet-appointments/${appointmentId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { message?: string })?.message || response.statusText);
    }
    return response.json().catch(() => ({}));
  },

  // Measurements (poids & mesures)
  getMeasurements: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/measurements`,
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
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/measurements`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  updateMeasurement: async (
    animalId: string,
    measurementId: string,
    data: Partial<AnimalMeasurement>,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/measurements/${measurementId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  deleteMeasurement: async (
    animalId: string,
    measurementId: string,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/measurements/${measurementId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { message?: string })?.message || response.statusText);
    }
    return response.json().catch(() => ({}));
  },

  // Vaccinations
  getVaccinations: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/vaccinations`,
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
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/vaccinations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  updateVaccination: async (
    animalId: string,
    vaccinationId: string,
    data: Partial<Vaccination>,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/vaccinations/${vaccinationId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  deleteVaccination: async (
    animalId: string,
    vaccinationId: string,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/vaccinations/${vaccinationId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { message?: string })?.message || response.statusText);
    }
    return response.json().catch(() => ({}));
  },

  // Breeding records (suivi de reproduction)
  getBreedingRecords: async (animalId: string, token: string) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/breeding-records`,
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
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/breeding-records`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  updateBreedingRecord: async (
    animalId: string,
    recordId: string,
    data: Partial<BreedingRecord>,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/breeding-records/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((resData as { message?: string })?.message || response.statusText);
    return resData;
  },

  deleteBreedingRecord: async (
    animalId: string,
    recordId: string,
    token: string
  ) => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/breeding-records/${recordId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { message?: string })?.message || response.statusText);
    }
    return response.json().catch(() => ({}));
  },

  // Reproduction de l'espèce (public)
  getSpeciesReproduction: async (speciesId: string): Promise<SpeciesReproduction | null> => {
    const response = await safeFetch(`${API_URL}/species/${speciesId}/reproduction`);
    if (response.status === 404) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data as { message?: string })?.message || response.statusText);
    }
    if (!data || typeof data !== 'object' || Object.keys(data as object).length === 0) return null;
    return data as SpeciesReproduction;
  },

  // Carnet de santé (export)
  exportCarnet: async (animalId: string, token: string): Promise<string> => {
    const response = await safeFetch(
      `${getApiBase()}/users/me/animals/${animalId}/carnet/export`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { message?: string })?.message || response.statusText);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  // History endpoints
  getAnimalHistory: async (animalId: string, token: string, limit = 100) => {
    const response = await safeFetch(
      `${API_URL}/users/me/animals/${animalId}/history?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.json();
  },

  logAction: async (animalId: string, data: any, token: string) => {
    const response = await safeFetch(
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
    return response.json();
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
        (data as any)?.message ||
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
        (data as any)?.message ||
        response.statusText ||
        `Erreur ${response.status}`
      );
    }
    return data;
  },

  forgotPassword: async (email: string) => {
    const response = await safeFetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data as any)?.message || response.statusText || 'Erreur');
    }
    return data as { message: string };
  },

  resetPassword: async (token: string, newPassword: string) => {
    const response = await safeFetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data as any)?.message || response.statusText || 'Erreur');
    }
    return data as { message: string };
  },

  changePassword: async (
    token: string,
    currentPassword: string,
    newPassword: string
  ) => {
    const response = await safeFetch(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data as any)?.message || response.statusText || 'Erreur');
    }
    return data as { message: string };
  },

  getProfile: async (token: string) => {
    const response = await safeFetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Subscription (Premium)
  getSubscription: async (token: string) => {
    const response = await safeFetch(`${API_URL}/users/me/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return data as { isPremium: boolean; plan?: 'monthly' | 'yearly' };
  },

  subscribe: async (plan: 'monthly' | 'yearly', token: string) => {
    const response = await safeFetch(`${API_URL}/users/me/subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { message?: string })?.message || response.statusText);
    return data as { isPremium: boolean; plan: string };
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