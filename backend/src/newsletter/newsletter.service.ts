import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { MailService } from '../mailer/mail.service';
import { NewsletterSubscriber, NewsletterStatus } from './entities/newsletter-subscriber.entity';

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
  // Token-Helfer (nur Hash gespeichert; Rohwert lebt ausschliesslich im Link)
  // ---------------------------------------------------------------------------

  /** SHA-256-Hex eines rohen Tokens. Gespeichert wird ausschliesslich dieser Hash. */
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

  // ---------------------------------------------------------------------------
  // Oeffentlich: Anmeldung (Double-Opt-in Schritt 1)
  // ---------------------------------------------------------------------------

  /**
   * Meldet eine Adresse an. Erzeugt bei neuen/abgemeldeten Adressen einen
   * `pending`-Datensatz mit frischem Token und verschickt die transaktionale
   * Double-Opt-in-Mail (KEINE Werbung). Bei bestehendem `pending` wird das Token
   * erneuert und die Bestaetigungs-Mail erneut geschickt. Bei bereits
   * `confirmed` passiert NICHTS (kein erneutes Opt-in).
   *
   * Enumeration-sicher: die Methode gibt NIE preis, ob die Adresse bekannt war –
   * der Controller antwortet immer identisch.
   */
  async anmelden(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    const existing = await this.repo.findOne({ where: { email: normalized } });

    // Bereits bestaetigt -> nichts tun (kein Werbe-/Opt-in-Sturm auf Bestandsabonnenten).
    if (existing && existing.status === NewsletterStatus.CONFIRMED) return;

    const raw = this.newRawToken();
    const now = new Date();

    if (!existing) {
      await this.repo.save(
        this.repo.create({
          email: normalized,
          status: NewsletterStatus.PENDING,
          tokenHash: this.hashToken(raw),
          angemeldetAm: now,
          bestaetigtAm: null,
          abgemeldetAm: null,
        }),
      );
    } else {
      // pending (Token erneuern) ODER unsubscribed (frisches Opt-in = neue Einwilligung).
      existing.status = NewsletterStatus.PENDING;
      existing.tokenHash = this.hashToken(raw);
      existing.angemeldetAm = now;
      existing.bestaetigtAm = null;
      existing.abgemeldetAm = null;
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
          `${this.bestaetigenLink(raw)}\n\n` +
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
   * Bestaetigt eine Anmeldung per Token. `pending` -> `confirmed` (+ Zeitstempel).
   * Idempotent: ein bereits bestaetigter Datensatz meldet erneut Erfolg
   * (Doppelklick auf den Link ist unkritisch). Unbekanntes/abgemeldetes Token
   * -> 400 (Link ungueltig).
   */
  async bestaetigen(rawToken: string): Promise<{ email: string }> {
    const ungueltig = new BadRequestException('Der Bestätigungs-Link ist ungültig oder abgelaufen.');

    const rec = await this.findByToken(rawToken);
    if (!rec || rec.status === NewsletterStatus.UNSUBSCRIBED) throw ungueltig;

    if (rec.status === NewsletterStatus.PENDING) {
      rec.status = NewsletterStatus.CONFIRMED;
      rec.bestaetigtAm = new Date();
      await this.repo.save(rec);
      this.logger.log('Newsletter-Anmeldung bestätigt (confirmed).');
    }
    // confirmed (bereits bestaetigt) -> idempotenter Erfolg.
    return { email: rec.email };
  }

  // ---------------------------------------------------------------------------
  // Oeffentlich: Abmeldung (1-Klick, sofort wirksam)
  // ---------------------------------------------------------------------------

  /**
   * Meldet per Token sofort ab (`unsubscribed` + Zeitstempel). Funktioniert fuer
   * `confirmed` UND `pending`. Idempotent: bereits abgemeldet -> erneut Erfolg.
   * Unbekanntes Token -> 400.
   */
  async abmelden(rawToken: string): Promise<void> {
    const rec = await this.findByToken(rawToken);
    if (!rec) throw new BadRequestException('Der Abmelde-Link ist ungültig.');

    if (rec.status !== NewsletterStatus.UNSUBSCRIBED) {
      rec.status = NewsletterStatus.UNSUBSCRIBED;
      rec.abgemeldetAm = new Date();
      await this.repo.save(rec);
      this.logger.log('Newsletter-Abmeldung verarbeitet (unsubscribed).');
    }
  }

  /** Laedt einen Datensatz anhand des Token-Hashes (Spalte ist select:false). */
  private async findByToken(rawToken: string): Promise<NewsletterSubscriber | null> {
    const token = (rawToken || '').trim();
    if (!token) return null;
    return this.repo
      .createQueryBuilder('s')
      .addSelect('s.tokenHash')
      .where('s.tokenHash = :h', { h: this.hashToken(token) })
      .getOne();
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
  // Betreiber: Versand (nur an confirmed, sequenziell, mit Abmelde-Link)
  // ---------------------------------------------------------------------------

  /**
   * Verschickt den Newsletter an ALLE bestaetigten Abonnenten. Pro Empfaenger
   * wird ein frisches Abmelde-Token erzeugt und der Hash rotiert – der versandte
   * Newsletter enthaelt damit einen gueltigen 1-Klick-Abmelde-Link. Der Versand
   * laeuft sequenziell (kein Parallel-Sturm); Fehler je Empfaenger werden geloggt
   * und stoppen den Lauf NICHT. Gibt eine Versand-Statistik zurueck.
   */
  async senden(betreff: string, inhalt: string): Promise<VersandStatistik> {
    const empfaenger = await this.repo.find({
      where: { status: NewsletterStatus.CONFIRMED },
      order: { angemeldetAm: 'ASC' },
    });

    const stat: VersandStatistik = { empfaenger: empfaenger.length, gesendet: 0, fehlgeschlagen: 0 };

    for (const sub of empfaenger) {
      // Frisches Abmelde-Token + Hash-Rotation (nur der Hash wird gespeichert).
      const raw = this.newRawToken();
      try {
        sub.tokenHash = this.hashToken(raw);
        await this.repo.save(sub);
      } catch (e) {
        stat.fehlgeschlagen++;
        this.logger.warn(
          `Token-Rotation fehlgeschlagen für ${MailService.maskRecipient(sub.email)}: ${(e as Error).message}`,
        );
        continue;
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
