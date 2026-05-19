from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dbfread import DBF
import os
import itertools
from datetime import datetime, timedelta
import pickle
import time
import threading

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = r"d:\epeor"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, "cache")
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# -------------------------------------------------------------
# CACHE AND IN-MEMORY DATABASE STRUCTURES
# -------------------------------------------------------------
def load_dbf(filename, load_all=False):
    """Dynamic disk loader (keeps compatibility and allows reading tiny PROV*.DBF files)"""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return None
    try:
        table = DBF(path, load=load_all, encoding='cp1256', char_decode_errors='ignore')
        return table
    except Exception as e:
        print(f"Error opening {filename}: {e}")
        return None

is_db_ready = False
db_loading_status = "Initialisation du serveur backend..."

# Global caches of all database files
MEM_ABONNES = []
MEM_FACTURES = []
MEM_AVOIRS = []
MEM_ABONMENTS = []
MEM_TABCODES = []
MEM_COMMUNES = []
MEM_QUARTIERS = []
MEM_RUES = []
MEM_CLASSES = []
MEM_UNITES = []
MEM_CAISSES = []

# Mappings built for O(1) high-speed lookups
abonnes_by_numab = {}       # NUMAB -> record dict
rues_by_codrue = {}         # CODRUE -> record dict
tabcodes_by_code = {}       # CODE_AFFEC -> record dict
abonments_by_numab = {}     # NUMAB -> record dict
factures_by_numab = {}      # NUMAB -> list of record dicts
avoirs_by_numab = {}        # NUMAB -> list of record dicts
unites_by_code = {}         # UNITE -> record dict
caisses_by_code = {}        # CODCAIS -> record dict
communes_by_code = {}       # CODCOM -> record dict
quartier_to_commune = {}    # QUART -> CODCOM
quartier_names = {}         # QUART -> LIBQUART
classe_map = {}             # (CLASSE, S_CLASSE) -> DESIGN

def load_table_cached(filename, encoding='cp1256'):
    """Checks cache validation and loads DBF or Pickle binary for maximum speed"""
    global db_loading_status
    dbf_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(dbf_path):
        print(f"[WARNING] {filename} does not exist at {dbf_path}")
        return []
    
    pkl_path = os.path.join(CACHE_DIR, filename.lower().replace('.dbf', '.pkl'))
    
    # Check if cache is valid (pkl exists and is newer than the actual DBF file)
    if os.path.exists(pkl_path):
        dbf_mtime = os.path.getmtime(dbf_path)
        pkl_mtime = os.path.getmtime(pkl_path)
        if pkl_mtime >= dbf_mtime:
            try:
                db_loading_status = f"Chargement rapide de {filename} depuis le cache..."
                t0 = time.time()
                import gc
                gc.disable()
                try:
                    with open(pkl_path, 'rb') as f:
                        data = pickle.load(f)
                finally:
                    gc.enable()
                print(f"[CACHE] Loaded {filename} in {time.time()-t0:.2f}s ({len(data)} records)")
                return data
            except Exception as e:
                print(f"Error reading cache for {filename}: {e}. Rebuilding...")
    
    # Missing or invalid cache -> Load from DBF
    try:
        db_loading_status = f"Extraction de {filename} de la base de données (Création du cache .pkl)..."
        t0 = time.time()
        print(f"[DISK] Parsing {filename} from DBF file (this runs once)...")
        dbf = DBF(dbf_path, load=True, encoding=encoding, char_decode_errors='ignore')
        records = [dict(r) for r in dbf]
        print(f"[SUCCESS] Loaded {len(records)} records from {filename} in {time.time()-t0:.2f}s")
        
        # Save parsed list to pickle file
        try:
            with open(pkl_path, 'wb') as f:
                pickle.dump(records, f, protocol=pickle.HIGHEST_PROTOCOL)
            print(f"[CACHE] Saved binary cache for {filename}.")
        except Exception as ce:
            print(f"Error writing cache for {filename}: {ce}")
            
        return records
    except Exception as e:
        print(f"Error loading {filename} from DBF: {e}")
        return []

