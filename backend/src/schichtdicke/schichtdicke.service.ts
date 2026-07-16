import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LayerMeasurement } from './entities/layer-measurement.entity';
import { LayerMeasurementPoint, LayerReading } from './entities/layer-measurement-point.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CreateLayerMeasurementDto } from './dto/create-layer-measurement.dto';
import { UpdateLayerMeasurementDto } from './dto/update-layer-measurement.dto';
import { CreateLayerPointDto, UpdateLayerPointDto } from './dto/layer-point.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  assertRefInTenant,
  findOneScoped,
  scopedQuery,
  withTenant,
} from '../common/tenant/tenant-scope';
import {
  AmpelStatus,
  BauteilStatistik,
  bauteilStatistik,
  bewerteBauteil,
  DEFAULT_NORM_PROFILE_KEY,
  istAuffaellig,
  NORM_PROFILE,
  SchichtPunkt,
} from './layer-norm-profiles';

/** Filter fuer die Protokoll-Liste. */
export interface LayerMeasurementListFilter {
  orderId?: string;
  vehicleId?: string;
  status?: string;
}

/** Pro-Bauteil aggregierte Auswertung (fuer UI + PDF). */
export interface BauteilAuswertung {
  partId: string;
  partLabel: string | null;
  statistik: BauteilStatistik | null;
  status: AmpelStatus;
  auffaellig: boolean;
}

/** Protokoll inkl. Punkte + abgeleiteter Auswertung. */
export interface LayerMeasurementDetail extends LayerMeasurement {
  points: LayerMeasurementPoint[];
  auswertung: BauteilAuswertung[];
  auffaelligeBauteile: number;
}

