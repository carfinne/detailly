import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ReferralCode } from './entities/referral-code.entity';
import { Referral } from './entities/referral.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuditService } from '../audit/audit.service';
import { isUniqueViolation } from '../common/unique-retry';
import {
  DEFAULT_REWARD_TYPE,
  generateReferralCode,
  normalizeReferralCode,
} from './affiliate.constants';

/** Kundensichere Sicht der „Weiterempfehlen"-Seite (GET /affiliate/me). */
export interface MyAffiliateView {
  /** Der eigene Empfehlungs-Code (wird bei Bedarf lazy erzeugt). */
  code: string;
  /** Teilbarer, relativer Pfad – das Frontend stellt die Origin voran. */
  sharePath: string;
  /** Zaehler. */
  geworben: number;
  zahlend: number;
  anwartschaften: number;
  /** Die eigenen geworbenen Betriebe (nur eigene – strikte Isolation). */
  empfehlungen: {
    betrieb: string;
    status: string;
    belohnungTyp: string | null;
    geworbenAm: Date;
    zahlendSeit: Date | null;
  }[];
}

/** Read-only Zeile der Plattform-Sicht (Betreiber-Cockpit „Empfehlungen"). */
export interface PlatformReferralItem {
  id: string;
  werber: string;
  werberTenantId: string;
  geworben: string;
  geworbenTenantId: string;
  code: string;
  status: string;
  belohnungAnwartschaft: boolean;
  belohnungTyp: string | null;
  geworbenAm: Date;
  zahlendSeit: Date | null;
}

export interface PlatformReferralResult {
  data: PlatformReferralItem[];
  total: number;
  limit: number;
  offset: number;
}

