import { resolve, join } from 'path';
import {
  resolveStorageConfig,
  storageBaseDir,
  isPathInsideAppDir,
} from './storage-config';

/**
 * Reine Konfig-Helfer der Speicher-Abstraktion. Belegt: Default = cwd (heutiges
 * Verhalten), STORAGE_LOCAL_PATH ueberschreibt, und die App-Dir-Erkennung fuer die
 * Preflight-Warnung.
 */
describe('resolveStorageConfig / storageBaseDir', () => {
  it('Default: driver=local, localPath=process.cwd() (unveraendertes Verhalten)', () => {
    const cfg = resolveStorageConfig({});
    expect(cfg.driver).toBe('local');
    expect(cfg.localPath).toBe(process.cwd());
    expect(storageBaseDir({})).toBe(process.cwd());
  });

  it('STORAGE_LOCAL_PATH ueberschreibt das Basisverzeichnis', () => {
    const p = resolve('/srv/detailly-data');
    expect(storageBaseDir({ STORAGE_LOCAL_PATH: p })).toBe(p);
  });

  it('leerer/whitespace STORAGE_LOCAL_PATH faellt auf cwd zurueck', () => {
    expect(storageBaseDir({ STORAGE_LOCAL_PATH: '   ' })).toBe(process.cwd());
  });

  it('unbekannter STORAGE_DRIVER faellt sichtbar auf local zurueck (Naht, kein Crash)', () => {
    expect(resolveStorageConfig({ STORAGE_DRIVER: 's3' }).driver).toBe('local');
  });
});

describe('isPathInsideAppDir', () => {
  it('Pfad im App-Verzeichnis -> true (Verlustrisiko)', () => {
    const appDir = process.cwd();
    expect(isPathInsideAppDir(join(appDir, 'private-uploads'), appDir)).toBe(true);
    expect(isPathInsideAppDir(appDir, appDir)).toBe(true);
  });

  it('Pfad ausserhalb (Elternordner / anderes Volume) -> false', () => {
    const appDir = process.cwd();
    expect(isPathInsideAppDir(resolve(appDir, '..'), appDir)).toBe(false);
    expect(isPathInsideAppDir(resolve(appDir, '..', 'detailly-daten-aussen'), appDir)).toBe(false);
  });
});
