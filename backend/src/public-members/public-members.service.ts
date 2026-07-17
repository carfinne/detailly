import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

import { Betriebstyp, Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/entities/subscription.entity';
import { initialeAusName, resolveMitgliedProfil } from '../common/mitglied-profil';
import { sanitizeLogoUrl } from '../common/logo-url';

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
  /** Oeffentliches Logo (http/https-URL ODER validiertes data:image-Raster) oder null. */
  logoUrl: string | null;
  /** 1–2-Buchstaben-Monogramm als Fallback, wenn kein Logo vorliegt. */
  initiale: string;
  /**
   * GROBE Leitregion (erste 2 Ziffern der PLZ, z. B. "10" fuer Berlin) – bewusst
   * NIE die volle PLZ/Adresse. Nur gesetzt, wenn der Betrieb (a) der Anzeige
   * zugestimmt hat UND (b) ein aktiv ZAHLENDES Abo hat (SubscriptionStatus.ACTIVE,
   * nicht trial). Sonst `null`. Es gibt bewusst KEIN oeffentliches `zahlend`-Flag –
   * der zahlende Status wird ausschliesslich implizit ueber das Vorhandensein von
   * `plzRegion` sichtbar. Die Karte plottet nur Eintraege mit `plzRegion`.
   */
  plzRegion: string | null;
}

/**
 * Grobe Leitregion aus einer PLZ: die ersten 2 Ziffern, aber NUR wenn die PLZ mit
 * (mindestens) 2 Ziffern beginnt – sonst null. Bewusst datensparsam: es verlaesst
 * NIE die volle PLZ das Backend, nur die 2-stellige Leitregion.
 */
function plzRegionAusPostalCode(postalCode: string | null | undefined): string | null {
  const treffer = /^(\d{2})/.exec((postalCode ?? '').trim());
  return treffer ? treffer[1] : null;
}

@Injectable()
export class PublicMembersService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

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
      // Filtern gebraucht, `postalCode` NUR zur Ableitung der 2-stelligen Leitregion –
      // beide verlassen das Backend NIE im Rohzustand (keine volle PLZ/Adresse).
      select: ['id', 'name', 'betriebstyp', 'logoUrl', 'postalCode', 'settings'],
      order: { name: 'ASC' },
    });

    // Erst die Opt-in-Betriebe herausfiltern; nur fuer diese wird der (zahlende)
    // Abo-Status gebraucht.
    const optin = tenants.filter((t) => {
      const s = (t.settings ?? {}) as Record<string, unknown>;
      return resolveMitgliedProfil(s.mitgliedProfil).zeigen;
    });

    // Aktiv ZAHLENDE Tenants BATCH laden (ein einziges find mit tenantId IN (...),
    // kein N+1). Nur die zwei benoetigten Spalten. Leere Liste -> gar keine Query.
    const aktivZahlend = new Set<string>();
    if (optin.length > 0) {
      const subs = await this.subscriptionRepo.find({
        where: { tenantId: In(optin.map((t) => t.id)), status: SubscriptionStatus.ACTIVE },
        select: ['tenantId', 'status'],
      });
      for (const sub of subs) aktivZahlend.add(sub.tenantId);
    }

    return optin.map((t) => {
      const s = (t.settings ?? {}) as Record<string, unknown>;
      const profil = resolveMitgliedProfil(s.mitgliedProfil);
      return {
        firmenname: t.name,
        betriebstyp: t.betriebstyp ?? Betriebstyp.KOMPLETT,
        stadt: profil.stadt || null,
        kurzbeschreibung: profil.kurzbeschreibung || null,
        webseite: profil.webseite || null,
        logoUrl: sanitizeLogoUrl(t.logoUrl),
        initiale: initialeAusName(t.name),
        // Leitregion NUR fuer aktiv zahlende Betriebe – sonst null (kein Punkt).
        plzRegion: aktivZahlend.has(t.id) ? plzRegionAusPostalCode(t.postalCode) : null,
      };
    });
  }
}
