import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  PASSWORT_MIN_LAENGE,
  PASSWORT_BLOCKLIST,
} from './password-policy';
import { RegisterTenantDto } from '../../tenants/dto/register-tenant.dto';
import { ConfirmPasswordResetDto } from '../../auth/dto/password-reset.dto';
import { CreateEmployeeDto, SetPasswordDto } from '../../employees/dto/employee.dto';
import { UserRole } from '../../users/entities/user.entity';

/**
 * A3 (Sicherheitsaudit Welle 1): Passwort-Policy an allen Stellen, an denen ein
 * NEUES Passwort gesetzt wird -> Mindestlaenge 10 + Trivial-Passwort-Blocklist
 * (case-insensitive). Getestet ueber die echte class-validator-Pipeline
 * (plainToInstance + validate), so wie es der globale ValidationPipe tut.
 */
describe('Passwort-Policy (A3)', () => {
  /** Liefert true, wenn eine Validierungsverletzung genau am Passwort-Feld haengt. */
  async function passwortFehler(instance: object, feld: string): Promise<boolean> {
    const errors = await validate(instance);
    return errors.some((e) => e.property === feld);
  }

  const basisRegister = {
    firmenname: 'Test Betrieb',
    firstName: 'Max',
    lastName: 'Muster',
    email: 'max@example.com',
  };
  const basisEmployee = {
    email: 'mit@example.com',
    firstName: 'Erika',
    lastName: 'Muster',
    role: UserRole.TECHNICIAN,
  };

  const registerMit = (password: string) =>
    plainToInstance(RegisterTenantDto, { ...basisRegister, password });
  const resetMit = (newPassword: string) =>
    plainToInstance(ConfirmPasswordResetDto, { token: 'a'.repeat(24), newPassword });
  const employeeMit = (password: string) =>
    plainToInstance(CreateEmployeeDto, { ...basisEmployee, password });
  const setPwMit = (password: string) => plainToInstance(SetPasswordDto, { password });

  it('Blocklist enthaelt nur Eintraege >= Mindestlaenge, alle lowercase', () => {
    for (const eintrag of PASSWORT_BLOCKLIST) {
      expect(eintrag).toBe(eintrag.toLowerCase());
      expect(eintrag.length).toBeGreaterThanOrEqual(PASSWORT_MIN_LAENGE);
    }
    // Das Dev-Seed-Passwort darf die Policy NICHT verletzen.
    expect(PASSWORT_BLOCKLIST.has('detailly2026!')).toBe(false);
  });

  describe('zu kurzes Passwort (< 10 Zeichen) -> Validierungsfehler', () => {
    const kurz = 'Ab1!cdef'; // 8 Zeichen
    it('RegisterTenantDto.password', async () =>
      expect(await passwortFehler(registerMit(kurz), 'password')).toBe(true));
    it('ConfirmPasswordResetDto.newPassword', async () =>
      expect(await passwortFehler(resetMit(kurz), 'newPassword')).toBe(true));
    it('CreateEmployeeDto.password', async () =>
      expect(await passwortFehler(employeeMit(kurz), 'password')).toBe(true));
    it('SetPasswordDto.password', async () =>
      expect(await passwortFehler(setPwMit(kurz), 'password')).toBe(true));
  });

  describe('Trivial-Passwort aus der Blocklist -> Validierungsfehler (case-insensitive)', () => {
    // 'Password123' -> lowercase 'password123' steht in der Blocklist; laenge 11
    // (scheitert also NICHT an der Mindestlaenge, sondern echt an der Blocklist).
    const trivial = 'Password123';
    it('RegisterTenantDto.password', async () =>
      expect(await passwortFehler(registerMit(trivial), 'password')).toBe(true));
    it('ConfirmPasswordResetDto.newPassword', async () =>
      expect(await passwortFehler(resetMit(trivial), 'newPassword')).toBe(true));
    it('CreateEmployeeDto.password', async () =>
      expect(await passwortFehler(employeeMit(trivial), 'password')).toBe(true));
    it('SetPasswordDto.password', async () =>
      expect(await passwortFehler(setPwMit(trivial), 'password')).toBe(true));
  });

  describe('gutes Passwort (Seed-Passwort Detailly2026!) -> kein Passwort-Fehler', () => {
    const gut = 'Detailly2026!';
    it('RegisterTenantDto.password', async () =>
      expect(await passwortFehler(registerMit(gut), 'password')).toBe(false));
    it('ConfirmPasswordResetDto.newPassword', async () =>
      expect(await passwortFehler(resetMit(gut), 'newPassword')).toBe(false));
    it('CreateEmployeeDto.password', async () =>
      expect(await passwortFehler(employeeMit(gut), 'password')).toBe(false));
    it('SetPasswordDto.password', async () =>
      expect(await passwortFehler(setPwMit(gut), 'password')).toBe(false));
  });
});
