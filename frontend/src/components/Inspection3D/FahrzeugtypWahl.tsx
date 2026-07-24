'use client';

// Auswahl des Fahrzeugtyps fuer die 3D-Karosserie (Schadenserfassung,
// Dellenkalkulation, Schichtdicke). Ruhiges, kompaktes Steuerelement: ein
// beschriftetes Dropdown mit Fahrzeug-Icon. Reduced-Motion-sicher (keine
// Animation). Der gewaehlte Typ steuert die geladene Karosserie-Geometrie.

import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';
import { FAHRZEUGTYPEN, type Fahrzeugtyp } from './car-body';

export function FahrzeugtypWahl({
  value,
  onChange,
  disabled,
  className,
}: {
  value: Fahrzeugtyp;
  onChange: (typ: Fahrzeugtyp) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();
  return (
    <label
      className={`inline-flex items-center gap-2 ${className ?? ''}`}
      title={t('fahrzeugtyp.hint')}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-copper-soft text-copper ring-1 ring-copper/20">
        <Icon className="h-4 w-4">{ICON_PATHS.vehicles}</Icon>
      </span>
      <span className="sr-only">{t('fahrzeugtyp.label')}</span>
      <select
        className="select w-auto min-w-[9.5rem]"
        value={value}
        onChange={(e) => onChange(e.target.value as Fahrzeugtyp)}
        disabled={disabled}
        aria-label={t('fahrzeugtyp.label')}
      >
        {FAHRZEUGTYPEN.map((ft) => (
          <option key={ft.id} value={ft.id}>
            {t(ft.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
