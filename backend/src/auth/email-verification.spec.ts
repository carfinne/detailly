import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';

/**
 * E-Mail-Bestaetigung (Double-Opt-in), repo-gemockt:
 * - buildEmailVerification speichert NUR den SHA-256-Hash (nie Klartext),
 * - verifyEmail: gueltig -> emailVerifiedAt gesetzt + Token entwertet,
 * - unbekannt/abgelaufen -> 400,
 * - resendVerification: unbestaetigt -> neuer Token + Mail; bestaetigt -> no-op.
 */
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function makeService() {
  const users = new Map<string, any>();
  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      for (const u of users.values()) {
        if (where.id !== undefined && u.id !== where.id) continue;
        if (
          where.emailVerificationTokenHash !== undefined &&
          u.emailVerificationTokenHash !== where.emailVerificationTokenHash
        )
          continue;
        return u;
      }
      return null;
    }),
    update: jest.fn(async (id: string, patch: any) => {
      const u = users.get(id);
      if (u) Object.assign(u, patch);
      return { affected: u ? 1 : 0 };
    }),
  };
  const mail = { send: jest.fn(async () => undefined) };
  const config = { get: jest.fn(() => 'http://localhost:3000') };
  const svc = new AuthService(userRepo as any, {} as any, {} as any, config as any, mail as any);
  return { svc, users, userRepo, mail };
}

describe('AuthService · E-Mail-Verifikation', () => {
  it('buildEmailVerification: nur Hash, Ablauf in der Zukunft', () => {
    const { svc } = makeService();
    const ev = svc.buildEmailVerification();
    expect(ev.tokenHash).toBe(sha256(ev.rawToken));
    expect(ev.tokenHash).not.toBe(ev.rawToken);
    expect(ev.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('verifyEmail: gueltiges Token -> bestaetigt + Token entwertet', async () => {
    const { svc, users } = makeService();
    users.set('u1', {
      id: 'u1',
      email: 'a@b.de',
      firstName: 'A',
      emailVerifiedAt: null,
      emailVerificationTokenHash: sha256('verify-token-1234567890'),
      emailVerificationExpiresAt: new Date(Date.now() + 60000),
    });
    await svc.verifyEmail('verify-token-1234567890');
    const u = users.get('u1');
    expect(u.emailVerifiedAt).toBeInstanceOf(Date);
    expect(u.emailVerificationTokenHash).toBeNull();
  });

  it('verifyEmail: unbekanntes Token -> 400', async () => {
    const { svc } = makeService();
    await expect(svc.verifyEmail('does-not-exist-xxxxxxxxxx')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('verifyEmail: abgelaufenes Token -> 400, nicht bestaetigt', async () => {
    const { svc, users } = makeService();
    users.set('u1', {
      id: 'u1',
      email: 'a@b.de',
      firstName: 'A',
      emailVerifiedAt: null,
      emailVerificationTokenHash: sha256('abgelaufen-token-123456'),
      emailVerificationExpiresAt: new Date(Date.now() - 1000),
    });
    await expect(svc.verifyEmail('abgelaufen-token-123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.get('u1').emailVerifiedAt).toBeNull();
  });

  it('resendVerification: unbestaetigt -> neuer Token + Mail', async () => {
    const { svc, users, mail } = makeService();
    users.set('u1', { id: 'u1', email: 'a@b.de', firstName: 'A', emailVerifiedAt: null, emailVerificationTokenHash: null });
    await svc.resendVerification('u1');
    expect(users.get('u1').emailVerificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('resendVerification: bereits bestaetigt -> no-op (keine Mail)', async () => {
    const { svc, users, mail } = makeService();
    users.set('u1', { id: 'u1', email: 'a@b.de', firstName: 'A', emailVerifiedAt: new Date() });
    await svc.resendVerification('u1');
    expect(mail.send).not.toHaveBeenCalled();
  });
});
