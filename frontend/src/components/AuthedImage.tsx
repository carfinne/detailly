'use client';

// FIX 2 (DSGVO): Foto-Anzeige ueber guard-geschuetzte, tenant-scoped Endpunkte.
//
// Hintergrund: Die Inspektions-Fotos werden nicht mehr oeffentlich-statisch unter
// /uploads ausgeliefert, sondern nur noch nach Auth ueber
// GET /api/v1/inspections/photos/:id(+/thumb). Ein normales <img src=...> sendet
// jedoch KEINEN Authorization-Header. Deshalb laedt diese Komponente das Bild per
// fetch (mit Bearer-Token) als Blob und zeigt es ueber eine Object-URL an. Die
// Object-URL wird bei Unmount/Wechsel freigegeben (kein Memory-Leak).

import { useEffect, useRef, useState } from 'react';
import { authedFileUrl } from '@/lib/api';

interface AuthedImageProps {
  /** API-Pfad relativ zu /api/v1, z.B. "/inspections/photos/<id>/thumb". */
  path: string;
  alt: string;
  className?: string;
}

export default function AuthedImage({ path, alt, className }: AuthedImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    setFailed(false);

    authedFileUrl(path)
      .then((objectUrl) => {
        if (!aktiv) {
          // Komponente schon unmounted -> sofort wieder freigeben.
          URL.revokeObjectURL(objectUrl);
          return;
        }
        // Vorherige Object-URL freigeben, bevor die neue gesetzt wird.
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = objectUrl;
        setSrc(objectUrl);
      })
      .catch(() => {
        if (aktiv) setFailed(true);
      });

    return () => {
      aktiv = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [path]);

  if (failed) {
    return (
      <div
        className={className}
        aria-label={alt}
        role="img"
        style={{ display: 'grid', placeItems: 'center', fontSize: 10 }}
      >
        ✕
      </div>
    );
  }

  if (!src) {
    return <div className={className} aria-hidden="true" />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
