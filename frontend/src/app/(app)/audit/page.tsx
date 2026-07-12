'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingCard } from '@/components/ui';

/**
 * Das Audit-Log ist in die Einstellungen umgezogen (Tab „Audit-Log", übersicht-
 * licher an einem Ort). Diese Route bleibt als schlanke Weiterleitung erhalten,
 * damit alte Lesezeichen/Links weiter funktionieren. Statischer Export: der
 * Redirect läuft erst clientseitig nach dem Mount (window/Router-Kontext).
 */
export default function AuditRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/einstellungen?tab=audit');
  }, [router]);
  return <LoadingCard />;
}
