import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { MarketplaceOrder, MarketplaceOrderStatus } from './entities/marketplace-order.entity';
import { MarketplaceOrderItem } from './entities/marketplace-order-item.entity';

/**
 * Mail-Texte des Marktplatzes an einem Ort (reine Funktionen -> testbar,
 * Service bleibt schlank). Bewusst Text statt HTML wie im restlichen System.
 *
 * SICHERHEIT: Der Portal-Token wird NIE per Mail verschickt (Mails liegen
 * unverschluesselt in fremden Postfaechern) - der Haendler kennt seinen
 * Portal-Link aus der Uebergabe durch den Betreiber.
 */

const eur = (n: number) => `${Number(n).toFixed(2)} EUR`;

function positionsListe(items: MarketplaceOrderItem[]): string {
  return items
    .map((i) => `  - ${i.menge}x ${i.produktName} (je ${eur(i.einzelpreis)}) = ${eur(i.zeilenSumme)}`)
    .join('\n');
}

function lieferBlock(order: MarketplaceOrder): string {
  const zeilen = [
    order.lieferFirma,
    order.lieferStrasse,
    [order.lieferPlz, order.lieferOrt].filter(Boolean).join(' '),
    order.lieferLand,
  ].filter(Boolean);
  const kontakt = [
    `Ansprechpartner: ${order.kontaktName}`,
    `E-Mail: ${order.kontaktEmail}`,
    order.kontaktTelefon ? `Telefon: ${order.kontaktTelefon}` : null,
  ].filter(Boolean);
  return [...zeilen, '', ...kontakt].join('\n');
}

/** Neue Bestellung -> Haendler (vollstaendige Abwicklungs-Infos). */
export function haendlerBestellMail(
  dealer: MarketplaceDealer,
  order: MarketplaceOrder,
  items: MarketplaceOrderItem[],
): { to: string; subject: string; text: string } {
  return {
    to: dealer.kontaktEmail,
    subject: `Neue Marktplatz-Bestellung ${order.nummer}`,
    text:
      `Hallo ${dealer.name},\n\n` +
      `ueber den Detailly-Marktplatz ist die Bestellung ${order.nummer} eingegangen.\n\n` +
      `Positionen:\n${positionsListe(items)}\n\n` +
      `Summe: ${eur(order.summeBrutto)}\n\n` +
      `Lieferanschrift:\n${lieferBlock(order)}\n` +
      (order.notiz ? `\nAnmerkung des Bestellers:\n${order.notiz}\n` : '') +
      `\nBitte bestaetigt die Bestellung in eurem Haendler-Portal und pflegt dort ` +
      `beim Versand die Sendungsnummer ein.`,
  };
}

/** Bestell-Eingangsbestaetigung -> Betrieb (Besteller). */
export function betriebBestellMail(
  order: MarketplaceOrder,
  items: MarketplaceOrderItem[],
  haendlerName: string,
): { to: string; subject: string; text: string } {
  return {
    to: order.kontaktEmail,
    subject: `Bestellung ${order.nummer} eingegangen`,
    text:
      `Hallo ${order.kontaktName},\n\n` +
      `eure Marktplatz-Bestellung ${order.nummer} bei ${haendlerName} ist eingegangen ` +
      `und wurde an den Haendler uebermittelt.\n\n` +
      `Positionen:\n${positionsListe(items)}\n\n` +
      `Summe: ${eur(order.summeBrutto)}\n\n` +
      `Sobald der Haendler die Bestellung bestaetigt oder versendet, ` +
      `informieren wir euch per E-Mail. Den aktuellen Stand seht ihr jederzeit ` +
      `in Detailly unter Marktplatz -> Meine Bestellungen.`,
  };
}

const STATUS_TEXT: Record<MarketplaceOrderStatus, { betreff: string; satz: string }> = {
  [MarketplaceOrderStatus.EINGEGANGEN]: {
    betreff: 'eingegangen',
    satz: 'ist eingegangen.',
  },
  [MarketplaceOrderStatus.BESTAETIGT]: {
    betreff: 'bestaetigt',
    satz: 'wurde vom Haendler bestaetigt und wird nun vorbereitet.',
  },
  [MarketplaceOrderStatus.VERSENDET]: {
    betreff: 'versendet',
    satz: 'wurde versendet.',
  },
  [MarketplaceOrderStatus.STORNIERT]: {
    betreff: 'storniert',
    satz: 'wurde storniert. Bei Fragen wendet euch bitte direkt an den Haendler.',
  },
};

/** Statuswechsel -> Betrieb (inkl. Tracking, falls vorhanden). */
export function betriebStatusMail(
  order: MarketplaceOrder,
  haendlerName: string,
): { to: string; subject: string; text: string } {
  const s = STATUS_TEXT[order.status];
  const tracking =
    order.status === MarketplaceOrderStatus.VERSENDET && (order.trackingNummer || order.trackingUrl)
      ? `\nSendungsverfolgung:` +
        (order.trackingNummer ? `\n  Sendungsnummer: ${order.trackingNummer}` : '') +
        (order.trackingUrl ? `\n  Link: ${order.trackingUrl}` : '') +
        `\n`
      : '';
  return {
    to: order.kontaktEmail,
    subject: `Bestellung ${order.nummer} ${s.betreff}`,
    text:
      `Hallo ${order.kontaktName},\n\n` +
      `eure Bestellung ${order.nummer} bei ${haendlerName} ${s.satz}\n` +
      tracking +
      `\nDen aktuellen Stand seht ihr jederzeit in Detailly unter ` +
      `Marktplatz -> Meine Bestellungen.`,
  };
}
