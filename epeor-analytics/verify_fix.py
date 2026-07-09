#!/usr/bin/env python
"""Verify that resigned subscriber counts are now consistent."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.main import compute_dashboard_stats, MEM_ABONMENTS

# Compute stats
stats = compute_dashboard_stats()

# Raw count from ABONMENT
raw_resigned = sum(1 for r in MEM_ABONMENTS if str(r.get('ETATCPT','')).strip() == '40')

# Computed counts from stats
types_resigned = sum(t.get('resigned', 0) for t in stats.get('subscriber_types', []))
communes_resigned = sum(c.get('resigned', 0) for c in stats.get('subscriber_communes', []))

print("=" * 70)
print("RESIGNED SUBSCRIBER COUNT VERIFICATION")
print("=" * 70)
print(f"Raw ABONMENT resigned:      {raw_resigned}")
print(f"stats.resigned_subscribers: {stats.get('resigned_subscribers', 0)}")
print(f"Sum subscriber_types:       {types_resigned}")
print(f"Sum subscriber_communes:    {communes_resigned}")
print()
print("✓ PASS" if raw_resigned == stats.get('resigned_subscribers') == types_resigned == communes_resigned
      else "✗ FAIL")
print(f"  All should be: {raw_resigned}")
