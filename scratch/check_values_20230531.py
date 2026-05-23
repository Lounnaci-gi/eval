import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'epeor-analytics', 'backend')))
import main

main.load_all_data_to_memory()

target_date = "20230531"
EMPTY_DATE_VALUES = {'', '        ', '19000101', '00000000', None}

# 1. Calculate FACTURES only
fact_count = 0
fact_sum = 0.0
fact_subscribers = set()
for r in main.MEM_FACTURES:
    tp = str(r.get('TYPE') or '').strip()
    typabon = str(r.get('TYPABON') or '').strip()
    datsaisie = str(r.get('DATSAISIE') or '').strip()
    datreg = str(r.get('DATREG') or '').strip()
    numab = str(r.get('NUMAB') or '').strip()
    monttc = float(r.get('MONTTC') or 0)
    
    if tp == 'E' and '10' <= typabon <= '19' and typabon != '15':
        if datsaisie and datsaisie <= target_date:
            if datreg in EMPTY_DATE_VALUES or datreg > target_date:
                fact_count += 1
                fact_subscribers.add(numab)
                fact_sum += monttc

# 2. Calculate AVOIRS only
avoir_count = 0
avoir_sum = 0.0
avoir_subscribers = set()
for r in main.MEM_AVOIRS:
    tp = str(r.get('TYPE') or '').strip()
    typabon = str(r.get('TYPABON') or '').strip()
    datsaisie = str(r.get('DATSAISIE') or '').strip()
    datreg = str(r.get('DATREG') or '').strip()
    datanul = str(r.get('DATANUL') or '').strip()
    numab = str(r.get('NUMAB') or '').strip()
    monttc = float(r.get('MONTTC') or 0)
    
    if tp == 'E' and '10' <= typabon <= '19' and typabon != '15':
        if datsaisie and datsaisie <= target_date:
            if datanul and datanul > target_date:
                if datreg in EMPTY_DATE_VALUES or datreg > target_date:
                    avoir_count += 1
                    avoir_subscribers.add(numab)
                    avoir_sum += monttc

print(f"Target Date: {target_date}")
print(f"FACTURES: count={fact_count}, sum={fact_sum:.2f}, unique_subs={len(fact_subscribers)}")
print(f"AVOIRS: count={avoir_count}, sum={avoir_sum:.2f}, unique_subs={len(avoir_subscribers)}")

print("\nPossible Options:")
print(f"Option A (Factures only):         {fact_sum:.2f} DA")
print(f"Option B (Factures + Avoirs):     {fact_sum + avoir_sum:.2f} DA")
print(f"Option C (Factures - Avoirs):     {fact_sum - avoir_sum:.2f} DA")
print(f"Option D (Factures - Avoirs? wait, is avoir_sum positive?): {fact_sum - avoir_sum:.2f} DA")
print(f"Expected Amount:                  36656791.87 DA")

# Let's see if we can find another combination or if datanul filter in AVOIRS is different.
# What if AVOIRS are NOT filtered by DATANUL > target_date?
avoir_count_no_datanul = 0
avoir_sum_no_datanul = 0.0
for r in main.MEM_AVOIRS:
    tp = str(r.get('TYPE') or '').strip()
    typabon = str(r.get('TYPABON') or '').strip()
    datsaisie = str(r.get('DATSAISIE') or '').strip()
    datreg = str(r.get('DATREG') or '').strip()
    numab = str(r.get('NUMAB') or '').strip()
    monttc = float(r.get('MONTTC') or 0)
    
    if tp == 'E' and '10' <= typabon <= '19' and typabon != '15':
        if datsaisie and datsaisie <= target_date:
            if datreg in EMPTY_DATE_VALUES or datreg > target_date:
                avoir_count_no_datanul += 1
                avoir_sum_no_datanul += monttc

print(f"\nAVOIRS (no DATANUL filter): count={avoir_count_no_datanul}, sum={avoir_sum_no_datanul:.2f}")
print(f"Option E (Factures + Avoirs no datanul): {fact_sum + avoir_sum_no_datanul:.2f} DA")
print(f"Option F (Factures - Avoirs no datanul): {fact_sum - avoir_sum_no_datanul:.2f} DA")
