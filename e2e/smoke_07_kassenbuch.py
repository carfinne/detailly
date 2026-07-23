"""
Flow 7 - Kassenbuch (GoBD-Bargeldkasse). KERN-Flow fuer den Pilot.

Login -> Kassenbuch -> Einnahme + Ausgabe erfassen -> laufender Kassenbestand
schreibt sich korrekt fort -> Tagesabschluss (Festschreiben, Eintrag danach
gesperrt) -> CSV-Export laedt herunter.

Assertions stuetzen sich auf sichtbaren Text (i18n DE), ARIA-Rollen (dialog,
button) und den Download-Event von Playwright - keine blinden sleeps.
"""

from __future__ import annotations

import os
import re

from _helpers import DEFAULT_TIMEOUT_MS, expect, login, Page, run_flow, unique


def _parse_eur(text: str) -> float:
    """de-DE Waehrungstext ('1.234,56 €', '+150,00 €', '−40,00 €') -> float."""
    t = text.strip().replace("−", "-")  # echtes Minuszeichen -> ASCII-Minus
    t = t.replace(".", "")                     # Tausenderpunkte entfernen
    t = re.sub(r"[^0-9,\-]", "", t)            # €, +, Leerzeichen etc. entfernen
    t = t.replace(",", ".")                     # Dezimalkomma -> Punkt
    return float(t)


def _kassenbestand(page: Page) -> float:
    """Liest den Wert der Kassenbestand-Kennzahl (StatCard)."""
    card = page.locator("div.card").filter(has_text="Kassenbestand").first
    return _parse_eur(card.locator("div.text-2xl").first.inner_text())


def _row_for(page: Page, zweck: str):
    """Tabellenzeile zu einem (eindeutigen) Zweck-Text."""
    return page.locator("table tbody tr").filter(has_text=zweck).first


def _add_entry(page: Page, typ_label: str, betrag: str, zweck: str) -> None:
    """Oeffnet das Anlage-Modal, erfasst einen Eintrag und wartet aufs Neuladen."""
    page.get_by_role("button", name="Eintrag hinzufügen").first.click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    # Buchungsart (Einnahme/Ausgabe) ueber den Modal-Umschalter waehlen.
    dialog.get_by_role("button", name=typ_label, exact=True).click()
    # Betrag = einziges number-Input; Zweck = erstes Text-Input im Modal.
    dialog.locator('input[type="number"]').fill(betrag)
    dialog.locator('input.input:not([type="number"])').first.fill(zweck)
    dialog.get_by_role("button", name="Speichern").click()
    # Modal schliesst, Liste laedt neu -> Zeile mit unserem Zweck ist sichtbar.
    # Grosszuegiger Timeout: POST + Reload koennen unter Last dauern.
    expect(page.get_by_role("dialog")).to_have_count(0, timeout=DEFAULT_TIMEOUT_MS)
    expect(page.get_by_text(zweck).first).to_be_visible(timeout=DEFAULT_TIMEOUT_MS)


def flow(page: Page) -> None:
    login(page)

    page.goto("/kassenbuch/", wait_until="networkidle")
    expect(page.get_by_role("heading", name="Kassenbuch").first).to_be_visible(timeout=DEFAULT_TIMEOUT_MS)

    einnahme_zweck = f"E2E-Einnahme {unique()}"
    ausgabe_zweck = f"E2E-Ausgabe {unique()}"

    # 1) Einnahme (+150) und Ausgabe (-40) erfassen.
    _add_entry(page, "Einnahme", "150", einnahme_zweck)
    _add_entry(page, "Ausgabe", "40", ausgabe_zweck)

    einnahme_row = _row_for(page, einnahme_zweck)
    ausgabe_row = _row_for(page, ausgabe_zweck)
    expect(einnahme_row).to_be_visible()
    expect(ausgabe_row).to_be_visible()

    # Betrag-Spalte (Index 4): +150,00 bzw. -40,00 sichtbar.
    expect(einnahme_row.locator("td").nth(4)).to_contain_text("150,00")
    expect(ausgabe_row.locator("td").nth(4)).to_contain_text("40,00")

    # 2) Saldo schreibt sich fort: laufende Bestand-Spalte (Index 5).
    bestand_einnahme = _parse_eur(einnahme_row.locator("td").nth(5).inner_text())
    bestand_ausgabe = _parse_eur(ausgabe_row.locator("td").nth(5).inner_text())
    assert abs(bestand_ausgabe - (bestand_einnahme - 40)) < 0.005, (
        "Saldo-Fortschreibung falsch: "
        f"Einnahme-Bestand={bestand_einnahme}, Ausgabe-Bestand={bestand_ausgabe} "
        f"(erwartet {bestand_einnahme - 40})"
    )

    # Die Kassenbestand-Kennzahl (Headline) entspricht dem laufenden Bestand nach
    # der juengsten Buchung (oberste Zeile) - der Saldo ist konsistent
    # fortgeschrieben. Beide Werte werden erst gelesen, nachdem die Zeilen sichtbar
    # sind (nach abgeschlossenem Reload), daher kein Render-Race.
    bestand_headline = _kassenbestand(page)
    assert abs(bestand_headline - bestand_ausgabe) < 0.005, (
        f"Kassenbestand-Kennzahl {bestand_headline} != laufender Bestand der letzten "
        f"Buchung {bestand_ausgabe}"
    )

    # 3) Tagesabschluss: alle Entwuerfe festschreiben -> danach unveraenderlich.
    page.get_by_role("button", name="Tagesabschluss").click()
    expect(page.get_by_role("dialog")).to_be_visible()
    page.get_by_role("button", name="Alle festschreiben").click()
    expect(page.get_by_role("dialog")).to_have_count(0, timeout=DEFAULT_TIMEOUT_MS)

    # Zeilen neu aufloesen (Tabelle wurde neu gerendert).
    einnahme_row = _row_for(page, einnahme_zweck)
    ausgabe_row = _row_for(page, ausgabe_zweck)
    # Status-Spalte (Index 6) = "Festgeschrieben" (nach POST + Reload).
    expect(einnahme_row.locator("td").nth(6)).to_contain_text("Festgeschrieben", timeout=DEFAULT_TIMEOUT_MS)
    expect(ausgabe_row.locator("td").nth(6)).to_contain_text("Festgeschrieben")
    # Eintrag gesperrt: kein Festschreiben-/Bearbeiten-Button mehr in der Zeile.
    expect(ausgabe_row.get_by_role("button", name="Festschreiben")).to_have_count(0)
    expect(ausgabe_row.get_by_role("button", name="Bearbeiten")).to_have_count(0)

    # 4) CSV-Export laedt eine nicht-leere .csv herunter.
    with page.expect_download() as dl_info:
        page.get_by_role("button", name="CSV-Export").click()
    download = dl_info.value
    assert download.suggested_filename.lower().endswith(".csv"), (
        f"unerwarteter Dateiname: {download.suggested_filename}"
    )
    pfad = download.path()
    assert pfad and os.path.getsize(pfad) > 0, "CSV-Export ist leer"


if __name__ == "__main__":
    name, ok, detail = run_flow("smoke_07_kassenbuch", flow)
    print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}")
    raise SystemExit(0 if ok else 1)
