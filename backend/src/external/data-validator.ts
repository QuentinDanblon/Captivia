/**
 * Service de validation des données GBIF
 * Source: plans/resource-improvement-plan.md
 */

export interface ValidationRule<T> {
  field: keyof T;
  validator: (value: unknown) => boolean;
  errorMessage: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

export interface SpeciesData {
  key: number;
  name: string;
  canonicalName: string;
  rank: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  status?: string;
  vernacularNames?: Array<{ name: string; language: string }>;
  iucn?: { status: string };
  distributions?: Array<{
    country: string;
    countryIsoCode: string;
    status: string;
  }>;
  media?: Array<{ type: string; identifier: string; url: string }>;
  metrics?: { usage: number; issues: number; extensions: string[] };
  occurrenceCount?: number;
}

export interface DistributionData {
  country: string;
  countryIsoCode: string;
  status: string;
}

export interface MediaData {
  type: string;
  creator?: string;
  identifier: string;
  title?: string;
  license?: string;
  url?: string;
}

export interface MetricsData {
  usage: number;
  issues: number;
  extensions: string[];
}

// Règles de validation pour les espèces
const SPECIES_VALIDATION_RULES: ValidationRule<SpeciesData>[] = [
  {
    field: 'key',
    validator: (value) =>
      typeof value === 'number' && !isNaN(value) && value > 0,
    errorMessage: 'Species key must be a positive number',
  },
  {
    field: 'name',
    validator: (value) => typeof value === 'string' && value.trim().length > 0,
    errorMessage: 'Species name is required',
  },
  {
    field: 'canonicalName',
    validator: (value) => typeof value === 'string' && value.trim().length > 0,
    errorMessage: 'Canonical name is required',
  },
  {
    field: 'rank',
    validator: (value) =>
      typeof value === 'string' &&
      [
        'SPECIES',
        'GENUS',
        'FAMILY',
        'ORDER',
        'CLASS',
        'KINGDOM',
        'PHYLUM',
      ].includes(value),
    errorMessage: 'Invalid species rank',
  },
  {
    field: 'kingdom',
    validator: (value) =>
      typeof value === 'string' &&
      ['Animalia', 'Plantae', 'Fungi', 'Protista', 'Monera'].includes(value),
    errorMessage: 'Invalid kingdom',
  },
  {
    field: 'status',
    validator: (value) =>
      !value ||
      (typeof value === 'string' &&
        ['EXTINCT', 'ENDANGERED', 'VULNERABLE', 'LC', 'DD', 'NT'].includes(
          value,
        )),
    errorMessage: 'Invalid conservation status',
  },
];

// Règles de validation pour les distributions
const DISTRIBUTION_VALIDATION_RULES: ValidationRule<DistributionData>[] = [
  {
    field: 'country',
    validator: (value) => typeof value === 'string' && value.trim().length > 0,
    errorMessage: 'Country is required',
  },
  {
    field: 'countryIsoCode',
    validator: (value) => typeof value === 'string' && /^[A-Z]{2}$/.test(value),
    errorMessage: 'ISO country code must be 2 uppercase letters',
  },
  {
    field: 'status',
    validator: (value) =>
      typeof value === 'string' &&
      ['PRESENT', 'ABSENT', 'POSSIBLE', 'CULTIVATED'].includes(value),
    errorMessage: 'Invalid distribution status',
  },
];

// Règles de validation pour les médias
const MEDIA_VALIDATION_RULES: ValidationRule<MediaData>[] = [
  {
    field: 'type',
    validator: (value) => typeof value === 'string' && value.trim().length > 0,
    errorMessage: 'Media type is required',
  },
  {
    field: 'identifier',
    validator: (value) => typeof value === 'string' && value.trim().length > 0,
    errorMessage: 'Media identifier is required',
  },
  {
    field: 'url',
    validator: (value) =>
      !value || (typeof value === 'string' && value.startsWith('http')),
    errorMessage: 'Media URL must be a valid URL',
  },
];

// Règles de validation pour les métriques
const METRICS_VALIDATION_RULES: ValidationRule<MetricsData>[] = [
  {
    field: 'usage',
    validator: (value) => typeof value === 'number' && value >= 0,
    errorMessage: 'Usage count must be a non-negative number',
  },
  {
    field: 'issues',
    validator: (value) => typeof value === 'number' && value >= 0,
    errorMessage: 'Issues count must be a non-negative number',
  },
  {
    field: 'extensions',
    validator: (value) =>
      Array.isArray(value) && value.every((ext) => typeof ext === 'string'),
    errorMessage: 'Extensions must be an array of strings',
  },
];

/**
 * Service de validation des données
 */
export class DataValidatorService {
  /**
   * Valide les données d'une espèce
   */
  validateSpecies(data: Partial<SpeciesData>): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    for (const rule of SPECIES_VALIDATION_RULES) {
      const value = data[rule.field];
      if (!rule.validator(value)) {
        errors.push({ field: String(rule.field), message: rule.errorMessage });
      }
    }

