import { promises as fsp } from 'fs';
import { existsSync } from 'fs';
import { join, resolve, sep } from 'path';
import { tmpdir } from 'os';
import type { Readable } from 'stream';
import { LocalDiskStorage } from './local-disk.storage';

/**
 * Unit-Tests des LocalDiskStorage-Adapters gegen ein ECHTES temporaeres
 * Basisverzeichnis (kein fs-Mock) – belegt put/get/getStream/exists/delete sowie
 * den Traversal-Schutz und die Bucket-Trennung (privat vs. oeffentlich).
 */

/** Sammelt einen Readable komplett in einen Buffer. */
function collect(stream: Readable): Promise<Buffer> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(Buffer.from(c)));
    stream.on('end', () => res(Buffer.concat(chunks)));
    stream.on('error', rej);
  });
}

describe('LocalDiskStorage', () => {
  let base: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    base = await fsp.mkdtemp(join(tmpdir(), 'detailly-storage-'));
    storage = new LocalDiskStorage(() => base);
  });
  afterEach(async () => {
    await fsp.rm(base, { recursive: true, force: true });
  });

  it('put legt die Datei im richtigen Bucket-Ordner an + get liest exakt zurueck', async () => {
    const data = Buffer.from('hallo welt', 'utf8');
    await storage.put('private', 'orders/T1/a.jpg', data);
    // physisch unter <base>/private-uploads/orders/T1/a.jpg
    const abs = resolve(base, 'private-uploads', 'orders', 'T1', 'a.jpg');
    expect(existsSync(abs)).toBe(true);
    const roh = await storage.get('private', 'orders/T1/a.jpg');
    expect(roh.equals(data)).toBe(true);
  });

  it('private und public landen in getrennten Wurzeln (private-uploads/ vs uploads/)', async () => {
    await storage.put('private', 'x/p.bin', Buffer.from([1]));
    await storage.put('public', 'x/q.bin', Buffer.from([2]));
    expect(existsSync(resolve(base, 'private-uploads', 'x', 'p.bin'))).toBe(true);
    expect(existsSync(resolve(base, 'uploads', 'x', 'q.bin'))).toBe(true);
    // Keine Vermischung.
    expect(existsSync(resolve(base, 'uploads', 'x', 'p.bin'))).toBe(false);
  });

  it('exists spiegelt Anlage + Loeschung wider', async () => {
    expect(await storage.exists('private', 'kyb/none.enc')).toBe(false);
    await storage.put('private', 'kyb/d.enc', Buffer.from('c'));
    expect(await storage.exists('private', 'kyb/d.enc')).toBe(true);
    await storage.delete('private', 'kyb/d.enc');
    expect(await storage.exists('private', 'kyb/d.enc')).toBe(false);
  });

  it('getStream liefert die Bytes als Readable', async () => {
    const data = Buffer.from('streaminhalt-123', 'utf8');
    await storage.put('private', 'erechnung/r.enc', data);
    const stream = await storage.getStream('private', 'erechnung/r.enc');
    const gelesen = await collect(stream);
    expect(gelesen.equals(data)).toBe(true);
  });

  it('get einer fehlenden Datei wirft (ENOENT propagiert)', async () => {
    await expect(storage.get('private', 'kyb/fehlt.enc')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('delete einer fehlenden Datei wirft ENOENT (nicht gedaempft) – fuer die DSGVO-Tri-State-Logik', async () => {
    await expect(storage.delete('private', 'orders/T1/weg.jpg')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  describe('Traversal-Schutz (key darf den Bucket nie verlassen)', () => {
    it('put mit ausbrechendem key wirft und schreibt NICHTS ausserhalb', async () => {
      await expect(
        storage.put('private', '../../etc/passwd', Buffer.from('x')),
      ).rejects.toThrow(/verlaesst den Bucket/);
    });

    it('get/exists/delete mit ausbrechendem key werfen', async () => {
      await expect(storage.get('private', '../secret')).rejects.toThrow(/verlaesst den Bucket/);
      await expect(storage.exists('private', '../secret')).rejects.toThrow(/verlaesst den Bucket/);
      await expect(storage.delete('private', '../secret')).rejects.toThrow(/verlaesst den Bucket/);
    });

    it('ein absoluter key bleibt am Bucket haengen (kein Ausbruch)', async () => {
      // resolve(root, '/etc/passwd') zeigt aus der Wurzel heraus -> muss werfen.
      const abszeichen = sep === '\\' ? 'C:\\Windows\\win.ini' : '/etc/passwd';
      await expect(storage.exists('private', abszeichen)).rejects.toThrow(/verlaesst den Bucket/);
    });
  });
});
