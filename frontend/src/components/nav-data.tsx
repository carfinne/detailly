'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useHasFeature } from '@/lib/entitlements';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { LEITUNG_ROLLEN, EMPFANG_ROLLEN, PLATTFORM_ROLLEN, INHABER_ROLLEN } from '@/lib/rollen';

// Gemeinsame Navigations-Definition fuer Desktop-Sidebar UND mobilen Drawer –
// EINE Quelle der Wahrheit, damit beide nie auseinanderlaufen.
// Gruppiert nach Arbeitsablauf statt einer langen flachen Liste.
// `rollen` (optional) schraenkt die Sichtbarkeit eines Eintrags ein.
// `badge: 'anfragen'` blendet einen Live-Zaehler neuer Online-Anfragen ein.
// `labelKey` ist ein i18n-Key (Anzeige-Text via useT() erst beim Rendern).
// `feature` (optional) gatet ein ganzes Modul: fehlt es dem Tarif, wird das Item
//   nicht gerendert (keine 403-Sackgasse). Die Keys spiegeln EXAKT die
//   @RequiresFeature(...)-Guards auf Klassen-Ebene der Backend-Controller; nur
//   ganze-Modul-Gates werden ausgeblendet (method-gated Aktionen wie
//   Rechnungen/Mitarbeiter/Standorte/Shop bleiben sichtbar).
export type NavItem = {
  href: string;
  labelKey: string;
  icon: JSX.Element;
  rollen?: string[];
  badge?: 'anfragen';
  feature?: string;
};
export type NavGroup = { labelKey: string; items: NavItem[] };

