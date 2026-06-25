import { ValueTransformer } from 'typeorm';
import { encrypt, decrypt } from './encryption';

/**
 * TypeORM-ValueTransformer fuer verschluesselte STRING-Spalten (text/varchar).
 * to: beim Schreiben verschluesseln; from: beim Lesen entschluesseln. null/undefined
 * bleiben unangetastet. Nutzung: `@Column({ type: 'text', nullable: true,
 * transformer: encryptedStringTransformer })`.
 */
export const encryptedStringTransformer: ValueTransformer = {
  to: (value?: string | null) =>
    value === null || value === undefined ? value : encrypt(value),
  from: (value?: string | null) =>
    value === null || value === undefined ? value : decrypt(value),
};

/**
 * Transformer fuer verschluesselte JSON-Spalten. Die Spalte MUSS `type: 'text'`
 * sein (NICHT jsonb/simple-json, sonst Doppel-Serialisierung): hier wird das
 * Objekt selbst serialisiert + verschluesselt. Altbestand (Klartext-JSON ohne
 * Marker) wird beim Lesen trotzdem korrekt geparst (decrypt gibt ihn unveraendert
 * zurueck).
 */
export function encryptedJsonTransformer<T = unknown>(): ValueTransformer {
  return {
    to: (value?: T | null) =>
      value === null || value === undefined ? value : encrypt(JSON.stringify(value)),
    from: (value?: string | null) => {
      if (value === null || value === undefined) return value;
      // decrypt() wirft bei markiertem, aber nicht entschluesselbarem Wert (Key-
      // Fehler) -> propagieren statt still auf null abzubilden (sonst leiser
      // §14-Datenverlust). Markerloser Altbestand (Klartext-JSON) wird normal geparst.
      return JSON.parse(decrypt(value)) as T;
    },
  };
}