def load_all_data_to_memory():
    """Initializes and builds O(1) in-memory indexes on startup"""
    global MEM_ABONNES, MEM_FACTURES, MEM_AVOIRS, MEM_ABONMENTS, MEM_TABCODES
    global MEM_COMMUNES, MEM_QUARTIERS, MEM_RUES, MEM_CLASSES, MEM_UNITES, MEM_CAISSES
    global abonnes_by_numab, rues_by_codrue, tabcodes_by_code, abonments_by_numab
    global factures_by_numab, avoirs_by_numab, unites_by_code, caisses_by_code
    global communes_by_code, quartier_to_commune, quartier_names, classe_map
    global is_db_ready, db_loading_status

    is_db_ready = False
    db_loading_status = "Initialisation de la base de données..."
    print("[INFO] Initializing EPEOR in-memory database cache...")
    t_start = time.time()
    
    MEM_ABONNES = load_table_cached("ABONNE.DBF", encoding='cp1256')
    MEM_FACTURES = load_table_cached("FACTURES.DBF", encoding='cp1256')
    MEM_AVOIRS = load_table_cached("AVOIR.DBF", encoding='cp1256')
    MEM_ABONMENTS = load_table_cached("ABONMENT.DBF", encoding='cp1256')
    MEM_TABCODES = load_table_cached("TABCODE.DBF", encoding='cp1256')
    MEM_COMMUNES = load_table_cached("COMMUNE.DBF", encoding='cp1256')
    MEM_QUARTIERS = load_table_cached("QUARTIER.DBF", encoding='cp1256')
    MEM_RUES = load_table_cached("RUE.DBF", encoding='cp1256')
    MEM_CLASSES = load_table_cached("CLASSE.DBF", encoding='cp1256')
    MEM_UNITES = load_table_cached("UNITE.DBF", encoding='cp1256')
    MEM_CAISSES = load_table_cached("CAISSE.DBF", encoding='cp1256')

    print("[INFO] Building indexes and hash mappings...")
    
    # 1. Subscribers Map
    abonnes_by_numab = {}
    for r in MEM_ABONNES:
        numab = str(r.get('NUMAB', '')).strip().upper()
        if numab:
            abonnes_by_numab[numab] = r
            
    # 2. Streets Map (Support raw and zero-padded lookups)
    rues_by_codrue = {}
    for r in MEM_RUES:
        codrue = str(r.get('CODRUE', '')).strip()
        if codrue:
            rues_by_codrue[codrue] = r
            rues_by_codrue[codrue.lstrip('0')] = r
            
    # 3. Tabcodes Map
    tabcodes_by_code = {}
    for r in MEM_TABCODES:
        code_affec = str(r.get('CODE_AFFEC', '')).strip().upper()
        if code_affec:
            tabcodes_by_code[code_affec] = r
            
    # 4. Abonments Map
    abonments_by_numab = {}
    for r in MEM_ABONMENTS:
        numab = str(r.get('NUMAB', '')).strip().upper()
        if numab:
            abonments_by_numab[numab] = r
            
    # 5. Invoices Map (NUMAB -> Facture records list)
    factures_by_numab = {}
    for r in MEM_FACTURES:
        numab = str(r.get('NUMAB', '')).strip().upper()
        if numab:
            if numab not in factures_by_numab:
                factures_by_numab[numab] = []
            factures_by_numab[numab].append(r)
            
    # Sort invoices for each subscriber by DATFACT descending
    for numab in factures_by_numab:
        factures_by_numab[numab].sort(key=lambda x: str(x.get('DATFACT', '')).strip(), reverse=True)
        
    # 6. Avoirs Map
    avoirs_by_numab = {}
    for r in MEM_AVOIRS:
        numab = str(r.get('NUMAB', '')).strip().upper()
        if numab:
            if numab not in avoirs_by_numab:
                avoirs_by_numab[numab] = []
            avoirs_by_numab[numab].append(r)
            
    for numab in avoirs_by_numab:
        avoirs_by_numab[numab].sort(key=lambda x: str(x.get('DATFACT', '')).strip(), reverse=True)
        
    # 7. Unites Map
    unites_by_code = {}
    for r in MEM_UNITES:
        code_unite = str(r.get('UNITE', '')).strip()
        if code_unite:
            unites_by_code[code_unite] = r
            unites_by_code[code_unite.lstrip('0')] = r
            
    # 8. Caisses Map
    caisses_by_code = {}
    for r in MEM_CAISSES:
        code_caisse = str(r.get('CODCAIS', '')).strip()
        if code_caisse:
            caisses_by_code[code_caisse] = r
            
    # 9. Communes Map
    communes_by_code = {}
    for r in MEM_COMMUNES:
        codcom = str(r.get('CODCOM', '')).strip()
        if codcom:
            communes_by_code[codcom.zfill(2)] = r
            
    # 10. Quartiers Maps
    quartier_to_commune = {}
    quartier_names = {}
    for r in MEM_QUARTIERS:
        q_id = str(r.get('QUART', '')).strip()
        if q_id:
            quartier_to_commune[q_id] = str(r.get('COMMUNE', '')).strip().zfill(2)
            quartier_names[q_id] = str(r.get('LIBQUART', '')).strip()
            
    # 11. Classes Map
    classe_map = {}
    for r in MEM_CLASSES:
        c = str(r.get('CLASSE', '')).strip()
        sc = str(r.get('S_CLASSE', '')).strip()
        classe_map[(c, sc)] = str(r.get('DESIGN', '')).strip()

    print(f"[SUCCESS] In-memory database cache fully ready in {time.time()-t_start:.2f}s!")
    is_db_ready = True
    db_loading_status = "Prêt"

def clear_cache_directory():
    if os.path.exists(CACHE_DIR):
        print(f"[INFO] Clearing all cached files in {CACHE_DIR}...")
        for f in os.listdir(CACHE_DIR):
            file_path = os.path.join(CACHE_DIR, f)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                print(f"Error deleting file {file_path}: {e}")

@app.on_event("startup")
def startup_event():
    threading.Thread(target=load_all_data_to_memory, daemon=True).start()

@app.on_event("shutdown")
def shutdown_event():
    print("[INFO] Server is stopping. Cache is preserved for fast restart.")

@app.get("/api/clear_cache")
def clear_cache_endpoint():
    print("[INFO] Clearing cache requested by frontend...")
    clear_cache_directory()
    return {"status": "success", "message": "Cache cleared successfully"}

