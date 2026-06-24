"""Extract EvolutionView, layout, SettingsView from page.tsx."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page_path = ROOT / "src" / "app" / "page.tsx"
comp = ROOT / "src" / "app" / "components"

lines = page_path.read_text(encoding="utf-8").splitlines()

evolution_header = '''"use client";

import { useEffect, useState, useMemo } from "react";
import { ChevronDown, Users, TrendingUp } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { apiUrl } from "../lib/api";
import {
  sanitizeEvolutionRows,
  formatPeriodFrench as formatPeriodFrenchSafe,
} from "./utils";

'''

evolution_body = "\n".join(lines[1358:1973])
evolution_body = evolution_body.replace(
    "function SubscribersEvolutionView",
    "export function SubscribersEvolutionView",
    1,
)
(comp / "EvolutionView.tsx").write_text(evolution_header + evolution_body + "\n", encoding="utf-8")

layout_header = '"use client";\n\n'
layout_body = "\n".join(lines[1156:1200])
layout_body = layout_body.replace("function StatsCard", "export function StatsCard", 1)
layout_body = layout_body.replace("function NavItem", "export function NavItem", 1)
(comp / "layout.tsx").write_text(layout_header + layout_body + "\n", encoding="utf-8")

settings_header = '''"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Database, RefreshCw, Search } from "lucide-react";
import { apiUrl } from "../lib/api";

'''

settings_body = "\n".join(lines[15103:])
settings_body = settings_body.replace("function SettingsView", "export function SettingsView", 1)
(comp / "SettingsView.tsx").write_text(settings_header + settings_body + "\n", encoding="utf-8")

new_lines = lines[:1156] + lines[1200:1358] + lines[1973:15103]
page_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
print(f"Done — page.tsx now {len(new_lines)} lines")
