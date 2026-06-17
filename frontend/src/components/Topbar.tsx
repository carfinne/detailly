'use client';

import { useAuth } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/labels';

export function Topbar() {
  const { user, logout } = useAuth();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email;

  return (
    <header className="flex items-center justify-between border-b border-base-700 bg-base-800/60 px-6 py-3">
      <div className="text-sm text-muted md:hidden">
        Detail<span className="text-accent">ly</span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted">{user ? ROLE_LABEL[user.role] ?? user.role : ''}</div>
        </div>
        <button onClick={logout} className="btn-ghost">
          Abmelden
        </button>
      </div>
    </header>
  );
}
