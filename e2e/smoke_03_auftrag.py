"""
Flow 3 - Auftrag anlegen (einfachste Variante) -> Detail oeffnen ->
Status weiterschalten -> Uebergang wird korrekt uebernommen.
"""

from __future__ import annotations

import re

from _helpers import expect, login, Page, run_flow, unique


def flow(page: Page) -> None:
    login(page)

    page.goto("/auftraege/", wait_until="networkidle")
    expect(page.get_by_role("heading", name="Aufträge").first).to_be_visible()

    # Anlage-Modal oeffnen.
    page.get_by_role("button", name="Neuer Auftrag").click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()

    # Kunde ist Pflicht: ersten echten Eintrag waehlen (Index 0 = Platzhalter).
    kunde_select = dialog.locator("select").first
    kunde_select.select_option(index=1)

    # Genau eine Position mit Beschreibung + Einzelpreis (Rest darf leer bleiben).
    bez = f"E2E-Position {unique()}"
    dialog.get_by_placeholder("Beschreibung").first.fill(bez)
    dialog.get_by_placeholder("Einzelpreis").first.fill("120")

    # Auftrag anlegen.
    dialog.get_by_role("button", name="Auftrag anlegen").click()

    # Modal schliesst; neuer Auftrag steht oben in der Liste.
    expect(page.get_by_role("dialog")).to_have_count(0)

    # Detail des obersten (= neuesten) Auftrags oeffnen ueber den Nummern-Link.
    erste_zeile = page.locator("table.table tbody tr").first
    auftragsnummer = erste_zeile.locator("td").first.inner_text().strip()
    erste_zeile.get_by_role("link").first.click()
    page.wait_for_url("**/auftraege/detail/**")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name=auftragsnummer).first).to_be_visible()

    # Status weiterschalten: erster Vorwaerts-Button unter "Naechster Schritt".
    expect(page.get_by_text("Nächster Schritt")).to_be_visible()
    vorwaerts = page.get_by_role("button", name=re.compile(r"→"))
    ziel_label = vorwaerts.first.inner_text().replace("→", "").strip()
    vorwaerts.first.click()

    # Nach dem Neuladen: der exakt gleiche Vorwaerts-Button ist weg (Status hat
    # sich bewegt) und das Ziel-Status-Label ist als Badge sichtbar. Die
    # Badge-Komponente rendert <span class="badge-*"> (keine Basisklasse "badge"),
    # daher ueber den sichtbaren Text pruefen.
    expect(page.get_by_role("button", name=f"→ {ziel_label}")).to_have_count(0)
    expect(page.get_by_text(ziel_label, exact=True).first).to_be_visible()


if __name__ == "__main__":
    name, ok, detail = run_flow("smoke_03_auftrag", flow)
    print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}")
    raise SystemExit(0 if ok else 1)