// Rollen-Gruppen kommen zentral aus lib/rollen.ts (geteilt mit Seiten und
// Karten). Plattform-Bereich: fuer alle Plattform-Rollen sichtbar; die
// schreibenden Endpunkte (z.B. Abos) sind backendseitig auf Platform-Admin
// begrenzt.

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.group.overview',
    items: [
      { href: '/dashboard', labelKey: 'nav.item.dashboard', icon: ICON_PATHS.dashboard },
      // Erfolge & Bestenliste: KERN (kein Tarif-Gate). Die Bestenliste auf der
      // Seite ist zusaetzlich rollen-gegatet – der Nav-Eintrag bleibt fuer alle
      // sichtbar, da Badges/Wrapped jeder Rolle offenstehen.
      { href: '/erfolge', labelKey: 'nav.item.achievements', icon: ICON_PATHS.trophy },
    ],
  },
  {
    // Betrieb: das taegliche Arbeiten (laufende Auftraege planen & Anfragen).
    labelKey: 'nav.group.operations',
    items: [
      { href: '/auftraege', labelKey: 'nav.item.orders', icon: ICON_PATHS.orders },
      { href: '/plantafel', labelKey: 'nav.item.planboard', icon: ICON_PATHS.calendar },
      { href: '/anfragen', labelKey: 'nav.item.requests', icon: ICON_PATHS.inbox, rollen: EMPFANG_ROLLEN, badge: 'anfragen' },
    ],
  },
  {
    // Annahme & Kalkulation: Fahrzeuge aufnehmen und Angebote kalkulieren.
    labelKey: 'nav.group.intake',
    items: [
      { href: '/kalkulation', labelKey: 'nav.item.calculation', icon: ICON_PATHS.kalkulation },
      // Zwei Annahme-Wege nebeneinander: schnelles Formular vs. 3D-Erfassung.
      { href: '/fahrzeugannahme', labelKey: 'nav.item.intakeQuick', icon: ICON_PATHS.intake },
      { href: '/schadenserfassung', labelKey: 'nav.item.intake3d', icon: ICON_PATHS.inspection3d, feature: 'inspektion' },
      // Dellenkalkulation (Smart Repair / PDR): 3D-Klick -> Sofortpreis, ab Basic.
      { href: '/dellenkalkulation', labelKey: 'nav.item.dellenkalkulation', icon: ICON_PATHS.kalkulation, feature: 'dellenkalkulation' },
      { href: '/schichtdicke', labelKey: 'nav.item.schichtdicke', icon: ICON_PATHS.schichtdicke, feature: 'schichtdicke' },
    ],
  },
  {
    labelKey: 'nav.group.masterdata',
    items: [
      { href: '/kunden', labelKey: 'nav.item.customers', icon: ICON_PATHS.customers },
      { href: '/fahrzeuge', labelKey: 'nav.item.vehicles', icon: ICON_PATHS.vehicles },
      { href: '/leistungen', labelKey: 'nav.item.services', icon: ICON_PATHS.services },
    ],
  },
  {
    labelKey: 'nav.group.finance',
    items: [
      { href: '/rechnungen', labelKey: 'nav.item.invoices', icon: ICON_PATHS.invoices },
      // E-Rechnungs-Eingang: KERN (§14-Empfangspflicht) – bewusst KEIN feature-Gate.
      // LEITUNG_ROLLEN, da Eingangsrechnungen fiskalische Dokumente mit Lieferanten-
      // Bankdaten sind (Backend-Controller: @Roles(OWNER, MANAGER)).
      { href: '/eingangsrechnungen', labelKey: 'nav.item.incomingInvoices', icon: ICON_PATHS.inbox, rollen: LEITUNG_ROLLEN },
      // Kassenbuch: KERN (GoBD-Pflicht bei Barzahlungen) – bewusst KEIN feature-Gate.
      // EMPFANG_ROLLEN, weil die Rezeption die Barkasse fuehrt (Backend-Controller:
      // @Roles(OWNER, MANAGER, RECEPTIONIST); Export ist Leitung-only).
      { href: '/kassenbuch', labelKey: 'nav.item.cashbook', icon: ICON_PATHS.revenue, rollen: EMPFANG_ROLLEN },
      // Mahn-Cockpit: ueberfaellige Rechnungen anmahnen. EMPFANG_ROLLEN, weil der
      // Backend-mahnen-Endpunkt auch der Rezeption erlaubt (nicht nur Leitung).
      { href: '/mahnungen', labelKey: 'nav.item.reminders', icon: ICON_PATHS.mahnung, rollen: EMPFANG_ROLLEN, feature: 'mahnwesen' },
      { href: '/auswertungen', labelKey: 'nav.item.reports', icon: ICON_PATHS.analytics, rollen: LEITUNG_ROLLEN, feature: 'auswertungen' },
      { href: '/buchhaltung', labelKey: 'nav.item.accounting', icon: ICON_PATHS.revenue, rollen: LEITUNG_ROLLEN, feature: 'export' },
    ],
  },
  {
    // Material: eigener Bestand/Einkauf (intern) + Einkauf bei Großhändlern (Marktplatz).
    labelKey: 'nav.group.material',
    items: [
      { href: '/shop', labelKey: 'nav.item.shop', icon: ICON_PATHS.box },
      { href: '/marktplatz', labelKey: 'nav.item.marketplace', icon: ICON_PATHS.marketplace },
      { href: '/geraetemarkt', labelKey: 'nav.item.geraetemarkt', icon: ICON_PATHS.tag },
    ],
  },
  {
    // Organisation: reine Org-Daten (Team, Standorte, Zeiten). System/Konto/
    // Support-Eintraege sind bewusst NICHT hier, sondern im Topbar-Account-Menue
    // (ACCOUNT_NAV_ITEMS) – Verwalten ist vom taeglichen Arbeiten getrennt.
    labelKey: 'nav.group.organization',
    items: [
      { href: '/standorte', labelKey: 'nav.item.locations', icon: ICON_PATHS.locations, rollen: LEITUNG_ROLLEN },
      { href: '/mitarbeiter', labelKey: 'nav.item.staff', icon: ICON_PATHS.staff },
      { href: '/zeiterfassung', labelKey: 'nav.item.time', icon: ICON_PATHS.time, feature: 'zeiterfassung' },
    ],
  },
  {
    labelKey: 'nav.group.platform',
    items: [
      { href: '/cockpit', labelKey: 'nav.item.cockpit', icon: ICON_PATHS.cockpit, rollen: PLATTFORM_ROLLEN },
      { href: '/plattform-analysen', labelKey: 'nav.item.platformAnalytics', icon: ICON_PATHS.globe, rollen: PLATTFORM_ROLLEN },
      { href: '/plattform-marktplatz', labelKey: 'nav.item.platformMarketplace', icon: ICON_PATHS.tag, rollen: PLATTFORM_ROLLEN },
      { href: '/plattform-geraetemarkt', labelKey: 'nav.item.platformGeraetemarkt', icon: ICON_PATHS.audit, rollen: PLATTFORM_ROLLEN },
      { href: '/plattform-support', labelKey: 'nav.item.platformSupport', icon: ICON_PATHS.support, rollen: PLATTFORM_ROLLEN },
      // Sicherheit (Sentinel): fuer alle Plattform-Rollen sichtbar (lesen); die
      // Sperr-Aktionen sind in der Seite + backendseitig auf PLATFORM_ADMIN begrenzt.
      { href: '/plattform-sicherheit', labelKey: 'nav.item.platformSecurity', icon: ICON_PATHS.shield, rollen: PLATTFORM_ROLLEN },
      // Newsletter-Versand ist Platform-Admin vorbehalten (Backend @Roles(PLATFORM_ADMIN)).
      { href: '/plattform-newsletter', labelKey: 'nav.item.platformNewsletter', icon: ICON_PATHS.inbox, rollen: ['platform_admin'] },
      { href: '/abos', labelKey: 'nav.item.subscriptions', icon: ICON_PATHS.subscription, rollen: PLATTFORM_ROLLEN },
    ],
  },
];

