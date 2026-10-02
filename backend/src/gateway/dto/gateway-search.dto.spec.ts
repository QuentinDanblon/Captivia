import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GatewaySearchDto } from './gateway-search.dto';

function validate(plain: Record<string, unknown>) {
  const dto = plainToInstance(GatewaySearchDto, plain);
  return { dto, errors: validateSync(dto) };
}

describe('GatewaySearchDto', () => {
  it('accepte une requête valide et applique limit=10 par défaut', () => {
    const { dto, errors } = validate({ query: 'boa constrictor' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(10);
  });

  it('convertit limit (chaîne) en nombre', () => {
    const { dto, errors } = validate({ query: 'boa', limit: '15' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(15);
  });

  it.each(['0', '21', '-1', '1.5', 'abc'])('refuse limit=%s', (limit) => {
    expect(validate({ query: 'boa', limit }).errors.length).toBeGreaterThan(0);
  });

  it.each(['', 'a', ' a '])('refuse une requête trop courte (%p)', (query) => {
    expect(validate({ query }).errors.length).toBeGreaterThan(0);
  });

  it('accepte 100 caractères et refuse 101', () => {
    expect(validate({ query: 'x'.repeat(100) }).errors).toHaveLength(0);
    expect(validate({ query: 'x'.repeat(101) }).errors.length).toBeGreaterThan(0);
  });

  it('refuse une requête absente', () => {
    expect(validate({}).errors.length).toBeGreaterThan(0);
  });
});
