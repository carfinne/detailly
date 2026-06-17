'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Solange die Auth-Pruefung laeuft, zuegig zur Anmeldung leiten. Sobald ein
    // angemeldeter Nutzer erkannt wird, ans Dashboard weiterreichen. So bleibt
    // die Startseite nie im Ladezustand haengen (auch ohne erreichbares Backend).
    if (!loading && user) {
      router.replace('/dashboard');
    } else if (!loading) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Sicherheitsnetz: Falls die Auth-Pruefung unerwartet lange dauert, nach
    // kurzer Zeit zur Anmeldeseite wechseln, damit nie nur "Laedt..." sichtbar ist.
    const t = setTimeout(() => router.replace('/login'), 1500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted">Laedt…</p>
    </main>
  );
}