// System/Konto-Eintraege: bewusst NICHT in der Haupt-Sidebar, sondern im
// Topbar-Account-Menue (Verwalten vom Arbeiten getrennt). Gleiche NavItem-Form
// wie NAV_GROUPS, damit Rollen-/Tarif-Filter identisch greifen. Alle Routen
// bleiben so fuer dieselben Rollen erreichbar wie zuvor.
export const ACCOUNT_NAV_ITEMS: NavItem[] = [
  // Audit-Log lebt als Tab in den Einstellungen (die /audit-Route leitet dorthin).
  { href: '/einstellungen', labelKey: 'nav.item.settings', icon: ICON_PATHS.settings },
  { href: '/abo', labelKey: 'nav.item.subscription', icon: ICON_PATHS.subscription, rollen: ['owner'] },
  // Weiterempfehlen (Empfehlungs-/Affiliate-Programm): Wachstumskanal, nur Inhaber
  // (Backend @Roles(OWNER)). Kein Tarif-Gate – auch Testphasen-Betriebe duerfen werben.
  { href: '/weiterempfehlen', labelKey: 'nav.item.affiliate', icon: ICON_PATHS.gift, rollen: ['owner'] },
  // Datenpannen-Register (Art. 33/34 DSGVO): KERN (Pflicht, kein Tarif-Gate),
  // aber nur Inhaber/Admin (Backend @Roles(OWNER); platform_admin per Bypass).
  { href: '/datenpannen', labelKey: 'nav.item.incidents', icon: ICON_PATHS.audit, rollen: INHABER_ROLLEN },
  // Datenschutz-Cockpit (DSGVO Art. 15/17): Pruefliste faelliger Kunden,
  // Datenauszug/Loeschung, Betriebs-Export. Leitung (OWNER/MANAGER).
  { href: '/datenschutz-cockpit', labelKey: 'nav.item.dsgvoCockpit', icon: ICON_PATHS.shield, rollen: LEITUNG_ROLLEN },
];

// Hilfe/Support-Eintrag: seltener gebraucht, daher ebenfalls ins Account-Menue.
export const SUPPORT_NAV_ITEMS: NavItem[] = [
  { href: '/hilfe', labelKey: 'nav.item.help', icon: ICON_PATHS.help },
  { href: '/assistent', labelKey: 'nav.item.assistant', icon: ICON_PATHS.assistant },
];

// Alle Nav-Eintraege flach – Sidebar-Gruppen PLUS Account-/Support-Menue.
// Quelle fuer die Command-Palette (Suche & Verlauf), damit auch die ins
// Account-Menue verschobenen Routen weiterhin per ⌘K auffindbar bleiben.
export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...ACCOUNT_NAV_ITEMS,
  ...SUPPORT_NAV_ITEMS,
];

/**
 * Filtert NavItems nach Rolle UND Tarif-Feature – identisch zur Sidebar-Logik,
 * damit das Account-Menue exakt dieselben Sichtbarkeitsregeln nutzt.
 */
export function filterNavItems(
  items: NavItem[],
  role: string | undefined,
  hasFeature: (feature?: string) => boolean,
): NavItem[] {
  return items.filter(
    (item) => (!item.rollen || (!!role && item.rollen.includes(role))) && hasFeature(item.feature),
  );
}

/**
 * Rendert die gruppierten Navigations-Links (rollengefiltert, aktiver Zustand).
 * `onNavigate` wird beim Klick auf einen Link aufgerufen – der mobile Drawer
 * schliesst sich darüber selbst.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useT();
  const hasFeature = useHasFeature();
  const [anfragenCount, setAnfragenCount] = useState(0);

  // Zaehler neuer Anfragen laden (nur wenn der Nutzer den Bereich sehen darf).
  // Aktualisiert bei jedem Routenwechsel, damit das Badge nach dem Bearbeiten sinkt.
  useEffect(() => {
    if (!user || !EMPFANG_ROLLEN.includes(user.role)) {
      setAnfragenCount(0);
      return;
    }
    let aktiv = true;
    api
      .get<{ neu: number }>('/booking-requests/count')
      .then((r) => aktiv && setAnfragenCount(r.neu))
      .catch(() => undefined);
    return () => {
      aktiv = false;
    };
  }, [user, pathname]);

  return (
    <>
      {NAV_GROUPS.map((group) => {
        // Eintraege nach Rolle UND Tarif-Feature filtern; leere Gruppen entfallen.
        // Feature-gegatete Items bleiben verborgen, solange die Entitlements noch
        // laden (kein Zeigen-dann-Verstecken). Gleiche Logik wie das Account-Menue.
        const sichtbar = filterNavItems(group.items, user?.role, hasFeature);
        if (sichtbar.length === 0) return null;
        return (
          <div key={group.labelKey}>
            <p className="nav-group-label">{t(group.labelKey)}</p>
            {sichtbar.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`nav-link ${active ? 'nav-link-active' : ''}`}
                >
                  <span className={active ? 'text-copper' : 'text-chrome-400'}>
                    <Icon className="h-[18px] w-[18px] shrink-0">{item.icon}</Icon>
                  </span>
                  <span className="flex-1">{t(item.labelKey)}</span>
                  {item.badge === 'anfragen' && anfragenCount > 0 && (
                    <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-copper px-1.5 text-[11px] font-semibold text-ink-950">
                      {anfragenCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
