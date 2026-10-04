import { hasImportableFeedingFacts } from './feeding-validation';

describe('hasImportableFeedingFacts', () => {
  it('allows sourced recommendations when no foods to avoid are documented', () => {
    expect(
      hasImportableFeedingFacts({
        dietType: 'carnivore',
        recommendedFoodsCount: 3,
        sourceCount: 1,
        hasValidMealFrequency: true,
      }),
    ).toBe(true);
  });

  it('requires a diet, at least two recommended foods, a source, and a valid frequency', () => {
    const valid = {
      dietType: 'carnivore',
      recommendedFoodsCount: 2,
      sourceCount: 1,
      hasValidMealFrequency: true,
    };
    expect(hasImportableFeedingFacts({ ...valid, dietType: null })).toBe(false);
    expect(
      hasImportableFeedingFacts({ ...valid, recommendedFoodsCount: 1 }),
    ).toBe(false);
    expect(hasImportableFeedingFacts({ ...valid, sourceCount: 0 })).toBe(false);
    expect(
      hasImportableFeedingFacts({ ...valid, hasValidMealFrequency: false }),
    ).toBe(false);
  });
});
