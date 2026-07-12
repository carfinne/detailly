"""
Flow 1 - Login: Landing -> Login -> Dashboard.

Testet den ECHTEN Einstieg (Landing-Seite, Klick auf "Anmelden") und dass das
Dashboard danach mit gerenderten Kennzahlen-Karten erscheint.
"""

from __future__ import annotations

from _helpers import EMAIL, PASSWORD, expect, Page, run_flow


def flow(page: Page) -> None:
    # 1) Landing-Seite oeffnen.
    page.goto("/", wait_until="networkidle")

    # 2) Ueber den Landing-Header zum Login navigieren (Link "Anmelden" -> /login).
    page.get_by_role("link", name="Anmelden").first.click()
    page.wait_for_url("**/login/**")
    page.wait_for_load_state("networkidle")

    # 3) Login-Formular ausfuellen und absenden.
    page.locator("#email").fill(EMAIL)
    page.locator("#password").fill(PASSWORD)
    page.locator('form.card button[type="submit"]').click()

    # 4) Weiterleitung ins Dashboard.
    page.wait_for_url("**/dashboard/**")
    page.wait_for_load_state("networkidle")

    # 5) Dashboard-Inhalt: Kennzahlen-Karten muessen gerendert sein.
    #    "Offene Auftraege" ist ein stabiles KPI-Label (StatCard) der DE-Ansicht.
    expect(page.get_by_text("Offene Aufträge").first).to_be_visible()
    # Begruessungs-Hero traegt den Vornamen aus dem Seed (Admin).
    expect(page.get_by_role("heading").filter(has_text="Admin").first).to_be_visible()


if __name__ == "__main__":
    name, ok, detail = run_flow("smoke_01_login", flow)
    print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}")
    raise SystemExit(0 if ok else 1)
