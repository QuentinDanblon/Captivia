export type FeedingFactsInput = {
  dietType: string | null;
  recommendedFoodsCount: number;
  sourceCount: number;
  hasValidMealFrequency: boolean;
};

/** A feeding section can be useful even when no reliable source identifies foods to avoid. */
export function hasImportableFeedingFacts(input: FeedingFactsInput): boolean {
  return Boolean(
    input.dietType &&
    input.recommendedFoodsCount >= 2 &&
    input.sourceCount > 0 &&
    input.hasValidMealFrequency,
  );
}
