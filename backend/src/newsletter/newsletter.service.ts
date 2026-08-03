import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { MailService } from '../mailer/mail.service';
import { isUniqueViolation } from '../common/unique-retry';
import {
  NachweisEintrag,
  NewsletterStatus,
  NewsletterSubscriber,
} from './entities/newsletter-subscriber.entity';

/** Ergebnis eines Newsletter-Versands (Statistik fuer die Admin-UI). */
export interface VersandStatistik {
  empfaenger: number;
  gesendet: number;
  fehlgeschlagen: number;
}

/** Aggregierte Uebersicht fuer das Betreiber-Dashboard. */
export interface NewsletterUebersicht {
  counts: { pending: number; confirmed: number; unsubscribed: number };
  letzte: { email: string; status: NewsletterStatus; angemeldetAm: Date; bestaetigtAm: Date | null }[];
}

/**
 * Cooldown gegen Mail-Bombing pro Adresse: eine erneute Opt-in-Mail geht
 * fruehestens nach dieser Zeit raus. IP-Throttle allein reicht nicht (Botnet).
 */
const OPT_IN_COOLDOWN_MS = 10 * 60 * 1000; // 10 Minuten

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(NewsletterSubscriber)
    private readonly repo: Repository<NewsletterSubscriber>,
  ) {}

  // ---------------------------------------------------------------------------
  // Token-Helfer
  // ---------------------------------------------------------------------------

  /** SHA-256-Hex eines rohen Tokens (Lookup-/Bestaetigungs-Hash). */
  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** Neues Roh-Token mit 256 Bit Entropie (URL-sicher). */
  private newRawToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /** Basis-URL des Frontends fuer Mail-Links (Fallback fuer lokale Entwicklung). */
  private frontendBaseUrl(): string {
    const url =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  private bestaetigenLink(raw: string): string {
    return `${this.frontendBaseUrl()}/newsletter/bestaetigen?token=${raw}`;
  }

  private abmeldenLink(raw: string): string {
    return `${this.frontendBaseUrl()}/newsletter/abmelden?token=${raw}`;
  }

  /** Haengt ein Ereignis an den append-only Nachweis-Log an (nie kuerzen). */
  private appendNachweis(
    bestehend: NachweisEintrag[] | null | undefined,
    ereignis: NachweisEintrag['ereignis'],
    zeit: Date,
  ): NachweisEintrag[] {
    return [...(bestehend ?? []), { ereignis, zeit: zeit.toISOString() }];
  }

  // ---------------------------------------------------------------------------
  // Oeffentlich: Anmeldung (Double-Opt-in Schritt 1)
  // ---------------------------------------------------------------------------

  /**
   * Meldet eine Adresse an. Neue/abgemeldete Adressen bekommen einen frischen
   * Bestaetigungs- UND (stabilen) Abmelde-Token; ein bestehender `pending`
   * bekommt einen neuen Bestaetigungs-Token, BEHAELT aber seinen stabilen
   * Abmelde-Token. Immer wird die transaktionale Double-Opt-in-Mail (KEINE
   * Werbung) verschickt – ausser der Cooldown greift.
   *
   * Mail-Bombing-Schutz: liegt die letzte Opt-in-Mail an diese Adresse weniger
   * als {@link OPT_IN_COOLDOWN_MS} zurueck, passiert NICHTS (keine Mail, keine
   * Aenderung). Die Antwort bleibt in JEDEM Fall identisch (kein Enumeration-
   * bzw. Cooldown-Leak) – der Controller antwortet immer gleich.
   */
  async anmelden(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    // Vollstaendig laden (inkl. select:false-Tokenspalten), damit ein save() den
    // stabilen Abmelde-Token nicht versehentlich auf null setzt.
    const existing = await this.repo
      .createQueryBuilder('s')
      .addSelect(['s.tokenHash', 's.abmeldeToken', 's.abmeldeTokenHash'])
      .where('s.email = :email', { email: normalized })
      .getOne();

    // Bereits bestaetigt -> nichts tun (kein Opt-in-Sturm auf Bestandsabonnenten).
    if (existing && existing.status === NewsletterStatus.CONFIRMED) return;

    const now = new Date();

    // Cooldown: letzte Opt-in-Mail zu kurz her -> komplett stumm (Mail-Bomb-Schutz).
    if (
      existing?.letzteOptInMailAm &&
      now.getTime() - new Date(existing.letzteOptInMailAm).getTime() < OPT_IN_COOLDOWN_MS
    ) {
      return;
    }

    const rawConfirm = this.newRawToken();

    if (!existing) {
      const rawAbmelde = this.newRawToken();
      try {
        await this.repo.save(
          this.repo.create({
            email: normalized,
            status: NewsletterStatus.PENDING,
            tokenHash: this.hashToken(rawConfirm),
            abmeldeToken: rawAbmelde,
            abmeldeTokenHash: this.hashToken(rawAbmelde),
            angemeldetAm: now,
            bestaetigtAm: null,
            abgemeldetAm: null,
            letzteOptInMailAm: now,
            nachweisLog: this.appendNachweis(null, 'angemeldet', now),
          }),
        );
      } catch (err) {
        // Race: eine parallele Erstanmeldung DERSELBEN Adresse hat die (unique)
        // Zeile zwischen unserem Lesen und Schreiben bereits angelegt. Der Gewinner
        // verschickt die Opt-in-Mail; wir antworten still identisch (kein 500, kein
        // Enumeration-/Adress-Leak nach aussen). Andere Fehler werden durchgereicht.
        if (isUniqueViolation(err)) return;
        throw err;
      }
    } else {
      const warAbgemeldet = existing.status === NewsletterStatus.UNSUBSCRIBED;
      existing.status = NewsletterStatus.PENDING;
      existing.tokenHash = this.hashToken(rawConfirm);
      // Abgemeldet -> frischer stabiler Abmelde-Token (neue Einwilligung, alter
      // Abmelde-Link erlischt). Pending -> bestehenden Token BEHALTEN, damit
      // bereits verschickte Abmelde-Links gueltig bleiben.
      if (warAbgemeldet || !existing.abmeldeToken || !existing.abmeldeTokenHash) {
        const rawAbmelde = this.newRawToken();
        existing.abmeldeToken = rawAbmelde;
        existing.abmeldeTokenHash = this.hashToken(rawAbmelde);
      }
      existing.angemeldetAm = now;
      existing.bestaetigtAm = null;
      existing.abgemeldetAm = null;
      existing.letzteOptInMailAm = now;
      existing.nachweisLog = this.appendNachweis(existing.nachweisLog, 'angemeldet', now);
      await this.repo.save(existing);
    }

    // Fire-and-forget: die Antwort wartet NICHT auf den SMTP-Round-Trip
    // (sonst Timing-Enumeration). Ohne SMTP_HOST loggt der MailService nur (Stub).
    void this.mail
      .send({
        to: normalized,
        subject: 'Bitte bestätige deine Newsletter-Anmeldung',
        text:
          `Hallo,\n\n` +
          `du (oder jemand) hat diese Adresse für den Detailly-Newsletter angemeldet.\n` +
          `Bestätige die Anmeldung über diesen Link:\n\n` +
          `${this.bestaetigenLink(rawConfirm)}\n\n` +
          `Wenn du das nicht warst, ignoriere diese E-Mail einfach – ohne Bestätigung ` +
          `wird die Adresse nicht in den Verteiler aufgenommen.\n\n` +
          `— Detailly`,
      })
      .catch((err) =>
        this.logger.warn(`Double-Opt-in-Mail fehlgeschlagen: ${err?.message ?? err}`),
      );

    this.logger.log('Newsletter-Anmeldung verarbeitet (Double-Opt-in-Mail ausgeloest).');
  }

  // ---------------------------------------------------------------------------
  // Oeffentlich: Bestaetigung (Double-Opt-in Schritt 2)
  // ---------------------------------------------------------------------------

  /**
   * Bestaetigt eine Anmeldung per Bestaetigungs-Token. `pending` -> `confirmed`
   * (+ Zeitstempel + Nachweis) und entwertet den Bestaetigungs-Token (tokenHash
   * = null) -> der Link ist danach nicht wiederverwendbar. Unbekanntes/entwertetes
   * Token -> 400.
   */
  async bestaetigen(rawToken: string): Promise<{ email: string }> {
    const ungueltig = new BadRequestException('Der Bestätigungs-Link ist ungültig oder abgelaufen.');

    const token = (rawToken || '').trim();
    if (!token) throw ungueltig;

    const rec = await this.repo
      .createQueryBuilder('s')
      .where('s.tokenHash = :h', { h: this.hashToken(token) })
      .getOne();
    if (!rec || rec.status === NewsletterStatus.UNSUBSCRIBED) throw ungueltig;

    if (rec.status === NewsletterStatus.PENDING) {
      const now = new Date();
      await this.repo.update(rec.id, {
        status: NewsletterStatus.CONFIRMED,
        bestaetigtAm: now,
        tokenHash: null, // Bestaetigungs-Token entwerten (Single-Use)
        nachweisLog: this.appendNachweis(rec.nachweisLog, 'bestaetigt', now),
      });
      this.logger.log('Newsletter-Anmeldung bestätigt (confirmed).');
    }
    return { email: rec.email };
  }

  // ---------------------------------------------------------------------------
  // Oeffentlich: Abmeldung (1-Klick, sofort wirksam)
  // ---------------------------------------------------------------------------

  /**
   * Meldet per Token sofort ab (`unsubscribed` + Zeitstempel + Nachweis).
   * Akzeptiert den stabilen Abmelde-Token (confirmed) UND – aus Kulanz – den
   * Bestaetigungs-Token (pending). Idempotent: bereits abgemeldet -> erneut
   * Erfolg. Unbekanntes Token -> 400.
   */
  async abmelden(rawToken: string): Promise<void> {
    const token = (rawToken || '').trim();
    if (!token) throw new BadRequestException('Der Abmelde-Link ist ungültig.');
    const h = this.hashToken(token);

    const rec = await this.repo
      .createQueryBuilder('s')
      .where('s.abmeldeTokenHash = :h OR s.tokenHash = :h', { h })
      .getOne();
    if (!rec) throw new BadRequestException('Der Abmelde-Link ist ungültig.');

    if (rec.status !== NewsletterStatus.UNSUBSCRIBED) {
      const now = new Date();
      await this.repo.update(rec.id, {
        status: NewsletterStatus.UNSUBSCRIBED,
        abgemeldetAm: now,
        nachweisLog: this.appendNachweis(rec.nachweisLog, 'abgemeldet', now),
      });
      this.logger.log('Newsletter-Abmeldung verarbeitet (unsubscribed).');
    }
  }

  // ---------------------------------------------------------------------------
  // Betreiber: Uebersicht
  // ---------------------------------------------------------------------------

  async uebersicht(): Promise<NewsletterUebersicht> {
    const [pending, confirmed, unsubscribed] = await Promise.all([
      this.repo.count({ where: { status: NewsletterStatus.PENDING } }),
      this.repo.count({ where: { status: NewsletterStatus.CONFIRMED } }),
      this.repo.count({ where: { status: NewsletterStatus.UNSUBSCRIBED } }),
    ]);

    // Nur die letzten 25 Anmeldungen (paginiert/limitiert). Admin darf E-Mails sehen.
    const rows = await this.repo.find({
      order: { angemeldetAm: 'DESC' },
      take: 25,
    });
    const letzte = rows.map((r) => ({
      email: r.email,
      status: r.status,
      angemeldetAm: r.angemeldetAm,
      bestaetigtAm: r.bestaetigtAm,
    }));

    return { counts: { pending, confirmed, unsubscribed }, letzte };
  }

  // ---------------------------------------------------------------------------
  // Betreiber: Versand (nur an confirmed, sequenziell, mit STABILEM Abmelde-Link)
  // ---------------------------------------------------------------------------

  /**
   * Verschickt den Newsletter an ALLE bestaetigten Abonnenten. Jeder Empfaenger
   * bekommt SEINEN stabilen Abmelde-Link (kein Rotieren, kein Schreiben im Loop)
   * -> jeder jemals versendete Newsletter behaelt einen funktionierenden
   * 1-Klick-Abmelde-Link. Der Versand laeuft sequenziell (kein Parallel-Sturm);
   * Fehler je Empfaenger werden geloggt und stoppen den Lauf NICHT.
   */
  async senden(betreff: string, inhalt: string): Promise<VersandStatistik> {
    // select:false-Abmelde-Token explizit mitladen; der Transformer entschluesselt
    // ihn beim Hydrieren -> hier liegt der Rohwert fuer den Link vor.
    const empfaenger = await this.repo
      .createQueryBuilder('s')
      .addSelect('s.abmeldeToken')
      .where('s.status = :st', { st: NewsletterStatus.CONFIRMED })
      .orderBy('s.angemeldetAm', 'ASC')
      .getMany();

    const stat: VersandStatistik = { empfaenger: empfaenger.length, gesendet: 0, fehlgeschlagen: 0 };

    for (const sub of empfaenger) {
      // Fehlt (sehr alter Datensatz) der Abmelde-Token, on-the-fly nachziehen –
      // ein Newsletter DARF nie ohne gueltigen Abmelde-Link rausgehen.
      let raw = sub.abmeldeToken;
      if (!raw) {
        raw = this.newRawToken();
        try {
          await this.repo.update(sub.id, {
            abmeldeToken: raw,
            abmeldeTokenHash: this.hashToken(raw),
          });
        } catch (e) {
          stat.fehlgeschlagen++;
          this.logger.warn(
            `Abmelde-Token nachziehen fehlgeschlagen für ${MailService.maskRecipient(sub.email)}: ${(e as Error).message}`,
          );
          continue;
        }
      }

      try {
        await this.mail.send({
          to: sub.email,
          subject: betreff,
          text: this.buildText(inhalt, raw),
          html: this.buildHtml(betreff, inhalt, raw),
        });
        stat.gesendet++;
      } catch (e) {
        stat.fehlgeschlagen++;
        this.logger.warn(
          `Newsletter-Versand fehlgeschlagen für ${MailService.maskRecipient(sub.email)}: ${(e as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Newsletter versendet: ${stat.gesendet}/${stat.empfaenger} ok, ${stat.fehlgeschlagen} Fehler.`,
    );
    return stat;
  }

  // ---------------------------------------------------------------------------
  // Mail-Rendering (mit Pflicht-Footer: Abmelde-Link + Impressum/Datenschutz)
  // ---------------------------------------------------------------------------

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Reiner Text-Body inkl. rechtlichem Footer (Abmeldung + Impressum/Datenschutz). */
  buildText(inhalt: string, rawAbmelde: string): string {
    const base = this.frontendBaseUrl();
    return (
      `${inhalt.trim()}\n\n` +
      `— — —\n` +
      `Du erhältst diese E-Mail, weil du den Detailly-Newsletter bestätigt hast.\n` +
      `Abmelden (sofort wirksam): ${this.abmeldenLink(rawAbmelde)}\n` +
      `Impressum: ${base}/impressum\n` +
      `Datenschutz: ${base}/datenschutz`
    );
  }

  /** HTML-Body inkl. rechtlichem Footer. Freitext wird escaped + absatzweise gesetzt. */
  buildHtml(betreff: string, inhalt: string, rawAbmelde: string): string {
    const base = this.frontendBaseUrl();
    const abmelde = this.abmeldenLink(rawAbmelde);
    const absaetze = inhalt
      .trim()
      .split(/\n{2,}/)
      .map(
        (p) =>
          `<p style="margin:0 0 16px;line-height:1.6;color:#1f2430;font-size:15px;">` +
          `${this.escapeHtml(p).replace(/\n/g, '<br/>')}</p>`,
      )
      .join('');

    return (
      `<!DOCTYPE html><html lang="de"><body style="margin:0;background:#f4f5f7;padding:24px;">` +
      `<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;` +
      `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
      `<div style="background:#12151c;padding:20px 28px;">` +
      `<span style="color:#ffffff;font-size:18px;font-weight:700;">Detail<span style="color:#c8794b;">ly</span></span>` +
      `</div>` +
      `<div style="padding:28px;">` +
      `<h1 style="margin:0 0 20px;font-size:20px;color:#12151c;">${this.escapeHtml(betreff)}</h1>` +
      `${absaetze}` +
      `</div>` +
      `<div style="padding:20px 28px;border-top:1px solid #e6e8ec;color:#6b7280;font-size:12px;line-height:1.7;">` +
      `Du erhältst diese E-Mail, weil du den Detailly-Newsletter bestätigt hast.<br/>` +
      `<a href="${abmelde}" style="color:#c8794b;">Newsletter abmelden</a> (sofort wirksam) &nbsp;·&nbsp; ` +
      `<a href="${base}/impressum" style="color:#6b7280;">Impressum</a> &nbsp;·&nbsp; ` +
      `<a href="${base}/datenschutz" style="color:#6b7280;">Datenschutz</a>` +
      `</div>` +
      `</div></body></html>`
    );
  }
}
