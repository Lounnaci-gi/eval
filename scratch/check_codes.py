from dbfread import DBF
from datetime import datetime

def check_codes(path, target_type, target_date_str):
    target_date = datetime.strptime(target_date_str, '%d/%m/%Y').date()
    table = DBF(path, encoding='cp1252', char_decode_errors='ignore')
    codes = {}
    for rec in table:
        if str(rec.get('TYPE', '')).strip() == target_type:
            # Try both DATFACT and DATSAISIE
            dsaisie = rec.get('DATSAISIE')
            if isinstance(dsaisie, str) and dsaisie.strip():
                try:
                    ds = datetime.strptime(dsaisie.strip(), '%Y%m%d').date()
                except:
                    ds = None
            else:
                ds = None
            
            if ds and ds <= target_date:
                code = rec.get('CODE', 'NONE')
                mont = float(rec.get('MONTTC', 0))
                codes[code] = codes.get(code, 0) + mont
    
    print(f"Sum by CODE for Type {target_type} (DATSAISIE <= {target_date_str}):")
    for c, s in codes.items():
        print(f"Code {c}: {s:.2f}")

check_codes(r'D:\EPEOR\FACTURES.DBF', '4', '01/05/2025')
