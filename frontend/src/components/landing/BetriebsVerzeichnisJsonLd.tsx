'use client';

// ===========================================================================
// Injiziert LocalBusiness-Markup (als schema.org ItemList) für die im
// öffentlichen Verzeichnis FREIGEGEBENEN Betriebe.
//
// WICHTIGE GRENZE (bewusst so gebaut): Die Liste wird erst zur LAUFZEIT über den
// öffentlichen Endpunkt GET /public/mitglieder geladen. Dieses JSON-LD steht
// deshalb NICHT im statischen Export-HTML, sondern wird per JavaScript injiziert.
// Google rendert JS und kann es aufnehmen – mit geringerer Zuverlässigkeit als
// statisches Markup. Der saubere Weg für vollen SEO-Wert wäre eine zur BAUZEIT
// erzeugte Verzeichnisseite bzw. eine serverseitig gerenderte Route; das ist
// bewusst ein eigenes, separates Paket (Backend-/Build-Umbau, hier out of scope).
//
// DATENSPARSAM: es werden AUSSCHLIESSLICH die vom Betrieb freigegebenen,
// PII-armen Whitelist-Felder ausgegeben (Backend PublicMitglied): Name, Gewerk,
// Ort, grobe 2-stellige Leitregion, Webseite, Logo, Kurzbeschreibung.
// NIEMALS Straße, volle PLZ, Telefon oder E-Mail.
// ===========================================================================

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Betriebstyp } from '@/lib/branche';
import { JsonLd } from '@/components/seo/JsonLd';
import { betriebeItemListNode, jsonLdGraph, type PublicMitgliedInput } from '@/lib/structured-data';

/** Spiegelt die PII-arme Whitelist PublicMitglied im Backend (public-members). */
type PublicMitglied = {
  firmenname: string;
  betriebstyp: Betriebstyp;
  stadt: string | null;
  kurzbeschreibung: string | null;
  webseite: string | null;
  logoUrl: string | null;
  initiale: string;
  plzRegion: string | null;
};

/** Stabiles deutsches Gewerk-Label fürs Markup (unabhängig von der UI-Sprache). */
const GEWERK_LABEL: Record<Betriebstyp, string> = {
  aufbereitung: 'Fahrzeugaufbereitung',
  folierung: 'Folierung',
  ppf: 'Lackschutzfolierung (PPF)',
  komplett: 'Aufbereitung, Folierung & PPF',
};

/** Nur echte http(s)-Bilder ins Markup – validierte data:image-Logos blähen das HTML auf. */
function bildUrl(logoUrl: string | null): string | null {
  return logoUrl && /^https?:\/\//i.test(logoUrl) ? logoUrl : null;
}

export default function BetriebsVerzeichnisJsonLd() {
  const [mitglieder, setMitglieder] = useState<PublicMitglied[]>([]);

  useEffect(() => {
    let aktiv = true;
    api
      .get<PublicMitglied[]>('/public/mitglieder')
      .then((liste) => {
        if (aktiv) setMitglieder(Array.isArray(liste) ? liste : []);
      })
      .catch(() => {
        /* Verzeichnis-Markup ist optional – Fehler still verschlucken. */
      });
    return () => {
      aktiv = false;
    };
  }, []);

  if (mitglieder.length === 0) return null;

  const items: PublicMitgliedInput[] = mitglieder.map((m) => ({
    firmenname: m.firmenname,
    gewerkLabel: GEWERK_LABEL[m.betriebstyp] ?? null,
    stadt: m.stadt,
    plzRegion: m.plzRegion,
    webseite: m.webseite,
    logoUrl: bildUrl(m.logoUrl),
    kurzbeschreibung: m.kurzbeschreibung,
  }));

  return <JsonLd data={jsonLdGraph([betriebeItemListNode(items)])} />;
}
