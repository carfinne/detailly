import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DellenKalkulation } from './entities/dellen-kalkulation.entity';
import { DellenMarker } from './entities/dellen-marker.entity';
import { DellenPreismatrix } from './entities/dellen-preismatrix.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { CreateDellenKalkulationDto } from './dto/create-dellen-kalkulation.dto';
import { UpdateDellenKalkulationDto } from './dto/update-dellen-kalkulation.dto';
import { DellenMarkerDto, SetDellenMarkerDto } from './dto/dellen-marker.dto';
import { SetDellenPreismatrixDto } from './dto/dellen-preismatrix.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { clampPageQuery, PaginatedResult } from '../common/util/pagination';
import {
  assertRefInTenant,
  findOneScoped,
  scopedQuery,
  withTenant,
} from '../common/tenant/tenant-scope';
import {
  berechneGesamt,
  DellenMarkerBerechnung,
  DellenModus,
  DellenPreismatrixWerte,
  DEFAULT_DELLEN_PREISMATRIX,
  normalisiereMatrix,
} from './dellen-preis.util';

/** Filter der Kalkulations-Liste. */
export interface DellenListFilter {
  vehicleId?: string;
  status?: string;
  modus?: string;
  page?: number;
  limit?: number;
}

/** Kalkulation inkl. Marker (Detail-Antwort). */
export interface DellenKalkulationDetail extends DellenKalkulation {
  marker: DellenMarker[];
}

/** Effektive Preismatrix (numerisch) + Herkunfts-Flag fuer die UI. */
export interface DellenPreismatrixAntwort extends DellenPreismatrixWerte {
  /** true = es existiert (noch) keine betriebs-eigene Matrix, es gelten Defaults. */
  istDefault: boolean;
}

/** Marker-Cap je Kalkulation (DoS-/Plausibilitaets-Grenze). */
const MAX_MARKER = 500;

@Injectable()
export class DellenkalkulationService {
  constructor(
    @InjectRepository(DellenKalkulation)
    private readonly kalkRepo: Repository<DellenKalkulation>,
    @InjectRepository(DellenMarker)
    private readonly markerRepo: Repository<DellenMarker>,
    @InjectRepository(DellenPreismatrix)
    private readonly matrixRepo: Repository<DellenPreismatrix>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Kalkulationen
  // ---------------------------------------------------------------------------

  async findAll(
    user: AuthUser,
    filter: DellenListFilter = {},
  ): Promise<PaginatedResult<DellenKalkulation>> {
    const { page, limit, skip, take } = clampPageQuery(filter);
    const qb = scopedQuery(this.kalkRepo, user, 'k');
    if (filter.vehicleId) qb.andWhere('k.vehicleId = :vehicleId', { vehicleId: filter.vehicleId });
    if (filter.status) qb.andWhere('k.status = :status', { status: filter.status });
    if (filter.modus) qb.andWhere('k.modus = :modus', { modus: filter.modus });
    const [data, total] = await qb
      .orderBy('k.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return { data, total, page, limit };
  }

  /** Einzelne Kalkulation inkl. Marker (tenant-scoped). */
  async findOne(user: AuthUser, id: string): Promise<DellenKalkulationDetail> {
    const kalk = await findOneScoped(this.kalkRepo, user, id, 'Kalkulation nicht gefunden');
    const marker = await this.ladeMarker(user, id);
    return { ...kalk, marker };
  }

  async create(user: AuthUser, dto: CreateDellenKalkulationDto): Promise<DellenKalkulation> {
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');

    // Idempotenz ausschliesslich ueber tenant-scoped clientUuid (dto.id nie als PK).
    if (dto.clientUuid) {
      const vorhanden = await this.kalkRepo.findOne({
        where: { tenantId: user.tenantId, clientUuid: dto.clientUuid },
      });
      if (vorhanden) return vorhanden;
    }

    const kalk = this.kalkRepo.create(
      withTenant(user, {
        customerId: dto.customerId,
        vehicleId: dto.vehicleId,
        modelKey: dto.modelKey,
        modus: dto.modus,
        status: 'entwurf' as const,
        gesamtpreis: '0',
        notiz: dto.notiz,
        erstelltVonUserId: user.id,
        erstelltVonRolle: user.role,
        clientUuid: dto.clientUuid,
      }),
    );
    const saved = await this.kalkRepo.save(kalk);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'DellenKalkulation',
      entityId: saved.id,
      payload: { modus: saved.modus },
    });
    return saved;
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateDellenKalkulationDto,
  ): Promise<DellenKalkulationDetail> {
    const kalk = await findOneScoped(this.kalkRepo, user, id, 'Kalkulation nicht gefunden');
    this.assertNichtFinal(kalk);

    if (dto.customerId !== undefined) {
      await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
      kalk.customerId = dto.customerId;
    }
    if (dto.vehicleId !== undefined) {
      await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');
      kalk.vehicleId = dto.vehicleId;
    }
    if (dto.modelKey !== undefined) kalk.modelKey = dto.modelKey;
    if (dto.notiz !== undefined) kalk.notiz = dto.notiz;

    const modusGewechselt = dto.modus !== undefined && dto.modus !== kalk.modus;
    if (dto.modus !== undefined) kalk.modus = dto.modus;

    await this.kalkRepo.save(kalk);

    // Modus-Wechsel bepreist die bestehenden Marker neu (Einzel <-> Hagel).
    if (modusGewechselt) {
      return this.neuBerechnen(user, id);
    }
    const marker = await this.ladeMarker(user, id);
    return { ...kalk, marker };
  }

