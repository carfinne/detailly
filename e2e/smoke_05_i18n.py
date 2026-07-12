"""
Flow 5 - i18n: Sprache auf EN umschalten (Dashboard-Label wechselt) und
anschliessend zurueck auf DE.
"""

from __future__ import annotations

from _helpers import expect, login, Page, run_flow


def flow(page: Page) -> None:
    login(page)  # landet auf /dashboard

    # Ausgangszustand DE: KPI-Label "Offene Auftraege" sichtbar.
    expect(page.get_by_text("Offene Aufträge").first).to_be_visible()

    # Sprachumschalter (Topbar) oeffnen. aria-label beginnt mit "Sprache wählen".
    page.get_by_role("button", name="Sprache wählen").click()
    page.get_by_role("menuitemradio", name="English").click()

    # EN aktiv: Label wechselt zu "Open orders", DE-Variante verschwindet.
    expect(page.get_by_text("Open orders").first).to_be_visible()
    expect(page.get_by_text("Offene Aufträge")).to_have_count(0)

    # Zurueck auf DE. Der Umschalter traegt jetzt das EN-aria-label.
    page.get_by_role("button", name="Choose language").click()
    page.get_by_role("menuitemradio", name="Deutsch").click()

    expect(page.get_by_text("Offene Aufträge").first).to_be_visible()
    expect(page.get_by_text("Open orders")).to_have_count(0)


if __name__ == "__main__":
    name, ok, detail = run_flow("smoke_05_i18n", flow)
    print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}")
    raise SystemExit(0 if ok else 1)
