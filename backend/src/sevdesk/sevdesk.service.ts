import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Platzhalter fuer die sevdesk-Anbindung.
 *
 * Es findet KEIN echter HTTP-Call statt. Die Methoden bilden lediglich die
 * spaeter benoetigte Schnittstelle ab. Sobald ein `SEVDESK_API_TOKEN` gesetzt
 * ist, kann hier der reale HTTP-Layer ergaenzt werden – aktuell wird ohne Token
 * nur geloggt (No-op) und eine simulierte ID zurueckgegeben.
 */
@Injectable()
export class SevdeskService {
  private readonly logger = new Logger(SevdeskService.name);

  constructor(private readonly config: ConfigService) {}

  private get token(): string | undefined {
    return this.config.get<string>('SEVDESK_API_TOKEN') || undefined;
  }

  private get enabled(): boolean {
    return Boolean(this.token);
  }

  /** Kontakt zu sevdesk synchronisieren. Gibt die (simulierte) sevdesk-Contact-ID zurueck. */
  async syncContact(customer: { id: string; sevdeskContactId?: string }): Promise<string | null> {
    if (!this.enabled) {
      this.logger.debug(`sevdesk deaktiviert – syncContact(${customer.id}) wird uebersprungen (Stub).`);
      return customer.sevdeskContactId ?? null;
    }
    // TODO: echten sevdesk-API-Call implementieren (POST /Contact).
    this.logger.log(`sevdesk syncContact(${customer.id}) – Stub mit Token, kein realer Call.`);
    return customer.sevdeskContactId ?? `sevdesk-contact-${customer.id}`;
  }

  /** Rechnung an sevdesk uebermitteln. Gibt die (simulierte) sevdesk-Invoice-ID zurueck. */
  async createInvoice(invoice: { id: string; sevdeskInvoiceId?: string }): Promise<string | null> {
    if (!this.enabled) {
      this.logger.debug(`sevdesk deaktiviert – createInvoice(${invoice.id}) wird uebersprungen (Stub).`);
      return invoice.sevdeskInvoiceId ?? null;
    }
    // TODO: echten sevdesk-API-Call implementieren (POST /Invoice).
    this.logger.log(`sevdesk createInvoice(${invoice.id}) – Stub mit Token, kein realer Call.`);
    return invoice.sevdeskInvoiceId ?? `sevdesk-invoice-${invoice.id}`;
  }

  /** Beleg/Voucher in sevdesk anlegen (z.B. fuer Eingangsrechnungen / Bestellungen). */
  async createVoucher(reference: { id: string; type: string }): Promise<string | null> {
    if (!this.enabled) {
      this.logger.debug(`sevdesk deaktiviert – createVoucher(${reference.id}) wird uebersprungen (Stub).`);
      return null;
    }
    // TODO: echten sevdesk-API-Call implementieren (POST /Voucher).
    this.logger.log(`sevdesk createVoucher(${reference.type}/${reference.id}) – Stub mit Token, kein realer Call.`);
    return `sevdesk-voucher-${reference.id}`;
  }
}