# -------------------------------------------------------------
# API HANDLERS (Blazing Fast In-Memory Processing)
# -------------------------------------------------------------
@app.get("/stats")
def get_stats():
    if not is_db_ready:
        return {"status": "loading", "message": db_loading_status}
    try:
        # Load type labels mapping
        mapping = {}
        for code_affec, r in tabcodes_by_code.items():
            if code_affec.startswith('T'):
                mapping[code_affec[1:]] = r.get('LIBELLE', '')

        stats = {
            "total_subscribers": 0,
            "resigned_subscribers": 0,
            "stopped_subscribers": 0,
            "no_meter_subscribers": 0,
            "total_revenue": 0,
            "recovery_rate": 0,
            "recent_invoices_count": 0,
            "subscriber_types": []
        }

        abonment_state_map = {}
        resigned = 0
        stopped = 0
        no_meter = 0
        for record in MEM_ABONMENTS:
            etat = str(record.get('ETATCPT', '')).strip()
            numab = str(record.get('NUMAB', '')).strip()
            abonment_state_map[numab] = etat
            if etat == '40':
                resigned += 1
            elif etat == '20':
                stopped += 1
            elif etat == '30':
                no_meter += 1
                
        stats["resigned_subscribers"] = resigned
        stats["stopped_subscribers"] = stopped
        stats["no_meter_subscribers"] = no_meter

        stats["total_subscribers"] = 0
        type_counts = {}
        commune_counts = {}
        
        # Communes map
        commune_map = {}
        for codcom, r in communes_by_code.items():
            if r.get('SECTEUR') == '02': # Only keep communes for the active sector
                commune_map[codcom] = r.get('LIBCOM', '')

        for record in MEM_ABONNES:
            t = str(record.get('TYPABON', '')).strip()
            if t == '':
                continue # Exclude empty TYPABON
            
            stats["total_subscribers"] += 1
            if t not in type_counts:
                type_counts[t] = {"total": 0, "resigned": 0, "stopped": 0, "no_meter": 0}
            
            type_counts[t]["total"] += 1
            
            numab = str(record.get('NUMAB', '')).strip()
            prefix = numab[:2]
            codcom = quartier_to_commune.get(prefix, '02') # Default to 02 if mapping missing
            
            if codcom not in commune_counts:
                commune_counts[codcom] = {"total": 0, "resigned": 0, "stopped": 0, "no_meter": 0, "quartiers": {}}
            
            commune_counts[codcom]["total"] += 1
            
            state = abonment_state_map.get(numab)
            is_resigned = (state == '40')
            is_stopped = (state == '20')
            is_no_meter = (state == '30')
            
            if is_resigned:
                commune_counts[codcom]["resigned"] += 1
                type_counts[t]["resigned"] += 1
            if is_stopped:
                commune_counts[codcom]["stopped"] += 1
                type_counts[t]["stopped"] += 1
            if is_no_meter:
                commune_counts[codcom]["no_meter"] += 1
                type_counts[t]["no_meter"] += 1
            
            if prefix not in commune_counts[codcom]["quartiers"]:
                commune_counts[codcom]["quartiers"][prefix] = {"total": 0, "resigned": 0, "stopped": 0, "no_meter": 0}
            
            commune_counts[codcom]["quartiers"][prefix]["total"] += 1
            if is_resigned:
                commune_counts[codcom]["quartiers"][prefix]["resigned"] += 1
            if is_stopped:
                commune_counts[codcom]["quartiers"][prefix]["stopped"] += 1
            if is_no_meter:
                commune_counts[codcom]["quartiers"][prefix]["no_meter"] += 1
        
        total = stats["total_subscribers"]
        
        # Format types with labels and percentage
        for t_code, counts in type_counts.items():
            if counts["total"] < 10: continue
            label = mapping.get(t_code, f"Autre ({t_code})" if t_code else "Inconnu")
            stats["subscriber_types"].append({
                "name": label,
                "value": counts["total"],
                "resigned": counts["resigned"],
                "stopped": counts["stopped"],
                "no_meter": counts["no_meter"],
                "percentage": round((counts["total"] / total) * 100, 2) if total > 0 else 0
            })
        
        stats["subscriber_types"].sort(key=lambda x: x['value'], reverse=True)

        stats["subscriber_communes"] = []
        for codcom, label in commune_map.items():
            counts = commune_counts.get(codcom, {"total": 0, "resigned": 0, "stopped": 0, "no_meter": 0, "quartiers": {}})
            
            formatted_quartiers = []
            for q_id, q_counts in counts.get("quartiers", {}).items():
                q_label = quartier_names.get(q_id, f"Quartier {q_id}")
                formatted_quartiers.append({
                    "id": q_id,
                    "name": q_label,
                    "value": q_counts["total"],
                    "resigned": q_counts["resigned"],
                    "stopped": q_counts["stopped"],
                    "no_meter": q_counts["no_meter"],
                    "percentage": round((q_counts["total"] / counts["total"]) * 100, 2) if counts["total"] > 0 else 0
                })
            formatted_quartiers.sort(key=lambda x: x['value'], reverse=True)

            stats["subscriber_communes"].append({
                "id": codcom,
                "name": label,
                "value": counts["total"],
                "resigned": counts["resigned"],
                "stopped": counts["stopped"],
                "no_meter": counts["no_meter"],
                "percentage": round((counts["total"] / total) * 100, 2) if total > 0 else 0,
                "quartiers": formatted_quartiers
            })
        stats["subscriber_communes"].sort(key=lambda x: x['value'], reverse=True)

        total_rev = 0
        count = 0
        paid_count = 0
        
        # Sum revenue across entire database in memory
        for r in MEM_FACTURES:
            tp = str(r.get('TYPE') or '').strip()
            monttc = float(r.get('MONTTC') or 0)
            if tp in ['E', 'C', '6']:
                total_rev += monttc
            count += 1
            if r.get('DATREG'):
                paid_count += 1
                
        for r in MEM_AVOIRS:
            tp = str(r.get('TYPE') or '').strip()
            monttc = float(r.get('MONTTC') or 0)
            if tp in ['E', 'C', '6']:
                total_rev += monttc
            count += 1
            if r.get('DATREG'):
                paid_count += 1
        
        stats["total_revenue"] = round(total_rev, 2)
        stats["recent_invoices_count"] = count
        stats["recovery_rate"] = round((paid_count / count) * 100, 2) if count > 0 else 0

        return stats
    except Exception as e:
        return {"error": str(e)}

@app.get("/search")
def search_subscribers(query: str = None, q: str = None):
    search_term = query or q
    if not search_term: return []
    try:
        search_term_lower = search_term.lower()
        results = []
        for record in MEM_ABONNES:
            numab = str(record.get('NUMAB', ''))
            raisoc = str(record.get('RAISOC', ''))
            nom = str(record.get('NOM', ''))
            
            if (search_term_lower in numab.lower() or 
                search_term_lower in raisoc.lower() or 
                search_term_lower in nom.lower()):
                
                res = dict(record)
                res['NOM'] = raisoc or nom
                
                # Resolve Address components
                codrue = str(record.get('CODRUE', '')).strip()
                street_rec = rues_by_codrue.get(codrue)
                street = street_rec.get('NOUVNOM', '') if street_rec else f"Code: {codrue}"
                
                bloc = str(record.get('BLOC', '')).strip()
                ndom = str(record.get('NDOM', '')).strip()
                
                full_address = f"{street}"
                if bloc: full_address += f" Bloc: {bloc}"
                if ndom: full_address += f" N°: {ndom}"
                res['ADRESSE'] = full_address
                
                res['TOURNEE'] = str(record.get('TOURNEE', '')).strip()
                res['NUMORDRE'] = str(record.get('NUMORDRE', '')).strip()
                
                abonment_info = abonments_by_numab.get(numab, {})
                res['NUMSER'] = abonment_info.get('NUMSER', '---')
                res['ETATCPT'] = abonment_info.get('ETATCPT', '---')
                
                t_code = str(record.get('TYPABON', '')).strip()
                t_rec = tabcodes_by_code.get("T" + t_code)
                res['TYPE_LABEL'] = t_rec.get('LIBELLE', '') if t_rec else (f"Autre ({t_code})" if t_code else "Inconnu")
                
                results.append(res)
                if len(results) >= 200: break
                
        return results
    except Exception as e:
        return {"error": str(e)}

