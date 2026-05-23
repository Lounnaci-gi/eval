import sys
import os

# Add backend folder to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'epeor-analytics', 'backend')))

import main

# Load all data to memory
main.load_all_data_to_memory()

# We test with the date from the user's SQL query: 20220131
target_date = "20230531"

print("\n" + "="*80)
print(f"RUNNING INTEGRITY TEST ON ADAPTED RECEIVABLES FOR DATE {target_date}")
print("="*80)

# 1. Query the endpoint get_creance_detaillee
results = main.get_creance_detaillee(target_date)

# Find the category '01:MENAGES' under section 'EAU'
menages_api = None
for res in results:
    if res["SECTION"] == "EAU" and "MENAGES" in res["CATEGORIE"]:
        menages_api = res
        break

if menages_api:
    print(f"[API RESULT] CATEGORIE: {menages_api['CATEGORIE']}")
    print(f"  NBR_FACTURES: {menages_api['NBR_FACTURES']}")
    print(f"  NBR_ABONNES:  {menages_api['NBR_ABONNES']}")
    print(f"  CREANCE:      {menages_api['CREANCE']:.2f} DA")
else:
    print("[API RESULT] No records found for 'MENAGES'")

# 2. Manual calculation mimicking the user's SQL query exactly
EMPTY_DATE_VALUES = {'', '        ', '19000101', '00000000', None}
print("[MANUAL CALCULATION] Executing exact SQL filters...")
fact_count = 0
avoir_count = 0
unique_subscribers = set()
total_monttc = 0.0

# Query FACTURES
for r in main.MEM_FACTURES:
    tp = str(r.get('TYPE') or '').strip()
    typabon = str(r.get('TYPABON') or '').strip()
    datsaisie = str(r.get('DATSAISIE') or '').strip()
    datreg = str(r.get('DATREG') or '').strip()
    numab = str(r.get('NUMAB') or '').strip()
    monttc = float(r.get('MONTTC') or 0)
    
    # SQL Filters:
    # TYPE = 'E' AND TYPABON >= '10' AND TYPABON <= '19' AND TYPABON <> '15'
    # AND DATSAISIE <= '20220131'
    # AND (TRIM(DATREG) = '' OR DATREG > '20220131')
    if tp == 'E' and '10' <= typabon <= '19' and typabon != '15':
        if datsaisie and datsaisie <= target_date:
            if datreg in EMPTY_DATE_VALUES or datreg > target_date:
                fact_count += 1
                unique_subscribers.add(numab)
                total_monttc += monttc

# Query AVOIR
for r in main.MEM_AVOIRS:
    tp = str(r.get('TYPE') or '').strip()
    typabon = str(r.get('TYPABON') or '').strip()
    datsaisie = str(r.get('DATSAISIE') or '').strip()
    datreg = str(r.get('DATREG') or '').strip()
    datanul = str(r.get('DATANUL') or '').strip()
    numab = str(r.get('NUMAB') or '').strip()
    monttc = float(r.get('MONTTC') or 0)
    
    # SQL Filters:
    # TYPE = 'E' AND TYPABON >= '10' AND TYPABON <= '19' AND TYPABON <> '15'
    # AND DATSAISIE <= '20220131'
    # AND DATANUL > '20220131'
    # AND (TRIM(DATREG) = '' OR DATREG > '20220131')
    if tp == 'E' and '10' <= typabon <= '19' and typabon != '15':
        if datsaisie and datsaisie <= target_date:
            if datanul and datanul > target_date:
                if datreg in EMPTY_DATE_VALUES or datreg > target_date:
                    avoir_count += 1
                    unique_subscribers.add(numab)
                    total_monttc += monttc  # Added since SQL query does UNION ALL without negating AVOIR

print(f"  Invoices Matched:     {fact_count}")
print(f"  Credit Notes Matched: {avoir_count}")
print(f"  Total Lines (COUNT):  {fact_count + avoir_count}")
print(f"  Unique Subscribers:   {len(unique_subscribers)}")
print(f"  Net Creance (SUM):    {total_monttc:.2f} DA")

# 3. Assert equivalences
assert menages_api is not None, "API returned no MENAGES category"
assert menages_api['NBR_FACTURES'] == fact_count + avoir_count, f"Mismatch in count: {menages_api['NBR_FACTURES']} vs {fact_count + avoir_count}"
assert menages_api['NBR_ABONNES'] == len(unique_subscribers), f"Mismatch in unique subscribers: {menages_api['NBR_ABONNES']} vs {len(unique_subscribers)}"
assert abs(menages_api['CREANCE'] - total_monttc) < 0.01, f"Mismatch in amount: {menages_api['CREANCE']} vs {total_monttc}"

print("\n" + "="*80)
print("SUCCESS: Endpoint and manual calculations are 100% equivalent!")
print("="*80)
sys.exit(0)
