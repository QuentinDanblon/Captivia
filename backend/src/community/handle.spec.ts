import { checkHandle, handleKey } from './handle';

describe('checkHandle', () => {
  it.each(['gecko_lover', 'Ana.Reptiles', 'max', 'a'.repeat(30), 'Bob42'])(
    'accepte %s',
    (h) => {
      const res = checkHandle(h);
      expect(res).toEqual({ ok: true, handle: h, key: h.toLowerCase() });
    },
  );

  it('normalise (NFKC, espaces, « @ » initial) et garde la casse affichée', () => {
    expect(checkHandle('  @Gecko_Lover ')).toEqual({
      ok: true,
      handle: 'Gecko_Lover',
      key: 'gecko_lover',
    });
    // Lettres pleine chasse → ASCII.
    expect(checkHandle('ｇｅｃｋｏ')).toMatchObject({ ok: true, key: 'gecko' });
  });

  it.each([
    'ab',
    'a'.repeat(31),
    'with space',
    'émile',
    'tiret-moins',
    '.dot',
    'dot.',
    '_lead',
    'double..dot',
    'a__b',
    '1234',
    '<script>',
    '',
  ])('refuse le format %p', (h) => {
    expect(checkHandle(h)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuse les valeurs non textuelles', () => {
    expect(checkHandle(42)).toEqual({ ok: false, reason: 'invalid' });
    expect(checkHandle(undefined)).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each([
    'admin',
    'Admin_01',
    'captivia',
    'Captivia_Officiel',
    'le.moderateur',
    'moderation',
    'operateur',
    'support',
    'Support_2',
    'root',
    'null',
    'staff',
    'superadmin',
  ])('refuse le mot réservé %s', (h) => {
    expect(checkHandle(h)).toEqual({ ok: false, reason: 'reserved' });
  });

  it('dérive la clé d’unicité en minuscules', () => {
    expect(handleKey('@GeckoLover')).toBe('geckolover');
    expect(handleKey('GECKOLOVER')).toBe(handleKey('geckolover'));
  });
});