@Injectable()
export class SchichtdickeService {
  constructor(
    @InjectRepository(LayerMeasurement)
    private readonly measurementRepo: Repository<LayerMeasurement>,
    @InjectRepository(LayerMeasurementPoint)
    private readonly pointRepo: Repository<LayerMeasurementPoint>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Protokolle
  // ---------------------------------------------------------------------------

  async findAll(
    user: AuthUser,
    filter: LayerMeasurementListFilter = {},
  ): Promise<LayerMeasurement[]> {
    const qb = scopedQuery(this.measurementRepo, user, 'm');
    if (filter.orderId) qb.andWhere('m.orderId = :orderId', { orderId: filter.orderId });
    if (filter.vehicleId) qb.andWhere('m.vehicleId = :vehicleId', { vehicleId: filter.vehicleId });
    if (filter.status) qb.andWhere('m.status = :status', { status: filter.status });
    return qb.orderBy('m.createdAt', 'DESC').getMany();
  }

  /** Einzelnes Protokoll inkl. Punkte + abgeleiteter Bauteil-Auswertung. */
  async findOne(user: AuthUser, id: string): Promise<LayerMeasurementDetail> {
    const measurement = await findOneScoped(
      this.measurementRepo,
      user,
      id,
      'Messprotokoll nicht gefunden',
    );
    const points = await this.pointRepo.find({
      where: { tenantId: user.tenantId, measurementId: id },
      order: { createdAt: 'ASC' },
    });
    const auswertung = this.auswerten(points, measurement.normProfileKey);
    return {
      ...measurement,
      points,
      auswertung,
      auffaelligeBauteile: auswertung.filter((a) => a.auffaellig).length,
    };
  }

  async create(user: AuthUser, dto: CreateLayerMeasurementDto): Promise<LayerMeasurement> {
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
    // inspectionId gegen das Schadens-Repo pruefen? Wir haben es hier nicht
    // injiziert (loses Kopplungsziel) – daher nur als lose Referenz gespeichert,
    // NICHT als FK ausgewertet. Sie wird nie als tenant-Grenze genutzt.

    // Idempotenz ausschliesslich ueber tenant-scoped clientUuid (dto.id nie als PK).
    if (dto.clientUuid) {
      const vorhanden = await this.measurementRepo.findOne({
        where: { tenantId: user.tenantId, clientUuid: dto.clientUuid },
      });
      if (vorhanden) return vorhanden;
    }

    const normProfileKey =
      dto.normProfileKey && NORM_PROFILE[dto.normProfileKey]
        ? dto.normProfileKey
        : DEFAULT_NORM_PROFILE_KEY;

    const measurement = this.measurementRepo.create(
      withTenant(user, {
        customerId: dto.customerId,
        vehicleId: dto.vehicleId,
        orderId: dto.orderId,
        inspectionId: dto.inspectionId,
        modelKey: dto.modelKey,
        anlass: dto.anlass ?? 'ankauf',
        normProfileKey,
        messgeraet: dto.messgeraet,
        notiz: dto.notiz,
        erfasstVonUserId: user.id,
        erfasstVonRolle: user.role,
        clientUuid: dto.clientUuid,
      }),
    );
    const saved = await this.measurementRepo.save(measurement);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'LayerMeasurement',
      entityId: saved.id,
      payload: { anlass: saved.anlass },
    });
    return saved;
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateLayerMeasurementDto,
  ): Promise<LayerMeasurement> {
    const measurement = await findOneScoped(
      this.measurementRepo,
      user,
      id,
      'Messprotokoll nicht gefunden',
    );
    this.assertNichtGesperrt(measurement);
    // 'freigegeben' ist in Welle 1 (ohne Signatur-Endpunkt) nicht erreichbar.
    if (dto.status === 'freigegeben') {
      throw new BadRequestException("Status 'freigegeben' ist in Welle 1 nicht verfügbar.");
    }
    if (dto.vehicleId !== undefined) {
      await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');
      measurement.vehicleId = dto.vehicleId;
    }
    if (dto.orderId !== undefined) {
      await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
      measurement.orderId = dto.orderId;
    }
    if (dto.anlass !== undefined) measurement.anlass = dto.anlass;
    if (dto.status !== undefined) measurement.status = dto.status;
    if (dto.messgeraet !== undefined) measurement.messgeraet = dto.messgeraet;
    if (dto.notiz !== undefined) measurement.notiz = dto.notiz;
    if (dto.modelKey !== undefined) measurement.modelKey = dto.modelKey;
    if (dto.normProfileKey !== undefined && NORM_PROFILE[dto.normProfileKey]) {
      measurement.normProfileKey = dto.normProfileKey;
    }

    const saved = await this.measurementRepo.save(measurement);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'LayerMeasurement',
      entityId: saved.id,
      payload: dto as Record<string, unknown>,
    });
    return saved;
  }

  async remove(user: AuthUser, id: string): Promise<{ deleted: true }> {
    const measurement = await findOneScoped(
      this.measurementRepo,
      user,
      id,
      'Messprotokoll nicht gefunden',
    );
    this.assertNichtGesperrt(measurement);
    // Punkte tenant-scoped mitloeschen (kein DB-Cascade auf String-FK).
    await this.pointRepo.delete({ tenantId: user.tenantId, measurementId: measurement.id });
    await this.measurementRepo.delete({ tenantId: user.tenantId, id: measurement.id });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'LayerMeasurement',
      entityId: id,
    });
    return { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Messpunkte
  // ---------------------------------------------------------------------------

  async createPoint(
    user: AuthUser,
    measurementId: string,
    dto: CreateLayerPointDto,
  ): Promise<LayerMeasurementPoint> {
    const measurement = await findOneScoped(
      this.measurementRepo,
      user,
      measurementId,
      'Messprotokoll nicht gefunden',
    );
    this.assertNichtGesperrt(measurement);

    if (dto.clientUuid) {
      const vorhanden = await this.pointRepo.findOne({
        where: { tenantId: user.tenantId, clientUuid: dto.clientUuid },
      });
      if (vorhanden) return vorhanden;
    }

    const point = this.pointRepo.create(
      withTenant(user, {
        measurementId: measurement.id,
        partId: dto.partId,
        partLabel: dto.partLabel,
        punktTyp: dto.punktTyp ?? 'frei',
        standardKey: dto.standardKey,
        label: dto.label,
        positionMode: dto.positionMode,
        position3d: dto.position3d ?? null,
        ansicht2d: dto.ansicht2d,
        x2d: dto.x2d,
        y2d: dto.y2d,
        readings: this.normalizeReadings(dto.readings),
        reihenfolge: dto.reihenfolge,
        clientUuid: dto.clientUuid,
      }),
    );
    return this.pointRepo.save(point);
  }

  async updatePoint(
    user: AuthUser,
    measurementId: string,
    pointId: string,
    dto: UpdateLayerPointDto,
  ): Promise<LayerMeasurementPoint> {
    const measurement = await findOneScoped(
      this.measurementRepo,
      user,
      measurementId,
      'Messprotokoll nicht gefunden',
    );
    this.assertNichtGesperrt(measurement);
    const point = await this.pointRepo.findOne({
      where: { id: pointId, tenantId: user.tenantId, measurementId: measurement.id },
    });
    if (!point) throw new NotFoundException('Messpunkt nicht gefunden');

    if (dto.label !== undefined) point.label = dto.label;
    if (dto.reihenfolge !== undefined) point.reihenfolge = dto.reihenfolge;
    // readings ERSETZT die Liste (der Client fuehrt die vollstaendige Messreihe).
    if (dto.readings !== undefined) point.readings = this.normalizeReadings(dto.readings);

    return this.pointRepo.save(point);
  }

  async removePoint(
    user: AuthUser,
    measurementId: string,
    pointId: string,
  ): Promise<{ deleted: true }> {
    const measurement = await findOneScoped(
      this.measurementRepo,
      user,
      measurementId,
      'Messprotokoll nicht gefunden',
    );
    this.assertNichtGesperrt(measurement);
    const res = await this.pointRepo.delete({
      id: pointId,
      tenantId: user.tenantId,
      measurementId: measurement.id,
    });
    if (!res.affected) throw new NotFoundException('Messpunkt nicht gefunden');
    return { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // PDF-Kontext (Service laedt tenant-scoped; der PDF-Builder ist rein)
  // ---------------------------------------------------------------------------

  async getReportContext(
    user: AuthUser,
    id: string,
  ): Promise<{
    measurement: LayerMeasurement;
    points: LayerMeasurementPoint[];
    auswertung: BauteilAuswertung[];
    customer: Customer | null;
    vehicle: Vehicle | null;
    tenant: Tenant | null;
  }> {
    const detail = await this.findOne(user, id);
    const [customer, vehicle, tenant] = await Promise.all([
      this.customerRepo.findOne({ where: { id: detail.customerId, tenantId: user.tenantId } }),
      detail.vehicleId
        ? this.vehicleRepo.findOne({ where: { id: detail.vehicleId, tenantId: user.tenantId } })
        : Promise.resolve(null),
      this.tenantRepo.findOne({ where: { id: user.tenantId } }),
    ]);
    return {
      measurement: detail,
      points: detail.points,
      auswertung: detail.auswertung,
      customer,
      vehicle,
      tenant,
    };
  }

  // ---------------------------------------------------------------------------
  // Ableitungen
  // ---------------------------------------------------------------------------

  /**
   * Gruppiert die Punkte nach Bauteil und berechnet je Bauteil Statistik +
   * Ampel-Status. Reihenfolge = Erst-Auftreten der Bauteile in den Punkten.
   */
  private auswerten(
    points: LayerMeasurementPoint[],
    normProfileKey?: string | null,
  ): BauteilAuswertung[] {
    const gruppen = new Map<string, { label: string | null; punkte: SchichtPunkt[] }>();
    for (const p of points) {
      const key = p.partId;
      const g = gruppen.get(key) ?? { label: p.partLabel ?? null, punkte: [] };
      if (!g.label && p.partLabel) g.label = p.partLabel;
      g.punkte.push({ partId: p.partId, readings: (p.readings ?? []) as LayerReading[] });
      gruppen.set(key, g);
    }
    const result: BauteilAuswertung[] = [];
    for (const [partId, g] of gruppen) {
      const statistik = bauteilStatistik(g.punkte);
      const status = bewerteBauteil(partId, statistik?.repraesentativUm ?? null, normProfileKey);
      result.push({
        partId,
        partLabel: g.label,
        statistik,
        status,
        auffaellig: istAuffaellig(status),
      });
    }
    return result;
  }

  /** Filtert/normalisiert Messwerte (nur endliche, >= 0), Zeitstempel bleibt. */
  private normalizeReadings(readings?: { wertUm: number; erfasstAm?: string }[]): LayerReading[] {
    return (readings ?? [])
      .filter((r) => typeof r?.wertUm === 'number' && Number.isFinite(r.wertUm) && r.wertUm >= 0)
      .map((r) => ({ wertUm: r.wertUm, erfasstAm: r.erfasstAm }));
  }

  /**
   * Sperr-Guard: ein freigegebenes/unterschriebenes Protokoll ist read-only.
   * (Welle 1 kennt noch keinen Signatur-Endpunkt; der Guard ist bereits scharf,
   * damit Welle 2 nur die Freigabe ergaenzen muss.)
   */
  private assertNichtGesperrt(m: LayerMeasurement): void {
    if (m.unterschriftPng || m.status === 'freigegeben') {
      throw new BadRequestException('Das Messprotokoll ist freigegeben und nicht mehr änderbar.');
    }
  }
}