@app.get("/subscribers")
def get_subscribers(quartier: str = None, etat: str = None):
    if not quartier:
        return {"error": "Missing parameters"}
    
    try:
        type_map = {}
        etat_map = {}
        for code_affec, r in tabcodes_by_code.items():
            libelle = str(r.get('LIBELLE', '')).strip()
            if code_affec.startswith('T'):
                type_map[code_affec[1:]] = libelle
            elif code_affec.startswith('E'):
                etat_map[code_affec[1:]] = libelle

        results = []
        for record in MEM_ABONNES:
            numab = str(record.get('NUMAB', '')).strip()
            prefix = numab[:2]
            
            # Filter by Quartier
            if prefix != quartier:
                continue
                
            # Filter by ETATCPT
            abonment_info = abonments_by_numab.get(numab, {})
            state = abonment_info.get('ETATCPT')
            if etat and etat.lower() != 'all' and state != etat:
                continue
                
            t_code = str(record.get('TYPABON', '')).strip()
            type_label = type_map.get(t_code, f"Autre ({t_code})" if t_code else "Inconnu")
            
            raisoc = str(record.get('RAISOC', '')).strip()
            nom = str(record.get('NOM', '')).strip()
            display_name = raisoc if raisoc else nom
            if not display_name:
                display_name = "Nom inconnu"
                
            codrue = str(record.get('CODRUE', '')).strip()
            street_rec = rues_by_codrue.get(codrue)
            adresse = street_rec.get('NOUVNOM', '') if street_rec else (f"Code: {codrue}" if codrue else "")
            
            bloc = str(record.get('BLOC', '')).strip()
            ndom = str(record.get('NDOM', '')).strip()
            numordre = str(record.get('NUMORDRE', '')).strip()
            numser   = abonment_info.get('NUMSER', '---')
            etatcpt  = abonment_info.get('ETATCPT', '')
            tournee  = str(record.get('TOURNEE', '')).strip()
            etat_label = etat_map.get(etatcpt, etatcpt if etatcpt else '—')
                
            results.append({
                "numab":      numab,
                "name":       display_name,
                "type":       type_label,
                "numser":     numser,
                "etatcpt":    etatcpt,
                "etat_label": etat_label,
                "adresse":    adresse,
                "bloc":       bloc,
                "ndom":       ndom,
                "tournee":    tournee,
                "numordre":   numordre
            })
            
        return results
    except Exception as e:
        return {"error": str(e)}

def get_official_ca(period_name: str):
    """Scans PROV*.DBF files to find official CA for a given period"""
    try:
        files = [f for f in os.listdir(DATA_DIR) if f.startswith("PROV") and f.endswith(".DBF")]
        for f in sorted(files, reverse=True):
            table = load_dbf(f, load_all=True)
            if table is None: continue
            
            first = next(iter(table))
            p_compta = str(first.get('PER_COMPTA', '')).strip()
            
            if period_name.lower() in p_compta.lower() or p_compta.lower() in period_name.lower():
                res = {"ca_eau": 0.0, "rfa": 0.0, "assainis": 0.0, "tva": 0.0}
                for r in table:
                    if r.get('IMPUTATION') == 'Exercice/Total.':
                        res["ca_eau"] = float(r.get('M_TTC') or 0)
                        res["rfa"] = float(r.get('RFA') or 0)
                        res["assainis"] = float(r.get('TOTAL_ASS') or 0)
                        res["tva"] = float(r.get('TVA_EAU', 0)) + float(r.get('TVARFA', 0)) + float(r.get('TVAASS', 0))
                        return res
    except:
        pass
    return None

