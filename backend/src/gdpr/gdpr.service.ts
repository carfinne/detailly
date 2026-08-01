import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { basename } from 'path';
import { storage } from '../common/storage';

import { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderFeedback } from '../orders/entities/order-feedback.entity';
import { Invoice, InvoiceKind } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { DamagePhoto } from '../inspection/entities/damage-photo.entity';
import { DamageItemPhoto } from '../inspection/entities/damage-item-photo.entity';
import { Rental } from '../shop/entities/rental.entity';
import { OrderTime } from '../zeiterfassung/entities/order-time.entity';
import { OrderMaterial } from '../order-material/entities/order-material.entity';
import { BookingRequest } from '../public-booking/entities/booking-request.entity';
import { LayerMeasurement } from '../schichtdicke/entities/layer-measurement.entity';
import { LayerMeasurementPoint } from '../schichtdicke/entities/layer-measurement-point.entity';
import { DellenKalkulation } from '../dellenkalkulation/entities/dellen-kalkulation.entity';
import { DellenMarker } from '../dellenkalkulation/entities/dellen-marker.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

/** Ergebnis der Loesch-Entscheidung (Anonymisieren vs. Hart-Loeschen). */
export type LoeschModus = 'anonymisiert' | 'geloescht';

/** Zaehler der aufbewahrungspflichtigen Belege eines Kunden (Entscheidungsgrundlage). */
export interface AufbewahrungsInfo {
  /** true, sobald mind. ein Kriterium eine Aufbewahrung erzwingt (-> anonymisieren). */
  pflicht: boolean;
  /** Rechnungen mit vergebener Belegnummer (§14 UStG/§147 AO). */
  rechnungen: number;
  /** Angebote mit vergebener Belegnummer (GoBD-Nummernkreis-Luecke). */
  angebote: number;
  /** Auftraege im Status 'abgerechnet' (Buchungszusammenhang). */
  abgerechneteAuftraege: number;
  /** Signierte/freigegebene Uebergabe-Protokolle (Haftungsbeweis). */
  signierteProtokolle: number;
}

