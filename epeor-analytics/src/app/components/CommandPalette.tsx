"use client";

import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  Search,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AppView } from "./app-view";

type PaletteCommand = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  view: AppView;
  keywords: string;
  searchSubscribers?: boolean;
};

export function CommandPalette({
  onNavigate,
  t,
}: {
  onNavigate: (view: AppView) => void;
  t: TFunction;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const handleOpenEvent = () => setOpen(true);

    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("epeor:open-command-palette", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("epeor:open-command-palette", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands: PaletteCommand[] = [
    { id: "dashboard", label: t("nav.dashboard"), description: t("command.screens"), icon: LayoutDashboard, view: "dashboard", keywords: "accueil synthèse" },
    { id: "subscribers", label: t("nav.subscribers"), description: t("command.screens"), icon: Users, view: "details", keywords: "abonné client recherche" },
    { id: "financials", label: t("nav.financials"), description: t("command.screens"), icon: BarChart3, view: "creance", keywords: "finance chiffre affaires créance" },
    { id: "subscriber-debts", label: t("nav.subscriberDebts"), description: t("command.screens"), icon: CreditCard, view: "creances_abonnes", keywords: "impayé dette recouvrement" },
    { id: "recovery", label: t("nav.recoveryQueue"), description: t("command.screens"), icon: ListChecks, view: "recovery_queue", keywords: "priorité recouvrement" },
    { id: "institutions", label: t("nav.institutionDebts"), description: t("command.screens"), icon: Building2, view: "creances_institutions", keywords: "organisme payeur institution" },
    { id: "contentieux", label: t("nav.billingPeriods"), description: t("command.screens"), icon: CalendarDays, view: "service_contentieux", keywords: "facturation période litige" },
    { id: "settings", label: t("nav.settings"), description: t("command.screens"), icon: Settings, view: "settings", keywords: "configuration administration" },
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingCommands = commands.filter((command) =>
    `${command.label} ${command.keywords}`.toLocaleLowerCase().includes(normalizedQuery)
  );
  const subscriberCommand: PaletteCommand = {
    id: "subscriber-search",
    label: t("command.subscriberSearch", { query: query.trim() }),
    description: t("nav.subscribers"),
    icon: Search,
    view: "details",
    keywords: "abonné nom numéro",
    searchSubscribers: true,
  };
  const results = normalizedQuery
    ? [subscriberCommand, ...matchingCommands].slice(0, 7)
    : matchingCommands;

  const selectCommand = (command: PaletteCommand) => {
    if (command.searchSubscribers) {
      try {
        sessionStorage.setItem("epeor:subscriber-search", query.trim());
      } catch {
        // Continue to the subscriber view if session storage is unavailable.
      }
    }
    onNavigate(command.view);
    if (command.searchSubscribers) {
      window.dispatchEvent(new Event("epeor:subscriber-search"));
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-[#26313A]/45 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        aria-label={t("command.title")}
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[#DDE5E8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900"
        data-testid="command-palette"
        role="dialog"
      >
        <div className="flex items-center gap-3 border-b border-[#E4E7EC] px-4 dark:border-slate-700">
          <Search aria-hidden="true" className="shrink-0 text-brand-600" size={19} />
          <input
            ref={inputRef}
            aria-activedescendant={results[activeIndex] ? `command-${results[activeIndex].id}` : undefined}
            aria-label={t("command.placeholder")}
            aria-controls="command-results"
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent py-4 text-sm text-[#26313A] outline-none placeholder:text-[#8A989E] focus-visible:outline-none dark:text-slate-100"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (!results.length) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % results.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => (index - 1 + results.length) % results.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                selectCommand(results[activeIndex]);
              }
            }}
            placeholder={t("command.placeholder")}
            type="search"
            value={query}
          />
          <button
            aria-label={t("nav.close")}
            className="rounded-md p-1.5 text-[#66757C] hover:bg-[#F3F6F7] focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2" id="command-results" role="listbox" aria-label={t("command.title")}>
          {results.length ? results.map((command, index) => {
            const Icon = command.icon;
            return (
              <button
                aria-selected={activeIndex === index}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-start transition-colors ${activeIndex === index ? "bg-brand-50 text-brand-800 dark:bg-slate-800 dark:text-slate-100" : "text-[#26313A] hover:bg-[#F3F6F7] dark:text-slate-200 dark:hover:bg-slate-800"}`}
                id={`command-${command.id}`}
                key={command.id}
                onClick={() => selectCommand(command)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-brand-700 dark:bg-slate-700 dark:text-slate-100">
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{command.label}</span>
                  <span className="block text-xs text-[#66757C] dark:text-slate-400">{command.description}</span>
                </span>
                <span className="shrink-0 text-[10px] font-medium text-[#8A989E]">↵</span>
              </button>
            );
          }) : (
            <p className="px-3 py-8 text-center text-sm text-[#66757C] dark:text-slate-400">{t("command.empty")}</p>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[#E4E7EC] px-4 py-2.5 text-[11px] text-[#66757C] dark:border-slate-700 dark:text-slate-400">
          <span>{t("command.hint")}</span>
          <span className="flex items-center gap-1"><kbd>Ctrl</kbd><kbd>K</kbd></span>
        </div>
      </section>
    </div>
  );
}