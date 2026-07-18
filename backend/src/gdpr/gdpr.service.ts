import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { basename, resolve, sep } from 'path';
import { promises as fsp } from 'fs';

import { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Invoice, InvoiceKind } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { DamagePhoto } from '../inspection/entities/damage-photo.entity';
import { DamageItemPhoto } from '../inspection/entities/damage-item-photo.entity';
import { Rental } from '../shop/entities/rental.entity';
import { OrderTime } from '../zeiterfassung/entities/order-time.entity';
import { BookingRequest } from '../public-booking/entities/booking-request.entity';
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
      `Vermietungen: ${vermietungen.length}`,
      `Online-Buchungsanfragen (E-Mail-Zuordnung): ${buchungsanfragen.length}`,
      `Protokoll-/Aenderungseintraege: ${auditEintraege.length}`,
    ];

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
      vermietungen,
      buchungsanfragen: {
        hinweis:
          'Best-effort-Zuordnung ueber die hinterlegte E-Mail-Adresse (kein direkter ' +
          'Datenbank-Bezug zum Kundenkonto).',
        eintraege: buchungsanfragen,
      },
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
        vermietungen: vermietungen.length,
        buchungsanfragen: buchungsanfragen.length,
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

    // Signierte/freigegebene Protokolle (Haftungsbeweis) -> Aufbewahrung.
    const signierteProtokolle = await inspRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :t AND d.customerId = :c', { t: tenantId, c: customerId })
      .andWhere("(d.unterschriftPng IS NOT NULL OR d.status = 'freigegeben')")
      .getCount();

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
  ): Promise<{ geloeschteFotos: number; betroffeneTabellen: number }> {
    const tenantId = user.tenantId;
    const id = kunde.id;

    const inspectionFiles: string[] = [];
    const orderFiles: string[] = [];

    const betroffeneTabellen = await this.dataSource.transaction(async (m) => {
      let tabellen = 0;

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

      // (c) Auftrags-Kinder + Auftraege. Arbeitszeit-Zeilen (order_times) haengen
      // am Auftrag (kein Endkunden-PII, aber sonst verwaist) -> mitloeschen.
      if (orderIds.length) {
        await m.delete(OrderTime, { orderId: In(orderIds), tenantId });
        await m.delete(OrderItem, { orderId: In(orderIds), tenantId });
      }
      if (auftraege.length) {
        await m.delete(Order, { customerId: id, tenantId });
        tabellen++;
      }

      // (d) Rechnungs-Entwuerfe (nummer=NULL; nummerierte Belege gibt es hier
      // per Vorbedingung nicht) + deren Positionen.
      if (invoiceIds.length) {
        await m.delete(InvoiceItem, { invoiceId: In(invoiceIds), tenantId });
        await m.delete(Invoice, { customerId: id, tenantId });
        tabellen++;
      }

      // (e) Vermietungen.
      await m.delete(Rental, { customerId: id, tenantId });

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

    // --- NACH Commit: physische Dateien idempotent + pfad-traversal-sicher loeschen ---
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
      action: 'gdpr_delete',
      entityType: 'Customer',
      entityId: id,
      payload: { modus: 'geloescht', betroffeneTabellen, geloeschteFotos },
    });

    return { geloeschteFotos, betroffeneTabellen };
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
