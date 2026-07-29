import { resolve, sep } from 'path';

/**
 * ENV-gesteuerte Speicher-Konfiguration (rein + testbar, keine Seiteneffekte).
 *
 * STORAGE_DRIVER    'local' (Default). Weitere Treiber (z. B. 's3') sind als
 *                   Naht dokumentiert (siehe storage.interface.ts), aber NICHT
 *                   gebaut — ein unbekannter Wert faellt sichtbar auf 'local'.
 * STORAGE_LOCAL_PATH Basisverzeichnis, unter dem `private-uploads/` und
 *                   `uploads/` liegen. Default: process.cwd() (= heutiges
 *                   Verhalten). In Produktion auf ein PERSISTENTES Volume
 *                   ausserhalb des App-/Container-Verzeichnisses legen, damit
 *                   Fotos + aufbewahrungspflichtige Belege einen Redeploy
 *                   ueberleben (Container-FS ist ephemer).
 */
export interface StorageConfig {
  /** Aktiver Treiber. Heute immer 'local' (S3 ist Naht, nicht implementiert). */
  driver: 'local';
  /** Absolutes/relatives Basisverzeichnis der lokalen Ablage. */
  localPath: string;
}

/** Liest die Speicher-Konfiguration aus der Umgebung (Default: process.env). */
export function resolveStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  // Nur 'local' ist implementiert. Ein abweichender STORAGE_DRIVER ist die (noch
  // nicht gebaute) Objektspeicher-Naht -> bewusst KEIN Absturz, sondern klarer
  // Fallback auf local; Preflight/Runbook weisen auf die offene Naht hin.
  const localPath =
    env.STORAGE_LOCAL_PATH && env.STORAGE_LOCAL_PATH.trim()
      ? env.STORAGE_LOCAL_PATH.trim()
      : process.cwd();
  return { driver: 'local', localPath };
}

/**
 * Basisverzeichnis fuer die lokale Datei-Ablage (STORAGE_LOCAL_PATH || cwd).
 * Wird sowohl vom LocalDiskStorage-Adapter als auch von den (aus Test-
 * Kompatibilitaet direkt lesenden) Foto-Resolvern genutzt — EINE Quelle der
 * Wahrheit, damit Schreiben und Lesen immer denselben Ort treffen.
 */
export function storageBaseDir(env: NodeJS.ProcessEnv = process.env): string {
  return resolveStorageConfig(env).localPath;
}

/**
 * Preflight-Helfer (rein): liegt `localPath` innerhalb von `appDir`? Ein
 * Storage-Pfad im App-/Container-Verzeichnis geht bei Redeploy verloren.
 */
export function isPathInsideAppDir(localPath: string, appDir: string = process.cwd()): boolean {
  const base = resolve(appDir);
  const target = resolve(localPath);
  return target === base || target.startsWith(base + sep);
}
