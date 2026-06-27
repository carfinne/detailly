import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import { Invoice } from '../invoices/entities/invoice.entity';

/**
 * sevDesk-Anbindung (Kontakte + Ausgangsrechnungen).
 *
 * Token PRO TENANT: liegt verschluesselt in `tenant.sevdeskApiToken`
 * (select:false) – nie in ENV, nie cross-tenant, nie im Klartext an den Client
 * oder ins Log. Ohne Token ist die Integration deaktiviert (No-op-Fallback wie
 * MailService ohne SMTP) – die App funktioniert unveraendert weiter.
 *
 * Auth: HTTP-Header `Authorization: <TOKEN>` (sevDesk nutzt KEIN "Bearer").
 *
 * HINWEIS (Steuermodell): Diese Implementierung nutzt das v1-Feld `taxType`
 * (Inland 19/7 -> "default", §19 -> "ss"). sevDesk-Konten der "Systemversion 2.0"
 * verwenden stattdessen `taxRule` – das ist beim ersten Test mit echtem Token zu
 * verifizieren (siehe sevDesk-Doku). Vor Produktiveinsatz mit einem Draft-Call
 * (status:100) gegen das echte Konto pruefen.
 */
export interface SevdeskCtx {
  tenantId: string;
  token?: string | null;
}

const BASE_URL = 'https://my.sevdesk.de/api/v1';
const TIMEOUT_MS = 10_000;

