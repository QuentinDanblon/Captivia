/** True when both thermal bounds are absent or form a complete ascending range. */
export function hasValidTemperatureRange(
  min: number | null,
  max: number | null,
): boolean {
  return (
    (min === null && max === null) ||
    (min !== null && max !== null && min <= max)
  );
}

/** Notes such as "oviparous" count as sourced reproduction facts without inventing numeric values. */
export function hasReproductionFacts(data: {
  gestationDays?: unknown;
  incubationDays?: unknown;
  litterSizeMin?: unknown;
  sexualMaturityMonths?: unknown;
  season?: unknown;
  notes?: unknown;
}): boolean {
  const numericFacts = [
    data.gestationDays,
    data.incubationDays,
    data.litterSizeMin,
    data.sexualMaturityMonths,
  ].some((value) => typeof value === 'number' && Number.isFinite(value));
  return (
    numericFacts ||
    (typeof data.season === 'string' && data.season.trim().length > 0) ||
    (typeof data.notes === 'string' && data.notes.trim().length > 0)
  );
}
