import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceItem } from './entities/service-item.entity';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  STARTER_GEWERKE,
  STARTER_KATALOG,
  StarterGewerk,
  StarterKatalogGruppe,
  getStarterKatalog,
  normStarterName,
} from './starter-catalog';

/** Ergebnis eines Starter-Imports (Onboarding). */
export interface StarterImportResult {
  /** Neu angelegte Leistungen. */
  importiert: number;
  /** Wegen Namensgleichheit uebersprungene Katalog-Eintraege (Idempotenz). */
  uebersprungen: number;
  items: ServiceItem[];
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(ServiceItem)
    private readonly repo: Repository<ServiceItem>,
  ) {}

  findAll(tenantId: string, includeInactive = false): Promise<ServiceItem[]> {
    const where: Record<string, unknown> = { tenantId };
    if (!includeInactive) where.aktiv = true;
    // take: Sicherheitsventil (T-009), kein Produktlimit - Leistungskataloge
    // liegen realistisch weit unter 500 Eintraegen.
    return this.repo.find({ where, order: { kategorie: 'ASC', name: 'ASC' }, take: 500 });
  }

  async findOne(tenantId: string, id: string): Promise<ServiceItem> {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Leistung nicht gefunden');
    return item;
  }

  create(user: AuthUser, dto: CreateServiceDto): Promise<ServiceItem> {
    return this.repo.save(this.repo.create({ ...dto, tenantId: user.tenantId }));
  }

  async update(user: AuthUser, id: string, dto: UpdateServiceDto): Promise<ServiceItem> {
    const item = await this.findOne(user.tenantId, id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const item = await this.findOne(user.tenantId, id);
    item.aktiv = false;
    await this.repo.save(item);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Starter-Katalog (Pilot-Onboarding): kuratierte Leistungen je Gewerk zur
  // Ein-Klick-Uebernahme. Reine Datenquelle in ./starter-catalog; das Anlegen
  // erfolgt hier tenant-scoped und idempotenz-bewusst (Namensgleichheit).
  // ---------------------------------------------------------------------------

  /** Statischer Vorschau-Katalog (kein Tenant): Gruppen je Gewerk. */
  starterCatalog(): { gewerke: StarterKatalogGruppe[] } {
    return getStarterKatalog();
  }

  /**
   * Uebernimmt die Starter-Leistungen der gewaehlten Gewerke tenant-scoped.
   * Idempotenz: existiert (aktiv ODER inaktiv) bereits eine Leistung mit
   * namensgleichem, normalisiertem Namen, wird der Katalog-Eintrag uebersprungen
   * statt dupliziert. Ungueltige/leere Gewerk-Wahl -> 400 (zweite Sicherung
   * hinter der DTO-Validierung).
   */
  async importStarter(user: AuthUser, gewerke: StarterGewerk[]): Promise<StarterImportResult> {
    // Duplikate im Array entfernen + auf gueltige Starter-Gewerke beschraenken.
    const gewaehlt = [...new Set(gewerke)].filter((g) => STARTER_GEWERKE.includes(g));
    if (gewaehlt.length === 0) {
      throw new BadRequestException('Mindestens ein gültiges Gewerk wählen');
    }

    const kandidaten = gewaehlt.flatMap((g) =>
      STARTER_KATALOG[g].map((l) => ({ ...l, kategorie: g })),
    );

    // Bestehende Namen (aktiv + inaktiv) tenant-scoped laden -> Idempotenz-Set.
    // take: defensives Sicherheitsventil (Kataloge liegen weit darunter).
    const bestehende = await this.repo.find({
      where: { tenantId: user.tenantId },
      select: ['name'],
      take: 2000,
    });
    const vorhanden = new Set(bestehende.map((s) => normStarterName(s.name)));

    const neu = kandidaten.filter((k) => !vorhanden.has(normStarterName(k.name)));
    const uebersprungen = kandidaten.length - neu.length;

    const items = neu.length
      ? await this.repo.save(
          neu.map((k) =>
            this.repo.create({
              tenantId: user.tenantId,
              name: k.name,
              beschreibung: k.beschreibung,
              kategorie: k.kategorie,
              einheit: k.einheit,
              basispreis: k.basispreis,
              aktiv: true,
            }),
          ),
        )
      : [];

    return { importiert: items.length, uebersprungen, items };
  }
}