/**
 * DSGVO-Service (Art. 15 Auskunft/Export + Art. 17 Loeschung/Anonymisierung).
 *
 * Leitlinien (siehe Konzept im Modul-Header):
 *  - Tenant-Sicherheit ist absolut: JEDE Query laeuft ueber { tenantId } des
 *    aufrufenden Nutzers; der Customer wird via { id, tenantId } geladen, nie
 *    nur per id. Es sind ausschliesslich Daten DES EIGENEN Betriebs export-/
 *    loeschbar (kein Cross-Tenant-Zugriff, auch nicht fuer platform_admin).
 *  - Art. 17 = ANONYMISIEREN statt hartem Loeschen, wo gesetzliche Aufbewahrung
 *    (GoBD/AO/HGB 10 Jahre) oder ein Haftungs-/Beweisinteresse besteht. Der
 *    Customer wird NIE hart geloescht (FK-Integritaet zu Invoice/Order), sondern
 *    seine PII-Spalten werden ueberschrieben + anonymisiertAm gesetzt.
 *  - Physische Foto-Dateien werden NACH dem DB-Commit ueber den Storage-Adapter
 *    (storage.delete) entfernt (die Ablage ist nicht rollback-faehig), strikt
 *    innerhalb des Tenant-Ordners (basename-scoped key + Adapter-Traversal-Schutz).
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

    const [fahrzeuge, auftraege, rechnungen, termine, inspektionen, vermietungen] =
      await Promise.all([
        // withDeleted: auch soft-geloeschte Fahrzeuge gehoeren zur Kundenakte.
        this.vehicleRepo.find({ where: { customerId: id, tenantId }, withDeleted: true }),
        this.orderRepo.find({ where: { customerId: id, tenantId }, relations: ['items'] }),
        this.invoiceRepo.find({ where: { customerId: id, tenantId }, relations: ['items'] }),
        this.appointmentRepo.find({ where: { customerId: id, tenantId } }),
        this.inspectionRepo.find({ where: { customerId: id, tenantId } }),
        this.rentalRepo.find({ where: { customerId: id, tenantId } }),
      ]);

    // Schichtdicken-Messungen (+Messpunkte) und Dellen-Kalkulationen (+Marker) des
    // Kunden – ebenfalls PII-tragend (customerId/vehicleId/notiz/Unterschrift).
    const [messungen, dellen] = await Promise.all([
      this.dataSource.getRepository(LayerMeasurement).find({ where: { customerId: id, tenantId } }),
      this.dataSource.getRepository(DellenKalkulation).find({ where: { customerId: id, tenantId } }),
    ]);
    const messungIds = messungen.map((x) => x.id);
    const dellenIds = dellen.map((x) => x.id);
    const [messpunkte, dellenMarker] = await Promise.all([
      messungIds.length
        ? this.dataSource.getRepository(LayerMeasurementPoint).find({ where: { measurementId: In(messungIds), tenantId } })
        : Promise.resolve([]),
      dellenIds.length
        ? this.dataSource.getRepository(DellenMarker).find({ where: { kalkulationId: In(dellenIds), tenantId } })
        : Promise.resolve([]),
    ]);

    // Kunden-Feedback zur Uebergabe-Mappe (Welle 2-C): die EIGENE Aeusserung des
    // Kunden (Sterne + Freitext) unterliegt dem Art.-15-Auskunftsanspruch. FK-frei
    // ueber die Auftrags-IDs des Kunden, tenant-scoped; `kommentar` wird ueber den
    // Column-Transformer entschluesselt zurueckgegeben.
    const kundenFeedback = auftraege.length
      ? await this.dataSource
          .getRepository(OrderFeedback)
          .find({ where: { orderId: In(auftraege.map((o) => o.id)), tenantId } })
      : [];

    // Materialbuchungen der Kundenauftraege (order_materials): gehoeren zur
    // Kundenakte und damit in den Art.-15-Auszug. FK-frei ueber die Auftrags-IDs
    // des Kunden, tenant-scoped; Length-Guard vermeidet ein leeres In([]).
    const materialbuchungen = auftraege.length
      ? await this.dataSource
          .getRepository(OrderMaterial)
          .find({ where: { orderId: In(auftraege.map((o) => o.id)), tenantId } })
      : [];

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

    // Buchungsanfragen: KEIN customerId-FK -> best-effort ueber exakte E-Mail des
    // Kunden (nur wenn eine E-Mail hinterlegt ist). Klar als best-effort markiert.
    const buchungsanfragen = kunde.email
      ? await this.dataSource
          .getRepository(BookingRequest)
          .find({ where: { tenantId, email: kunde.email } })
      : [];

    // Kundenbezogene Audit-Logs ueber entityType+entityId (kein customerId-Feld).
    const auditEintraege = await this.collectAuditLogs(tenantId, {
      customerId: id,
      vehicleIds: fahrzeuge.map((v) => v.id),
      orderIds: auftraege.map((o) => o.id),
      invoiceIds: rechnungen.map((r) => r.id),
      appointmentIds: termine.map((t) => t.id),
      inspectionIds,
      damageItemIds: damageItems.map((d) => d.id),
      damagePhotoIds: damagePhotos.map((p) => p.id),
    });

    // Menschenlesbare Zusammenfassung (Art. 15: verstaendliche Form) – reine Zaehler
    // + Klartext-Hinweise, damit der Betrieb den Auszug ohne JSON-Kenntnis pruefen kann.
    const zusammenfassung: string[] = [
      `Datenauszug nach Art. 15/20 DSGVO fuer: ${this.kundenAnzeigeName(kunde)}`,
      `Erstellt am ${new Date().toLocaleString('de-DE')}.`,
      `Gespeicherte Fahrzeuge: ${fahrzeuge.length}`,
      `Auftraege: ${auftraege.length}`,
      `Rechnungen/Angebote: ${rechnungen.length}`,
      `Termine: ${termine.length}`,
      `Fahrzeug-/Schaden-Protokolle: ${inspektionen.length}`,
      `Schichtdicken-Messungen: ${messungen.length}`,
      `Dellen-Kalkulationen: ${dellen.length}`,
      `Vermietungen: ${vermietungen.length}`,
      `Online-Buchungsanfragen (E-Mail-Zuordnung): ${buchungsanfragen.length}`,
      `Eigene Rueckmeldungen (Mappen-Feedback): ${kundenFeedback.length}`,
      `Materialbuchungen (zu Auftraegen): ${materialbuchungen.length}`,
      `Protokoll-/Aenderungseintraege: ${auditEintraege.length}`,
    ];

    // Messpunkte/Marker den Eltern zuordnen (fuer die strukturierte Ausgabe).
    const punkteByMessung = new Map<string, LayerMeasurementPoint[]>();
    for (const p of messpunkte) {
      const list = punkteByMessung.get(p.measurementId) ?? [];
      list.push(p);
      punkteByMessung.set(p.measurementId, list);
    }
    const markerByDelle = new Map<string, DellenMarker[]>();
    for (const mk of dellenMarker) {
      const list = markerByDelle.get(mk.kalkulationId) ?? [];
      list.push(mk);
      markerByDelle.set(mk.kalkulationId, list);
    }

    const result: Record<string, unknown> = {
      exportiertAm: new Date().toISOString(),
      exportiertVon: user.id,
      tenantId,
      hinweis:
        'Auskunft nach Art. 15 DSGVO. Foto-Felder enthalten Pfad-Metadaten; die ' +
        'Bilddateien sind ueber die geschuetzten Foto-Endpunkte abrufbar.',
      zusammenfassung,
      kunde,
      fahrzeuge,
      auftraege: auftraege.map((o) => ({
        ...o,
        fotosVorher: o.bilderVorher ?? [],
        fotosNachher: o.bilderNachher ?? [],
      })),
      rechnungen,
      termine,
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
      schichtdickenMessungen: messungen.map((mess) => ({
        ...mess,
        messpunkte: punkteByMessung.get(mess.id) ?? [],
      })),
      dellenKalkulationen: dellen.map((k) => ({
        ...k,
        marker: markerByDelle.get(k.id) ?? [],
      })),
      vermietungen,
      buchungsanfragen: {
        hinweis:
          'Best-effort-Zuordnung ueber die hinterlegte E-Mail-Adresse (kein direkter ' +
          'Datenbank-Bezug zum Kundenkonto).',
        eintraege: buchungsanfragen,
      },
      kundenFeedback,
      materialbuchungen,
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
        inspektionen: inspektionen.length,
        schichtdickenMessungen: messungen.length,
        dellenKalkulationen: dellen.length,
        vermietungen: vermietungen.length,
        buchungsanfragen: buchungsanfragen.length,
        kundenFeedback: kundenFeedback.length,
        materialbuchungen: materialbuchungen.length,
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
  ): Promise<{
    success: boolean;
    geloeschteFotos: number;
    anonymisierteTabellen: number;
    fehlgeschlageneDateien?: string[];
  }> {
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

      // (0) Idempotenz-Claim IN der Transaktion: anonymisiertAm atomar setzen, nur
      // wenn noch NULL. Ein paralleler Zweitlauf sieht dann affected=0 und wird zum
      // No-op (kein doppeltes Protokoll, kein erneutes Ueberschreiben des Snapshots).
      const claim = await m
        .createQueryBuilder()
        .update(Customer)
        .set({ anonymisiertAm: new Date() })
        .where('id = :id AND tenantId = :tenantId AND anonymisiertAm IS NULL', { id, tenantId })
        .execute();
      if (!claim.affected) return -1; // bereits (parallel) anonymisiert -> No-op

      // --- IDs des Kunden tenant-scoped einsammeln ---
      // withDeleted: soft-geloeschte Fahrzeuge muessen ebenfalls anonymisiert/
      // physisch entfernt werden (m.delete unten loescht sie hart).
      const fahrzeuge = await m.find(Vehicle, { where: { customerId: id, tenantId }, withDeleted: true });
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

      // (a) Rechnungen/Angebote nach Festschreibung TRENNEN:
      //  - FESTGESCHRIEBEN (nummer != NULL, Beleg): Empfaenger-SNAPSHOT einfrieren,
      //    damit das PDF (§14 UStG) den korrekten Adressaten behaelt, obwohl der
      //    Customer gleich anonym ist. Der Snapshot ist WERTGLEICH zur bisherigen
      //    Live-Anzeige -> der gerenderte Beleg-Inhalt aendert sich NICHT (GoBD).
      //    `hinweis` bleibt UNVERAENDERT: er ist Teil des unveraenderbaren Belegs
      //    (Art.17 Abs.3 lit.b) und wird aufs PDF gerendert -> Nullen waere ein
      //    GoBD-Verstoss (der regulaere Pfad verbietet es per ConflictException).
      //  - ENTWURF (nummer == NULL, kein Beleg): KEIN Snapshot (Empfaenger faellt
      //    auf den anonymisierten Customer zurueck) + PII-Freitext `hinweis` leeren.
      for (const rechnung of rechnungen) {
        const festgeschrieben = !!rechnung.nummer;
        if (festgeschrieben) {
          rechnung.empfaengerName = this.kundenAnzeigeName(kunde);
          rechnung.empfaengerAnschrift = this.kundenAnschrift(kunde);
          rechnung.empfaengerVatNumber = kunde.vatNumber ?? null;
        } else {
          rechnung.hinweis = null as unknown as string;
        }
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

      // (d) Termine: keine Retention -> hart loeschen. IDs vorher einsammeln,
      // damit ihre Audit-Logs redigiert werden koennen. (Alt-Annahmeprotokolle
      // liegen seit P3-7 als DamageInspection vor und werden unter (e) behandelt.)
      // Erfasst BEIDE Verknuepfungsarten: direkt (customerId) UND ueber einen
      // Auftrag des Kunden (orderId, falls der Termin keinen customerId traegt) -
      // sonst ueberlebt ein rein auftragsbezogener Termin die Anonymisierung samt
      // PII (und sein Audit-Log bliebe unredigiert). Gleiches Kriterium fuer find
      // und delete, damit appointmentIds die spaetere Audit-Redaktion voll abdeckt.
      const orderIds = auftraege.map((o) => o.id);
      const terminWhere = orderIds.length
        ? [
            { customerId: id, tenantId },
            { orderId: In(orderIds), tenantId },
          ]
        : { customerId: id, tenantId };
      const termine = await m.find(Appointment, { where: terminWhere });
      const appointmentIds = termine.map((t) => t.id);
      await m.delete(Appointment, terminWhere);

      // (d2) Kunden-Feedback zur Uebergabe-Mappe (Welle 2-C): reine Kundenaeusserung
      // OHNE Aufbewahrungspflicht -> HART loeschen (nicht anonymisieren). FK-frei ->
      // kein Cascade, sonst bliebe der verschluesselte Freitext nach Art. 17 zurueck
      // (Verschluesselung ist KEINE Loeschung). Scope tenant- UND auftrags-gebunden;
      // tenantId ist immer gesetzt -> keine TypeORM-0.3-Falle (where {tenantId:undefined}
      // traefe ALLE Zeilen). Length-Guard vermeidet ein leeres In([]).
      if (orderIds.length) {
        await m.delete(OrderFeedback, { orderId: In(orderIds), tenantId });
      }

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

      // (e2) Schichtdicken-Messungen (LayerMeasurement) analog zu Inspektionen:
      //   - signiert (unterschriftPng gesetzt) = Lackdicken-Nachweis -> BEHALTEN,
      //     PII (Unterschrift/Name/Consent/Notiz) raus, Fahrzeugbezug kappen.
      //   - Entwurf ohne Unterschrift -> LOESCHEN samt Messpunkten.
      // freigabeToken wird IMMER invalidiert (oeffentlicher Kunden-Link).
      const messungen = await m.find(LayerMeasurement, { where: { customerId: id, tenantId } });
      const messBehalten: string[] = [];
      const messLoeschen: string[] = [];
      for (const mess of messungen) {
        if (mess.unterschriftPng) messBehalten.push(mess.id);
        else messLoeschen.push(mess.id);
      }
      for (const mess of messungen.filter((x) => messBehalten.includes(x.id))) {
        mess.unterschriftPng = null as unknown as string;
        mess.unterschriebenVonName = 'Anonymisiert';
        mess.consentText = null as unknown as string;
        mess.notiz = null as unknown as string;
        mess.vehicleId = null as unknown as string; // Fahrzeug wird gleich geloescht
        mess.freigabeToken = null as unknown as string;
        await m.save(LayerMeasurement, mess);
        anonymisierteTabellen++;
      }
      if (messLoeschen.length) {
        await m.delete(LayerMeasurementPoint, { measurementId: In(messLoeschen), tenantId });
        await m.delete(LayerMeasurement, { id: In(messLoeschen), tenantId });
      }
      // freigabeToken auch der behaltenen Messungen sicher invalidieren (select:false).
      await m
        .createQueryBuilder()
        .update(LayerMeasurement)
        .set({ freigabeToken: null as unknown as string })
        .where('customerId = :id AND tenantId = :tenantId', { id, tenantId })
        .execute();

      // (e3) Dellen-Kalkulationen (PDR): kein Beleg-/Signatur-Charakter -> Zeile
      // BEHALTEN (Bezug ueber den anonymen Customer), aber PII-Freitext `notiz`
      // leeren und Fahrzeugbezug kappen. Marker tragen kein PII -> unveraendert.
      await m
        .createQueryBuilder()
        .update(DellenKalkulation)
        .set({ notiz: null as unknown as string, vehicleId: null as unknown as string })
        .where('customerId = :id AND tenantId = :tenantId', { id, tenantId })
        .execute();

      // (e4) Buchungsanfragen best-effort ueber die exakte E-Mail des Kunden HART
      // loeschen (kein customerId-FK; name/email/phone/nachricht/sourceIpHash = PII
      // ohne Retention). WICHTIG: VOR dem Nullen von kunde.email ausfuehren.
      if (kunde.email) {
        await m.delete(BookingRequest, { tenantId, email: kunde.email });
      }

      // (f) Audit-Logs: BEHALTEN (Art. 5 Abs. 2 Rechenschaft), aber PII im payload
      // redigieren – ueber alle relevanten entityType+entityId-Bezuege.
      await this.redactAuditLogs(m, tenantId, {
        customerId: id,
        vehicleIds: fahrzeuge.map((v) => v.id),
        orderIds: auftraege.map((o) => o.id),
        invoiceIds: rechnungen.map((r) => r.id),
        appointmentIds,
        inspectionIds,
        damageItemIds: damageItems.map((d) => d.id),
        damagePhotoIds: damagePhotos.map((p) => p.id),
      });

      // (g) Rentals: behalten (customerId not-null; Customer ohnehin anonym).
      //     Keine Aenderung noetig – Personenbezug ist ueber den anonymen Customer.

      // (g2) Token-Invalidierung: oeffentliche Kunden-Links (Auftrags-Tracking
      // "Wo ist mein Auto", Angebots-Freigabe, Rechnungs-PDF-Download) SOFORT
      // entwerten. Es sind select:false-Spalten -> per UPDATE nullen (m.find laedt
      // sie nicht). Idempotent + tenant-scoped; ein spaeterer Aufruf mit den alten
      // Tokens laeuft dann ins Leere.
      await m
        .createQueryBuilder()
        .update(Order)
        .set({ freigabeToken: null as unknown as string })
        .where('customerId = :id AND tenantId = :tenantId', { id, tenantId })
        .execute();
      await m
        .createQueryBuilder()
        .update(Invoice)
        .set({
          downloadToken: null as unknown as string,
          angebotToken: null as unknown as string,
        })
        .where('customerId = :id AND tenantId = :tenantId', { id, tenantId })
        .execute();

      // (h) Customer zuletzt: PII-Spalten ueberschreiben + Flag setzen.
      kunde.firstName = 'Geloescht';
      kunde.lastName = 'Geloescht';
      kunde.companyName = null as unknown as string;
      kunde.vatNumber = null as unknown as string;
      kunde.leitwegId = null as unknown as string; // B2G-Empfaenger-ID, sonst re-identifizierend
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

    // Idempotenz-Claim schlug fehl (paralleler Zweitlauf) -> No-op ohne Datei-
    // Loeschung und ohne Protokoll (die andere Transaktion erledigt/te alles).
    if (zaehler < 0) {
      return { success: true, geloeschteFotos: 0, anonymisierteTabellen: 0 };
    }

    // --- NACH erfolgreichem Commit: physische Dateien idempotent loeschen ---
    const { geloeschteFotos, fehlgeschlagen } = await this.loescheDateienNachCommit(
      tenantId,
      inspectionFiles,
      orderFiles,
    );

    await this.audit.log({
      tenantId,
      userId: user.id,
      action: 'gdpr_anonymize',
      entityType: 'Customer',
      entityId: id,
      payload: {
        anonymisierteTabellen: zaehler,
        geloeschteFotos,
        ...(fehlgeschlagen.length
          ? { dateiLoeschungUnvollstaendig: fehlgeschlagen.length, nachzuarbeitendeDateien: fehlgeschlagen }
          : {}),
      },
    });

    return { success: true, geloeschteFotos, anonymisierteTabellen: zaehler, fehlgeschlageneDateien: fehlgeschlagen };
  }

  // ===========================================================================
  // Art. 17 – Entscheidung Loeschen vs. Anonymisieren
  // ===========================================================================

  /**
   * Prueft tenant-scoped, ob fuer den Kunden eine gesetzliche Aufbewahrung greift
   * (siehe DSGVO_LOESCHKONZEPT.md §1.1). Liefert die Einzelzaehler zur Anzeige +
   * das aggregierte `pflicht`-Flag. Optionaler EntityManager -> innerhalb einer
   * Transaktion konsistent nutzbar.
   */
  async hatAufbewahrungspflicht(
    tenantId: string,
    customerId: string,
    m?: EntityManager,
  ): Promise<AufbewahrungsInfo> {
    const invRepo = m ? m.getRepository(Invoice) : this.invoiceRepo;
    const orderRepo = m ? m.getRepository(Order) : this.orderRepo;
    const inspRepo = m ? m.getRepository(DamageInspection) : this.inspectionRepo;
    const layerRepo = m ? m.getRepository(LayerMeasurement) : this.dataSource.getRepository(LayerMeasurement);

    // Rechnungen/Angebote mit vergebener Belegnummer (nummer IS NOT NULL).
    const [rechnungen, angebote] = await Promise.all([
      invRepo
        .createQueryBuilder('i')
        .where('i.tenantId = :t AND i.customerId = :c AND i.nummer IS NOT NULL AND i.art = :art', {
          t: tenantId,
          c: customerId,
          art: InvoiceKind.RECHNUNG,
        })
        .getCount(),
      invRepo
        .createQueryBuilder('i')
        .where('i.tenantId = :t AND i.customerId = :c AND i.nummer IS NOT NULL AND i.art = :art', {
          t: tenantId,
          c: customerId,
          art: InvoiceKind.ANGEBOT,
        })
        .getCount(),
    ]);

    const abgerechneteAuftraege = await orderRepo.count({
      where: { tenantId, customerId, status: OrderStatus.ABGERECHNET },
    });

    // Signierte/freigegebene Protokolle (Haftungsbeweis) -> Aufbewahrung. Erfasst
    // BEIDE Protokoll-Arten: Schadens-/Uebergabe-Inspektionen (DamageInspection)
    // UND signierte Schichtdicken-Messungen (LayerMeasurement, Lackdicken-Nachweis).
    const [signierteInspektionen, signierteMessungen] = await Promise.all([
      inspRepo
        .createQueryBuilder('d')
        .where('d.tenantId = :t AND d.customerId = :c', { t: tenantId, c: customerId })
        .andWhere("(d.unterschriftPng IS NOT NULL OR d.status = 'freigegeben')")
        .getCount(),
      layerRepo
        .createQueryBuilder('l')
        .where('l.tenantId = :t AND l.customerId = :c', { t: tenantId, c: customerId })
        .andWhere('l.unterschriftPng IS NOT NULL')
        .getCount(),
    ]);
    const signierteProtokolle = signierteInspektionen + signierteMessungen;

    const pflicht =
      rechnungen + angebote + abgerechneteAuftraege + signierteProtokolle > 0;
    return { pflicht, rechnungen, angebote, abgerechneteAuftraege, signierteProtokolle };
  }

  /**
   * Vorschau der Loesch-Entscheidung fuer die Cockpit-/Modal-Anzeige. Mutiert
   * NICHTS. Wirft 404, wenn der Kunde nicht (mehr) existiert. Bereits anonymisierte
   * Kunden werden als `bereitsAnonymisiert` markiert.
   */
  async previewCustomerDeletion(
    user: AuthUser,
    id: string,
  ): Promise<{ modus: LoeschModus; bereitsAnonymisiert: boolean; belege: AufbewahrungsInfo }> {
    const tenantId = user.tenantId;
    const kunde = await this.customerRepo.findOne({ where: { id, tenantId } });
    if (!kunde) throw new NotFoundException('Kunde nicht gefunden');
    const belege = await this.hatAufbewahrungspflicht(tenantId, id);
    return {
      modus: belege.pflicht ? 'anonymisiert' : 'geloescht',
      bereitsAnonymisiert: !!kunde.anonymisiertAm,
      belege,
    };
  }

  /**
   * Zentraler Art.-17-Endpunkt: entscheidet zwischen ANONYMISIEREN (bei
   * Aufbewahrungspflicht) und HARTER Loeschung. Idempotent: existiert der Kunde
   * nicht mehr -> 404 (harte Loeschung war bereits erfolgt); ist er bereits
   * anonymisiert -> No-op mit `bereitsErledigt` (kein erneutes Ueberschreiben des
   * eingefrorenen Beleg-Snapshots). Schreibt ein PII-freies Protokoll.
   */
  async deleteCustomer(
    user: AuthUser,
    id: string,
  ): Promise<{
    modus: LoeschModus;
    bereitsErledigt?: boolean;
    rechtsgrund: string;
    belege: AufbewahrungsInfo;
    geloeschteFotos: number;
    betroffeneTabellen: number;
    fehlgeschlageneDateien?: string[];
  }> {
    const tenantId = user.tenantId;
    const kunde = await this.customerRepo.findOne({ where: { id, tenantId } });
    if (!kunde) throw new NotFoundException('Kunde nicht gefunden');

    const belege = await this.hatAufbewahrungspflicht(tenantId, id);

    // Bereits anonymisiert -> idempotenter No-op (Snapshot NICHT erneut ueberschreiben).
    if (kunde.anonymisiertAm) {
      return {
        modus: 'anonymisiert',
        bereitsErledigt: true,
        rechtsgrund: 'Art. 17 Abs. 3 lit. b DSGVO (Aufbewahrungspflicht)',
        belege,
        geloeschteFotos: 0,
        betroffeneTabellen: 0,
      };
    }

    if (belege.pflicht) {
      // ANONYMISIEREN (bewaehrte Transaktion wiederverwenden).
      const r = await this.anonymizeCustomer(user, id);
      return {
        modus: 'anonymisiert',
        rechtsgrund: 'Art. 17 Abs. 3 lit. b DSGVO (Aufbewahrungspflicht §147 AO/§14 UStG)',
        belege,
        geloeschteFotos: r.geloeschteFotos,
        betroffeneTabellen: r.anonymisierteTabellen,
        fehlgeschlageneDateien: r.fehlgeschlageneDateien,
      };
    }

    // HART LOESCHEN.
    const r = await this.hardDeleteCustomer(user, kunde);
    return {
      modus: 'geloescht',
      rechtsgrund: 'Art. 17 Abs. 1 DSGVO (keine Aufbewahrungspflicht)',
      belege,
      geloeschteFotos: r.geloeschteFotos,
      betroffeneTabellen: r.betroffeneTabellen,
      fehlgeschlageneDateien: r.fehlgeschlageneDateien,
    };
  }

  /**
   * VOLLSTAENDIGE harte Loeschung eines Kunden ohne Aufbewahrungspflicht. Nur ueber
   * deleteCustomer erreichbar (dort ist garantiert: keine nummerierten Belege,
   * keine abgerechneten Auftraege, keine signierten Protokolle). DB-Teil in EINER
   * Transaktion; physische Foto-Dateien werden ERST nach dem Commit entfernt.
   */
  private async hardDeleteCustomer(
    user: AuthUser,
    kunde: Customer,
  ): Promise<{ geloeschteFotos: number; betroffeneTabellen: number; fehlgeschlageneDateien: string[] }> {
    const tenantId = user.tenantId;
    const id = kunde.id;

    const inspectionFiles: string[] = [];
    const orderFiles: string[] = [];

    const betroffeneTabellen = await this.dataSource.transaction(async (m) => {
      let tabellen = 0;

      // (0a) Idempotenz-Guard: existiert der Kunde noch? Ein paralleler Zweitlauf
      // hat ihn ggf. schon geloescht -> sauberer No-op (kein doppeltes Protokoll).
      const stillDa = await m.findOne(Customer, { where: { id, tenantId } });
      if (!stillDa) return -1;

      // (0b) TOCTOU-Recheck INNERHALB der Transaktion: zwischen der aeusseren
      // Entscheidung und diesem Punkt koennte ein Beleg festgeschrieben worden sein
      // (z. B. Rechnung mit Nummer). Dann darf NICHT hart geloescht werden (der
      // m.delete(Invoice, {customerId}) unten wuerde einen §14-/GoBD-Beleg physisch
      // vernichten + eine Nummernkreis-Luecke reissen) -> 409, Aufrufer anonymisiert.
      const recheck = await this.hatAufbewahrungspflicht(tenantId, id, m);
      if (recheck.pflicht) {
        throw new ConflictException(
          'Es sind inzwischen aufbewahrungspflichtige Belege vorhanden – bitte erneut ausführen (wird dann anonymisiert).',
        );
      }

      const fahrzeuge = await m.find(Vehicle, { where: { customerId: id, tenantId }, withDeleted: true });
      const auftraege = await m.find(Order, { where: { customerId: id, tenantId } });
      const rechnungen = await m.find(Invoice, { where: { customerId: id, tenantId } });
      const inspektionen = await m.find(DamageInspection, { where: { customerId: id, tenantId } });
      const orderIds = auftraege.map((o) => o.id);
      const invoiceIds = rechnungen.map((r) => r.id);
      const inspectionIds = inspektionen.map((i) => i.id);

      const damagePhotos = inspectionIds.length
        ? await m.find(DamagePhoto, { where: { inspectionId: In(inspectionIds), tenantId } })
        : [];
      const damageItems = inspectionIds.length
        ? await m.find(DamageItem, { where: { inspectionId: In(inspectionIds), tenantId } })
        : [];

      // Foto-Pfade fuer die Disk-Loeschung einsammeln (nach Commit).
      for (const ph of damagePhotos) {
        if (ph.pfad) inspectionFiles.push(ph.pfad);
        if (ph.thumbnailPfad) inspectionFiles.push(ph.thumbnailPfad);
      }
      for (const order of auftraege) {
        for (const url of order.bilderVorher ?? []) orderFiles.push(url);
        for (const url of order.bilderNachher ?? []) orderFiles.push(url);
      }

      // (a) Inspektions-Kinder zuerst (Join -> Fotos -> Schaeden -> Inspektionen).
      if (inspectionIds.length) {
        const damageItemIds = damageItems.map((d) => d.id);
        const photoIds = damagePhotos.map((p) => p.id);
        if (damageItemIds.length) {
          await m.delete(DamageItemPhoto, { damageItemId: In(damageItemIds), tenantId });
        }
        if (photoIds.length) {
          await m.delete(DamageItemPhoto, { photoId: In(photoIds), tenantId });
        }
        await m.delete(DamagePhoto, { inspectionId: In(inspectionIds), tenantId });
        await m.delete(DamageItem, { inspectionId: In(inspectionIds), tenantId });
        await m.delete(DamageInspection, { id: In(inspectionIds), tenantId });
        tabellen++;
      }

      // (b) Termine (direkt ueber customerId ODER ueber orderId eines Auftrags).
      // IDs vorher einsammeln, damit ihre Audit-Logs redigiert werden koennen.
      const terminWhere = orderIds.length
        ? [
            { customerId: id, tenantId },
            { orderId: In(orderIds), tenantId },
          ]
        : { customerId: id, tenantId };
      const termine = await m.find(Appointment, { where: terminWhere });
      const appointmentIds = termine.map((t) => t.id);
      await m.delete(Appointment, terminWhere);
      tabellen++;

      // (c) Auftrags-Kinder + Auftraege. Arbeitszeit-Zeilen (order_times) und
      // Materialbuchungen (order_materials) haengen am Auftrag (kein Endkunden-PII,
      // aber sonst verwaist) -> mitloeschen. OrderItem/OrderTime werden ueber die
      // (bereits tenant-gescoped erhobenen) orderIds geloescht: OrderItem hat KEINE
      // tenantId-Spalte -> tenantId hier NICHT im Kriterium (wuerde
      // EntityPropertyNotFoundError werfen). OrderMaterial HAT eine tenantId-Spalte
      // -> zusaetzlich tenant-scopen (Defense-in-Depth; tenantId ist hier immer
      // gesetzt, keine TypeORM-0.3-undefined-Falle). Bewusst KEINE Bestands-
      // Rueckbuchung (anders als OrderMaterial.remove): das Material wurde real
      // verbraucht; eine Kundenloeschung darf den laufenden Lagerbestand des
      // Betriebs nicht verfaelschen.
      if (orderIds.length) {
        await m.delete(OrderTime, { orderId: In(orderIds) });
        await m.delete(OrderItem, { orderId: In(orderIds) });
        await m.delete(OrderMaterial, { orderId: In(orderIds), tenantId });
      }
      if (auftraege.length) {
        await m.delete(Order, { customerId: id, tenantId });
        tabellen++;
      }

      // (d) Rechnungs-Entwuerfe (nummer=NULL) + deren Positionen. Defensiv NUR
      // nicht festgeschriebene Belege (nummer IS NULL) loeschen – der TOCTOU-
      // Recheck oben garantiert das bereits, aber die WHERE-Einschraenkung ist ein
      // zweiter Riegel gegen die physische Vernichtung eines §14-/GoBD-Belegs.
      // InvoiceItem hat KEINE tenantId-Spalte -> nur ueber invoiceIds scopen.
      if (invoiceIds.length) {
        const entwurfIds = rechnungen.filter((r) => !r.nummer).map((r) => r.id);
        if (entwurfIds.length) {
          await m.delete(InvoiceItem, { invoiceId: In(entwurfIds) });
          await m.delete(Invoice, { id: In(entwurfIds), tenantId });
          tabellen++;
        }
      }

      // (e) Vermietungen.
      await m.delete(Rental, { customerId: id, tenantId });

      // (e1) Kunden-Feedback zur Uebergabe-Mappe: FK-frei (kein Cascade ueber den
      // Auftrag) -> hier explizit hart loeschen, sonst bliebe der verschluesselte
      // Freitext nach der harten Loeschung zurueck. Tenant- UND auftrags-gescoped.
      if (orderIds.length) {
        await m.delete(OrderFeedback, { orderId: In(orderIds), tenantId });
      }

      // (e2) Schichtdicken-Messungen + Messpunkte (keine signierten per Vorbedingung).
      const messungen = await m.find(LayerMeasurement, { where: { customerId: id, tenantId } });
      const messIds = messungen.map((x) => x.id);
      if (messIds.length) {
        await m.delete(LayerMeasurementPoint, { measurementId: In(messIds), tenantId });
        await m.delete(LayerMeasurement, { id: In(messIds), tenantId });
        tabellen++;
      }

      // (e3) Dellen-Kalkulationen + Marker (customerId/vehicleId/notiz = PII-Bezug).
      const dellen = await m.find(DellenKalkulation, { where: { customerId: id, tenantId } });
      const dellenIds = dellen.map((x) => x.id);
      if (dellenIds.length) {
        await m.delete(DellenMarker, { kalkulationId: In(dellenIds), tenantId });
        await m.delete(DellenKalkulation, { id: In(dellenIds), tenantId });
        tabellen++;
      }

      // (f) Buchungsanfragen best-effort ueber exakte E-Mail (kein customerId-FK).
      if (kunde.email) {
        await m.delete(BookingRequest, { tenantId, email: kunde.email });
      }

      // (g) Fahrzeuge (harte Identifikatoren, kein Retention-Zwang).
      if (fahrzeuge.length) {
        await m.delete(Vehicle, { customerId: id, tenantId });
        tabellen++;
      }

      // (h) Audit-Logs BEHALTEN, aber PII im payload redigieren (Art. 5 Abs. 2).
      await this.redactAuditLogs(m, tenantId, {
        customerId: id,
        vehicleIds: fahrzeuge.map((v) => v.id),
        orderIds,
        invoiceIds,
        appointmentIds,
        inspectionIds,
        damageItemIds: damageItems.map((d) => d.id),
        damagePhotoIds: damagePhotos.map((p) => p.id),
      });

      // (i) Kunde zuletzt HART loeschen.
      await m.delete(Customer, { id, tenantId });
      tabellen++;

      return tabellen;
    });

    // Guard schlug an (paralleler Zweitlauf) -> No-op ohne Datei-Loeschung/Protokoll.
    if (betroffeneTabellen < 0) {
      return { geloeschteFotos: 0, betroffeneTabellen: 0, fehlgeschlageneDateien: [] };
    }

    // --- NACH Commit: physische Dateien idempotent + pfad-traversal-sicher loeschen ---
    const { geloeschteFotos, fehlgeschlagen } = await this.loescheDateienNachCommit(
      tenantId,
      inspectionFiles,
      orderFiles,
    );

    await this.audit.log({
      tenantId,
      userId: user.id,
      action: 'gdpr_delete',
      entityType: 'Customer',
      entityId: id,
      payload: {
        modus: 'geloescht',
        betroffeneTabellen,
        geloeschteFotos,
        ...(fehlgeschlagen.length
          ? { dateiLoeschungUnvollstaendig: fehlgeschlagen.length, nachzuarbeitendeDateien: fehlgeschlagen }
          : {}),
      },
    });

    return { geloeschteFotos, betroffeneTabellen, fehlgeschlageneDateien: fehlgeschlagen };
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
   * Loescht eine Datei STRENG innerhalb von private-uploads/<subdir>/<tenantId>/
   * (basename-Resolve + Praefix-Check, spiegelt resolveTenantFile der Foto-
   * Controller). Liefert ein Tri-State:
   *  - 'deleted': Datei erfolgreich entfernt.
   *  - 'missing': Datei war nicht (mehr) vorhanden (ENOENT) oder Pfad ungueltig
   *    (Traversal-Schutz) – kein Nacharbeitsbedarf.
   *  - 'failed':  transienter Fehler (EBUSY/EPERM/…) – die DB-Zeile ist bereits
   *    weg, die Datei blieb liegen und muss NACHGEARBEITET werden.
   */
  private async unlinkTenantFile(
    subdir: 'inspections' | 'orders',
    tenantId: string,
    gespeicherterPfad: string,
  ): Promise<'deleted' | 'missing' | 'failed'> {
    if (!gespeicherterPfad) return 'missing';
    // NUR der Dateiname (basename) zaehlt -> ein manipulierter DB-Wert/../-Segment
    // kann den Tenant-Ordner nicht verlassen; der Adapter guardt zusaetzlich.
    const dateiname = basename(gespeicherterPfad);
    if (!dateiname) return 'missing';
    const key = `${subdir}/${tenantId}/${dateiname}`;
    try {
      await storage.delete('private', key);
      return 'deleted';
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
      this.logger.warn(`Foto-Loeschung fehlgeschlagen (${subdir}/${dateiname}): ${(err as Error).message}`);
      return 'failed';
    }
  }

  /**
   * Loescht die gesammelten physischen Dateien NACH dem DB-Commit und meldet die
   * Zaehler zurueck. Fehlgeschlagene (transiente) Loeschungen werden als
   * PII-FREIE Dateinamen (UUID-basiert, kein Personenbezug) gesammelt, damit das
   * Audit-Protokoll + die Antwort einen konkreten Nacharbeits-Hinweis liefern
   * koennen (sonst waere die PII-Datei fuer immer verwaist + unauffindbar).
   */
  private async loescheDateienNachCommit(
    tenantId: string,
    inspectionFiles: string[],
    orderFiles: string[],
  ): Promise<{ geloeschteFotos: number; fehlgeschlagen: string[] }> {
    let geloeschteFotos = 0;
    const fehlgeschlagen: string[] = [];
    for (const pfad of inspectionFiles) {
      const r = await this.unlinkTenantFile('inspections', tenantId, pfad);
      if (r === 'deleted') geloeschteFotos++;
      else if (r === 'failed') fehlgeschlagen.push(`inspections/${basename(pfad)}`);
    }
    for (const datei of orderFiles) {
      const r = await this.unlinkTenantFile('orders', tenantId, datei);
      if (r === 'deleted') geloeschteFotos++;
      else if (r === 'failed') fehlgeschlagen.push(`orders/${basename(datei)}`);
    }
    return { geloeschteFotos, fehlgeschlagen };
  }
}
