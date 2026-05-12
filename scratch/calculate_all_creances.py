from dbfread import DBF
from datetime import datetime
import os
import sys

def parse_dbf_date(date_str):
    if not date_str or not isinstance(date_str, str) or date_str.strip() == '':
        return None
    try:
        return datetime.strptime(date_str.strip(), '%Y%m%d').date()
    except ValueError:
        return None

def calculate_all_creances(fact_path, target_date_str):
    try:
        target_date = datetime.strptime(target_date_str, '%d/%m/%Y').date()
    except ValueError:
        print("Erreur : Format de date invalide. Utilisez JJ/MM/AAAA")
        return

    creances_by_type = {} # { type: { 'total': 0.0, 'count': 0 } }
    
    if not os.path.exists(fact_path):
        print(f"Erreur : Le fichier {fact_path} est introuvable.")
        return

    print(f"Calcul de la créance GLOBALE au {target_date_str}...")
    print(f"Lecture du fichier {os.path.basename(fact_path)} (veuillez patienter)...")
    
    table_fact = DBF(fact_path, encoding='cp1252', char_decode_errors='ignore')
    for rec in table_fact:
        dsaisie = parse_dbf_date(rec.get('DATSAISIE'))
        
        if dsaisie and dsaisie <= target_date:
            dreg_str = str(rec.get('DATREG', '')).strip()
            dreg = parse_dbf_date(dreg_str)
            
            if dreg_str == '' or (dreg and dreg > target_date):
                t = str(rec.get('TYPE', 'UNKNOWN')).strip()
                mont = float(rec.get('MONTTC', 0))
                
                if t not in creances_by_type:
                    creances_by_type[t] = {'total': 0.0, 'count': 0}
                
                creances_by_type[t]['total'] += mont
                creances_by_type[t]['count'] += 1
                
    print("\n" + "="*60)
    print(f"RÉCAPITULATIF DES CRÉANCES PAR TYPE AU {target_date_str}")
    print("="*60)
    print(f"{'TYPE':<10} | {'MONTANT TOTAL':<20} | {'NB FACTURES':<12}")
    print("-" * 60)
    
    grand_total = 0.0
    total_count = 0
    
    # Trier par type pour la lisibilité
    for t in sorted(creances_by_type.keys()):
        total = creances_by_type[t]['total']
        count = creances_by_type[t]['count']
        print(f"{t:<10} | {total:20.2f} | {count:12}")
        grand_total += total
        total_count += count
        
    print("-" * 60)
    print(f"{'TOTAL':<10} | {grand_total:20.2f} | {total_count:12}")
    print("="*60)

if __name__ == "__main__":
    date_to_calc = sys.argv[1] if len(sys.argv) > 1 else '31/12/2025'
    calculate_all_creances(r'D:\EPEOR\FACTURES.DBF', date_to_calc)
