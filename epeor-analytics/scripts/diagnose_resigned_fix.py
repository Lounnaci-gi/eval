#!/usr/bin/env python
"""Diagnose and verify resigned subscriber counts."""
import sys
sys.path.insert(0, r'd:\eval\epeor-analytics')

from backend.main import (
    compute_dashboard_stats,
    MEM_ABONMENTS,
    MEM_ABONNES,
    _abonne_codcom,
    _commune_map_for_centre,
    abonments_by_numab
)

print("=" * 70)
print("RESIGNED SUBSCRIBER DIAGNOSTIC")
print("=" * 70)

# Get stats
stats = compute_dashboard_stats()

# Raw counts
raw_resigned = sum(1 for r in MEM_ABONMENTS if str(r.get('ETATCPT','')).strip() == '40')
types_resigned_sum = sum(t.get('resigned', 0) for t in stats.get('subscriber_types', []))
communes_resigned_sum = sum(c.get('resigned', 0) for c in stats.get('subscriber_communes', []))

print(f"stats.resigned_subscribers:     {stats.get('resigned_subscribers', 0)}")
print(f"Raw ABONMENT resigned count:    {raw_resigned}")
print(f"Sum of subscriber_types resigned:    {types_resigned_sum}")
print(f"Sum of subscriber_communes resigned: {communes_resigned_sum}")
print()

# Find discrepancies
resigned_numabs = {str(r.get('NUMAB', '')).strip().upper() for r in MEM_ABONMENTS if str(r.get('ETATCPT','')).strip() == '40'}
abonne_with_typabon = {str(r.get('NUMAB', '')).strip().upper() for r in MEM_ABONNES if str(r.get('TYPABON', '')).strip()}
abonne_empty_typabon = [str(r.get('NUMAB', '')).strip().upper() for r in MEM_ABONNES if str(r.get('TYPABON', '')).strip() == '']

print(f"Resigned NUMABs: {len(resigned_numabs)}")
print(f"ABONNE NUMABs with TYPABON: {len(abonne_with_typabon)}")
print(f"ABONNE NUMABs with empty TYPABON: {len(abonne_empty_typabon)}")

# Resigned with no ABONNE record or empty TYPABON
missed = resigned_numabs - abonne_with_typabon
print(f"Resigned NUMABs missing from ABONNE with TYPABON: {len(missed)}")
print(f"  Sample: {sorted(list(missed))[:10]}")

# Resigned with empty TYPABON in ABONNE
empty_resigned = [n for n in abonne_empty_typabon if n in abonments_by_numab and str(abonments_by_numab[n].get('ETATCPT','')).strip() == '40']
print(f"Resigned ABONNE records with empty TYPABON: {len(empty_resigned)}")
print(f"  Sample: {empty_resigned[:10]}")

print()
print("SUMMARY:")
print(f"  - Backend stats.resigned_subscribers should be: {raw_resigned}")
print(f"  - Detailed table totals currently show: {types_resigned_sum} (from types) or {communes_resigned_sum} (from communes)")
print(f"  - Difference: {raw_resigned - types_resigned_sum}")
print(f"  - Missing subscribers are those with: empty TYPABON ({len(empty_resigned)}) or no ABONNE record ({len(missed)})")