/** Baut den teilbaren Registrierungs-Pfad zu einem Code. */
function sharePathFor(code: string): string {
  return `/registrieren?ref=${code}`;
}

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectRepository(ReferralCode) private readonly codeRepo: Repository<ReferralCode>,
    @InjectRepository(Referral) private readonly referralRepo: Repository<Referral>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Code-Verwaltung (je Betrieb genau ein Code)
  // ---------------------------------------------------------------------------

  /**
   * Liefert den Empfehlungs-Code des Betriebs und erzeugt ihn bei Bedarf
   * kollisionsfest. Bei einer UNIQUE-Verletzung wird unterschieden:
   *  - tenantId-Kollision (paralleler Aufruf) -> den inzwischen erzeugten Code
   *    zurueckgeben (idempotent, ein Code je Betrieb).
   *  - code-Kollision -> mit neuem Code erneut versuchen.
   */
  async ensureCode(tenantId: string): Promise<ReferralCode> {
    const existing = await this.codeRepo.findOne({ where: { tenantId } });
    if (existing) return existing;

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateReferralCode();
      try {
        return await this.codeRepo.save(this.codeRepo.create({ tenantId, code }));
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // tenantId-Race: ein paralleler Aufruf war schneller -> dessen Code nutzen.
        const again = await this.codeRepo.findOne({ where: { tenantId } });
        if (again) return again;
        // sonst reine code-Kollision -> naechster Versuch mit neuem Code.
      }
    }
    throw new Error('Konnte keinen eindeutigen Empfehlungs-Code erzeugen');
  }

  // ---------------------------------------------------------------------------
  // Zuordnung bei der Registrierung
  // ---------------------------------------------------------------------------

  /**
   * Ordnet einen frisch registrierten Betrieb einem Werber-Code zu (best-effort,
   * wird NACH dem Registrierungs-Commit aufgerufen und darf die Registrierung nie
   * scheitern lassen).
   *
   * Anti-Missbrauch / Robustheit:
   *  - Kein/leerer Code -> still verwerfen (kein Fehler).
   *  - Unbekannter Code -> still verwerfen + Audit-Hinweis (KEIN Existenz-Orakel,
   *    exakter Lookup, kein Listing).
   *  - Selbst-Werbung (Code gehoert dem neuen Betrieb selbst) -> blocken + Audit.
   *  - Betrieb bereits geworben -> no-op (UNIQUE referredTenantId als Backstop).
   */
  async attachReferral(referredTenantId: string, rawCode: string | null | undefined): Promise<void> {
    const code = normalizeReferralCode(rawCode);
    if (!code) return; // kein Code angegeben – normaler Fall

    const owner = await this.codeRepo.findOne({ where: { code } });
    if (!owner) {
      // Ungueltiger Code: Registrierung lief bereits normal weiter -> nur Hinweis.
      await this.audit.log({
        tenantId: referredTenantId,
        action: 'affiliate.ref_invalid',
        entityType: 'Referral',
        payload: { code },
      });
      return;
    }

    // Selbst-Werbung: identischer Tenant/Code-Inhaber. (Die E-Mail-Domain ist
    // bewusst KEIN Kriterium.) Bei einer Neu-Registrierung strukturell selten,
    // aber als korrekte Schranke defensiv geblockt.
    if (owner.tenantId === referredTenantId) {
      await this.audit.log({
        tenantId: referredTenantId,
        action: 'affiliate.ref_self_blocked',
        entityType: 'Referral',
        payload: { code },
      });
      return;
    }

    // Ein Betrieb kann nur einmal geworben werden.
    const alreadyReferred = await this.referralRepo.findOne({ where: { referredTenantId } });
    if (alreadyReferred) return;

    try {
      const referral = await this.referralRepo.save(
        this.referralRepo.create({
          referrerTenantId: owner.tenantId,
          referredTenantId,
          code,
          status: 'registriert',
          belohnungAnwartschaft: false,
        }),
      );
      // Ereignis-Zeile auf den WERBER buchen (dessen Empfehlung war erfolgreich).
      await this.audit.log({
        tenantId: owner.tenantId,
        action: 'affiliate.referred',
        entityType: 'Referral',
        entityId: referral.id,
        payload: { code, referredTenantId },
      });
    } catch (err) {
      // UNIQUE-Backstop (paralleler Doppel-Register o. ae.) -> stillschweigend ok.
      if (!isUniqueViolation(err)) throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Belohnungs-Logik (Statuswechsel auf „zahlend")
  // ---------------------------------------------------------------------------

  /**
   * Wird aufgerufen, wenn das Abo eines Betriebs auf „zahlend" (ACTIVE) wechselt.
   * War der Betrieb geworben und ist die Werbung noch nicht abgerechnet, wird die
   * Gutschrift-Anwartschaft des WERBERS EINMALIG verbucht.
   *
   * IDEMPOTENT + RACE-FEST: Der Wechsel wird per KONDITIONALEM UPDATE
   * (`status = 'registriert'` im WHERE) atomar „geclaimt" – nur genau ein
   * paralleler Aufruf gewinnt (affected === 1). Erst danach wird der Audit-
   * Eintrag geschrieben. Ohne diesen Claim wuerden zwei gleichzeitige Status-
   * wechsel (read-then-write) doppelte 'affiliate.reward_earned'-Eintraege und –
   * sobald Stripe die Events zaehlt – eine Doppel-Gutschrift erzeugen.
   * KEINE echte Zahlungsverrechnung (kommt mit Stripe) – nur die Anwartschaft.
   */
  async onReferredTenantBecamePaying(referredTenantId: string): Promise<void> {
    const claim = await this.referralRepo.update(
      { referredTenantId, status: 'registriert' },
      {
        status: 'zahlend',
        zahlendSeit: new Date(),
        belohnungAnwartschaft: true,
        belohnungTyp: DEFAULT_REWARD_TYPE,
      },
    );
    // Kein Treffer -> nicht geworben ODER bereits verbucht: still beenden (idempotent).
    if (!claim.affected) return;

    // Nur nach erfolgreichem Claim den Werber fuer den Audit-Eintrag nachladen.
    const referral = await this.referralRepo.findOne({ where: { referredTenantId } });
    if (!referral) return;
    await this.audit.log({
      tenantId: referral.referrerTenantId,
      action: 'affiliate.reward_earned',
      entityType: 'Referral',
      entityId: referral.id,
      payload: { referredTenantId, belohnungTyp: DEFAULT_REWARD_TYPE },
    });
  }

  // ---------------------------------------------------------------------------
  // Tenant-Sicht („Weiterempfehlen")
  // ---------------------------------------------------------------------------

  /**
   * Sicht des eigenen Betriebs: Code + teilbarer Pfad + Zaehler + die EIGENEN
   * geworbenen Betriebe. Strikt tenant-scoped (WHERE referrerTenantId = tenantId).
   */
  async getMyView(tenantId: string | null | undefined): Promise<MyAffiliateView> {
    if (!tenantId) {
      throw new BadRequestException('Kein Betrieb im Kontext.');
    }
    const codeRow = await this.ensureCode(tenantId);

    const referrals = await this.referralRepo.find({
      where: { referrerTenantId: tenantId },
      order: { createdAt: 'DESC' },
    });

    const tenantNames = await this.namesFor(referrals.map((r) => r.referredTenantId));

    return {
      code: codeRow.code,
      sharePath: sharePathFor(codeRow.code),
      geworben: referrals.length,
      zahlend: referrals.filter((r) => r.status === 'zahlend').length,
      anwartschaften: referrals.filter((r) => r.belohnungAnwartschaft).length,
      empfehlungen: referrals.map((r) => ({
        betrieb: tenantNames.get(r.referredTenantId) ?? '—',
        status: r.status,
        belohnungTyp: r.belohnungTyp ?? null,
        geworbenAm: r.createdAt,
        zahlendSeit: r.zahlendSeit ?? null,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Plattform-Sicht (Betreiber-Cockpit, read-only, alle Werbungen)
  // ---------------------------------------------------------------------------

  /**
   * Betreiber-Sicht: wer hat wen geworben (Betriebsnamen, Datum, Status,
   * Gutschrift-Anwartschaft). Read-only, paginiert + hart gedeckelt. Bewusst OHNE
   * Mandantenfilter – der Aufruf ist im Controller strikt auf Plattform-Rollen
   * begrenzt (RolesGuard).
   */
  async listForPlatform(params: { limit?: string; offset?: string }): Promise<PlatformReferralResult> {
    const limit = clampLimit(params.limit, 50, 200);
    const offset = clampOffset(params.offset);

    const [rows, total] = await this.referralRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.referrerTenantId);
      ids.add(r.referredTenantId);
    }
    const names = await this.namesFor([...ids]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        werber: names.get(r.referrerTenantId) ?? '—',
        werberTenantId: r.referrerTenantId,
        geworben: names.get(r.referredTenantId) ?? '—',
        geworbenTenantId: r.referredTenantId,
        code: r.code,
        status: r.status,
        belohnungAnwartschaft: r.belohnungAnwartschaft,
        belohnungTyp: r.belohnungTyp ?? null,
        geworbenAm: r.createdAt,
        zahlendSeit: r.zahlendSeit ?? null,
      })),
      total,
      limit,
      offset,
    };
  }

  // ---------------------------------------------------------------------------
  // intern
  // ---------------------------------------------------------------------------

  /** Betriebsnamen zu einer Menge von tenantIds (nur id/name, Datensparsamkeit). */
  private async namesFor(tenantIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const uniq = [...new Set(tenantIds.filter((v) => !!v))];
    if (uniq.length === 0) return map;
    const tenants = await this.tenantRepo.find({
      where: { id: In(uniq) },
      select: ['id', 'name'],
    });
    for (const t of tenants) map.set(t.id, t.name);
    return map;
  }
}

function clampLimit(raw: string | undefined, def: number, max: number): number {
  const n = raw != null ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(1, n), max);
}

function clampOffset(raw: string | undefined): number {
  const n = raw != null ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return 0;
  return Math.max(0, n);
}
