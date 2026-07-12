"""
Flow 4 - Rechnung: aus einem Auftrag eine Rechnung erstellen -> Redirect in die
Beleg-Liste -> neuer Beleg erscheint -> Zeilen-Aktionen (PDF) erreichbar.

Hinweis: Detailly hat KEINE eigene Rechnungs-Detailseite. Das "Detail oeffnen"
wird daher als Erreichbarkeit der Zeilenaktionen (ActionMenu -> PDF) geprueft.
"""

from __future__ import annotations

from _helpers import expect, login, Page, run_flow, unique


def _neuen_auftrag_anlegen(page: Page) -> None:
    page.goto("/auftraege/", wait_until="networkidle")
    page.get_by_role("button", name="Neuer Auftrag").click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    dialog.locator("select").first.select_option(index=1)
    dialog.get_by_placeholder("Beschreibung").first.fill(f"Rechnungsposition {unique()}")
    dialog.get_by_placeholder("Einzelpreis").first.fill("250")
    dialog.get_by_role("button", name="Auftrag anlegen").click()
    expect(page.get_by_role("dialog")).to_have_count(0)


def flow(page: Page) -> None:
    login(page)

    # Ausgangsstand der Beleg-Liste (Seed enthaelt mindestens 1 Rechnung).
    page.goto("/rechnungen/", wait_until="networkidle")
    expect(page.get_by_role("heading", name="Belege").first).to_be_visible()
    rows = page.locator("table.table tbody tr")
    # Die Liste laedt entprellt (250ms) NACH dem Mount -> networkidle allein
    # garantiert die Tabelle noch nicht. Erst auf die erste Zeile warten,
    # dann zaehlen (Seed garantiert >= 1 Beleg).
    expect(rows.first).to_be_visible()
    vorher = rows.count()

    # Frischen Auftrag anlegen und dessen Detail oeffnen.
    _neuen_auftrag_anlegen(page)
    page.locator("table.table tbody tr").first.get_by_role("link").first.click()
    page.wait_for_url("**/auftraege/detail/**")
    page.wait_for_load_state("networkidle")

    # Rechnung aus dem Auftrag erstellen -> Backend legt Beleg an, Frontend leitet
    # in die Beleg-Liste um.
    page.get_by_role("button", name="Rechnung erstellen").click()
    page.wait_for_url("**/rechnungen/**")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="Belege").first).to_be_visible()

    # Genau ein Beleg mehr als vorher.
    expect(page.locator("table.table tbody tr")).to_have_count(vorher + 1)

    # "Detail": Zeilen-Aktionsmenue des neuesten Belegs oeffnen -> PDF erreichbar.
    page.locator("table.table tbody tr").first.get_by_role("button").first.click()
    expect(page.get_by_role("menuitem", name="PDF herunterladen").first).to_be_visible()


if __name__ == "__main__":
    name, ok, detail = run_flow("smoke_04_rechnung", flow)
    print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}")
    raise SystemExit(0 if ok else 1)