  async remove(user: AuthUser, id: string): Promise<{ deleted: true }> {
    const kalk = await findOneScoped(this.kalkRepo, user, id, 'Kalkulation nicht gefunden');
    this.assertNichtFinal(kalk);
    // Marker tenant-scoped mitloeschen (kein DB-Cascade auf String-FK).
    await this.markerRepo.delete({ tenantId: user.tenantId, kalkulationId: kalk.id });
    await this.kalkRepo.delete({ tenantId: user.tenantId, id: kalk.id });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'DellenKalkulation',
      entityId: id,
    });
    return { deleted: true };
  }

  /** Finalisiert die Kalkulation (danach read-only). */
  async finalisieren(user: AuthUser, id: string): Promise<DellenKalkulationDetail> {
    const kalk = await findOneScoped(this.kalkRepo, user, id, 'Kalkulation nicht gefunden');
    if (kalk.status === 'final') {
      const marker = await this.ladeMarker(user, id);
      return { ...kalk, marker };
    }
    // Vor dem Sperren den Preis final gegen die aktuelle Matrix rechnen.
    const detail = await this.neuBerechnen(user, id);
    detail.status = 'final';
    detail.finalisiertAm = new Date();
    await this.kalkRepo.update(
      { tenantId: user.tenantId, id },
      { status: 'final', finalisiertAm: detail.finalisiertAm },
    );
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'finalize',
      entityType: 'DellenKalkulation',
      entityId: id,
      payload: { gesamtpreis: detail.gesamtpreis },
    });
    return detail;
  }

  // ---------------------------------------------------------------------------
  // Marker (Batch)
  // ---------------------------------------------------------------------------

  /**
   * Ersetzt ALLE Marker der Kalkulation in EINEM Request. Die Einzelpreise werden
   * IMMER serverseitig aus der Tenant-Matrix berechnet (ein vom Client gesendeter
   * Preis ist wirkungslos). Anschliessend wird der Gesamtpreis neu gesetzt.
   */
  async setMarker(
    user: AuthUser,
    id: string,
    dto: SetDellenMarkerDto,
  ): Promise<DellenKalkulationDetail> {
    const kalk = await findOneScoped(this.kalkRepo, user, id, 'Kalkulation nicht gefunden');
    this.assertNichtFinal(kalk);

    const eingehend = dto.markers ?? [];
    if (eingehend.length > MAX_MARKER) {
      throw new BadRequestException(`Maximal ${MAX_MARKER} Marker je Kalkulation.`);
    }

    const matrix = await this.effektiveMatrix(user);
    const { markerPreise, gesamtpreis } = berechneGesamt(
      matrix,
      kalk.modus,
      eingehend.map((m) => this.toBerechnung(m)),
    );

    // Komplett ersetzen: alte Marker tenant-scoped loeschen, neue anlegen.
    await this.markerRepo.delete({ tenantId: user.tenantId, kalkulationId: kalk.id });
    if (eingehend.length > 0) {
      const neu = eingehend.map((m, i) =>
        this.markerRepo.create(
          withTenant(user, {
            kalkulationId: kalk.id,
            bauteil: m.bauteil,
            bauteilLabel: m.bauteilLabel,
            positionMode: m.positionMode,
            position3d: m.position3d ?? null,
            ansicht2d: m.ansicht2d,
            x2d: m.x2d,
            y2d: m.y2d,
            groessenklasse: m.groessenklasse,
            kante: !!m.kante,
            alu: !!m.alu,
            lackschaden: !!m.lackschaden,
            dellenAnzahl: m.dellenAnzahl,
            // Preis IMMER serverseitig – nie aus dem Client-Body.
            einzelpreis: markerPreise[i].toFixed(2),
            reihenfolge: m.reihenfolge ?? i,
            clientUuid: m.clientUuid,
          }),
        ),
      );
      await this.markerRepo.save(neu);
    }

    kalk.gesamtpreis = gesamtpreis.toFixed(2);
    await this.kalkRepo.save(kalk);

    const marker = await this.ladeMarker(user, id);
    return { ...kalk, marker };
  }

  /**
   * Berechnet den Preis der Kalkulation aus den GESPEICHERTEN Markern + der
   * aktuellen Tenant-Matrix neu (z.B. nach Matrix-Aenderung oder Modus-Wechsel)
   * und persistiert Einzel-/Gesamtpreise.
   */
  async neuBerechnen(user: AuthUser, id: string): Promise<DellenKalkulationDetail> {
    const kalk = await findOneScoped(this.kalkRepo, user, id, 'Kalkulation nicht gefunden');
    this.assertNichtFinal(kalk);
    const marker = await this.ladeMarker(user, id);
    const matrix = await this.effektiveMatrix(user);
    const { markerPreise, gesamtpreis } = berechneGesamt(
      matrix,
      kalk.modus,
      marker.map((m) => this.toBerechnung(m)),
    );
    // Einzelpreise je Marker aktualisieren (nur bei Aenderung schreiben).
    for (let i = 0; i < marker.length; i++) {
      const neu = markerPreise[i].toFixed(2);
      if (marker[i].einzelpreis !== neu) {
        marker[i].einzelpreis = neu;
        await this.markerRepo.update(
          { tenantId: user.tenantId, id: marker[i].id },
          { einzelpreis: neu },
        );
      }
    }
    kalk.gesamtpreis = gesamtpreis.toFixed(2);
    await this.kalkRepo.save(kalk);
    return { ...kalk, marker };
  }

  // ---------------------------------------------------------------------------
  // Preismatrix (tenant-scoped, konfigurierbar)
  // ---------------------------------------------------------------------------

  /** Liefert die effektive Matrix (persistiert oder Default) + Herkunfts-Flag. */
  async getMatrix(user: AuthUser): Promise<DellenPreismatrixAntwort> {
    const row = await this.matrixRepo.findOne({ where: { tenantId: user.tenantId } });
    if (!row) return { ...DEFAULT_DELLEN_PREISMATRIX, istDefault: true };
    return { ...this.rowToWerte(row), istDefault: false };
  }

  /** Setzt (Upsert) die betriebs-eigene Matrix. */
  async setMatrix(user: AuthUser, dto: SetDellenPreismatrixDto): Promise<DellenPreismatrixAntwort> {
    const werte = normalisiereMatrix({
      basispreise: {
        '1euro': dto.basis1Euro,
        '2euro': dto.basis2Euro,
        '5euro': dto.basis5Euro,
        golfball: dto.basisGolfball,
        groesser: dto.basisGroesser,
      },
      kantenFaktor: dto.kantenFaktor,
      aluFaktor: dto.aluFaktor,
      lackschadenAufschlag: dto.lackschadenAufschlag,
      mindestpauschale: dto.mindestpauschale,
      anfahrtspauschale: dto.anfahrtspauschale,
      hagelStaffel: (dto.hagelStaffel ?? []).map((s) => ({
        maxDellen: s.maxDellen === undefined ? null : s.maxDellen,
        pauschale: s.pauschale,
      })),
    });

    let row = await this.matrixRepo.findOne({ where: { tenantId: user.tenantId } });
    if (!row) row = this.matrixRepo.create(withTenant(user, {}) as DellenPreismatrix);
    this.werteInRow(werte, row);
    const saved = await this.matrixRepo.save(row);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'DellenPreismatrix',
      entityId: saved.id,
    });
    return { ...werte, istDefault: false };
  }

  // ---------------------------------------------------------------------------
  // Intern
  // ---------------------------------------------------------------------------

  private async ladeMarker(user: AuthUser, kalkulationId: string): Promise<DellenMarker[]> {
    return this.markerRepo.find({
      where: { tenantId: user.tenantId, kalkulationId },
      order: { reihenfolge: 'ASC', createdAt: 'ASC' },
    });
  }

  private async effektiveMatrix(user: AuthUser): Promise<DellenPreismatrixWerte> {
    const row = await this.matrixRepo.findOne({ where: { tenantId: user.tenantId } });
    return row ? this.rowToWerte(row) : DEFAULT_DELLEN_PREISMATRIX;
  }

  /** Abbildung eines Markers (DTO/Entity) auf die Preis-Eingaben. */
  private toBerechnung(m: DellenMarkerDto | DellenMarker): DellenMarkerBerechnung {
    return {
      groessenklasse: m.groessenklasse ?? null,
      kante: !!m.kante,
      alu: !!m.alu,
      lackschaden: !!m.lackschaden,
      dellenAnzahl: m.dellenAnzahl ?? null,
    };
  }

  /** decimal-Spalten (Strings) -> reine Zahlen (fuer die Engine), inkl. Normalisierung. */
  private rowToWerte(row: DellenPreismatrix): DellenPreismatrixWerte {
    return normalisiereMatrix({
      basispreise: {
        '1euro': Number(row.basis1Euro),
        '2euro': Number(row.basis2Euro),
        '5euro': Number(row.basis5Euro),
        golfball: Number(row.basisGolfball),
        groesser: Number(row.basisGroesser),
      },
      kantenFaktor: Number(row.kantenFaktor),
      aluFaktor: Number(row.aluFaktor),
      lackschadenAufschlag: Number(row.lackschadenAufschlag),
      mindestpauschale: Number(row.mindestpauschale),
      anfahrtspauschale: Number(row.anfahrtspauschale),
      hagelStaffel: Array.isArray(row.hagelStaffel)
        ? row.hagelStaffel
        : DEFAULT_DELLEN_PREISMATRIX.hagelStaffel,
    });
  }

  /** Zahlen -> decimal-Strings/JSON auf der Entity. */
  private werteInRow(werte: DellenPreismatrixWerte, row: DellenPreismatrix): void {
    row.basis1Euro = werte.basispreise['1euro'].toFixed(2);
    row.basis2Euro = werte.basispreise['2euro'].toFixed(2);
    row.basis5Euro = werte.basispreise['5euro'].toFixed(2);
    row.basisGolfball = werte.basispreise.golfball.toFixed(2);
    row.basisGroesser = werte.basispreise.groesser.toFixed(2);
    row.kantenFaktor = werte.kantenFaktor.toFixed(3);
    row.aluFaktor = werte.aluFaktor.toFixed(3);
    row.lackschadenAufschlag = werte.lackschadenAufschlag.toFixed(2);
    row.mindestpauschale = werte.mindestpauschale.toFixed(2);
    row.anfahrtspauschale = werte.anfahrtspauschale.toFixed(2);
    row.hagelStaffel = werte.hagelStaffel;
  }

  private assertNichtFinal(kalk: DellenKalkulation): void {
    if (kalk.status === 'final') {
      throw new BadRequestException('Die Kalkulation ist finalisiert und nicht mehr änderbar.');
    }
  }
}
