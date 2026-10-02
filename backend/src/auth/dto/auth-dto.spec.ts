import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { ForgotPasswordDto } from './forgot-password.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { ChangePasswordDto } from './change-password.dto';

const validRegister = {
  email: 'jane@example.com',
  password: 'password123',
  acceptTerms: true,
  ageConfirmed: true,
};

async function errorsOf<T extends object>(cls: new () => T, plain: object) {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instance, props: errors.map((e) => e.property) };
}

describe('Auth DTOs', () => {
  it.each([
    [RegisterDto, { ...validRegister, email: '  OP@EXAMPLE.COM ' }],
    [LoginDto, { email: '  OP@EXAMPLE.COM ', password: 'x' }],
    [ForgotPasswordDto, { email: '  OP@EXAMPLE.COM ' }],
  ])('%p normalizes email (trim + lowercase)', async (cls, plain) => {
    const { instance, props } = await errorsOf(cls as new () => object, plain);
    expect(props).toEqual([]);
    expect((instance as { email: string }).email).toBe('op@example.com');
  });

  it('accepts a complete registration', async () => {
    expect((await errorsOf(RegisterDto, validRegister)).props).toEqual([]);
  });

  it.each([
    ['acceptTerms missing', { acceptTerms: undefined }, 'acceptTerms'],
    ['acceptTerms false', { acceptTerms: false }, 'acceptTerms'],
    ['acceptTerms "true" (string)', { acceptTerms: 'true' }, 'acceptTerms'],
    ['ageConfirmed missing', { ageConfirmed: undefined }, 'ageConfirmed'],
    ['ageConfirmed false', { ageConfirmed: false }, 'ageConfirmed'],
    ['password 9 chars', { password: '123456789' }, 'password'],
    ['password 129 chars', { password: 'a'.repeat(129) }, 'password'],
    ['non-string email', { email: 42 }, 'email'],
  ])('rejects register when %s', async (_label, patch, prop) => {
    const { props } = await errorsOf(RegisterDto, {
      ...validRegister,
      ...patch,
    });
    expect(props).toContain(prop);
  });

  it('accepts password lengths 10 and 128', async () => {
    expect(
      (
        await errorsOf(RegisterDto, {
          ...validRegister,
          password: 'a'.repeat(10),
        })
      ).props,
    ).toEqual([]);
    expect(
      (
        await errorsOf(RegisterDto, {
          ...validRegister,
          password: 'a'.repeat(128),
        })
      ).props,
    ).toEqual([]);
  });

  it('reset / change password enforce 10–128 chars', async () => {
    expect(
      (await errorsOf(ResetPasswordDto, { token: 't', newPassword: 'short' }))
        .props,
    ).toContain('newPassword');
    expect(
      (
        await errorsOf(ResetPasswordDto, {
          token: 't',
          newPassword: 'a'.repeat(129),
        })
      ).props,
    ).toContain('newPassword');
    expect(
      (
        await errorsOf(ChangePasswordDto, {
          currentPassword: 'x',
          newPassword: '123456789',
        })
      ).props,
    ).toContain('newPassword');
    expect(
      (
        await errorsOf(ChangePasswordDto, {
          currentPassword: 'x',
          newPassword: 'a'.repeat(10),
        })
      ).props,
    ).toEqual([]);
  });

  it('login keeps accepting legacy short passwords (no min length)', async () => {
    expect(
      (await errorsOf(LoginDto, { email: 'a@b.co', password: 'short' })).props,
    ).toEqual([]);
  });
});
