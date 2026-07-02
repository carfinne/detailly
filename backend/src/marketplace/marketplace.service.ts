import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';
import { MarketplaceClick } from './entities/marketplace-click.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateDealerDto, UpdateDealerDto, CreateProductDto, UpdateProductDto } from './dto/marketplace.dto';

/**
 * B2B-Marktplatz (Detailly-kuratiert, plattform-weit). Betriebe sehen den
 * Katalog und klicken zum Haendler (Affiliate-Link); jeder Klick wird fuer die
 * Provisions-Auswertung gezaehlt. Pflege ausschliesslich durch Plattform-Rollen
 * (Controller-Guards).
 */
@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(MarketplaceDealer) private readonly dealerRepo: Repository<MarketplaceDealer>,
    @InjectRepository(MarketplaceProduct) private readonly productRepo: Repository<MarketplaceProduct>,
    @InjectRepository(MarketplaceClick) private readonly clickRepo: Repository<MarketplaceClick>,
  ) {}

  // ---------------------------------------------------------------------------
  // Katalog (Kunden-Seite)
  // ---------------------------------------------------------------------------

  /**
   * Kompletter aktiver Katalog in EINEM Aufruf (kuratiert -> ueberschaubar
   * gross): Produkte inkl. Haendlername, Haendlerliste, Kategorien. Das
   * Frontend filtert clientseitig -> sofortige Reaktion ohne Requests.
   */
  async catalog() {
    const [produkte, haendler] = await Promise.all([
      this.productRepo.find({
        where: { aktiv: true },
        order: { klicks: 'DESC', createdAt: 'DESC' },
        take: 1000,
      }),
      this.dealerRepo.find({ where: { aktiv: true }, order: { name: 'ASC' } }),
    ]);
    const dealerById = new Map(haendler.map((d) => [d.id, d.name]));
    const kategorien = [...new Set(produkte.map((p) => p.kategorie))].sort((a, b) =>
      a.localeCompare(b, 'de'),
    );
    return {
      produkte: produkte
        // Produkte deaktivierter Haendler nicht anbieten.
        .filter((p) => dealerById.has(p.dealerId))
        .map((p) => ({ ...p, haendlerName: dealerById.get(p.dealerId)! })),
      haendler: haendler.map((d) => ({ id: d.id, name: d.name, logoUrl: d.logoUrl, webseite: d.webseite })),
      kategorien,
    };
  }

  /**
   * Klick auf "Zum Haendler": zaehlt (Einzelklick + atomarer Zaehler) und gibt
   * den Affiliate-Link zurueck – die URL kommt vom Server, nie vom Client.
   */
  async klick(user: AuthUser, productId: string): Promise<{ affiliateUrl: string }> {
    const product = await this.productRepo.findOne({ where: { id: productId, aktiv: true } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    await Promise.all([
      this.clickRepo.save(
        this.clickRepo.create({
          productId: product.id,
          dealerId: product.dealerId,
          tenantId: user.tenantId,
        }),
      ),
      this.productRepo.increment({ id: product.id }, 'klicks', 1),
    ]);
    return { affiliateUrl: product.affiliateUrl };
  }

  // ---------------------------------------------------------------------------
  // Pflege (Plattform-Seite)
  // ---------------------------------------------------------------------------

  listDealers(): Promise<MarketplaceDealer[]> {
    return this.dealerRepo.find({ order: { name: 'ASC' } });
  }

  createDealer(dto: CreateDealerDto): Promise<MarketplaceDealer> {
    return this.dealerRepo.save(this.dealerRepo.create({ ...dto }));
  }

  async updateDealer(id: string, dto: UpdateDealerDto): Promise<MarketplaceDealer> {
    const dealer = await this.dealerRepo.findOne({ where: { id } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    Object.assign(dealer, dto);
    return this.dealerRepo.save(dealer);
  }

  listProducts(): Promise<MarketplaceProduct[]> {
    return this.productRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createProduct(dto: CreateProductDto): Promise<MarketplaceProduct> {
    const dealer = await this.dealerRepo.findOne({ where: { id: dto.dealerId } });
    if (!dealer) throw new BadRequestException('Haendler existiert nicht');
    return this.productRepo.save(this.productRepo.create({ ...dto }));
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<MarketplaceProduct> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    if (dto.dealerId && dto.dealerId !== product.dealerId) {
      const dealer = await this.dealerRepo.findOne({ where: { id: dto.dealerId } });
      if (!dealer) throw new BadRequestException('Haendler existiert nicht');
    }
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  /** Affiliate-Statistik: Gesamt/30 Tage + Top-Produkte/-Haendler. */
  async stats() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [gesamt, letzte30Tage, topProdukteRaw, topHaendlerRaw, dealers] = await Promise.all([
      this.clickRepo.count(),
      this.clickRepo.count({ where: { createdAt: MoreThanOrEqual(cutoff) } }),
      this.productRepo.find({ where: { aktiv: true }, order: { klicks: 'DESC' }, take: 5 }),
      this.clickRepo
        .createQueryBuilder('k')
        .select('k.dealerId', 'dealerId')
        .addSelect('COUNT(*)', 'klicks')
        .groupBy('k.dealerId')
        .orderBy('klicks', 'DESC')
        .limit(5)
        .getRawMany<{ dealerId: string; klicks: string }>(),
      this.dealerRepo.find({ select: ['id', 'name'] }),
    ]);
    const nameById = new Map(dealers.map((d) => [d.id, d.name]));
    return {
      gesamt,
      letzte30Tage,
      topProdukte: topProdukteRaw.map((p) => ({
        name: p.name,
        haendler: nameById.get(p.dealerId) ?? '—',
        klicks: Number(p.klicks),
      })),
      topHaendler: topHaendlerRaw.map((r) => ({
        name: nameById.get(r.dealerId) ?? '—',
        klicks: Number(r.klicks),
      })),
    };
  }
}
