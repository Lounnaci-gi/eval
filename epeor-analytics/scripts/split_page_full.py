"""Découpe complète de page.tsx en modules."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "src" / "app" / "page.tsx"
COMP = ROOT / "src" / "app" / "components"

lines = PAGE.read_text(encoding="utf-8").splitlines()

BOOTSTRAP = '''if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      args[0] &&
      typeof args[0] === "string" &&
      args[0].includes("width(-1) and height(-1) of chart should be greater than 0")
    ) {
      return;
    }
    originalWarn(...args);
  };
}

'''

VIEW_LOADER = '''const viewLoader = (
  <div className="p-12 flex justify-center">
    <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
  </div>
);
'''

DASHBOARD_HEADER = '''"use client";

''' + BOOTSTRAP + '''
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Users, UserX, TimerOff, Ban, CreditCard, TrendingUp, Settings, LogOut,
  LayoutDashboard, Database, BarChart3, Calendar, ChevronRight, Bell, HelpCircle, Building2,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { apiUrl } from "../lib/api";
import {
  sanitizeUserFacingMessage,
  isBackendConnectionError,
  isDataPathConfigurationRequired,
  formatPeriodLabel,
  ChartContainer,
  type DataPathInfo,
} from "./utils";
import { SecteurDropdown } from "./ui";
import { StatsCard, NavItem } from "./dashboard-ui";
import { SettingsView } from "./SettingsView";

''' + VIEW_LOADER + '''

const GestionAbonnesShell = dynamic(
  () => import("./SubscriberViews").then((m) => ({ default: m.GestionAbonnesShell })),
  { loading: () => viewLoader }
);
const CreancesAbonnesView = dynamic(
  () => import("./CreancesAbonnesView").then((m) => ({ default: m.CreancesAbonnesView })),
  { loading: () => viewLoader }
);
const CreancesInstitutionsView = dynamic(
  () => import("./InstitutionsView").then((m) => ({ default: m.CreancesInstitutionsView })),
  { loading: () => viewLoader }
);
const CreanceDetailView = dynamic(
  () => import("./CreanceViews").then((m) => ({ default: m.CreanceDetailView })),
  { loading: () => viewLoader }
);
const CreanceVentilationView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.CreanceVentilationView })),
  { loading: () => viewLoader }
);
const CreanceRepartitionView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.CreanceRepartitionView })),
  { loading: () => viewLoader }
);
const CreanceCommuneView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.CreanceCommuneView })),
  { loading: () => viewLoader }
);
const BilanActiviteView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.BilanActiviteView })),
  { loading: () => viewLoader }
);

'''

SUBSCRIBER_HEADER = '''"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import dynamic from "next/dynamic";
import { saveAs } from "file-saver";
import {
  Users, UserX, TimerOff, Ban, ChevronRight, ChevronDown, MapPin,
  Search, Printer, FileText, FileSpreadsheet, Percent, RefreshCw, CreditCard,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar,
  PolarAngleAxis, ReferenceLine, LabelList,
} from "recharts";
import { apiUrl } from "../lib/api";
import { ChartContainer, formatDate, buildSubscribersUrl, appendSecteurParam } from "./utils";
import { SecteurDropdown } from "./ui";

const SubscribersEvolutionView = dynamic(
  () => import("./EvolutionView").then((mod) => ({ default: mod.SubscribersEvolutionView })),
  {
    loading: () => (
      <div className="p-12 flex justify-center">
        <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
      </div>
    ),
  }
);

'''

CREANCE_HEADER = '''"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import { saveAs } from "file-saver";
import {
  ChevronRight, ChevronDown, Search, Printer, FileText, FileSpreadsheet,
  Percent, MapPin, BarChart3, Calendar, RefreshCw, CreditCard, Users, Ban,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar,
  PolarAngleAxis, ReferenceLine, LabelList, AreaChart, Area,
} from "recharts";
import { apiUrl } from "../lib/api";
import {
  ChartContainer, formatDate, formatPeriodLabel, appendSecteurParam,
} from "./utils";
import { SecteurDropdown, MultiSelectDropdown, FrenchDateInput } from "./ui";

'''

REPORTS_HEADER = '''"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import { saveAs } from "file-saver";
import {
  ChevronRight, ChevronDown, Search, Printer, FileText, FileSpreadsheet,
  Percent, MapPin, BarChart3, Calendar, RefreshCw, CreditCard, Users,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { apiUrl } from "../lib/api";
import { formatDate, formatPeriodLabel, appendSecteurParam } from "./utils";
import { SecteurDropdown } from "./ui";

'''

CREANCES_ABONNES_HEADER = '''"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import { saveAs } from "file-saver";
import {
  ChevronRight, ChevronDown, Search, Printer, FileText, FileSpreadsheet,
  Percent, MapPin, BarChart3, Calendar, RefreshCw, CreditCard, Users, Building2,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { apiUrl } from "../lib/api";
import { formatDate, appendSecteurParam } from "./utils";
import { SecteurDropdown, MultiSelectDropdown } from "./ui";

'''

INSTITUTIONS_HEADER = '''"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Fragment } from "react";
import { saveAs } from "file-saver";
import {
  ChevronRight, ChevronDown, Search, Printer, FileText, FileSpreadsheet,
  Percent, MapPin, RefreshCw, CreditCard, Users, Building2, Ban,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { apiUrl } from "../lib/api";
import { appendSecteurParam } from "./utils";
import { SecteurDropdown, MultiSelectDropdown } from "./ui";

'''


def export_fn(body: str, names: list[str]) -> str:
    for name in names:
        body = body.replace(f"function {name}(", f"export function {name}(", 1)
    return body


def write(name: str, header: str, body: str, exports: list[str]) -> None:
    path = COMP / name
    path.write_text(header + export_fn(body, exports) + "\n", encoding="utf-8")
    print(f"  {name}: {body.count(chr(10)) + 1} lines")


def main() -> None:
    COMP.mkdir(parents=True, exist_ok=True)

    # 0-indexed slices: start inclusive, end exclusive
    dashboard_body = "\n".join(lines[432:1170])
    dashboard_body = dashboard_body.replace(
        "export default function Dashboard",
        "export default function Dashboard",
        1,
    )

    write(
        "SubscriberViews.tsx",
        SUBSCRIBER_HEADER,
        "\n".join(lines[1170:5597]),
        ["GestionAbonnesShell"],
    )
    write(
        "CreanceViews.tsx",
        CREANCE_HEADER,
        "\n".join(lines[5597:7044]),
        ["CreanceDetailView"],
    )

    reports_body = "\n".join(lines[7044:8924]) + "\n" + "\n".join(lines[10745:11705])
    write(
        "ReportsViews.tsx",
        REPORTS_HEADER,
        reports_body,
        [
            "SubscriberDrillDownView",
            "CreanceVentilationView",
            "CreanceRepartitionView",
            "CreanceCommuneView",
            "BilanActiviteView",
        ],
    )

    write(
        "CreancesAbonnesView.tsx",
        CREANCES_ABONNES_HEADER,
        "\n".join(lines[8924:10745]),
        ["CreancesAbonnesView"],
    )

    write(
        "InstitutionsView.tsx",
        INSTITUTIONS_HEADER,
        "\n".join(lines[11705:]),
        ["CreancesInstitutionsView"],
    )

    dashboard = COMP / "Dashboard.tsx"
    dashboard.write_text(
        DASHBOARD_HEADER + dashboard_body + "\n",
        encoding="utf-8",
    )
    print(f"  Dashboard.tsx: {dashboard_body.count(chr(10)) + 1} lines")

    PAGE.write_text('export { default } from "./components/Dashboard";\n', encoding="utf-8")
    print(f"  page.tsx -> re-export ({len(lines)} lines removed)")


if __name__ == "__main__":
    main()
