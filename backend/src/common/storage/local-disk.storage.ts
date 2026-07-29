import { createReadStream, existsSync, promises as fsp } from 'fs';
import { dirname, resolve, sep } from 'path';
import type { Readable } from 'stream';
import { StorageAdapter, StorageBucket, StoragePutOptions } from './storage.interface';
import { storageBaseDir } from './storage-config';

/** Bucket -> Unterverzeichnis unter dem Basisverzeichnis. */
const BUCKET_DIR: Record<StorageBucket, string> = {
  private: 'private-uploads',
  public: 'uploads',
};

/**
 * Standard-Implementierung: Ablage im lokalen Dateisystem.
 *
 * Verhaltensgleich zum bisherigen direkten fs-Zugriff der Feature-Services:
 * derselbe Ordneraufbau (`<base>/private-uploads/<key>`), dieselben fs-Aufrufe
 * (fsp.mkdir/writeFile/readFile/unlink, createReadStream, existsSync) und
 * derselbe Basis-Pfad — nur zentralisiert. `<base>` = STORAGE_LOCAL_PATH || cwd,
 * pro Operation gelesen (identisch zum frueheren `process.cwd()`-Verhalten).
 *
 * Eigener Traversal-Schutz (Defense-in-Depth): jeder key wird streng innerhalb
 * seiner Bucket-Wurzel aufgeloest; ein ausbrechender key wirft. Die Feature-
 * Services behalten ZUSAETZLICH ihre basename-/tenant-Absicherung.
 */
export class LocalDiskStorage implements StorageAdapter {
  /** baseDirFn injizierbar fuer Tests; Default liest STORAGE_LOCAL_PATH || cwd. */
  constructor(private readonly baseDirFn: () => string = storageBaseDir) {}

  async put(
    bucket: StorageBucket,
    key: string,
    data: Buffer,
    _opts?: StoragePutOptions,
  ): Promise<void> {
    const abs = this.resolveKey(bucket, key);
    await fsp.mkdir(dirname(abs), { recursive: true });
    await fsp.writeFile(abs, data);
  }

  async get(bucket: StorageBucket, key: string): Promise<Buffer> {
    return fsp.readFile(this.resolveKey(bucket, key));
  }

  async getStream(bucket: StorageBucket, key: string): Promise<Readable> {
    return createReadStream(this.resolveKey(bucket, key));
  }

  async exists(bucket: StorageBucket, key: string): Promise<boolean> {
    return existsSync(this.resolveKey(bucket, key));
  }

  async delete(bucket: StorageBucket, key: string): Promise<void> {
    await fsp.unlink(this.resolveKey(bucket, key));
  }

  /** Absolute Bucket-Wurzel (<base>/<bucket-dir>). */
  private bucketRoot(bucket: StorageBucket): string {
    return resolve(this.baseDirFn(), BUCKET_DIR[bucket]);
  }

  /**
   * Traversal-fester absoluter Pfad. Der aufgeloeste Pfad MUSS innerhalb der
   * Bucket-Wurzel liegen (Praefix-Check inkl. Trenner), sonst wirft er. Die
   * Feature-Services liefern bereits basename-neutralisierte keys; dies ist die
   * zusaetzliche Absicherung im Adapter.
   */
  private resolveKey(bucket: StorageBucket, key: string): string {
    const root = this.bucketRoot(bucket);
    const abs = resolve(root, key);
    if (abs !== root && !abs.startsWith(root + sep)) {
      throw new Error(`Storage-Key verlaesst den Bucket-Ordner: ${key}`);
    }
    return abs;
  }
}
