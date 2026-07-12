"""
Gemeinsame Helfer fuer die Detailly-Smoke-Suite (Python-Playwright, sync API).

Bewusst dependency-frei: nur `playwright` (bereits installiert), kein pytest,
kein @playwright/test. Konfiguration ueber Umgebungsvariablen, damit die Suite
gegen beliebige Ports/Hosts laeuft (Standard: lokaler Dev-Stack).

  E2E_BASE_URL   Frontend-URL           (Default http://localhost:3000)
  E2E_EMAIL      Login-E-Mail           (Default admin@detailly.de)
  E2E_PASSWORD   Login-Passwort         (Default Detailly2026!)
  E2E_HEADLESS   "0" -> sichtbarer Browser (Default headless=1)
  E2E_SLOWMO     Verzoegerung in ms pro Aktion (Default 0)
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, expect

# Windows-Konsole ist standardmaessig cp1252 -> Symbole wie ⌘ aus dem UI (Topbar)
# oder Umlaute in Fehlermeldungen wuerden print() zum Absturz bringen. Ausgabe
# hart auf UTF-8 stellen (verlustfrei), sonst verdeckt ein Encoding-Fehler den
# eigentlichen Test-Befund.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except Exception:  # noqa: BLE001
        pass

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:3000").rstrip("/")
# Backend-API (fuer den einmaligen Token-Abruf im Setup). Bei Fallback-Ports
# ueber E2E_API_URL ueberschreibbar (z. B. http://localhost:3021).
API_URL = os.environ.get("E2E_API_URL", "http://localhost:3001").rstrip("/")
EMAIL = os.environ.get("E2E_EMAIL", "admin@detailly.de")
PASSWORD = os.environ.get("E2E_PASSWORD", "Detailly2026!")
HEADLESS = os.environ.get("E2E_HEADLESS", "1") != "0"
SLOWMO = int(os.environ.get("E2E_SLOWMO", "0") or "0")

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"

# Grosszuegige Default-Wartezeit: Next.js im Dev-Modus kompiliert die erste
# Anfrage einer Route on-demand, das kann beim ersten Aufruf mehrere Sekunden
# dauern.
DEFAULT_TIMEOUT_MS = 30_000


def unique(prefix: str = "") -> str:
    """Kollisionsfreies Suffix (fuer Testdaten ueber mehrere Laeufe hinweg)."""
    return f"{prefix}{int(time.time() * 1000) % 10_000_000}"


@contextmanager
def browser_page():
    """Frischer Browser-Kontext (isolierter Storage je Flow) inkl. Console-Log-Sammler."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS, slow_mo=SLOWMO)
        context = browser.new_context(base_url=BASE_URL, locale="de-DE")
        context.set_default_timeout(DEFAULT_TIMEOUT_MS)
        page = context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.console_errors = errors  # type: ignore[attr-defined]
        try:
            yield page
        finally:
            context.close()
            browser.close()


def screenshot(page: Page, name: str) -> str:
    """Screenshot in artifacts/ ablegen (nur im Fehlerfall aufgerufen)."""
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    path = ARTIFACTS / f"{name}.png"
    try:
        page.screenshot(path=str(path), full_page=True)
    except Exception:  # noqa: BLE001 - Screenshot darf den Testfehler nie verdecken
        return "<screenshot fehlgeschlagen>"
    return str(path)


_token_cache: str | None = None


def _get_token() -> str:
    """
    Holt EINMAL pro Suite-Lauf ein Access-Token direkt von der API und cached es.

    Hintergrund: Der Login-Endpunkt ist absichtlich hart gedrosselt
    (5 Versuche / 60 s, Brute-Force-Schutz). Wuerde jeder Flow ueber die UI
    einloggen, liefe die Suite ins Rate-Limit (429). Daher: der echte UI-Login
    wird genau einmal in smoke_01_login getestet; alle uebrigen Flows bekommen
    den Auth-Zustand ueber dieses Token injiziert (Standard-Playwright-Muster,
    vgl. storageState) statt ihn erneut einzutippen.
    """
    global _token_cache
    if _token_cache:
        return _token_cache
    req = urllib.request.Request(
        f"{API_URL}/api/v1/auth/login",
        data=json.dumps({"email": EMAIL, "password": PASSWORD}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        _token_cache = json.loads(resp.read().decode("utf-8"))["accessToken"]
    return _token_cache


def login(page: Page) -> None:
    """
    Setzt den authentifizierten Zustand fuer Flows, die den Login nur als
    Vorbedingung brauchen: Token (einmalig geholt) vor dem App-Start in den
    localStorage injizieren, dann direkt aufs Dashboard. Der explizite
    Landing->Login-Pfad wird separat in smoke_01_login getestet.
    """
    token = _get_token()
    page.add_init_script(
        "try { localStorage.setItem('detailly_token', %s); } catch (e) {}" % json.dumps(token)
    )
    page.goto("/dashboard/", wait_until="networkidle")
    # Erfolg = wir bleiben auf dem Dashboard (kein Redirect zurueck auf /login).
    page.wait_for_url("**/dashboard/**", timeout=DEFAULT_TIMEOUT_MS)
    page.wait_for_load_state("networkidle")


def run_flow(name: str, fn) -> tuple[str, bool, str]:
    """
    Fuehrt einen Flow (Funktion, die ein `Page` erwartet) in eigenem Browser aus.
    Liefert (name, ok, detail). Bei Fehler: Screenshot + Konsolenfehler im Detail.
    """
    started = time.time()
    with browser_page() as page:
        try:
            fn(page)
            dauer = time.time() - started
            return (name, True, f"{dauer:.1f}s")
        except Exception as err:  # noqa: BLE001 - Runner faengt bewusst alles ab
            shot = screenshot(page, name)
            cerr = getattr(page, "console_errors", [])
            detail = f"{type(err).__name__}: {err}"
            if cerr:
                detail += f"\n    console-errors: {cerr[:5]}"
            detail += f"\n    screenshot: {shot}"
            return (name, False, detail)


__all__ = [
    "BASE_URL",
    "EMAIL",
    "PASSWORD",
    "DEFAULT_TIMEOUT_MS",
    "browser_page",
    "login",
    "screenshot",
    "unique",
    "run_flow",
    "expect",
    "Page",
]
