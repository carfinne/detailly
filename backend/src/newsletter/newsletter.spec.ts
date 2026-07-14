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
 * rechtssicheren Double-Opt-in-Flow ab: enumeration-sicher, EINMALIGER
 * Bestaetigungs-Token, STABILER Abmelde-Token (kein Rotieren beim Versand),
 * Mail-Bombing-Cooldown, append-only Nachweis-Log und das Rollen-Gate.
 *
 * Der abmeldeToken-Transformer verschluesselt nur auf der echten DB; im Mock
 * liegt der Rohwert direkt vor (wie nach dem Entschluesseln beim Hydrieren).
 */
function makeService() {
  const rows: any[] = [];
  let seq = 0;

  const matchClause = (r: any, str: string, params: any): boolean => {
    if (str.includes('email')) return r.email === params.email;
    if (str.includes('status')) return r.status === params.st;
    if (str.includes('abmeldeTokenHash') && str.includes('s.tokenHash'))
      return r.abmeldeTokenHash === params.h || r.tokenHash === params.h;
    if (str.includes('abmeldeTokenHash')) return r.abmeldeTokenHash === params.h;
    if (str.includes('tokenHash')) return r.tokenHash === params.h;
    return true;
  };

  const makeQb = () => {
    const clauses: { str: string; params: any }[] = [];
    let order: { col: string; dir: 'ASC' | 'DESC' } | null = null;
    const filtered = () => {
      let list = rows.filter((r) => clauses.every((c) => matchClause(r, c.str, c.params)));
      if (order) {
        const key = order.col.split('.').pop() as string;
        list = list
          .slice()
          .sort((a, b) => new Date(a[key]).getTime() - new Date(b[key]).getTime());
        if (order.dir === 'DESC') list.reverse();
      }
      return list;
    };
    const qb: any = {
      addSelect: () => qb,
      where: (str: string, params: any) => {
        clauses.push({ str, params: params || {} });
        return qb;
      },
      andWhere: (str: string, params: any) => {
        clauses.push({ str, params: params || {} });
        return qb;
      },
      orderBy: (col: string, dir: 'ASC' | 'DESC' = 'ASC') => {
        order = { col, dir };
        return qb;
      },
      getOne: async () => filtered()[0] ?? null,
      getMany: async () => filtered(),
    };
    return qb;
  };

  const repo = {
    createQueryBuilder: jest.fn(() => makeQb()),
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (rec: any) => {
      if (!rec.id) {
        rec.id = `sub-${++seq}`;
        rows.push(rec);
      }
      return rec;
    }),
    update: jest.fn(async (id: string, patch: any) => {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
      return { affected: r ? 1 : 0 };
    }),
    count: jest.fn(async ({ where }: any) => rows.filter((r) => r.status === where.status).length),
    find: jest.fn(async ({ order, take }: any = {}) => {
      const list = rows.slice();
      if (order?.angemeldetAm) {
        list.sort((a, b) => new Date(a.angemeldetAm).getTime() - new Date(b.angemeldetAm).getTime());
        if (order.angemeldetAm === 'DESC') list.reverse();
      }
      return take ? list.slice(0, take) : list;
    }),
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

/** Extrahiert den token=-Wert aus einem Mail-Text. */
const tokenAusMail = (text: string) => /token=([^\s&]+)/.exec(text)?.[1] ?? '';
/** Rückt letzteOptInMailAm über den Cooldown hinaus (simuliert Zeitablauf). */
const cooldownAblaufen = (row: any) => {
  row.letzteOptInMailAm = new Date(Date.now() - 11 * 60 * 1000);
};

describe('NewsletterService · Double-Opt-in', () => {
  it('Anmeldung legt pending an, verschickt eine transaktionale Bestätigungs-Mail (keine Werbung), loggt Nachweis', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('Test@Example.DE');

    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('test@example.de'); // lowercase-normalisiert
    expect(rows[0].status).toBe(NewsletterStatus.PENDING);
    expect(rows[0].angemeldetAm).toBeInstanceOf(Date);
    expect(rows[0].bestaetigtAm).toBeNull();
    expect(rows[0].letzteOptInMailAm).toBeInstanceOf(Date);
    expect(rows[0].nachweisLog).toEqual([{ ereignis: 'angemeldet', zeit: expect.any(String) }]);
    expect(mailSent).toHaveLength(1);
    expect(mailSent[0].text).toContain('/newsletter/bestaetigen?token=');
    // Bestaetigungs-Mail ist transaktional -> KEIN Abmelde-/Werbe-Footer.
    expect(mailSent[0].text).not.toContain('/newsletter/abmelden');
  });

  it('speichert NIE das Roh-Token, nur SHA-256-Hashes (Bestätigung + Abmeldung)', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('hash@example.de');
    const raw = tokenAusMail(mailSent[0].text!);
    expect(raw).not.toBe('');
    expect(rows[0].tokenHash).toBe(sha256(raw));
    expect(rows[0].tokenHash).not.toBe(raw);
    // Abmelde-Token: Hash konsistent zum (im Mock unverschlüsselten) Rohwert.
    expect(rows[0].abmeldeTokenHash).toBe(sha256(rows[0].abmeldeToken));
  });

  it('Bestätigung setzt confirmed + bestaetigtAm, entwertet den Bestätigungs-Token (Single-Use)', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('confirm@example.de');
    const raw = tokenAusMail(mailSent[0].text!);

    await service.bestaetigen(raw);
    expect(rows[0].status).toBe(NewsletterStatus.CONFIRMED);
    expect(rows[0].bestaetigtAm).toBeInstanceOf(Date);
    expect(rows[0].tokenHash).toBeNull(); // entwertet
    expect(rows[0].nachweisLog.map((e: any) => e.ereignis)).toEqual(['angemeldet', 'bestaetigt']);
    // Zweiter Klick auf denselben (entwerteten) Link -> 400.
    await expect(service.bestaetigen(raw)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Bestätigung mit unbekanntem Token -> 400', async () => {
    const { service } = makeService();
    await expect(service.bestaetigen('nicht-existent-token')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Anmelde-Antwort ist identisch für neue vs. bestehende Adresse (keine Enumeration)', async () => {
    const { service, rows } = makeService();
    await expect(service.anmelden('neu@example.de')).resolves.toBeUndefined();
    cooldownAblaufen(rows[0]);
    await expect(service.anmelden('neu@example.de')).resolves.toBeUndefined();
  });

  it('bereits bestätigte Adresse erhält bei erneuter Anmeldung KEIN neues Opt-in', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('doppelt@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[0].text!));
    const mailsVorher = mailSent.length;

    await service.anmelden('doppelt@example.de'); // schon confirmed -> No-op
    expect(mailSent).toHaveLength(mailsVorher);
    expect(rows[0].status).toBe(NewsletterStatus.CONFIRMED);
  });
});

