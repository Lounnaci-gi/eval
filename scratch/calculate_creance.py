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

def calculate_creance_saisie(fact_path, target_date_str, target_type='7'):
    """
    Calcule la créance (Total MONTTC) basée sur la date de saisie.
    Logique : TYPE = target_type AND DATSAISIE <= target_date AND (DATREG vide OR DATREG > target_date)
    """
    try:
        target_date = datetime.strptime(target_date_str, '%d/%m/%Y').date()
    except ValueError:
        print("Erreur : Format de date invalide. Utilisez JJ/MM/AAAA")
        return

    total_creance = 0
    count_records = 0
    
    if not os.path.exists(fact_path):
        print(f"Erreur : Le fichier {fact_path} est introuvable.")
        return

    print(f"Calcul de la créance Type {target_type} au {target_date_str}...")
    print(f"Lecture du fichier {os.path.basename(fact_path)} (veuillez patienter)...")
    
    table_fact = DBF(fact_path, encoding='cp1252', char_decode_errors='ignore')
    for rec in table_fact:
        if str(rec.get('TYPE', '')).strip() == target_type:
            dsaisie = parse_dbf_date(rec.get('DATSAISIE'))
            
            if dsaisie and dsaisie <= target_date:
                dreg_str = str(rec.get('DATREG', '')).strip()
                dreg = parse_dbf_date(dreg_str)
                
                # Condition Impayé : Date de règlement vide ou postérieure à la date d'arrêt
                if dreg_str == '' or (dreg and dreg > target_date):
                    total_creance += float(rec.get('MONTTC', 0))
                    count_records += 1
                
    print("\n" + "="*50)
    print(f"RÉSULTAT CRÉANCE (TYPE {target_type}) AU {target_date_str}")
    print("="*50)
    print(f"Total Créance : {total_creance:15.2f} DA")
    print(f"Nombre de factures : {count_records}")
    print("="*50)
    return total_creance

if __name__ == "__main__":
    # Par défaut on calcule pour le 01/09/2025 si aucun argument n'est fourni
    date_to_calc = sys.argv[1] if len(sys.argv) > 1 else '01/09/2025'
    type_to_calc = sys.argv[2] if len(sys.argv) > 2 else '7'
    
    calculate_creance_saisie(r'D:\EPEOR\FACTURES.DBF', date_to_calc, type_to_calc)