@app.get("/creance")
def get_creance(start_date: str = None, end_date: str = None):
    try:
        # Build period name for PROV lookup
        months_fr = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
        period_label = ""
        if start_date and len(start_date) >= 6:
            year = start_date[:4]
            month_idx = int(start_date[4:6]) - 1
            if 0 <= month_idx < 12:
                period_label = f"Mois de {months_fr[month_idx]} {year}"
        
        official = get_official_ca(period_label) if period_label else None

        # Build commune map: CODCOM -> label
        commune_map = {}
        for codcom, r in communes_by_code.items():
            commune_map[codcom] = r.get('LIBCOM', '')

        total_ca_eau        = 0.0
        total_ca_prestation = 0.0
        total_creance       = 0.0
        total_recouvre      = 0.0
        total_ca_recouvre   = 0.0
        commune_ca          = {}   # codcom -> {ca_eau, ca_prestation, creance, recouvre, ca_recouvre}
        type_ca             = {}   # typabon -> {label, ca_eau, ca_prestation, creance, recouvre, ca_recouvre}
        raw_type_ca         = {}   # type -> {creance, count}

        EMPTY_DATE_VALUES = {'', '        ', '19000101', '00000000', None}
        target_date = end_date if end_date else '99991231'

        # Chain all records in memory
        records = itertools.chain(
            ((r, False) for r in MEM_FACTURES),
            ((r, True) for r in MEM_AVOIRS)
        )

        for r, is_avoir in records:
            datsaisie = str(r.get('DATSAISIE') or '').strip()
            datreg  = str(r.get('DATREG') or '').strip()
            
            # 1. Activity filters
            is_in_saisie = True
            if start_date and datsaisie < start_date:
                is_in_saisie = False
            if end_date and datsaisie > end_date:
                is_in_saisie = False

            is_in_reg = True
            if datreg in EMPTY_DATE_VALUES:
                is_in_reg = False
            else:
                if start_date and datreg < start_date:
                    is_in_reg = False
                if end_date and datreg > end_date:
                    is_in_reg = False

            # 2. "Créance arrêtée" condition
            is_creance_arretee = False
            if not is_avoir:
                if datsaisie and datsaisie <= target_date:
                    if datreg in EMPTY_DATE_VALUES or datreg > target_date:
                        is_creance_arretee = True

            # Skip if doesn't match any criteria
            if not is_in_saisie and not is_in_reg and not is_creance_arretee:
                continue

            tp = str(r.get('TYPE') or '').strip()
            periode = str(r.get('PERIODE') or '').strip()
            monttc  = float(r.get('MONTTC') or 0)
            timbre  = float(r.get('TIMBRE') or 0)
            
            numab   = str(r.get('NUMAB', '') or '').strip()
            typabon = str(r.get('TYPABON', '') or '').strip()
            prefix  = numab[:2]
            codcom  = quartier_to_commune.get(prefix, '??')

            # Category determination
            section = None
            ordre = 0
            type_code = tp
            categorie = ""

            if tp == 'E':
                section = 'EAU'
                type_code = 'E'
                if typabon == '15':
                    ordre = 5
                    categorie = 'VENTE EN GROS'
                elif '10' <= typabon <= '19':
                    ordre = 1
                    categorie = 'MENAGES'
                elif '20' <= typabon <= '29':
                    ordre = 2
                    categorie = 'ADMINISTRATIONS'
                elif '30' <= typabon <= '39':
                    ordre = 3
                    categorie = 'SERVICES'
                elif '40' <= typabon <= '49':
                    ordre = 4
                    categorie = 'INDUSTRIE & TOURISME'
                else:
                    ordre = 6
                    categorie = f'AUTRE EAU ({typabon})'
            elif tp == 'C' and periode == '0002':
                section = 'EAU'
                ordre = 7
                type_code = 'C'
                categorie = 'E/CITERNE'
            elif tp == '6':
                section = 'EAU'
                ordre = 9
                type_code = '6'
                categorie = 'E/MANQUE A GAGNER'
            elif tp != '':
                section = 'PRESTATIONS'
                ordre = 100
                cl_design = classe_map.get((tp, '****'), tp)
                cs_design = classe_map.get((tp, periode), periode)
                categorie = f"{cl_design} / {cs_design}"

            cat_key = (section, ordre, type_code, categorie)
            
            # Aggregation logic
            if codcom not in commune_ca:
                commune_ca[codcom] = {
                    "ca_eau": 0.0,
                    "ca_prestation": 0.0,
                    "creance": 0.0,
                    "creance_eau": 0.0,
                    "creance_prestation": 0.0,
                    "recouvre": 0.0,
                    "recouvre_eau": 0.0,
                    "recouvre_prestation": 0.0,
                    "ca_recouvre": 0.0,
                    "ca_recouvre_eau": 0.0,
                    "ca_recouvre_prestation": 0.0
                }
            if section and cat_key not in type_ca:
                type_ca[cat_key] = {"section": section, "ordre": ordre, "type_code": type_code, "label": categorie, "ca_eau": 0.0, "ca_prestation": 0.0, "creance": 0.0, "recouvre": 0.0, "ca_recouvre": 0.0}

            # CA logic (within range)
            if is_in_saisie:
                if tp in ['E', 'C', '6']:
                    total_ca_eau += monttc
                    commune_ca[codcom]["ca_eau"] += monttc
                    if section:
                        type_ca[cat_key]["ca_eau"] += monttc
                else:
                    total_ca_prestation += monttc
                    commune_ca[codcom]["ca_prestation"] += monttc
                    if section:
                        type_ca[cat_key]["ca_prestation"] += monttc

            # Recouvrement logic (within range)
            if is_in_reg and not is_avoir:
                m_rec = monttc + timbre
                total_recouvre += m_rec
                commune_ca[codcom]["recouvre"] += m_rec
                if section == 'EAU':
                    commune_ca[codcom]["recouvre_eau"] += m_rec
                else:
                    commune_ca[codcom]["recouvre_prestation"] += m_rec
                if section:
                    type_ca[cat_key]["recouvre"] += m_rec

            # CA Recouvré logic (portion of current CA that is paid by target_date)
            if is_in_saisie and not is_avoir:
                is_paid = datreg not in EMPTY_DATE_VALUES and datreg <= target_date
                if is_paid:
                    total_ca_recouvre += monttc
                    commune_ca[codcom]["ca_recouvre"] += monttc
                    if section == 'EAU':
                        commune_ca[codcom]["ca_recouvre_eau"] += monttc
                    else:
                        commune_ca[codcom]["ca_recouvre_prestation"] += monttc
                    if section:
                        type_ca[cat_key]["ca_recouvre"] += monttc

            # Créance arrêtée logic
            if is_creance_arretee:
                total_creance += monttc
                commune_ca[codcom]["creance"] += monttc
                if section == 'EAU':
                    commune_ca[codcom]["creance_eau"] += monttc
                else:
                    commune_ca[codcom]["creance_prestation"] += monttc
                if section:
                    type_ca[cat_key]["creance"] += monttc
                
                if tp not in raw_type_ca:
                    raw_type_ca[tp] = {"creance": 0.0, "count": 0}
                raw_type_ca[tp]["creance"] += monttc
                raw_type_ca[tp]["count"] += 1

        # Format communes
        communes_list = []
        for codcom, label in commune_map.items():
            d = commune_ca.get(codcom, {
                "ca_eau": 0.0,
                "ca_prestation": 0.0,
                "creance": 0.0,
                "creance_eau": 0.0,
                "creance_prestation": 0.0,
                "recouvre": 0.0,
                "recouvre_eau": 0.0,
                "recouvre_prestation": 0.0,
                "ca_recouvre": 0.0,
                "ca_recouvre_eau": 0.0,
                "ca_recouvre_prestation": 0.0
            })
            tot_ca = d["ca_eau"] + d["ca_prestation"]
            ca_rec = d.get("ca_recouvre", 0.0)
            taux = (ca_rec / tot_ca * 100) if tot_ca > 0 else 0
            
            # calculate rates for sections
            ca_rec_eau = d.get("ca_recouvre_eau", 0.0)
            tot_ca_eau = d["ca_eau"]
            taux_eau = (ca_rec_eau / tot_ca_eau * 100) if tot_ca_eau > 0 else 0
            
            ca_rec_prest = d.get("ca_recouvre_prestation", 0.0)
            tot_ca_prest = d["ca_prestation"]
            taux_prest = (ca_rec_prest / tot_ca_prest * 100) if tot_ca_prest > 0 else 0

            communes_list.append({
                "id": codcom,
                "name": label,
                "ca_eau": round(d["ca_eau"], 2),
                "ca_prestation": round(d["ca_prestation"], 2),
                "ca": round(tot_ca, 2),
                "creance": round(d["creance"], 2),
                "recouvre": round(d["recouvre"], 2),
                "ca_recouvre": round(ca_rec, 2),
                "taux": round(taux, 2),
                # Details EAU
                "creance_eau": round(d.get("creance_eau", 0.0), 2),
                "recouvre_eau": round(d.get("recouvre_eau", 0.0), 2),
                "ca_recouvre_eau": round(ca_rec_eau, 2),
                "taux_eau": round(taux_eau, 2),
                # Details PRESTATIONS
                "creance_prestation": round(d.get("creance_prestation", 0.0), 2),
                "recouvre_prestation": round(d.get("recouvre_prestation", 0.0), 2),
                "ca_recouvre_prestation": round(ca_rec_prest, 2),
                "taux_prestation": round(taux_prest, 2)
            })
        communes_list.sort(key=lambda x: x["creance"], reverse=True)

        # Format types
        types_list = []
        for cat_key, d in type_ca.items():
            tot_ca = d["ca_eau"] + d["ca_prestation"]
            if tot_ca < 100 and d["recouvre"] < 100 and d["creance"] < 100: continue
            ca_rec = d.get("ca_recouvre", 0.0)
            taux = (ca_rec / tot_ca * 100) if tot_ca > 0 else 0
            types_list.append({
                "section": d["section"],
                "ordre": d["ordre"],
                "type_code": d["type_code"],
                "name": d["label"],
                "ca_eau": round(d["ca_eau"], 2),
                "ca_prestation": round(d["ca_prestation"], 2),
                "ca": round(tot_ca, 2),
                "creance": round(d["creance"], 2),
                "recouvre": round(d["recouvre"], 2),
                "ca_recouvre": round(ca_rec, 2),
                "taux": round(taux, 2)
            })
        types_list.sort(key=lambda x: (0 if x["section"] == 'EAU' else 1, x["ordre"], x["name"]))

        total_ca = total_ca_eau + total_ca_prestation

        # Format raw types
        raw_types_list = []
        for tp_code, d in raw_type_ca.items():
            raw_types_list.append({
                "type": tp_code,
                "creance": round(d["creance"], 2),
                "count": d["count"]
            })
        raw_types_list.sort(key=lambda x: x["creance"], reverse=True)

        result = {
            "total_ca_eau": round(total_ca_eau, 2),
            "total_ca_prestation": round(total_ca_prestation, 2),
            "total_ca": round(total_ca, 2),
            "total_creance": round(total_creance, 2),
            "total_recouvre": round(total_recouvre, 2),
            "total_ca_recouvre": round(total_ca_recouvre, 2),
            "by_commune": communes_list,
            "by_type": types_list,
            "by_raw_type": raw_types_list,
            "is_official": official is not None
        }
        return result

    except Exception as e:
        return {"error": str(e)}

