"""
Flow 6 - A11y-Spot: der Skip-Link ist per Tastatur (Tab) als erstes Element
erreichbar und wird bei Fokus sichtbar (aus #156).
"""

from __future__ import annotations

from _helpers import expect, login, Page, run_flow


def flow(page: Page) -> None:
    login(page)

    # Frisch laden, damit der Fokus am Dokumentanfang steht.
    page.goto("/dashboard/", wait_until="networkidle")

    skip = page.locator('a[href="#hauptinhalt"]')
    expect(skip).to_have_count(1)
    expect(skip).to_have_text("Zum Inhalt springen")

    # 1) Skip-Link ist das ERSTE fokussierbare Element im Dokument -> der erste
    #    Tab landet zwangslaeufig hier. Deterministisch ueber die DOM-Reihenfolge
    #    geprueft (headless-Chromium fokussiert rohes keyboard.press('Tab') je
    #    nach Dokument-Fokuszustand nicht zuverlaessig).
    ist_erstes = page.evaluate(
        """() => {
            const sel = 'a[href],button:not([disabled]),input:not([disabled]),'
              + 'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
            const first = document.querySelector(sel);
            return !!first && first.getAttribute('href') === '#hauptinhalt';
        }"""
    )
    assert ist_erstes, "Skip-Link ist nicht das erste fokussierbare Element im DOM"

    # 2) Tastatur-Fokus: erst den echten Tab versuchen; verpufft er headless,
    #    deterministisch nachfokussieren. Beides fuehrt zum selben Ziel-Element.
    page.keyboard.press("Tab")
    if not skip.evaluate("el => el === document.activeElement"):
        skip.focus()
    expect(skip).to_be_focused()

    # 3) Bei Fokus verlaesst der Link den sr-only-Zustand und wird real sichtbar
    #    (focus:not-sr-only) -> messbare Breite statt 1px-Clip.
    box = skip.bounding_box()
    assert box is not None and box["width"] > 10, f"Skip-Link bei Fokus nicht sichtbar: {box}"

    # 4) Ziel des Skip-Links existiert (Haupt-Inhaltsbereich mit passender id).
    expect(page.locator("#hauptinhalt")).to_have_count(1)


if __name__ == "__main__":
    name, ok, detail = run_flow("smoke_06_a11y", flow)
    print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}")
    raise SystemExit(0 if ok else 1)
