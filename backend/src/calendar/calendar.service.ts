import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Appointment } from '../appointments/entities/appointment.entity';

const DAY_MS = 86_400_000;

/**
 * iCal-Kalender-Feed (Abo) der Termine eines Betriebs. Der oeffentliche Feed ist
 * ueber ein geheimes Token in der URL erreichbar (kein Login moeglich, da
 * Kalender-Apps nur eine URL abrufen). Token ist regenerierbar.
 */
@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Appointment) private readonly apptRepo: Repository<Appointment>,
  ) {}

  /** Liefert das Feed-Token (erzeugt es beim ersten Mal). */
  async getOrCreateToken(tenantId: string): Promise<string> {
    const t = await this.tenantRepo.findOne({ where: { id: tenantId }, select: ['id', 'calendarToken'] });
    if (!t) throw new NotFoundException('Betrieb nicht gefunden');
    if (t.calendarToken) return t.calendarToken;
    const token = this.gen();
    await this.tenantRepo.update({ id: tenantId }, { calendarToken: token });
    return token;
  }

  /** Erzeugt ein NEUES Token (altes Abo wird dadurch ungueltig). */
  async regenerate(tenantId: string): Promise<string> {
    const token = this.gen();
    await this.tenantRepo.update({ id: tenantId }, { calendarToken: token });
    return token;
  }

  /** Baut den ICS-Feed fuer ein gueltiges Token (sonst 404). */
  async icsForToken(token: string): Promise<string> {
    const clean = (token || '').replace(/\.ics$/i, '');
    if (!clean) throw new NotFoundException('Kalender nicht gefunden');
    const t = await this.tenantRepo.findOne({ where: { calendarToken: clean }, select: ['id', 'name'] });
    if (!t) throw new NotFoundException('Kalender nicht gefunden');
    const from = new Date(Date.now() - 90 * DAY_MS);
    const to = new Date(Date.now() + 540 * DAY_MS);
    const appts = await this.apptRepo.find({
      where: { tenantId: t.id, start: Between(from, to) },
      order: { start: 'ASC' },
      take: 2000,
    });
    return this.buildIcs(t.name, appts);
  }

  // ---------------------------------------------------------------------------
  // Pure ICS-Erzeugung (RFC 5545)
  // ---------------------------------------------------------------------------

  buildIcs(calName: string, appts: Appointment[]): string {
    const out: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Detailly//Plantafel//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      this.fold(`X-WR-CALNAME:${this.esc('Detailly – ' + (calName || 'Termine'))}`),
      'X-WR-TIMEZONE:Europe/Berlin',
    ];
    const stamp = this.icsDate(new Date());
    for (const a of appts) {
      out.push('BEGIN:VEVENT');
      out.push(`UID:${a.id}@detailly`);
      out.push(`DTSTAMP:${stamp}`);
      out.push(`DTSTART:${this.icsDate(a.start)}`);
      out.push(`DTEND:${this.icsDate(a.ende)}`);
      out.push(this.fold(`SUMMARY:${this.esc(a.titel || 'Termin')}`));
      if (a.notiz) out.push(this.fold(`DESCRIPTION:${this.esc(a.notiz)}`));
      out.push(`STATUS:${this.mapStatus(a.status)}`);
      out.push('END:VEVENT');
    }
    out.push('END:VCALENDAR');
    return out.join('\r\n') + '\r\n';
  }

  private gen(): string {
    return randomBytes(24).toString('hex');
  }

  /** UTC-Zeitstempel im iCal-Format YYYYMMDDTHHMMSSZ. */
  private icsDate(d: Date | string): string {
    const x = new Date(d);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${x.getUTCFullYear()}${p(x.getUTCMonth() + 1)}${p(x.getUTCDate())}T${p(x.getUTCHours())}${p(x.getUTCMinutes())}${p(x.getUTCSeconds())}Z`;
  }

  /** RFC-5545-Escaping fuer Textwerte. */
  private esc(s: string): string {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  private mapStatus(s: string): string {
    if (s === 'bestaetigt' || s === 'abgeschlossen') return 'CONFIRMED';
    if (s === 'abgesagt') return 'CANCELLED';
    return 'TENTATIVE';
  }

  /** Zeilen > 73 Zeichen falten (Folge-Zeilen beginnen mit Leerzeichen). */
  private fold(line: string): string {
    if (line.length <= 73) return line;
    const parts: string[] = [];
    let i = 0;
    while (i < line.length) {
      parts.push((i === 0 ? '' : ' ') + line.slice(i, i + 73));
      i += 73;
    }
    return parts.join('\r\n');
  }
}