@app.get("/creance_detaillee")
def get_creance_detaillee(date_arrete: str):
    try:
        stats = {}
        EMPTY_DATE_VALUES = {'', '        ', '19000101', '00000000', None}

        for r in MEM_FACTURES:
            datsaisie = str(r.get('DATSAISIE') or '').strip()
            datreg = str(r.get('DATREG') or '').strip()
            
            # Filter
            if not datsaisie or datsaisie > date_arrete:
                continue
            
            is_paid_before = False
            if datreg not in EMPTY_DATE_VALUES and datreg <= date_arrete:
                is_paid_before = True
            
            if is_paid_before:
                continue
            
            tp = str(r.get('TYPE') or '').strip()
            typabon = str(r.get('TYPABON') or '').strip()
            periode = str(r.get('PERIODE') or '').strip()
            numab = str(r.get('NUMAB') or '').strip()
            monttc = float(r.get('MONTTC') or 0)

            section = None
            ordre = 0
            type_code = tp
            categorie = ""

            # Categorization logic
            if tp == 'E':
                section = 'EAU'
                type_code = 'E'
                if typabon == '15':
                    ordre = 5
                    categorie = '05:VENTE EN GROS'
                elif '10' <= typabon <= '19':
                    ordre = 1
                    categorie = '01:MENAGES'
                elif '20' <= typabon <= '29':
                    ordre = 2
                    categorie = '02:ADMINISTRATIONS'
                elif '30' <= typabon <= '39':
                    ordre = 3
                    categorie = '03:COMMERCE'
                elif '40' <= typabon <= '49':
                    ordre = 4
                    categorie = '04:INDUSTRIE & TOURISME'
                else:
                    ordre = 6
                    categorie = f'06:AUTRE EAU ({typabon})'
            elif tp == 'C' and periode == '0002':
                section = 'EAU'
                ordre = 7
                type_code = 'C'
                categorie = '07:E/CITERNE'
            elif tp == '6':
                section = 'EAU'
                ordre = 9
                type_code = '6'
                categorie = '09:E/MANQUE A GAGNER'
            elif tp != '':
                section = 'PRESTATIONS'
                ordre = 100
                cl_design = classe_map.get((tp, '****'), tp)
                cs_design = classe_map.get((tp, periode), periode)
                categorie = f"{cl_design} / {cs_design}"

            if section:
                key = (section, ordre, type_code, categorie)
                if key not in stats:
                    stats[key] = {"nbr_factures": 0, "numabs": set(), "creance": 0.0}
                
                stats[key]["nbr_factures"] += 1
                stats[key]["numabs"].add(numab)
                stats[key]["creance"] += monttc

        # Format results
        final_list = []
        for (section, ordre, type_code, categorie), data in stats.items():
            final_list.append({
                "SECTION": section,
                "ORDRE": ordre,
                "TYPE_CODE": type_code,
                "CATEGORIE": categorie,
                "NBR_FACTURES": data["nbr_factures"],
                "NBR_ABONNES": len(data["numabs"]),
                "CREANCE": round(data["creance"], 2)
            })

        # Custom sort: PRESTATIONS first (P > E), then by ORDRE and CATEGORIE
        final_list.sort(key=lambda x: (0 if x["SECTION"] == 'PRESTATIONS' else 1, x["ORDRE"], x["CATEGORIE"]))
        
        return final_list

    except Exception as e:
        return {"error": str(e)}

