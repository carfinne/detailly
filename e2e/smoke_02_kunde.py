"""
Flow 2 - Kunde anlegen: Kunden-Seite -> Modal -> Pflichtfeld -> speichern ->
erscheint in der Liste.
"""

from __future__ import annotations

from _helpers import expect, login, Page, run_flow, unique


def flow(page: Page) -> None:
    login(page)

    # Zur Kundenliste.
    page.goto("/kunden/", wait_until="networkidle")
    expect(page.get_by_role("heading", name="Kunden").first).to_be_visible()

    # Neuanlage-Modal oeffnen.
    page.get_by_role("button", name="Neuer Kunde").click()

    # Modal-Titel = "Neuer Kunde"; Pflichtfeld privat ist der Nachname.
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()

    nachname = f"Testkunde-{unique()}"
    # Privatkunde (Default): Vorname optional, Nachname Pflicht.
    page.locator("#kunde-vorname").fill("Max")
    page.locator("#kunde-nachname").fill(nachname)
    page.locator("#kunde-email").fill(f"{nachname.lower()}@example.test")
    page.locator("#kunde-ort").fill("Berlin")

    # Speichern.
    dialog.get_by_role("button", name="Speichern").click()

    # Modal schliesst + neuer Kunde erscheint in der Liste (Neuladen ueber onSaved).
    expect(page.get_by_role("dialog")).to_have_count(0)
    expect(page.get_by_role("cell", name=nachname).first).to_be_visible()


if __name__ == "__main__":
    name, ok, detail = run_flow("smoke_02_kunde", flow)
    print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}")
    raise SystemExit(0 if ok else 1)
