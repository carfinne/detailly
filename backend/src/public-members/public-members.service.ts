import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { Betriebstyp, Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import { initialeAusName, resolveMitgliedProfil } from '../common/mitglied-profil';

/**
 * OEFFENTLICH sichtbare Mitglieds-Karte (STRIKTE Whitelist). Enthaelt AUSSCHLIESSLICH
 * zur Veroeffentlichung freigegebene, PII-arme Felder – NIEMALS E-Mail, Adresse,
 * Telefon, interne IDs oder verschluesselte settings.
 */
export interface PublicMitglied {
  firmenname: string;
  /** Ausrichtung (labels.betriebstyp.* im Frontend). */
  betriebstyp: Betriebstyp;
  stadt: string | null;
  kurzbeschreibung: string | null;
  /** Eigene Webseite (nur sicheres http/https-Schema) oder null. */
  webseite: string | null;
  /** Oeffentliches Logo (nur absolute http/https-URL) oder null. */
  logoUrl: string | null;
  /** 1–2-Buchstaben-Monogramm als Fallback, wenn kein Logo vorliegt. */
  initiale: string;
}

/** Gibt eine Logo-URL nur zurueck, wenn sie absolut (http/https) ist – sonst null. */
function safeLogo(url: string | null | undefined): string | null {
  const s = (url ?? '').trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

@Injectable()
export class PublicMembersService {
  constructor(@InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>) {}

  /**
   * Liefert plattformweit ALLE Betriebe, die der oeffentlichen Anzeige zugestimmt
   * haben (`settings.mitgliedProfil.zeigen === true`). BEWUSST OHNE Tenant-Scope –
   * das ist ein oeffentliches, tenant-neutrales Verzeichnis; es fliessen aber NUR
   * die vom jeweiligen Betrieb selbst freigegebenen, PII-armen Felder nach aussen
   * (strikte Whitelist in `PublicMitglied`), nie sensible/andere Tenant-Daten.
   *
   * WICHTIG: `settings` ist verschluesseltes JSON (nicht SQL-durchsuchbar), daher
   * wird der `zeigen`-Filter in der Anwendung ausgewertet (Muster wie
   * PublicBookingService). Inaktive Betriebe werden ausgeschlossen. Die Sortierung
   * ist deterministisch (Name), damit die Antwort cache-freundlich stabil bleibt.
   */
  async listMitglieder(): Promise<PublicMitglied[]> {
    const tenants = await this.tenantRepo.find({
      where: { status: Not(TenantStatus.INACTIVE) },
      // Nur die serverseitig benoetigten Felder. `settings` wird zum Entschluesseln/
      // Filtern gebraucht, verlaesst das Backend aber NIE als Ganzes.
      select: ['id', 'name', 'betriebstyp', 'logoUrl', 'settings'],
      order: { name: 'ASC' },
    });

    const mitglieder: PublicMitglied[] = [];
    for (const t of tenants) {
      const s = (t.settings ?? {}) as Record<string, unknown>;
      const profil = resolveMitgliedProfil(s.mitgliedProfil);
      if (!profil.zeigen) continue; // nur mit ausdruecklicher Zustimmung (Opt-in)
      mitglieder.push({
        firmenname: t.name,
        betriebstyp: t.betriebstyp ?? Betriebstyp.KOMPLETT,
        stadt: profil.stadt || null,
        kurzbeschreibung: profil.kurzbeschreibung || null,
        webseite: profil.webseite || null,
        logoUrl: safeLogo(t.logoUrl),
        initiale: initialeAusName(t.name),
      });
    }
    return mitglieder;
  }
}
