import type { Readable } from 'stream';

/**
 * Logische Ablage-Trennung.
 *
 *  - 'private': personenbezogene ODER aufbewahrungspflichtige Dateien
 *    (Inspektions-/Auftragsfotos, Eingangsrechnungen, KYB-/SDB-Belege). Diese
 *    liegen heute unter `private-uploads/` und werden NIE oeffentlich gemountet,
 *    sondern ausschliesslich guard-geschuetzt + tenant-scoped ausgeliefert.
 *  - 'public': bewusst oeffentlich auslieferbare Assets. Heute im Code ungenutzt
 *    (es gibt keinen oeffentlichen Mount mehr), aber als Naht fuer ein spaeteres
 *    CDN-/Public-Bucket vorgesehen; die LocalDisk-Implementierung mappt es auf
 *    das historische `uploads/`-Verzeichnis.
 */
export type StorageBucket = 'private' | 'public';

/** Zusatz-Metadaten beim Schreiben (LocalDisk ignoriert sie; ein Objektspeicher legt sie ab). */
export interface StoragePutOptions {
  /** MIME-Typ, den ein Objektspeicher als Objekt-Metadatum speichern wuerde. */
  contentType?: string;
}

/**
 * Schmale, backend-unabhaengige Datei-Ablage.
 *
 * Ein `key` ist ein RELATIVER, POSIX-artiger Pfad INNERHALB eines Buckets, z. B.
 * `orders/<tenantId>/<datei>.jpg` oder `erechnung/<uuid>.pdf.enc`. Der Aufrufer
 * MUSS bereits einen sicheren key liefern (basename/tenant-scope bleiben in den
 * Feature-Services). Jede Implementierung fuehrt ZUSAETZLICH einen eigenen
 * Traversal-Schutz (Defense-in-Depth), sodass ein key den Bucket nie verlaesst.
 *
 * ===========================================================================
 * NAHT fuer einen Objektspeicher (S3-kompatibel) — BEWUSST NICHT GEBAUT
 * ---------------------------------------------------------------------------
 * Eine zweite Implementierung `ObjectStorage implements StorageAdapter` bildet
 * dieselben fuenf Methoden auf einen S3-kompatiblen Speicher (z. B. Hetzner
 * Object Storage) ab — OHNE dass ein Feature-Service geaendert werden muss, da
 * alle Aufrufer nur dieses Interface kennen:
 *
 *   put(bucket,key,data)  -> PutObject   (S3-Key z. B. `${bucket}/${key}`)
 *   get(bucket,key)       -> GetObject   (Body als Buffer sammeln)
 *   getStream(bucket,key) -> GetObject   (Body als Readable durchreichen)
 *   exists(bucket,key)    -> HeadObject  (404/NotFound => false)
 *   delete(bucket,key)    -> DeleteObject
 *
 * Erwarteter ENV-Satz, wenn STORAGE_DRIVER=s3 (Auswahl zentral in ./index.ts,
 * createStorageFromEnv):
 *   STORAGE_S3_ENDPOINT        z. B. https://fsn1.your-objectstorage.com
 *   STORAGE_S3_REGION          z. B. eu-central
 *   STORAGE_S3_BUCKET          Ziel-Bucket
 *   STORAGE_S3_ACCESS_KEY      Zugriffsschluessel
 *   STORAGE_S3_SECRET_KEY      Geheimschluessel
 *   STORAGE_S3_FORCE_PATH_STYLE 'true' fuer S3-kompatible Nicht-AWS-Endpunkte
 *
 * In DIESEM Change wird KEIN SDK/npm-Paket ergaenzt und KEINE halbfertige
 * S3-Klasse gebaut — nur diese dokumentierte Naht. Ein spaeterer Change fuegt
 * `object-storage.storage.ts` + die Treiber-Verzweigung hinzu.
 * ===========================================================================
 */
export interface StorageAdapter {
  /** Schreibt `data` unter (bucket,key). Legt Zwischenordner an; ueberschreibt vorhandene Objekte. */
  put(bucket: StorageBucket, key: string, data: Buffer, opts?: StoragePutOptions): Promise<void>;

  /** Liest das komplette Objekt als Buffer. Wirft (ENOENT propagiert), wenn es nicht existiert. */
  get(bucket: StorageBucket, key: string): Promise<Buffer>;

  /** Oeffnet einen Lese-Stream (grosse Dateien / direktes Durchreichen an die Antwort). */
  getStream(bucket: StorageBucket, key: string): Promise<Readable>;

  /** Existenzpruefung ohne Lesen. */
  exists(bucket: StorageBucket, key: string): Promise<boolean>;

  /**
   * Loescht das Objekt. NICHT idempotent gedaempft: ein fehlendes Objekt (ENOENT)
   * bzw. ein transienter Fehler wird DURCHGEREICHT (wie fs.unlink) — Aufrufer wie
   * die DSGVO-Loeschung unterscheiden so 'fehlte' (ENOENT) von 'fehlgeschlagen'.
   * Best-Effort-Aufrufer fangen den Fehler selbst ab.
   */
  delete(bucket: StorageBucket, key: string): Promise<void>;
}
