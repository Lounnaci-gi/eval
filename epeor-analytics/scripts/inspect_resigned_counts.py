import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import backend.main as m
from collections import defaultdict

print('DATA_DIR=', m.DATA_DIR)
print('ABONMENT exists=', os.path.isfile(os.path.join(m.DATA_DIR, 'ABONMENT.DBF')))

m.load_all_data_to_memory()

abonments = m.MEM_ABONMENTS
abonnes = m.MEM_ABONNES
communes = {str(r.get('CODCOM', '')).strip().zfill(2): r for r in m.MEM_COMMUNES}

abonne_by_numab = {str(r.get('NUMAB', '')).strip(): r for r in abonnes}
resigned_numabs = {str(r.get('NUMAB', '')).strip() for r in abonments if str(r.get('ETATCPT', '')).strip() == '40'}

print('raw ABONMENT resigned count:', len(resigned_numabs))
print('ABONNE records:', len(abonnes))
print('ABONMENT records:', len(abonments))
print('resigned numabs present in ABONNE:', len([n for n in resigned_numabs if n in abonne_by_numab]))

empty_typabon = 0
mapped_typabon = 0
unmapped_typabon = 0
missing_commune = 0
resigned_without_typabon = []
resigned_unmapped_typabon = []
resigned_missing_commune = []
counts_by_typabon = defaultdict(int)

def is_type_mapped(t: str) -> bool:
    code_affec = ('T' + t).upper() if t else ''
    typ_num = None
    try:
        typ_num = int(t)
    except Exception:
        pass
    return (
        code_affec in ('T15', 'T60', 'T50') or
        code_affec == 'T80' or
        (typ_num is not None and 20 <= typ_num <= 29) or
        (typ_num is not None and 30 <= typ_num <= 39) or
        (typ_num is not None and 40 <= typ_num <= 49) or
        code_affec in ('T10', 'T11', 'T19')
    )

for numab in sorted(resigned_numabs):
    if numab not in abonne_by_numab:
        continue
    row = abonne_by_numab[numab]
    t = str(row.get('TYPABON', '')).strip()
    counts_by_typabon[t] += 1
    if t == '':
        empty_typabon += 1
        resigned_without_typabon.append(numab)
    elif is_type_mapped(t):
        mapped_typabon += 1
    else:
        unmapped_typabon += 1
        resigned_unmapped_typabon.append((numab, t))
    codcom = str(row.get('CODCOM', '')).strip().zfill(2)
    if codcom not in communes:
        missing_commune += 1
        resigned_missing_commune.append((numab, codcom))

print('resigned in ABONNE with mapped TYPABON:', mapped_typabon)
print('resigned in ABONNE with unmapped TYPABON:', unmapped_typabon)
print('resigned in ABONNE with empty TYPABON:', empty_typabon)
print('resigned in ABONNE with unknown CODCOM:', missing_commune)
print('type count sample:', sorted(counts_by_typabon.items(), key=lambda item: -item[1])[:20])

s = m.compute_dashboard_stats()
print('stats.resigned_subscribers:', s.get('resigned_subscribers'))
print('sum subscriber_types resigned:', sum(t.get('resigned', 0) for t in s.get('subscriber_types', [])))
print('sum subscriber_communes resigned:', sum(c.get('resigned', 0) for c in s.get('subscriber_communes', [])))
print('subscriber_types length:', len(s.get('subscriber_types', [])))
print('subscriber_communes length:', len(s.get('subscriber_communes', [])))
print('resigned count difference:', len(resigned_numabs) - s.get('resigned_subscribers'))

missing = set(resigned_numabs) - {str(r.get('NUMAB', '')).strip() for r in abonnes if str(r.get('NUMAB','')).strip()}
print('resigned numabs missing from ABONNE count:', len(missing))
print('missing numabs:', sorted(list(missing))[:10])
print('sample unmapped resigned typabon:', resigned_unmapped_typabon[:20])
