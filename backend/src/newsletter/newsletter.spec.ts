import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';
import { NewsletterService } from './newsletter.service';
import { NewsletterStatus } from './entities/newsletter-subscriber.entity';
import { NewsletterController } from './newsletter.controller';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Newsletter-Kern, repo-gemockt (kein Nest-Boot, keine DB). Deckt den
 * rechtssicheren Double-Opt-in-Flow ab: enumeration-sicher, Token-Rotation,
 * Bestaetigung, Abmeldung (pending + confirmed) und das Rollen-Gate.
 */
function makeService() {
  const rows: any[] = [];
  let seq = 0;

  // Minimaler QueryBuilder nur fuer findByToken (WHERE tokenHash = :h).
  const makeQb = () => {
    let hash: string | undefined;
    const qb: any = {
      addSelect: () => qb,
      where: (_s: string, params: { h: string }) => {
        hash = params.h;
        return qb;
      },
      getOne: async () => rows.find((r) => r.tokenHash === hash) ?? null,
    };
    return qb;
  };

  const repo = {
    findOne: jest.fn(async ({ where }: any) => {
      return rows.find((r) => (where.email === undefined || r.email === where.email)) ?? null;
    }),
    find: jest.fn(async ({ where }: any = {}) => {
      let list = rows.slice();
      if (where?.status !== undefined) list = list.filter((r) => r.status === where.status);
      return list;
    }),
    count: jest.fn(async ({ where }: any) => rows.filter((r) => r.status === where.status).length),
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (rec: any) => {
      if (!rec.id) {
        rec.id = `sub-${++seq}`;
        rows.push(rec);
      }
      return rec;
    }),
    createQueryBuilder: jest.fn(() => makeQb()),
  };

  const mailSent: { to: string; subject: string; text?: string; html?: string }[] = [];
  const mail = {
    send: jest.fn(async (opts: any) => {
      mailSent.push(opts);
    }),
  };

  const config = {
    get: jest.fn((k: string) => (k === 'FRONTEND_URL' ? 'https://app.detailly.test' : undefined)),
  };

  const service = new NewsletterService(config as any, mail as any, repo as any);
  return { service, rows, mailSent, mail, repo };
}

/** Extrahiert den token=-Wert aus dem letzten Mail-Text. */
const tokenAusMail = (text: string) => /token=([^\s&]+)/.exec(text)?.[1] ?? '';

