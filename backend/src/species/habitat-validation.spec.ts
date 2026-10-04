import { hasReproductionFacts, hasValidTemperatureRange } from './habitat-validation';

describe('hasValidTemperatureRange', () => {
  it('allows missing temperature facts when the source does not publish them', () => {
    expect(hasValidTemperatureRange(null, null)).toBe(true);
  });

  it('requires both bounds when a temperature range is present', () => {
    expect(hasValidTemperatureRange(18, null)).toBe(false);
    expect(hasValidTemperatureRange(null, 27)).toBe(false);
  });

  it('requires a complete ascending range', () => {
    expect(hasValidTemperatureRange(18, 27)).toBe(true);
    expect(hasValidTemperatureRange(27, 18)).toBe(false);
  });
});

describe('hasReproductionFacts', () => {
  it('accepts a sourced note when the source gives no numeric reproduction values', () => {
    expect(hasReproductionFacts({ notes: 'Espèce ovipare.' })).toBe(true);
  });

  it('ignores empty notes and empty facts', () => {
    expect(hasReproductionFacts({ notes: '  ', season: null })).toBe(false);
  });

  it('accepts numeric, season and note facts', () => {
    expect(hasReproductionFacts({ incubationDays: 35 })).toBe(true);
    expect(hasReproductionFacts({ season: 'mars à juin' })).toBe(true);
  });
});