describe('NewsletterService · Mail-Bombing-Cooldown (FIX 2)', () => {
  it('zweite Anmeldung derselben Adresse innerhalb 10 min löst KEINE zweite Mail aus (Antwort identisch)', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('bomb@example.de');
    const tokenVorher = rows[0].tokenHash;
    expect(mailSent).toHaveLength(1);

    await service.anmelden('bomb@example.de'); // sofort erneut -> Cooldown
    expect(mailSent).toHaveLength(1); // KEINE zweite Mail
    expect(rows[0].tokenHash).toBe(tokenVorher); // Token nicht erneuert
  });

  it('nach Ablauf des Cooldowns wird erneut gesendet, Bestätigungs-Token erneuert, Abmelde-Token bleibt stabil', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('later@example.de');
    const confirmVorher = rows[0].tokenHash;
    const abmeldeVorher = rows[0].abmeldeTokenHash;

    cooldownAblaufen(rows[0]);
    await service.anmelden('later@example.de');
    expect(mailSent).toHaveLength(2);
    expect(rows[0].tokenHash).not.toBe(confirmVorher); // neuer Bestätigungs-Token
    expect(rows[0].abmeldeTokenHash).toBe(abmeldeVorher); // Abmelde-Token STABIL (pending-Renew)
  });
});

describe('NewsletterService · Abmeldung + stabiler Abmelde-Token (FIX 1)', () => {
  it('Abmelde-Link aus Newsletter #1 funktioniert AUCH nach Versand von Newsletter #2', async () => {
    const { service, mailSent } = makeService();
    await service.anmelden('stabil@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[0].text!));

    await service.senden('N1', 'Erster Newsletter, Inhalt reicht.');
    const link1 = tokenAusMail(mailSent[mailSent.length - 1].text!);
    await service.senden('N2', 'Zweiter Newsletter, Inhalt reicht.');
    const link2 = tokenAusMail(mailSent[mailSent.length - 1].text!);

    // Kein Rotieren: identischer, stabiler Abmelde-Token in beiden Versänden.
    expect(link1).toBe(link2);
    // Der Link aus Newsletter #1 meldet auch nach Versand #2 erfolgreich ab.
    await expect(service.abmelden(link1)).resolves.toBeUndefined();
  });

  it('Abmeldung per stabilem Token wirkt für confirmed sofort (+ Nachweis)', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('bye@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[0].text!));
    await service.senden('Betreff', 'Inhalt-Absatz mit genug Text.');
    const abmeldeRaw = tokenAusMail(mailSent[mailSent.length - 1].text!);

    await service.abmelden(abmeldeRaw);
    expect(rows[0].status).toBe(NewsletterStatus.UNSUBSCRIBED);
    expect(rows[0].abgemeldetAm).toBeInstanceOf(Date);
    expect(rows[0].nachweisLog.map((e: any) => e.ereignis)).toEqual([
      'angemeldet',
      'bestaetigt',
      'abgemeldet',
    ]);
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
    await expect(service.abmelden('unbekannt-token-xyz')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('NewsletterService · Nachweis-Log append-only (FIX 3)', () => {
  it('Log wächst über Ab- und Neu-Anmeldung hinweg, chronologisch, nie gekürzt', async () => {
    const { service, rows, mailSent } = makeService();
    await service.anmelden('nachweis@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[0].text!));
    await service.senden('N', 'Inhalt lang genug hier.');
    await service.abmelden(tokenAusMail(mailSent[mailSent.length - 1].text!));

    // Neu-Anmeldung nach Cooldown-Ablauf.
    cooldownAblaufen(rows[0]);
    await service.anmelden('nachweis@example.de');

    expect(rows[0].nachweisLog.map((e: any) => e.ereignis)).toEqual([
      'angemeldet',
      'bestaetigt',
      'abgemeldet',
      'angemeldet',
    ]);
    // Chronologisch nicht-absteigend.
    const zeiten = rows[0].nachweisLog.map((e: any) => new Date(e.zeit).getTime());
    expect([...zeiten].sort((a, b) => a - b)).toEqual(zeiten);
  });
});

describe('NewsletterService · Versand', () => {
  it('sendet nur an confirmed, mit Abmelde-Link + Impressum/Datenschutz im Footer', async () => {
    const { service, mailSent } = makeService();
    await service.anmelden('a@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[0].text!));
    await service.anmelden('b@example.de');
    await service.bestaetigen(tokenAusMail(mailSent[1].text!));
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
