"""
Runner der Detailly-Smoke-Suite.

Fuehrt alle Flows nacheinander in je eigenem Browser-Kontext aus, sammelt
Ergebnisse, legt bei Fehlern Screenshots in artifacts/ ab und beendet mit
Exit-Code != 0, sobald mindestens ein Flow rot ist (CI-tauglich).

  python e2e/run_all.py

Einzelne Flows laufen auch standalone: `python e2e/smoke_01_login.py`.
"""

from __future__ import annotations

import importlib
import sys
import time

from _helpers import BASE_URL, run_flow

FLOWS = [
    "smoke_01_login",
    "smoke_02_kunde",
    "smoke_03_auftrag",
    "smoke_04_rechnung",
    "smoke_05_i18n",
    "smoke_06_a11y",
]


def main() -> int:
    print(f"Detailly Smoke-Suite  |  BASE_URL={BASE_URL}")
    print("=" * 64)
    ergebnisse: list[tuple[str, bool, str]] = []
    start = time.time()
    for name in FLOWS:
        modul = importlib.import_module(name)
        res = run_flow(name, modul.flow)
        ergebnisse.append(res)
        status = "OK  " if res[1] else "FAIL"
        print(f"[{status}] {res[0]}: {res[2]}")
    print("=" * 64)
    gruen = sum(1 for _, ok, _ in ergebnisse if ok)
    gesamt = len(ergebnisse)
    dauer = time.time() - start
    print(f"Ergebnis: {gruen}/{gesamt} gruen  ({dauer:.1f}s)")
    if gruen != gesamt:
        rot = [n for n, ok, _ in ergebnisse if not ok]
        print(f"ROT: {', '.join(rot)}")
    return 0 if gruen == gesamt else 1


if __name__ == "__main__":
    sys.exit(main())
