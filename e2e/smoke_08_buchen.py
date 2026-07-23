"""
Flow 8 - Oeffentliches Buchungsportal (Anfrage-Modus). KERN-Flow fuer den Pilot.

Oeffentliche Buchungsseite (/buchen?b=<slug>) -> Kontakt + Fahrzeug + Termin
angeben -> unverbindliche Terminanfrage absenden -> Referenz-Bestaetigung ->
danach als Leitung eingeloggt unter /anfragen als neue Anfrage sichtbar.

Deckt den rechtssicheren Anfrage-Modus ab (Default-Modus des Betriebs; es kommt
KEIN entgeltlicher Vertrag zustande). Der Slug `pilotbetrieb` stammt aus dem
Demo-Seed (backend/src/database/seed.ts).
"""

from __future__ import annotations

from datetime import datetime, timedelta

from _helpers import DEFAULT_TIMEOUT_MS, expect, login, Page, run_flow, unique

SLUG = "pilotbetrieb"


def _future_datetime_local() -> str:
    """+3 Tage, 10:00 Uhr - sicher in der Zukunft, Format fuer <input datetime-local>."""
    return (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%dT10:00")


def flow(page: Page) -> None:
    name = f"E2E-Buchung {unique()}"
    fahrzeug = f"VW Golf 7 · {unique()}"

    # 1) Oeffentliche Buchungsseite (kein Login noetig).
    page.goto(f"/buchen/?b={SLUG}", wait_until="networkidle")

    # Anfrage-Modus (Default): unverbindlicher Absende-Button ist sichtbar.
    # Grosszuegiger Timeout: die Seite laedt Betriebsdaten async (LoadingCard),
    # das kann unter Last dauern - erst danach rendert das Formular.
    submit = page.get_by_role("button", name="Unverbindlich anfragen")
    expect(submit).to_be_visible(timeout=DEFAULT_TIMEOUT_MS)

    # Pflicht: Name + (E-Mail ODER Telefon). Hier beides.
    page.locator("#name").fill(name)
    page.locator("#email").fill(f"e2e-{unique()}@example.com")
    page.locator("#phone").fill("+49 170 1234567")
    page.locator("#fahrzeug").fill(fahrzeug)

    # Leistung (optional) - erste echte Leistung waehlen, wenn Select vorhanden.
    leistung = page.locator("#leistung")
    if leistung.count() > 0:
        leistung.select_option(index=1)

    # Termin waehlen: datetime-local (Slot-Modus aus) oder Slot-Picker (Slot-Modus an).
    if page.locator("#wunschtermin").count() > 0:
        page.locator("#wunschtermin").fill(_future_datetime_local())
        # Pflichtinfo-Zusammenfassung spiegelt den Termin (nicht mehr "Kein Termin gewählt").
        expect(page.get_by_text("Kein Termin gewählt")).to_have_count(0)
    elif page.locator("#slot-datum").count() > 0:
        page.locator("#slot-datum").fill((datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"))
        slot = page.get_by_role("option")
        if slot.count() > 0:
            slot.first.click()

    # 2) Anfrage absenden.
    submit.click()

    # 3) Bestaetigung mit Referenz (nach POST-Roundtrip -> grosszuegiger Timeout).
    expect(page.get_by_role("heading", name="Anfrage gesendet")).to_be_visible(timeout=DEFAULT_TIMEOUT_MS)
    expect(page.get_by_text("Ihre Referenz:")).to_be_visible()

    # 4) Als Leitung eingeloggt: Anfrage taucht unter /anfragen auf (Status "neu").
    login(page)
    page.goto("/anfragen/", wait_until="networkidle")
    expect(page.get_by_role("heading", name="Anfragen").first).to_be_visible(timeout=DEFAULT_TIMEOUT_MS)
    expect(page.get_by_text(name).first).to_be_visible(timeout=DEFAULT_TIMEOUT_MS)
    expect(page.get_by_text(fahrzeug).first).to_be_visible()


if __name__ == "__main__":
    res_name, ok, detail = run_flow("smoke_08_buchen", flow)
    print(f"[{'OK' if ok else 'FAIL'}] {res_name}: {detail}")
    raise SystemExit(0 if ok else 1)