describe('NewsletterService · Double-Opt-in', () => {
  it('Anmeldung legt pending an und verschickt eine Bestätigungs-Mail (keine Werbung)', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('Test@Example.DE');

    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('test@example.de'); // lowercase-normalisiert
    expect(rows[0].status).toBe(NewsletterStatus.PENDING);
    expect(rows[0].angemeldetAm).toBeInstanceOf(Date);
    expect(rows[0].bestaetigtAm).toBeNull();
    expect(mailSent).toHaveLength(1);
    expect(mailSent[0].text).toContain('/newsletter/bestaetigen?token=');
    // Bestaetigungs-Mail ist transaktional -> KEIN Abmelde-/Werbe-Footer.
    expect(mailSent[0].text).not.toContain('/newsletter/abmelden');
  });

  it('speichert NIE das Roh-Token, nur dessen SHA-256-Hash', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('hash@example.de');
    const raw = tokenAusMail(mailSent[0].text!);
    expect(raw).not.toBe('');
    expect(rows[0].tokenHash).toBe(sha256(raw));
    expect(rows[0].tokenHash).not.toBe(raw);
  });

  it('Bestätigung setzt confirmed + bestaetigtAm', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('confirm@example.de');
    const raw = tokenAusMail(mailSent[0].text!);

    await service.bestaetigen(raw);
    expect(rows[0].status).toBe(NewsletterStatus.CONFIRMED);
    expect(rows[0].bestaetigtAm).toBeInstanceOf(Date);
  });

  it('Bestätigung mit unbekanntem Token -> 400', async () => {
    const { service } = makeService();
    await expect(service.bestaetigen('nicht-existent')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Anmelde-Antwort ist identisch für neue vs. bestehende Adresse (keine Enumeration)', async () => {
    const { service } = makeService();
    // Der Controller gibt immer { ok: true } zurueck; der Service wirft nie
    // (weder neu, noch pending, noch bereits bestaetigt).
    await expect(service.anmelden('neu@example.de')).resolves.toBeUndefined();
    await expect(service.anmelden('neu@example.de')).resolves.toBeUndefined(); // jetzt pending
  });

  it('bereits bestätigte Adresse erhält bei erneuter Anmeldung KEIN neues Opt-in', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('doppelt@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[0].text!));
    const mailsVorher = mailSent.length;
    const hashVorher = rows[0].tokenHash;

    await service.anmelden('doppelt@example.de'); // schon confirmed -> No-op
    expect(mailSent).toHaveLength(mailsVorher);
    expect(rows[0].status).toBe(NewsletterStatus.CONFIRMED);
    expect(rows[0].tokenHash).toBe(hashVorher);
  });

  it('erneute Anmeldung eines pending erneuert das Token (alter Link wird ungültig)', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('renew@example.de');
    const raw1 = tokenAusMail(mailSent[0].text!);

    await service.anmelden('renew@example.de'); // pending -> Token erneuern
    const raw2 = tokenAusMail(mailSent[1].text!);
    expect(raw2).not.toBe(raw1);
    // Alter Bestaetigungs-Link greift nicht mehr, der neue schon.
    await expect(service.bestaetigen(raw1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.bestaetigen(raw2)).resolves.toEqual({ email: 'renew@example.de' });
    expect(rows).toHaveLength(1); // weiterhin genau EIN Datensatz
  });

  it('Abmeldung per Token wirkt für confirmed sofort', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('bye@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[0].text!));

    // Versand rotiert das Token -> frischer Abmelde-Link im Newsletter.
    await service.senden('Betreff', 'Inhalt-Absatz mit genug Text.');
    const abmeldeRaw = tokenAusMail(mailSent[mailSent.length - 1].text!);

    await service.abmelden(abmeldeRaw);
    expect(rows[0].status).toBe(NewsletterStatus.UNSUBSCRIBED);
    expect(rows[0].abgemeldetAm).toBeInstanceOf(Date);
  });

  it('Abmeldung funktioniert auch für pending (mit dem Bestätigungs-Token)', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('pending-bye@example.de');
    const raw = tokenAusMail(mailSent[0].text!);

    await service.abmelden(raw);
    expect(rows[0].status).toBe(NewsletterStatus.UNSUBSCRIBED);
  });

  it('Abmeldung mit unbekanntem Token -> 400', async () => {
    const { service } = makeService();
    await expect(service.abmelden('unbekannt')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('NewsletterService · Versand', () => {
  it('sendet nur an confirmed, mit Abmelde-Link + Impressum/Datenschutz im Footer', async () => {
    const { service, mailSent } = makeService();
    // 2 confirmed, 1 pending, 1 unsubscribed
    await service.anmelden('a@example.de');
    const rawA = tokenAusMail(mailSent[0].text!);
    await service.bestaetigen(rawA);
    await service.anmelden('b@example.de');
    const rawB = tokenAusMail(mailSent[1].text!);
    await service.bestaetigen(rawB);
    await service.anmelden('c-pending@example.de'); // bleibt pending

    mailSent.length = 0;
    const stat = await service.senden('Neuigkeiten', 'Erster Absatz.\n\nZweiter Absatz.');

    expect(stat.empfaenger).toBe(2);
    expect(stat.gesendet).toBe(2);
    expect(stat.fehlgeschlagen).toBe(0);
    expect(mailSent).toHaveLength(2);
    for (const m of mailSent) {
      expect(m.subject).toBe('Neuigkeiten');
      expect(m.text).toContain('/newsletter/abmelden?token=');
      expect(m.text).toContain('/impressum');
      expect(m.text).toContain('/datenschutz');
      expect(m.html).toContain('/newsletter/abmelden?token=');
    }
  });

  it('Token wird pro Versand rotiert (alter Abmelde-Link wird ungültig)', async () => {
    const { service, mailSent } = makeService();
    await service.anmelden('rot@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[0].text!));

    await service.senden('N1', 'Inhalt eins reicht.');
    const raw1 = tokenAusMail(mailSent[mailSent.length - 1].text!);
    await service.senden('N2', 'Inhalt zwei reicht.');
    const raw2 = tokenAusMail(mailSent[mailSent.length - 1].text!);

    expect(raw2).not.toBe(raw1);
    // Der aktuellste Abmelde-Link ist gueltig; der vorherige nicht mehr.
    await service.abmelden(raw2);
    await expect(service.abmelden(raw1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ein fehlgeschlagener Empfänger bricht den Lauf nicht ab', async () => {
    const { service, mailSent, mail } = makeService();
    await service.anmelden('x@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[0].text!));
    await service.anmelden('y@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[1].text!));

    mail.send.mockImplementationOnce(async () => {
      throw new Error('SMTP down');
    });
    const stat = await service.senden('B', 'Inhalt lang genug.');
    expect(stat.empfaenger).toBe(2);
    expect(stat.gesendet).toBe(1);
    expect(stat.fehlgeschlagen).toBe(1);
  });
});

describe('NewsletterController · RolesGuard (nur Platform-Admin)', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = NewsletterController.prototype as any;
  const ctxFor = (handler: any, role: string): any => ({
    getHandler: () => handler,
    getClass: () => NewsletterController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  });

  it.each([UserRole.OWNER, UserRole.MANAGER, UserRole.PLATFORM_SUPPORT, UserRole.PLATFORM_ANALYST])(
    'Rolle %s darf NICHT senden',
    (role) => {
      expect(guard.canActivate(ctxFor(proto.senden, role))).toBe(false);
    },
  );

  it('Platform-Admin darf senden und die Übersicht lesen', () => {
    expect(guard.canActivate(ctxFor(proto.senden, UserRole.PLATFORM_ADMIN))).toBe(true);
    expect(guard.canActivate(ctxFor(proto.uebersicht, UserRole.PLATFORM_ADMIN))).toBe(true);
  });
});