@Injectable()
export class SevdeskService {
  private readonly logger = new Logger(SevdeskService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /** Laedt den (verschluesselten, select:false) sevDesk-Token eines Betriebs. */
  async loadToken(tenantId: string): Promise<string | null> {
    const row = await this.tenantRepo
      .createQueryBuilder('t')
      .addSelect('t.sevdeskApiToken')
      .where('t.id = :id', { id: tenantId })
      .getOne();
    const token = row?.sevdeskApiToken?.trim();
    return token || null;
  }

  /**
   * Token-/Verbindungstest: billiger Read-Call (GET /SevUser). Gibt nur einen
   * Status zurueck, NIE den Token. companyName aus dem ersten SevUser (best effort).
   */
  async testConnection(token: string): Promise<{ ok: boolean; companyName?: string }> {
    try {
      const data = await this.request<any>(token, 'GET', '/SevUser');
      const users = this.asArray(data?.objects);
      const ok = users.length > 0;
      return { ok, companyName: users[0]?.fullname || users[0]?.username || undefined };
    } catch {
      return { ok: false };
    }
  }

  /**
   * Stellt den sevDesk-Kontakt zum Kunden sicher und gibt dessen Contact-ID
   * zurueck. Idempotent: vorhandene sevdeskContactId wird unveraendert
   * zurueckgegeben. Ohne Token -> No-op (vorhandene/leere ID).
   */
  async syncContact(ctx: SevdeskCtx, customer: Customer): Promise<string | null> {
    if (!ctx.token) {
      this.logger.debug(`sevdesk aus – syncContact(${customer.id}) uebersprungen.`);
      return customer.sevdeskContactId ?? null;
    }
    if (customer.sevdeskContactId) return customer.sevdeskContactId;
    const created = await this.request<any>(ctx.token, 'POST', '/Contact', this.buildContactBody(customer));
    const id = this.extractId(created);
    this.logger.log(`sevdesk Kontakt angelegt (customer ${customer.id} -> ${id ?? '?'}).`);
    return id;
  }

  /**
   * Legt die Ausgangsrechnung samt Positionen in sevDesk an
   * (POST /Invoice/Factory/saveInvoice) und gibt die sevDesk-Invoice-ID zurueck.
   * Braucht die sevDesk-Contact-ID (Empfaenger) und einen SevUser (Ersteller).
   * Ohne Token -> No-op.
   */
  async createInvoice(ctx: SevdeskCtx, invoice: Invoice, contactId: string): Promise<string | null> {
    if (!ctx.token) {
      this.logger.debug(`sevdesk aus – createInvoice(${invoice.id}) uebersprungen.`);
      return invoice.sevdeskInvoiceId ?? null;
    }
    // contactPerson MUSS ein SevUser sein (nicht der Kunde) -> ersten User holen.
    const userData = await this.request<any>(ctx.token, 'GET', '/SevUser');
    const sevUserId = this.asArray(userData?.objects)[0]?.id;
    if (!sevUserId) throw new Error('Kein sevDesk-SevUser gefunden (Token-Account ohne Benutzer?).');

    const body = this.buildInvoiceBody(invoice, contactId, String(sevUserId));
    const created = await this.request<any>(ctx.token, 'POST', '/Invoice/Factory/saveInvoice', body);
    const id = created?.objects?.invoice?.id
      ? String(created.objects.invoice.id)
      : this.extractId(created);
    this.logger.log(`sevdesk Rechnung angelegt (invoice ${invoice.id} -> ${id ?? '?'}).`);
    return id;
  }

  // ---------------------------------------------------------------------------
  // Body-Builder (rein, testbar)
  // ---------------------------------------------------------------------------

  buildContactBody(customer: Customer): Record<string, unknown> {
    const body: Record<string, unknown> = {
      category: { id: 3, objectName: 'Category' }, // 3 = Kunde
    };
    if (customer.type === CustomerType.BUSINESS) {
      body.name = customer.companyName || 'Kunde';
    } else {
      // sevDesk: surname = Vorname, familyname = Nachname (laut Doku-Beispiel).
      body.surname = customer.firstName || '';
      body.familyname = customer.lastName || customer.firstName || 'Kunde';
    }
    return body;
  }

  buildInvoiceBody(invoice: Invoice, contactId: string, sevUserId: string): Record<string, unknown> {
    const satz = Math.round(Number(invoice.mwstSatz ?? 19));
    const istKlein = satz === 0;
    const positionen = (invoice.items ?? []).map((it) => ({
      objectName: 'InvoicePos',
      mapAll: true,
      name: it.beschreibung || 'Position',
      quantity: Number(it.menge),
      price: Number(it.einzelpreis),
      taxRate: satz,
      unity: { id: 1, objectName: 'Unity' }, // 1 = Stueck
    }));
    return {
      invoice: {
        objectName: 'Invoice',
        mapAll: true,
        contact: { id: contactId, objectName: 'Contact' },
        contactPerson: { id: sevUserId, objectName: 'SevUser' },
        invoiceDate: this.formatDate(invoice.datum),
        invoiceType: 'RE',
        status: 200, // gestellt/offen (verbucht)
        currency: 'EUR',
        taxType: istKlein ? 'ss' : 'default',
        taxText: istKlein ? 'Steuerfrei nach §19 UStG' : `Umsatzsteuer ${satz}%`,
        taxRate: satz,
        header: `Rechnung ${invoice.nummer ?? ''}`.trim(),
        discount: 0,
      },
      invoicePosSave: positionen,
      invoicePosDelete: null,
      discountSave: null,
      discountDelete: null,
    };
  }

  /** Maskiert einen Token fuer die Anzeige: nur die letzten 4 Zeichen sichtbar. */
  static maskToken(token: string): string {
    if (!token) return '';
    const last = token.slice(-4);
    return `${'•'.repeat(Math.max(4, token.length - 4))}${last}`;
  }

  // ---------------------------------------------------------------------------
  // HTTP / Helfer
  // ---------------------------------------------------------------------------

  private async request<T>(
    token: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: token, // sevDesk: nackter Token, KEIN "Bearer"
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // Status loggen, NIE Header/Token.
      throw new Error(`sevdesk ${method} ${path} -> HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  private asArray(v: unknown): any[] {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return [v];
    return [];
  }

  private extractId(data: any): string | null {
    const obj = Array.isArray(data?.objects) ? data.objects[0] : data?.objects;
    const id = obj?.id;
    return id != null ? String(id) : null;
  }

  private formatDate(d?: Date | string | null): string {
    const date = d ? new Date(d) : new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}`;
  }
}
