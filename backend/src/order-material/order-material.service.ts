import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { OrderMaterial } from './entities/order-material.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../shop/entities/product.entity';
import { FolienRolle, FolienRolleStatus } from '../folien-rollen/entities/folien-rolle.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { CreateOrderMaterialDto } from './dto/order-material.dto';

/**
 * Materialverbrauch je Auftrag. Erfassen senkt den Produkt-Bestand, Loeschen
 * bucht ihn zurueck – beides als EINE Transaktion (Zeile + Bestand atomar) und
 * mit relativem decrement/increment (kein Lost-Update bei Parallelzugriff).
 * Bestand darf negativ werden: ehrlicher Ueberverbrauch-Hinweis UND symmetrische
 * Rueckbuchung (Loeschen fuehrt exakt zum Ausgangswert zurueck). Tenant-gebunden.
 *
 * Optional kann eine konkrete Restrolle (FolienRolle) mitgebucht werden: deren
 * restLfm wird in DERSELBEN Transaktion mitgesenkt (und beim Loeschen symmetrisch
 * zurueckgebucht). WICHTIG (Semantik): der Produkt-`bestand` umfasst ALLES Material
 * inkl. der Reste; die Rolle ist nur die feinere Verortung DESSELBEN Materials.
 * Das doppelte Dekrement (bestand UND restLfm) ist daher KORREKT und KEIN
 * Doppelabzug.
 */
@Injectable()
export class OrderMaterialService {
  constructor(
    @InjectRepository(OrderMaterial) private readonly repo: Repository<OrderMaterial>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(FolienRolle) private readonly rolleRepo: Repository<FolienRolle>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Materialliste eines Auftrags (neueste zuerst). */
  async listForOrder(tenantId: string, orderId: string): Promise<OrderMaterial[]> {
    if (!orderId) return [];
    // take: defensives Sicherheitsventil (T-009) - pro Auftrag naturgemaess klein.
    return this.repo.find({ where: { tenantId, orderId }, order: { createdAt: 'DESC' }, take: 500 });
  }

  /**
   * Verbucht Materialverbrauch auf einen Auftrag und senkt den Bestand. Auftrag,
   * Produkt und (optional) Restrolle muessen zum eigenen Betrieb gehoeren
   * (Mandantentrennung).
   */
  async add(user: AuthUser, dto: CreateOrderMaterialDto): Promise<OrderMaterial> {
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
    const product = (await assertRefInTenant(this.productRepo, user, dto.productId, 'Produkt'))!;
    // Optionale Restrolle tenant-validieren, BEVOR die Transaktion oeffnet.
    if (dto.folienRolleId) {
      await assertRefInTenant(this.rolleRepo, user, dto.folienRolleId, 'Restrolle');
    }
    const menge = Number(dto.menge);
    const geplantLfm = dto.geplantLfm == null ? null : Number(dto.geplantLfm);

    // Zeile anlegen UND Bestand senken atomar (eine Transaktion). Relativer
    // decrement -> kein Lost-Update, kein Pre-Read, kein Clamp.
    const saved = await this.dataSource.transaction(async (m) => {
      const s = await m.save(
        m.create(OrderMaterial, {
          tenantId: user.tenantId,
          orderId: dto.orderId,
          productId: dto.productId,
          produktName: product.name,
          einheit: product.einheit,
          menge,
          folienRolleId: dto.folienRolleId ?? null,
          geplantLfm,
          erfasstVon: user.id,
        }),
      );
      await m.decrement(Product, { id: product.id, tenantId: user.tenantId }, 'bestand', menge);
      if (dto.folienRolleId) {
        // Rolle mitsenken (feinere Verortung desselben Materials, s. Klassen-Doc).
        await m.decrement(
          FolienRolle,
          { id: dto.folienRolleId, tenantId: user.tenantId },
          'restLfm',
          menge,
        );
        // Leergelaufene Rolle automatisch AUFGEBRAUCHT (nur solange VERFUEGBAR;
        // ein manuell ENTSORGT bleibt unberuehrt). Bedingtes UPDATE = kein Race.
        await m.update(
          FolienRolle,
          {
            id: dto.folienRolleId,
            tenantId: user.tenantId,
            restLfm: LessThanOrEqual(0),
            status: FolienRolleStatus.VERFUEGBAR,
          },
          { status: FolienRolleStatus.AUFGEBRAUCHT },
        );
      }
      return s;
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'OrderMaterial',
      entityId: saved.id,
      payload: {
        orderId: dto.orderId,
        productId: dto.productId,
        menge,
        folienRolleId: dto.folienRolleId ?? null,
      },
    });
    return saved;
  }

  /** Loescht einen Verbrauch und bucht die Menge atomar auf den Bestand zurueck. */
  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const eintrag = await this.repo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!eintrag) throw new NotFoundException('Materialeintrag nicht gefunden');
    const menge = Number(eintrag.menge);

    await this.dataSource.transaction(async (m) => {
      // Nur zurueckbuchen, wenn das Produkt noch existiert (Snapshot haelt die Zeile lesbar).
      const product = await m.findOne(Product, {
        where: { id: eintrag.productId, tenantId: user.tenantId },
      });
      if (product) {
        await m.increment(Product, { id: product.id, tenantId: user.tenantId }, 'bestand', menge);
      }
      // Wurde von einer Restrolle gebucht und existiert diese noch: restLfm
      // symmetrisch zuruecklaufen lassen und ein auto-AUFGEBRAUCHT wieder aufheben
      // (ein manuell ENTSORGT bleibt unangetastet).
      if (eintrag.folienRolleId) {
        const rolle = await m.findOne(FolienRolle, {
          where: { id: eintrag.folienRolleId, tenantId: user.tenantId },
        });
        if (rolle) {
          await m.increment(
            FolienRolle,
            { id: rolle.id, tenantId: user.tenantId },
            'restLfm',
            menge,
          );
          await m.update(
            FolienRolle,
            { id: rolle.id, tenantId: user.tenantId, status: FolienRolleStatus.AUFGEBRAUCHT },
            { status: FolienRolleStatus.VERFUEGBAR },
          );
        }
      }
      await m.remove(eintrag);
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'OrderMaterial',
      entityId: id,
      payload: { productId: eintrag.productId, menge, folienRolleId: eintrag.folienRolleId ?? null },
    });
    return { success: true };
  }
}
