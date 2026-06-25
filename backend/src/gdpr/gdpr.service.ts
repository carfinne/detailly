import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { basename, resolve, sep } from 'path';
import { promises as fsp } from 'fs';

import { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { VehicleIntake } from '../intake/entities/vehicle-intake.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { DamagePhoto } from '../inspection/entities/damage-photo.entity';
import { DamageItemPhoto } from '../inspection/entities/damage-item-photo.entity';
import { Rental } from '../shop/entities/rental.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

/**
 * DSGVO-Service (Art. 15 Auskunft/Export + Art. 17 Loeschung/Anonymisierung).
 *
 * Leitlinien (siehe Konzept im Modul-Header):
 *  - Tenant-Sicherheit ist absolut: JEDE Query laeuft ueber { tenantId } des
 *    aufrufenden Nutzers; der Customer wird via { id, tenantId } geladen, nie
 *    nur per id. Es sind ausschliesslich Daten DES EIGENEN Betriebs export-/
 *    loeschbar (kein Cross-Tenant-Zugriff, auch nicht fuer super_admin).
 *  - Art. 17 = ANONYMISIEREN statt hartem Loeschen, wo gesetzliche Aufbewahrung
 *    (GoBD/AO/HGB 10 Jahre) oder ein Haftungs-/Beweisinteresse besteht. Der
 *    Customer wird NIE hart geloescht (FK-Integritaet zu Invoice/Order), sondern
 *    seine PII-Spalten werden ueberschrieben + anonymisiertAm gesetzt.
 *  - Physische Foto-Dateien werden NACH dem DB-Commit per fs.unlink entfernt
 *    (fs ist nicht rollback-faehig), strikt innerhalb des Tenant-Ordners.
 */
@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  // Platzhalter fuer anonymisierte PII (Audit-Redaktion + Customer).
  private static readonly REDACTED = '***anonymisiert***';

  constructor(
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private readonly invoiceItemRepo: Repository<InvoiceItem>,
    @InjectRepository(Appointment) private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(VehicleIntake) private readonly intakeRepo: Repository<VehicleIntake>,
    @InjectRepository(DamageInspection) private readonly inspectionRepo: Repository<DamageInspection>,
    @InjectRepository(DamageItem) private readonly damageItemRepo: Repository<DamageItem>,
    @InjectRepository(DamagePhoto) private readonly damagePhotoRepo: Repository<DamagePhoto>,
    @InjectRepository(DamageItemPhoto) private readonly damageItemPhotoRepo: Repository<DamageItemPhoto>,
    @InjectRepository(Rental) private readonly rentalRepo: Repository<Rental>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  // ===========================================================================
  // Art. 15 – Datenauskunft / Export
  // ===========================================================================

  /**
   * Sammelt alle personenbezogenen Daten eines Kunden tenant-scoped in ein
   * strukturiertes JSON. Fotos werden als METADATEN/Pfade ausgegeben (Art. 15
   * verlangt Auskunft, nicht zwingend die Mitlieferung der Binaerdatei; die
   * Bilder sind ueber den guard-geschuetzten Foto-Endpunkt nachladbar).
   */
  async exportCustomerData(user: AuthUser, id: string): Promise<Record<string, unknown>> {
    const tenantId = user.tenantId;
    const kunde = await this.customerRepo.findOne({ where: { id, tenantId } });
    if (!kunde) throw new NotFoundException('Kunde nicht gefunden');

    const [fahrzeuge, auftraege, rechnungen, termine, intakes, inspektionen, vermietungen] =
      await Promise.all([
        this.vehicleRepo.find({ where: { customerId: id, tenantId } }),
        this.orderRepo.find({ where: { customerId: id, tenantId }, relations: ['items'] }),
        this.invoiceRepo.find({ where: { customerId: id, tenantId }, relations: ['items'] }),
        this.appointmentRepo.find({ where: { customerId: id, tenantId } }),
        this.intakeRepo.find({ where: { customerId: id, tenantId } }),
        this.inspectionRepo.find({ where: { customerId: id, tenantId } }),
        this.rentalRepo.find({ where: { customerId: id, tenantId } }),
      ]);

    // Inspektions-Kinder (Schaeden + Fotos) ueber die inspectionIds des Kunden.
    const inspectionIds = inspektionen.map((i) => i.id);
    const [damageItems, damagePhotos] = inspectionIds.length
      ? await Promise.all([
          this.damageItemRepo.find({ where: { inspectionId: In(inspectionIds), tenantId } }),
          this.damagePhotoRepo.find({ where: { inspectionId: In(inspectionIds), tenantId } }),
        ])
      : [[], []];

    const itemsByInspection = new Map<string, DamageItem[]>();
    for (const it of damageItems) {
      const list = itemsByInspection.get(it.inspectionId) ?? [];
      list.push(it);
      itemsByInspection.set(it.inspectionId, list);
    }
    const photosByInspection = new Map<string, DamagePhoto[]>();
    for (const ph of damagePhotos) {
      const list = photosByInspection.get(ph.inspectionId) ?? [];
      list.push(ph);
      photosByInspection.set(ph.inspectionId, list);
    }

    // Kundenbezogene Audit-Logs ueber entityType+entityId (kein customerId-Feld).
    const auditEintraege = await this.collectAuditLogs(tenantId, {
      customerId: id,
      vehicleIds: fahrzeuge.map((v) => v.id),
      orderIds: auftraege.map((o) => o.id),
      invoiceIds: rechnungen.map((r) => r.id),
      appointmentIds: termine.map((t) => t.id),
      intakeIds: intakes.map((t) => t.id),
      inspectionIds,
      damageItemIds: damageItems.map((d) => d.id),
      damagePhotoIds: damagePhotos.map((p) => p.id),
    });

    const result: Record<string, unknown> = {
      exportiertAm: new Date().toISOString(),
      exportiertVon: user.id,
      tenantId,
      hinweis:
        'Auskunft nach Art. 15 DSGVO. Foto-Felder enthalten Pfad-Metadaten; die ' +
        'Bilddateien sind ueber die geschuetzten Foto-Endpunkte abrufbar.',
      kunde,
      fahrzeuge,
      auftraege: auftraege.map((o) => ({
        ...o,
        fotosVorher: o.bilderVorher ?? [],
        fotosNachher: o.bilderNachher ?? [],
      })),
      rechnungen,
      termine,
      intakeProtokolle: intakes,
      inspektionen: inspektionen.map((insp) => ({
        ...insp,
        schaeden: (itemsByInspection.get(insp.id) ?? []).map((d) => ({
          ...d,
        })),
        fotos: (photosByInspection.get(insp.id) ?? []).map((p) => ({
          id: p.id,
          pfad: p.pfad,
          thumbnailPfad: p.thumbnailPfad,
          kategorie: p.kategorie,
        })),
      })),
      vermietungen,
      auditEintraege,
    };

    // Den Export selbst auditieren – payload OHNE PII (nur Zaehler).
    await this.audit.log({
      tenantId,
      userId: user.id,
      action: 'gdpr_export',
      entityType: 'Customer',
      entityId: id,
      payload: {
        fahrzeuge: fahrzeuge.length,
        auftraege: auftraege.length,
        rechnungen: rechnungen.length,
        termine: termine.length,
        intakes: intakes.length,
        inspektionen: inspektionen.length,
        vermietungen: vermietungen.length,
        auditEintraege: auditEintraege.length,
      },
    });

    return result;
  }

  // ===========================================================================
  // Art. 17 – Loeschung / Anonymisierung
  // ===========================================================================

  /**
   * Anonymisiert/loescht alle personenbezogenen Daten eines Kunden tenant-scoped.
   * DB-Teil in EINER Transaktion; physische Fotos werden ERST nach dem Commit
   * geloescht (fs ist nicht rollback-faehig).
   */
  async anonymizeCustomer(
    user: AuthUser,
    id: string,
  ): Promise<{ success: boolean; geloeschteFotos: number; anonymisierteTabellen: number }> {
    const tenantId = user.tenantId;
    const kunde = await this.customerRepo.findOne({ where: { id, tenantId } });
    if (!kunde) throw new NotFoundException('Kunde nicht gefunden');
    // Idempotenz: ein zweiter Lauf darf den bereits eingefrorenen Rechnungs-Snapshot
    // NICHT mit 'Geloescht' ueberschreiben (wuerde den §14-UStG-Beleg zerstoeren).
    if (kunde.anonymisiertAm) {
      return { success: true, geloeschteFotos: 0, anonymisierteTabellen: 0 };
    }

    // Disk-Pfade werden IN der Transaktion gesammelt, aber erst NACH Commit geloescht.
    const inspectionFiles: string[] = []; // private-uploads/inspections/<tenant>/
    const orderFiles: string[] = []; // private-uploads/orders/<tenant>/ (nur Dateinamen)

    const zaehler = await this.dataSource.transaction(async (m) => {
      let anonymisierteTabellen = 0;

      // --- IDs des Kunden tenant-scoped einsammeln ---
      const fahrzeuge = await m.find(Vehicle, { where: { customerId: id, tenantId } });
      const auftraege = await m.find(Order, { where: { customerId: id, tenantId } });
      const rechnungen = await m.find(Invoice, { where: { customerId: id, tenantId } });
      const inspektionen = await m.find(DamageInspection, { where: { customerId: id, tenantId } });
      const inspectionIds = inspektionen.map((i) => i.id);

      const damagePhotos = inspectionIds.length
        ? await m.find(DamagePhoto, { where: { inspectionId: In(inspectionIds), tenantId } })
        : [];
      const damageItems = inspectionIds.length
        ? await m.find(DamageItem, { where: { inspectionId: In(inspectionIds), tenantId } })
        : [];

      // (a) Rechnungen: Empfaenger-SNAPSHOT schreiben (GoBD/§14 UStG) -> Beleg
      // bleibt korrekt, obwohl der Customer gleich anonymisiert wird. Angebote
      // (kein steuerlicher Beleg) werden geloescht, Rechnungen behalten.
      // Rechnungen UND Angebote: Empfaenger-Snapshot einfrieren + PII-Freitext
      // (hinweis) nullen, Zeile BEHALTEN. Angebote werden bewusst NICHT geloescht,
      // sonst entsteht eine Luecke im count-basierten Nummernkreis (GoBD). Der
      // Positionstext (InvoiceItem.beschreibung) bleibt als Teil des unveraenderbaren
      // Belegs erhalten (Art.17 Abs.3 lit.b Aufbewahrungsausnahme) - bewusste Entscheidung.
      for (const rechnung of rechnungen) {
        rechnung.empfaengerName = this.kundenAnzeigeName(kunde);
        rechnung.empfaengerAnschrift = this.kundenAnschrift(kunde);
        rechnung.empfaengerVatNumber = kunde.vatNumber ?? null;
        rechnung.hinweis = null as unknown as string;
        await m.save(Invoice, rechnung);
        anonymisierteTabellen++;
      }

      // (b) Auftraege: Belegfunktion behalten, aber PII-Freitexte + Bilder weg.
      // Foto-Pfade fuer Disk-Loeschung einsammeln.
      for (const order of auftraege) {
        for (const url of order.bilderVorher ?? []) orderFiles.push(url);
        for (const url of order.bilderNachher ?? []) orderFiles.push(url);
        order.internerHinweis = null as unknown as string;
        order.leistungDetails = null as unknown as Order['leistungDetails'];
        order.bilderVorher = [];
        order.bilderNachher = [];
        order.vehicleId = null as unknown as string; // Fahrzeug wird gleich geloescht
        await m.save(Order, order);
        anonymisierteTabellen++;
      }

      // (c) Fahrzeuge: harte Loeschung (licensePlate/vin sind harte Identifikatoren,
      // kein eigener Retention-Zwang). Belege referenzieren keinen FK aufs Fahrzeug
      // (Order.vehicleId wurde oben genullt).
      if (fahrzeuge.length) {
        await m.delete(Vehicle, { customerId: id, tenantId });
        anonymisierteTabellen++;
      }

      // (d) Termine + Annahmeprotokolle: keine Retention -> hart loeschen. IDs
      // vorher einsammeln, damit ihre Audit-Logs redigiert werden koennen.
      const termine = await m.find(Appointment, { where: { customerId: id, tenantId } });
      const intakes = await m.find(VehicleIntake, { where: { customerId: id, tenantId } });
      const appointmentIds = termine.map((t) => t.id);
      const intakeIds = intakes.map((t) => t.id);
      await m.delete(Appointment, { customerId: id, tenantId });
      await m.delete(VehicleIntake, { customerId: id, tenantId });

      // (e) Inspektionen: SPLIT.
      //   - signiert/freigegeben = Haftungsbeweis -> BEHALTEN, Personenbezug raus.
      //   - reine Entwuerfe ohne Unterschrift -> LOESCHEN samt Kindern.
      const behaltenIds: string[] = [];
      const loeschenIds: string[] = [];
      for (const insp of inspektionen) {
        const signiert = !!insp.unterschriftPng || insp.status === 'freigegeben';
        if (signiert) behaltenIds.push(insp.id);
        else loeschenIds.push(insp.id);
      }

      // Fotos der Kunden-Inspektionen werden IMMER entfernt (PII ohne Retention:
      // zeigen Kennzeichen/VIN/Tacho). Pfade fuer Disk-Loeschung sammeln.
      for (const ph of damagePhotos) {
        if (ph.pfad) inspectionFiles.push(ph.pfad);
        if (ph.thumbnailPfad) inspectionFiles.push(ph.thumbnailPfad);
      }
      if (inspectionIds.length) {
        const damageItemIds = damageItems.map((d) => d.id);
        const photoIds = damagePhotos.map((p) => p.id);
        // Join-Zeilen Foto<->Schaden zuerst (sonst verwaisen sie).
        if (damageItemIds.length) {
          await m.delete(DamageItemPhoto, { damageItemId: In(damageItemIds), tenantId });
        }
        if (photoIds.length) {
          await m.delete(DamageItemPhoto, { photoId: In(photoIds), tenantId });
        }
        await m.delete(DamagePhoto, { inspectionId: In(inspectionIds), tenantId });
      }

      // Behaltene (signierte) Inspektionen anonymisieren.
      for (const insp of inspektionen.filter((i) => behaltenIds.includes(i.id))) {
        insp.unterschriftPng = null as unknown as string;
        insp.unterschriebenVonName = 'Anonymisiert';
        insp.consentText = null as unknown as string;
        insp.notiz = null as unknown as string;
        await m.save(DamageInspection, insp);
        anonymisierteTabellen++;
      }
      // Deren Schaeden: notiz/ausmass nullen.
      if (behaltenIds.length) {
        await m
          .createQueryBuilder()
          .update(DamageItem)
          .set({ notiz: null as unknown as string, ausmass: null as unknown as string })
          .where('inspectionId IN (:...ids) AND tenantId = :tenantId', {
            ids: behaltenIds,
            tenantId,
          })
          .execute();
      }
      // Zu loeschende (Entwurf-)Inspektionen samt Schaeden entfernen.
      if (loeschenIds.length) {
        await m.delete(DamageItem, { inspectionId: In(loeschenIds), tenantId });
        await m.delete(DamageInspection, { id: In(loeschenIds), tenantId });
      }

      // (f) Audit-Logs: BEHALTEN (Art. 5 Abs. 2 Rechenschaft), aber PII im payload
      // redigieren – ueber alle relevanten entityType+entityId-Bezuege.
      await this.redactAuditLogs(m, tenantId, {
        customerId: id,
        vehicleIds: fahrzeuge.map((v) => v.id),
        orderIds: auftraege.map((o) => o.id),
        invoiceIds: rechnungen.map((r) => r.id),
        appointmentIds,
        intakeIds,
        inspectionIds,
        damageItemIds: damageItems.map((d) => d.id),
        damagePhotoIds: damagePhotos.map((p) => p.id),
      });

      // (g) Rentals: behalten (customerId not-null; Customer ohnehin anonym).
      //     Keine Aenderung noetig – Personenbezug ist ueber den anonymen Customer.

      // (h) Customer zuletzt: PII-Spalten ueberschreiben + Flag setzen.
      kunde.firstName = 'Geloescht';
      kunde.lastName = 'Geloescht';
      kunde.companyName = null as unknown as string;
      kunde.vatNumber = null as unknown as string;
      kunde.email = null as unknown as string;
      kunde.phone = null as unknown as string;
      kunde.mobile = null as unknown as string;
      kunde.street = null as unknown as string;
      kunde.city = null as unknown as string;
      kunde.postalCode = null as unknown as string;
      kunde.notes = null as unknown as string;
      kunde.sevdeskContactId = null as unknown as string;
      kunde.isActive = false;
      kunde.anonymisiertAm = new Date();
      await m.save(Customer, kunde);
      anonymisierteTabellen++;

      return anonymisierteTabellen;
    });

    // --- NACH erfolgreichem Commit: physische Dateien idempotent loeschen ---
    let geloeschteFotos = 0;
    for (const pfad of inspectionFiles) {
      if (await this.unlinkInspectionFile(tenantId, pfad)) geloeschteFotos++;
    }
    for (const datei of orderFiles) {
      if (await this.unlinkOrderFile(tenantId, datei)) geloeschteFotos++;
    }

    await this.audit.log({
      tenantId,
      userId: user.id,
      action: 'gdpr_anonymize',
      entityType: 'Customer',
      entityId: id,
      payload: { anonymisierteTabellen: zaehler, geloeschteFotos },
    });

    return { success: true, geloeschteFotos, anonymisierteTabellen: zaehler };
  }

  // ===========================================================================
  // Helfer
  // ===========================================================================

  private kundenAnzeigeName(c: Customer): string {
    if (c.companyName) return c.companyName;
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || '–';
  }

  private kundenAnschrift(c: Customer): string {
    const ort = [c.postalCode, c.city].filter(Boolean).join(' ').trim();
    return [c.street, ort, c.country && c.country !== 'DE' ? c.country : '']
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Sammelt kundenbezogene Audit-Logs ueber entityType+entityId (audit_logs hat
   * KEIN customerId-Feld). Tenant-scoped.
   */
  private async collectAuditLogs(
    tenantId: string,
    refs: {
      customerId: string;
      vehicleIds: string[];
      orderIds: string[];
      invoiceIds: string[];
      appointmentIds: string[];
      intakeIds: string[];
      inspectionIds: string[];
      damageItemIds: string[];
      damagePhotoIds: string[];
    },
  ): Promise<AuditLog[]> {
    const paare: Array<{ entityType: string; ids: string[] }> = [
      { entityType: 'Customer', ids: [refs.customerId] },
      { entityType: 'Vehicle', ids: refs.vehicleIds },
      { entityType: 'Order', ids: refs.orderIds },
      { entityType: 'Invoice', ids: refs.invoiceIds },
      { entityType: 'Appointment', ids: refs.appointmentIds },
      { entityType: 'VehicleIntake', ids: refs.intakeIds },
      { entityType: 'DamageInspection', ids: refs.inspectionIds },
      { entityType: 'Inspection', ids: refs.inspectionIds },
      { entityType: 'DamageItem', ids: refs.damageItemIds },
      { entityType: 'DamagePhoto', ids: refs.damagePhotoIds },
    ];
    const out: AuditLog[] = [];
    for (const { entityType, ids } of paare) {
      const gueltige = ids.filter(Boolean);
      if (!gueltige.length) continue;
      const logs = await this.auditRepo.find({
        where: { tenantId, entityType, entityId: In(gueltige) },
      });
      out.push(...logs);
    }
    return out;
  }

  /**
   * Redigiert PII in den payloads kundenbezogener Audit-Logs (innerhalb der
   * Transaktion). Gezielt nur bekannte PII-Schluessel ersetzen, der Rest des
   * Audit-Trails bleibt erhalten (Rechenschaftspflicht).
   */
  private async redactAuditLogs(
    m: EntityManager,
    tenantId: string,
    refs: {
      customerId: string;
      vehicleIds: string[];
      orderIds: string[];
      invoiceIds: string[];
      appointmentIds: string[];
      intakeIds: string[];
      inspectionIds: string[];
      damageItemIds: string[];
      damagePhotoIds: string[];
    },
  ): Promise<void> {
    const paare: Array<{ entityType: string; ids: string[] }> = [
      { entityType: 'Customer', ids: [refs.customerId] },
      { entityType: 'Vehicle', ids: refs.vehicleIds },
      { entityType: 'Order', ids: refs.orderIds },
      { entityType: 'Invoice', ids: refs.invoiceIds },
      { entityType: 'Appointment', ids: refs.appointmentIds },
      { entityType: 'VehicleIntake', ids: refs.intakeIds },
      { entityType: 'DamageInspection', ids: refs.inspectionIds },
      { entityType: 'Inspection', ids: refs.inspectionIds },
      { entityType: 'DamageItem', ids: refs.damageItemIds },
      { entityType: 'DamagePhoto', ids: refs.damagePhotoIds },
    ];

    for (const { entityType, ids } of paare) {
      const gueltige = ids.filter(Boolean);
      if (!gueltige.length) continue;
      const logs = await m.find(AuditLog, {
        where: { tenantId, entityType, entityId: In(gueltige) },
      });
      for (const log of logs) {
        // Payload komplett durch einen neutralen Marker ersetzen: entfernt JEDE
        // (auch verschachtelte/unbekannte) PII restlos. Die Audit-SPALTEN (action,
        // entityType, entityId, userId, createdAt) bleiben erhalten -> die
        // Rechenschaftspflicht (Art. 5 Abs. 2 DSGVO) ist ueber den WER/WAS/WANN-Trail
        // weiter erfuellt, nur die personenbezogene Detail-Payload ist weg.
        if (log.payload == null) continue;
        log.payload = { anonymisiert: true };
        await m.save(AuditLog, log);
      }
    }
  }

  /**
   * Loescht eine Inspektions-Foto-Datei STRENG innerhalb von
   * private-uploads/inspections/<tenantId>/ (basename-Resolve + Praefix-Check,
   * spiegelt resolveTenantFile aus inspection-photo.controller.ts). Idempotent
   * (ENOENT toleriert). Liefert true bei erfolgreicher Loeschung.
   */
  private async unlinkInspectionFile(tenantId: string, gespeicherterPfad: string): Promise<boolean> {
    if (!gespeicherterPfad) return false;
    const tenantDir = resolve(process.cwd(), 'private-uploads', 'inspections', tenantId);
    const dateiname = basename(gespeicherterPfad);
    const kandidat = resolve(tenantDir, dateiname);
    if (kandidat !== tenantDir && !kandidat.startsWith(tenantDir + sep)) return false;
    try {
      await fsp.unlink(kandidat);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Foto-Loeschung fehlgeschlagen (${dateiname}): ${(err as Error).message}`);
      }
      return false;
    }
  }

  /**
   * Loescht eine Auftrags-Foto-Datei STRENG innerhalb von
   * private-uploads/orders/<tenantId>/ (basename + Praefix-Check, spiegelt
   * resolveTenantFile aus order-photo.controller.ts). Idempotent.
   */
  private async unlinkOrderFile(tenantId: string, gespeicherterPfad: string): Promise<boolean> {
    if (!gespeicherterPfad) return false;
    const tenantDir = resolve(process.cwd(), 'private-uploads', 'orders', tenantId);
    const dateiname = basename(gespeicherterPfad);
    const kandidat = resolve(tenantDir, dateiname);
    if (kandidat !== tenantDir && !kandidat.startsWith(tenantDir + sep)) return false;
    try {
      await fsp.unlink(kandidat);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Foto-Loeschung fehlgeschlagen (${dateiname}): ${(err as Error).message}`);
      }
      return false;
    }
  }
}
