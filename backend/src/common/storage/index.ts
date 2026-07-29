import { LocalDiskStorage } from './local-disk.storage';
import { resolveStorageConfig } from './storage-config';
import { StorageAdapter } from './storage.interface';

export * from './storage.interface';
export * from './storage-config';
export { LocalDiskStorage } from './local-disk.storage';

/**
 * Erzeugt den konfigurierten Storage-Adapter. HEUTE immer LocalDiskStorage.
 *
 * Naht: sobald eine Objektspeicher-Implementierung existiert, hier auf
 * `resolveStorageConfig(env).driver === 's3'` verzweigen und den S3-Adapter
 * zurueckgeben. Alle Feature-Services bleiben unveraendert (sie kennen nur den
 * `storage`-Singleton bzw. das Interface).
 */
export function createStorageFromEnv(env: NodeJS.ProcessEnv = process.env): StorageAdapter {
  resolveStorageConfig(env); // validiert/liest die Konfig (Naht-Verzweigung folgt hier)
  return new LocalDiskStorage();
}

/**
 * Prozessweiter Default-Adapter. Feature-Services importieren diesen direkt
 * (kein Konstruktor-Parameter), damit ihre bestehenden Unit-Tests, die die
 * Services mit `new Service(repos)` bauen und `fs`/`fsp` mocken, unveraendert
 * gruen bleiben — die Mocks greifen weiter, weil der Adapter dieselben
 * fs-Modulfunktionen nutzt.
 */
export const storage: StorageAdapter = createStorageFromEnv();
