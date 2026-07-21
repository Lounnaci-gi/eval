"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Calendar, MapPin } from "lucide-react";

// ─── MultiSelectDropdown ──────────────────────────────────────────────────────

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const updatePos = () => {
    const btn = buttonRef.current;
    if (!btn) return setPos(null);
    const rect = btn.getBoundingClientRect();
    setPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onPointer = (e: PointerEvent) => {
      const menu = menuRef.current;
      const btn = buttonRef.current;
      if (menu && btn && !menu.contains(e.target as Node) && !btn.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => updatePos();
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  };

  const labelText = selected.length === 0
    ? (placeholder || 'Toutes')
    : selected.length === 1
      ? selected[0]
      : `${selected.length} sélectionnés`;

  const menu = pos ? (
    <div
      ref={menuRef}
      style={{ position: 'absolute', top: pos.top - 4, left: pos.left, width: pos.width, zIndex: 9999 }}
    >
      <div className="max-h-44 overflow-y-auto rounded-2xl border border-[#E4E7EC] bg-white p-3 shadow-lg">
        {options.map(o => (
          <label key={o} className="flex items-center gap-2 text-xs text-[#101828] py-1" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected.includes(o)}
              onChange={(e) => { e.stopPropagation(); toggle(o); }}
              className="h-4 w-4 rounded border-[#D0D5DD] text-brand-600 focus:ring-brand-500"
            />
            <span>{o}</span>
          </label>
        ))}
        <div className="mt-2 flex gap-2 justify-end">
          <button onClick={() => { onChange([]); }} className="text-[10px] font-bold text-brand-600 hover:text-brand-800" type="button">Effacer</button>
          <button onClick={() => setOpen(false)} className="text-[10px] text-[#475467]" type="button">Fermer</button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) setTimeout(updatePos, 0); }}
        onFocus={() => { setOpen(true); setTimeout(updatePos, 0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); setTimeout(updatePos, 0); }
        }}
        className="w-full flex justify-between items-center py-2 px-4 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs font-bold"
      >
        <span className="text-left">
          <span className="font-black">{label}</span>
          <span className="ml-2 font-normal text-[#475467]">{labelText}</span>
        </span>
        <ChevronDown size={14} className="text-[#98A2B3]" />
      </button>
      {open && pos && createPortal(menu, document.body)}
    </div>
  );
}

// ─── FrenchDateInput ─────────────────────────────────────────────────────────

export function FrenchDateInput({
  label,
  value,
  onChange,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const defaultClass = 'block bg-white border border-[#E4E7EC] rounded-xl px-4 py-2.5 text-xs font-bold text-[#101828] outline-none focus:ring-2 focus:ring-brand-500 w-36';
  const formatDisplay = (raw: string) => {
    if (!raw) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
    }
    return raw;
  };

  // Convert focus classes to peer-focus classes to style the custom container when the actual input is focused
  const cleanedClass = (className ?? defaultClass)
    .replace(/\bfocus:ring-2\b/g, 'peer-focus:ring-2')
    .replace(/\bfocus:ring-brand-500\b/g, 'peer-focus:ring-brand-500');

  return (
    <div>
      {label && <div className="text-[11px] font-black text-[#475467] mb-1">{label}</div>}
      <div className="relative">
        <input
          type="date"
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 peer"
          aria-label={label ? `Sélectionner la date ${label}` : 'Sélectionner une date'}
          onClick={(e) => {
            try {
              (e.target as HTMLInputElement).showPicker();
            } catch {}
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              try {
                (e.target as HTMLInputElement).showPicker();
              } catch {}
            }
          }}
        />
        <div
          className={`${cleanedClass} cursor-pointer flex items-center gap-2`}
        >
          <span className="flex-1 text-left">{formatDisplay(value)}</span>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#98A2B3] z-20">
          <Calendar size={14} />
        </div>
      </div>
    </div>
  );
}

// ─── SecteurDropdown ─────────────────────────────────────────────────────────

export function SecteurDropdown({
  sectors,
  selectedSecteur,
  onSelect,
  uniteLabel,
  loading = false,
  allowAll = true,
}: {
  sectors: { code: string; libelle: string }[];
  selectedSecteur: string;
  onSelect: (code: string) => void;
  uniteLabel?: string;
  loading?: boolean;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = loading
    ? 'Chargement des centres…'
    : selectedSecteur
      ? (sectors.find(s => s.code === selectedSecteur)?.libelle ?? selectedSecteur)
      : (allowAll ? `Tous les centres${uniteLabel ? ` — ${uniteLabel}` : ''}` : 'Sélectionner un centre');

  return (
    <div ref={ref} className="relative w-full sm:w-auto max-w-full">
      <button
        type="button"
        disabled={loading}
        onClick={() => !loading && setOpen(o => !o)}
        className="flex w-full sm:w-auto items-center gap-2 pl-4 pr-3 py-2.5 bg-white border border-[#E4E7EC] rounded-2xl text-xs font-bold text-[#344054] hover:border-[#0D83DE] hover:text-[#0D83DE] transition-all shadow-sm min-w-0 sm:min-w-[200px] max-w-full justify-between disabled:opacity-60 disabled:cursor-wait"
      >
        <span className="flex items-center gap-2">
          <MapPin size={14} className={selectedSecteur ? 'text-[#0D83DE]' : 'text-[#98A2B3]'} />
          <span className={selectedSecteur ? 'text-[#0D83DE] font-black' : ''}>{currentLabel}</span>
        </span>
        <ChevronDown size={14} className="text-[#98A2B3] shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 sm:right-auto mt-2 w-full sm:w-64 bg-white border border-[#E4E7EC] rounded-2xl shadow-xl z-50 overflow-hidden max-h-[min(70vh,20rem)] overflow-y-auto">
          {allowAll && (
            <>
              <button
                type="button"
                onClick={() => { onSelect(''); setOpen(false); }}
                className={`w-full text-left px-4 py-3 text-xs font-bold flex items-center gap-2 transition-colors ${
                  !selectedSecteur
                    ? 'bg-blue-50 text-[#0D83DE]'
                    : 'text-[#344054] hover:bg-[#F9FAFB]'
                }`}
              >
                <span className="w-5 h-5 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-[9px] font-black shrink-0">
                  ✦
                </span>
                Tous les centres{uniteLabel ? ` — ${uniteLabel}` : ''}
              </button>
              <div className="border-t border-[#F2F4F7]" />
            </>
          )}
          {sectors.length === 0 && !loading && (
            <p className="px-4 py-3 text-xs text-[#667085] font-medium">
              Aucun centre chargé. Attendez la fin du chargement des données ou ouvrez Paramètres.
            </p>
          )}
          {sectors.map(s => (
            <button
              key={s.code}
              type="button"
              onClick={() => { onSelect(s.code); setOpen(false); }}
              className={`w-full text-left px-4 py-3 text-xs font-bold flex items-center gap-2 transition-colors ${
                selectedSecteur === s.code
                  ? 'bg-blue-50 text-[#0D83DE]'
                  : 'text-[#344054] hover:bg-[#F9FAFB]'
              }`}
            >
              <span className="w-5 h-5 rounded-lg bg-blue-50 text-[#0D83DE] flex items-center justify-center text-[9px] font-black shrink-0">
                {s.code}
              </span>
              {s.libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