    // Validation des noms vernaculaires
    if (data.vernacularNames && Array.isArray(data.vernacularNames)) {
      data.vernacularNames.forEach((vn, index) => {
        if (typeof vn.name !== 'string' || vn.name.trim().length === 0) {
          warnings.push({
            field: `vernacularNames[${index}].name`,
            message: 'Vernacular name is required',
          });
        }
        if (vn.language && typeof vn.language !== 'string') {
          warnings.push({
            field: `vernacularNames[${index}].language`,
            message: 'Language must be a string',
          });
        }
      });
    }

    // Validation des distributions
    if (data.distributions && Array.isArray(data.distributions)) {
      data.distributions.forEach((dist, index) => {
        const distResult = this.validateDistribution(dist);
        distResult.errors.forEach((e) =>
          warnings.push({
            field: `distributions[${index}].${e.field}`,
            message: e.message,
          }),
        );
      });
    }

    // Validation des médias
    if (data.media && Array.isArray(data.media)) {
      data.media.forEach((media, index) => {
        const mediaResult = this.validateMedia(media);
        mediaResult.errors.forEach((e) =>
          warnings.push({
            field: `media[${index}].${e.field}`,
            message: e.message,
          }),
        );
      });
    }

    // Validation des métriques
    if (data.metrics) {
      const metricsResult = this.validateMetrics(data.metrics);
      metricsResult.errors.forEach((e) =>
        warnings.push({
          field: `metrics.${e.field}`,
          message: e.message,
        }),
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valide les données d'une distribution
   */
  validateDistribution(data: DistributionData): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    for (const rule of DISTRIBUTION_VALIDATION_RULES) {
      const value = data[rule.field];
      if (!rule.validator(value)) {
        errors.push({ field: String(rule.field), message: rule.errorMessage });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valide les données d'un média
   */
  validateMedia(data: MediaData): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    for (const rule of MEDIA_VALIDATION_RULES) {
      const value = data[rule.field];
      if (!rule.validator(value)) {
        errors.push({ field: String(rule.field), message: rule.errorMessage });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valide les données de métriques
   */
  validateMetrics(data: MetricsData): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    for (const rule of METRICS_VALIDATION_RULES) {
      const value = data[rule.field];
      if (!rule.validator(value)) {
        errors.push({ field: String(rule.field), message: rule.errorMessage });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Nettoie et normalise les données d'une espèce
   */
  sanitizeSpecies(data: SpeciesData): Partial<SpeciesData> {
    const sanitized: Partial<SpeciesData> = {};

    // Champs obligatoires
    sanitized.key = data.key;
    sanitized.name = String(data.name || '').trim();
    sanitized.canonicalName = String(data.canonicalName || '').trim();
    sanitized.rank = data.rank;
    sanitized.kingdom = data.kingdom;
    sanitized.phylum = data.phylum;
    sanitized.class = data.class;
    sanitized.order = data.order;
    sanitized.family = data.family;
    sanitized.genus = data.genus;

    // Champs optionnels
    if (data.status) sanitized.status = data.status;
    if (data.vernacularNames) sanitized.vernacularNames = data.vernacularNames;
    if (data.iucn) sanitized.iucn = data.iucn;
    if (data.distributions) sanitized.distributions = data.distributions;
    if (data.media) sanitized.media = data.media;
    if (data.metrics) sanitized.metrics = data.metrics;
    if (data.occurrenceCount !== undefined)
      sanitized.occurrenceCount = data.occurrenceCount;

    return sanitized;
  }

  /**
   * Calcule un score de qualité basé sur la validation
   */
  calculateQualityScore(validationResult: ValidationResult): number {
    if (validationResult.valid) {
      return 100;
    }

    // Score basé sur le nombre d'erreurs et d'avertissements
    const totalIssues =
      validationResult.errors.length + validationResult.warnings.length;
    return Math.max(0, 100 - totalIssues * 5);
  }

  /**
   * Vérifie si les données sont complètes
   */
  isComplete(data: Partial<SpeciesData>): boolean {
    const requiredFields: (keyof SpeciesData)[] = [
      'key',
      'name',
      'canonicalName',
      'rank',
      'kingdom',
      'phylum',
      'class',
      'order',
      'family',
      'genus',
    ];

    return requiredFields.every((field) => {
      const value = data[field];
      if (field === 'status' && value === undefined) return true; // Optionnel
      return value !== undefined && value !== null && value !== '';
    });
  }

  /**
   * Obtient les statistiques de validation
   */
  getValidationStats(data: Partial<SpeciesData>): {
    totalFields: number;
    completeFields: number;
    qualityScore: number;
    completenessPercentage: number;
  } {
    const totalFields = 11; // Champs obligatoires
    const completeFields = this.isComplete(data) ? totalFields : 0;
    const qualityScore = this.calculateQualityScore(this.validateSpecies(data));
    const completenessPercentage = (completeFields / totalFields) * 100;

    return {
      totalFields,
      completeFields,
      qualityScore,
      completenessPercentage,
    };
  }
}
