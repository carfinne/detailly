/**
 * Kleine Format-Helfer fuer Endkunden-Mails (T-003 Statuskommunikation).
 *
 * Stil und Escaping sind bewusst 1:1 am bestehenden Endkunden-Muster der
 * Rechnungs-/Mahn-Mails (invoices.service.ts) ausgerichtet: Sie-Ton,
 * "Guten Tag ...," als Anrede, schlichtes Inline-HTML. Die dortigen privaten
 * Helfer bleiben unangetastet – dieser Baustein wird NUR von den neuen
 * Status-/Terminbestaetigungs-Mails genutzt (kein Refactoring-Zwang).
 */

/**
 * Eine Mail-Zeile: normaler Text (wird escaped) oder ein vorgerenderter
 * HTML-Block (z. B. der Track-Link via `htmlLink` – NIE Fremd-Eingaben).
 */
export type MailZeile = string | { html: string };

/** Minimal-Escaping fuer HTML-Mails (identische Zeichenmenge wie invoices.service). */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

/**
 * Baut aus Zeilen ein schlichtes HTML-Dokument (leere Zeile -> Abstand).
 * Text-Zeilen werden escaped; { html } wird unveraendert eingebettet und darf
 * deshalb ausschliesslich server-generiertes Markup enthalten (htmlLink).
 */
export function linesToHtml(zeilen: MailZeile[]): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6">${zeilen
    .map((z) => {
      if (typeof z !== 'string') return `<p style="margin:0 0 4px">${z.html}</p>`;
      return z === '' ? '<br/>' : `<p style="margin:0 0 4px">${escapeHtml(z)}</p>`;
    })
    .join('')}</div>`;
}

/** Link-Baustein fuer linesToHtml ({ html }). URL/Label werden attribut-sicher escaped. */
export function htmlLink(url: string, label: string): { html: string } {
  return { html: `<a href="${escapeHtml(url)}" style="color:#1d4ed8">${escapeHtml(label)}</a>` };
}

/** Anrede im Sie-Ton. Ohne Namen neutral ("Guten Tag,"). */
export function anrede(name?: string | null): string {
  const n = name?.trim();
  return n ? `Guten Tag ${n},` : 'Guten Tag,';
}

/** Datum + Uhrzeit deutsch (dd.mm.yyyy, hh:mm Uhr) – ohne Locale-Abhaengigkeit der Runtime. */
export function formatDatumZeit(d: Date): string {
  const date = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}, ${p(date.getHours())}:${p(date.getMinutes())} Uhr`;
}
