import * as crypto from 'crypto';
import { SecurityEventService } from './security-event.service';

/**
 * Unit-Tests des Security-Event-Logs. Repo-gemockt (kein Nest-Boot / keine DB).
 * Deckt die sicherheits-/DSGVO-kritischen Zusagen ab: fire-and-forget (ein
 * DB-Fehler wirft nie), nur emailHash (nie Klartext), IP-Normalisierung, Purge.
 */
function makeRepo(over: Record<string, unknown> = {}) {
  return {
    create: jest.fn((x: Record<string, unknown>) => ({ ...x })),
    save: jest.fn(async (x: Record<string, unknown>) => x),
    delete: jest.fn(async () => ({ affected: 0 })),
    ...over,
  };
}

describe('SecurityEventService – record() ist fire-and-forget', () => {
  it('wirft NICHT, wenn der DB-Write fehlschlaegt (Login darf nie brechen)', async () => {
    const repo = makeRepo({
      save: jest.fn(async () => {
        throw new Error('db down');
      }),
    });
    const svc = new SecurityEventService(repo as never);
    expect(() => svc.record({ type: 'login_fail', ip: '1.2.3.4', email: 'a@b.de' })).not.toThrow();
    // Der abgelehnte save-Promise wird intern gefangen (kein unhandled rejection).
    await new Promise((r) => setImmediate(r));
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('wirft NICHT, wenn schon der Entity-Aufbau (create) fehlschlaegt', () => {
    const repo = makeRepo({
      create: jest.fn(() => {
        throw new Error('boom');
      }),
    });
    const svc = new SecurityEventService(repo as never);
    expect(() => svc.record({ type: 'mfa_fail' })).not.toThrow();
  });
});

describe('SecurityEventService – E-Mail nur als Hash, IP normalisiert', () => {
  it('speichert emailHash (SHA-256), niemals Klartext', () => {
    let saved: Record<string, unknown> | undefined;
    const repo = makeRepo({
      create: jest.fn((x: Record<string, unknown>) => {
        saved = x;
        return x;
      }),
    });
    const svc = new SecurityEventService(repo as never);
    svc.record({ type: 'login_fail', email: 'Max@Example.DE', ip: '::ffff:203.0.113.9' });
    expect(saved).toBeDefined();
    expect(saved!.emailHash).toMatch(/^[0-9a-f]{64}$/);
    // Kein Klartext irgendwo im gespeicherten Objekt.
    expect(JSON.stringify(saved)).not.toContain('Max@Example');
    // Hash ist der der NORMALISIERTEN (lowercase/trim) E-Mail.
    const expected = crypto.createHash('sha256').update('max@example.de').digest('hex');
    expect(saved!.emailHash).toBe(expected);
    // IPv4-mapped-IPv6-Praefix wird entfernt.
    expect(saved!.ip).toBe('203.0.113.9');
  });

  it('ohne E-Mail bleibt emailHash null', () => {
    let saved: Record<string, unknown> | undefined;
    const repo = makeRepo({
      create: jest.fn((x: Record<string, unknown>) => {
        saved = x;
        return x;
      }),
    });
    const svc = new SecurityEventService(repo as never);
    svc.record({ type: 'login_lockout', ip: '203.0.113.1', details: { scope: 'ip' } });
    expect(saved!.emailHash).toBeNull();
    expect(saved!.details).toEqual({ scope: 'ip' });
  });
});

describe('SecurityEventService – Auto-Purge (Datenminimierung)', () => {
  it('loescht mit Cutoff = now - TTL (Default 60 Tage) und meldet die Anzahl', async () => {
    let whereArg: { createdAt: { value: Date } } | undefined;
    const repo = makeRepo({
      delete: jest.fn(async (w: { createdAt: { value: Date } }) => {
        whereArg = w;
        return { affected: 3 };
      }),
    });
    const svc = new SecurityEventService(repo as never);
    const now = new Date('2026-07-17T00:00:00.000Z');
    const geloescht = await svc.purgeExpired(now);
    expect(geloescht).toBe(3);
    // Cutoff = now - 60 Tage (LessThan-Operator -> .value).
    const cutoff = whereArg!.createdAt.value;
    const erwartet = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    expect(new Date(cutoff).getTime()).toBe(erwartet.getTime());
  });

  it('faengt DB-Fehler ab (der Timer-Lauf bricht nie) -> 0', async () => {
    const repo = makeRepo({
      delete: jest.fn(async () => {
        throw new Error('db down');
      }),
    });
    const svc = new SecurityEventService(repo as never);
    await expect(svc.purgeExpired()).resolves.toBe(0);
  });
});