@app.get("/abonne_factures")
def get_abonne_factures(numab: str = None):
    if not numab:
        return {"error": "numab parameter is required"}
    try:
        numab_upper = numab.strip().upper()
        abonne_info = abonnes_by_numab.get(numab_upper)
        factures = factures_by_numab.get(numab_upper, [])

        results = []
        for f in factures:
            f_copy = dict(f)
            if abonne_info:
                raisoc = str(abonne_info.get('RAISOC', '')).strip()
                nom = str(abonne_info.get('NOM', '')).strip()
                f_copy["NOM"] = raisoc if raisoc else nom
                f_copy["ADRESSE"] = str(abonne_info.get('ADRESSE', '')).strip()
            else:
                f_copy["NOM"] = "Inconnu"
                f_copy["ADRESSE"] = ""
            results.append(f_copy)

        return results
    except Exception as e:
        return {"error": str(e)}

# -------------------------------------------------------------
# NEW ARABIC BILL & DETAILS API ENDPOINTS (NO TRANSLATIONS FILE)
# -------------------------------------------------------------
@app.get("/api/abonne/{numab}")
def get_abonne_api(numab: str):
    numab_upper = numab.strip().upper()
    abonne_rec = abonnes_by_numab.get(numab_upper)
    if not abonne_rec:
        return {"error": "Aucun abonné trouvé."}
        
    raw_codrue = str(abonne_rec.get('CODRUE', '')).strip()
    codrue = raw_codrue.lstrip('0')
    
    rue_rec = rues_by_codrue.get(codrue)
    nom_rue = rue_rec.get('NOUVNOM', '?') if rue_rec else '?'
    nom_rue_arabe = rue_rec.get('NOUVNOMA', None) if rue_rec else None
    
    adresse_str = str(nom_rue).strip()
    bloc = str(abonne_rec.get('BLOC', '')).strip()
    ndom = str(abonne_rec.get('NDOM', '')).strip()
    if bloc: adresse_str += f" | BLOC: {bloc}"
    if ndom: adresse_str += f" | DOM: {ndom}"
    
    raw_typabon = str(abonne_rec.get('TYPABON', '')).strip()
    t_rec = tabcodes_by_code.get("T" + raw_typabon)
    type_abonne_str = t_rec.get('LIBELLE', f"Type {raw_typabon}") if t_rec else "Non spécifié"
    
    abonment_rec = abonments_by_numab.get(numab_upper)
    num_serie = str(abonment_rec.get('NUMSER', 'Inconnu')).strip() if abonment_rec else "Inconnu"
    
    code_unite = ""
    for k in ['UNITE', 'CODUNI', 'COD_UNI']:
        if abonne_rec.get(k):
            code_unite = str(abonne_rec.get(k)).strip()
            break
    if not code_unite:
        code_unite = "N/A"
        
    nom_unite = "N/A"
    if code_unite != "N/A":
        u_code = code_unite.lstrip('0')
        u_rec = unites_by_code.get(u_code)
        if u_rec:
            nom_unite = str(u_rec.get('DENOM', 'Nom manquant')).strip()
        else:
            nom_unite = f"Unité {u_code} non trouvée"
            
    code_secteur = str(abonne_rec.get('SECTEUR', 'N/A')).strip()
    nom_secteur = "N/A"
    if code_secteur != "N/A":
        s_rec = tabcodes_by_code.get("S" + code_secteur)
        if s_rec:
            nom_secteur = str(s_rec.get('LIBELLE', f"Secteur {code_secteur}")).strip()
            
    code_caisse = str(abonne_rec.get('CODCAIS', 'N/A')).strip()
    nom_caisse = "N/A"
    if code_caisse != "N/A":
        c_rec = caisses_by_code.get(code_caisse)
        if c_rec:
            nom_caisse = str(c_rec.get('LIBCAIS', 'Caisse inconnue')).strip()
            
    abonne = {
        "numab": numab_upper,
        "nom_prenom": abonne_rec.get('RAISOC', 'Nom inconnu'),
        "nom_arabe": abonne_rec.get('RAISOCA') or None,
        "adresse": adresse_str,
        "ville": "---",
        "rue_arabe": (nom_rue_arabe.strip() if nom_rue_arabe else None),
        "bloc_arabe": None,
        "ndom_arabe": None,
        "type_abonne": type_abonne_str,
        "raw_type_abonne": raw_typabon,
        "type_abonne_arabe": None,
        "num_serie": num_serie,
        "tournee": str(abonne_rec.get('TOURNEE', 'N/A')).strip(),
        "echelon": str(abonne_rec.get('ECHELON', 'N/A')).strip(),
        "code_unite": code_unite,
        "nom_unite": nom_unite,
        "code_secteur": code_secteur,
        "nom_secteur": nom_secteur,
        "nom_unite_arabe": None,
        "nom_secteur_arabe": None,
        "code_caisse": code_caisse,
        "nom_caisse": nom_caisse,
        "nom_caisse_arabe": None,
        "organisme_payeur_arabe": None,
    }
    
    raw_factures = factures_by_numab.get(numab_upper, [])
    factures_formatted = []
    
    for r in raw_factures:
        dFactRaw = str(r.get('DATFACT', '')).strip()
        dFact = ""
        periode_label = str(r.get('NUMREC', '')).strip()
        
        if len(dFactRaw) == 8:
            dFact = f"{dFactRaw[:4]}-{dFactRaw[4:6]}-{dFactRaw[6:8]}"
            year = dFactRaw[:4]
            month = dFactRaw[4:6]
            typeFact = str(r.get('TYPE', '')).strip()
            periode = str(r.get('PERIODE', '')).strip()
            
            monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
            try:
                monthIndex = int(month) - 1
                monthName = monthNames[monthIndex] if 0 <= monthIndex < 12 else month
            except:
                monthName = month
                
            if typeFact != 'E':
                periode_label = f"{monthName} {year}"
            else:
                if periode == '1':
                    periode_label = f"{monthName} {year}"
                elif periode == '3':
                    trim = ""
                    if month == '03': trim = "الثلاثي الأول"
                    elif month == '06': trim = "الثلاثي الثاني"
                    elif month == '09': trim = "الثلاثي الثالث"
                    elif month == '12': trim = "الثلاثي الرابع"
                    else: trim = f"شهر {month}"
                    periode_label = f"{trim} {year}"
                    
        dReg = str(r.get('DATREG', '')).strip()
        if len(dReg) == 8:
            dReg = f"{dReg[:4]}-{dReg[4:6]}-{dReg[6:8]}"
        else:
            dReg = None
            
        dRelRaw = str(r.get('DATERELEVE', '')).strip()
        dRel = ""
        if len(dRelRaw) == 8:
            dRel = f"{dRelRaw[:4]}-{dRelRaw[4:6]}-{dRelRaw[6:8]}"
        else:
            dRel = dFact
            
        dSaisieRaw = str(r.get('DATSAISIE', '')).strip()
        dSaisie = ""
        if len(dSaisieRaw) == 8:
            dSaisie = f"{dSaisieRaw[:4]}-{dSaisieRaw[4:6]}-{dSaisieRaw[6:8]}"
        else:
            dSaisie = dFact
            
        raw_etat_cpt = str(r.get('ETATCPT', '')).strip()
        etatMap = {
            '10': 'في الخدمة', '11': 'بدون ماء', '12': 'خط غير مستخدم',
            '13': 'تجاوز المؤشر', '14': 'عداد مقطوع', '15': 'بئر',
            '16': 'قطعة أرض', '17': 'خزانة مغلقة', '18': 'منزل غير مسكون',
            '19': 'خط غير مستخدم', '20': 'متوقف', '30': 'بدون عداد',
            '40': 'ملغى', '41': 'غير موصول',
        }
        etat_cpt_str = "N/A"
        if raw_etat_cpt:
            t_lookup = "E" + raw_etat_cpt
            t_rec = tabcodes_by_code.get(t_lookup)
            etat_cpt_str = etatMap.get(raw_etat_cpt) or (t_rec.get('LIBELLE') if t_rec else f"حالة {raw_etat_cpt}")
            
        reference = f"{dFactRaw[:4]}-{dFactRaw[4:6]}/{str(r.get('TYPE', '')).strip()}"
        
        factures_formatted.append({
            "id": reference,
            "numab": numab_upper,
            "montant": float(r.get('MONTTC') or 0),
            "date_fact": dFact,
            "date_reglement": dReg,
            "date_releve": dRel,
            "date_saisie": dSaisie,
            "montant_paye": float(r.get('MONTTC') or 0) if r.get('PAIEMENT') == 'C' else 0,
            "etat_cpt": etat_cpt_str,
            "periode_label": periode_label,
            "raw_periode": str(r.get('PERIODE', '')).strip(),
            "ancien_index": float(r.get('ANCIENX') or 0),
            "nouveau_index": float(r.get('NOUVELX') or 0),
            "consommation": float(r.get('QTE') or 0),
            "timbre": float(r.get('TIMBRE') or 0),
            "paiement": str(r.get('MODALITE', '')).strip(),
            "numrec": str(r.get('NUMREC', '')).strip(),
            "calc_data": {
                "type": str(r.get('TYPE', '')).strip(),
                "typabon": int(r.get('TYPABON') or 0),
                "qe11": float(r.get('QE11') or 0), "pe11": float(r.get('PE11') or 0),
                "qe12": float(r.get('QE12') or 0), "pe12": float(r.get('PE12') or 0),
                "qe13": float(r.get('QE13') or 0), "pe13": float(r.get('PE13') or 0),
                "qe14": float(r.get('QE14') or 0), "pe14": float(r.get('PE14') or 0),
                "qeun": float(r.get('QEUN') or 0), "peun": float(r.get('PEUN') or 0),
                "pa11": float(r.get('PA11') or 0), "pa12": float(r.get('PA12') or 0),
                "pa13": float(r.get('PA13') or 0), "pa14": float(r.get('PA14') or 0),
                "paun": float(r.get('PAUN') or 0),
                "rfa": float(r.get('RFA') or 0),
                "tvrfa": float(r.get('TVRFA') or 0),
                "rfass": float(r.get('RFASS') or 0),
                "tveau": float(r.get('TVEAU') or 0),
                "tvass": float(r.get('TVASS') or 0),
                "ass": float(r.get('ASS') or 0),
                "rqe": float(r.get('RQE') or 0),
                "ree": float(r.get('REE') or 0),
                "rdg": float(r.get('RDG') or 0),
                "qte": float(r.get('QTE') or 0),
            }
        })
        
    factures_formatted.sort(key=lambda x: x["date_fact"])
    
    # Calculate intervals
    for i in range(len(factures_formatted)):
        if i > 0:
            factures_formatted[i]["date_releve_prec"] = factures_formatted[i-1]["date_releve"]
        else:
            if factures_formatted[i]["raw_periode"] == '3':
                try:
                    d = datetime.strptime(factures_formatted[i]["date_releve"], "%Y-%m-%d")
                    d_prec = d - timedelta(days=92)
                    factures_formatted[i]["date_releve_prec"] = d_prec.strftime("%Y-%m-%d")
                except:
                    factures_formatted[i]["date_releve_prec"] = factures_formatted[i]["date_releve"]
            else:
                factures_formatted[i]["date_releve_prec"] = factures_formatted[i]["date_releve"]
                
        try:
            d_rel = datetime.strptime(factures_formatted[i]["date_releve"], "%Y-%m-%d")
            next_rel = d_rel + timedelta(days=91)
            factures_formatted[i]["date_prochain_releve"] = next_rel.strftime("%Y-%m-%d")
        except:
            factures_formatted[i]["date_prochain_releve"] = factures_formatted[i]["date_releve"]
            
        try:
            d_saisie = datetime.strptime(factures_formatted[i]["date_saisie"], "%Y-%m-%d")
            next_fact = d_saisie + timedelta(days=91)
            factures_formatted[i]["date_prochaine_facture"] = next_fact.strftime("%Y-%m-%d")
        except:
            factures_formatted[i]["date_prochaine_facture"] = factures_formatted[i]["date_saisie"]
            
    return {
        "abonne": abonne,
        "factures": factures_formatted
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
