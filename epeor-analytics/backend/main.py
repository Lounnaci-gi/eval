from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dbfread import DBF
import os
import itertools
import json
from datetime import datetime

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

def get_cache(name):
    path = os.path.join(CACHE_DIR, f"{name}.json")
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading cache {name}: {e}")
            return None
    return None

def save_cache(name, data):
    path = os.path.join(CACHE_DIR, f"{name}.json")
    try:
        # If it's a list (ventilation), wrap it to include date_calcul
        if isinstance(data, list):
            cache_data = {
                "date_calcul": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
                "data": data
            }
        else:
            data["date_calcul"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            cache_data = data
            
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving cache {name}: {e}")

def load_dbf(filename, load_all=False):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return None
    try:
        # Use load=False for large files
        table = DBF(path, load=load_all, encoding='cp1252')
        return table
    except Exception as e:
        print(f"Error opening {filename}: {e}")
        return None

@app.get("/stats")
def get_stats():
    try:
        table_abonne = load_dbf("ABONNE.DBF", load_all=False)
        table_factures = load_dbf("FACTURES.DBF", load_all=False)
        table_abonment = load_dbf("ABONMENT.DBF", load_all=False)
        table_tabcode = load_dbf("TABCODE.DBF", load_all=True)
        
        # Load mapping from TABCODE
        mapping = {}
        if table_tabcode is not None:
            for r in table_tabcode:
                if r['CODE_AFFEC'].startswith('T'):
                    # T10 -> 10
                    mapping[r['CODE_AFFEC'][1:]] = r['LIBELLE']

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
        if table_abonment is not None:
            resigned = 0
            stopped = 0
            no_meter = 0
            for record in table_abonment:
                etat = record.get('ETATCPT')
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

        if table_abonne is not None:
            stats["total_subscribers"] = 0
            type_counts = {}
            commune_counts = {}
            
            # Count Communes and Types in a single pass
            table_commune = load_dbf("COMMUNE.DBF", load_all=True)
            commune_map = {}
            if table_commune is not None:
                for r in table_commune:
                    if r.get('SECTEUR') == '02': # Only keep communes for the active sector
                        commune_map[str(r.get('CODCOM', '')).zfill(2)] = r.get('LIBCOM', '')
                        
            # Load QUARTIER mapping to resolve prefixes to CODCOM
            table_quartier = load_dbf("QUARTIER.DBF", load_all=True)
            quart_to_commune = {}
            quartier_names = {}
            if table_quartier is not None:
                for r in table_quartier:
                    q_id = str(r.get('QUART', '')).strip()
                    quart_to_commune[q_id] = str(r.get('COMMUNE', '')).strip().zfill(2)
                    quartier_names[q_id] = str(r.get('LIBQUART', '')).strip()

            for record in table_abonne:
                t = record.get('TYPABON', '').strip()
                if t == '':
                    continue # Exclude empty TYPABON
                
                stats["total_subscribers"] += 1
                if t not in type_counts:
                    type_counts[t] = {"total": 0, "resigned": 0, "stopped": 0}
                
                type_counts[t]["total"] += 1
                
                numab = str(record.get('NUMAB', '')).strip()
                prefix = numab[:2]
                codcom = quart_to_commune.get(prefix, '02') # Default to 02 if mapping missing
                
                if codcom not in commune_counts:
                    commune_counts[codcom] = {"total": 0, "resigned": 0, "stopped": 0, "quartiers": {}}
                
                commune_counts[codcom]["total"] += 1
                
                state = abonment_state_map.get(numab)
                is_resigned = (state == '40')
                is_stopped = (state == '20')
                
                if is_resigned:
                    commune_counts[codcom]["resigned"] += 1
                    type_counts[t]["resigned"] += 1
                if is_stopped:
                    commune_counts[codcom]["stopped"] += 1
                    type_counts[t]["stopped"] += 1
                
                if prefix not in commune_counts[codcom]["quartiers"]:
                    commune_counts[codcom]["quartiers"][prefix] = {"total": 0, "resigned": 0, "stopped": 0}
                
                commune_counts[codcom]["quartiers"][prefix]["total"] += 1
                if is_resigned:
                    commune_counts[codcom]["quartiers"][prefix]["resigned"] += 1
                if is_stopped:
                    commune_counts[codcom]["quartiers"][prefix]["stopped"] += 1
            
            total = stats["total_subscribers"]
            
            # Format types with labels and percentage
            for t_code, counts in type_counts.items():
                if counts["total"] < 10: continue # Skip very small categories for cleaner UI
                label = mapping.get(t_code, f"Autre ({t_code})" if t_code else "Inconnu")
                stats["subscriber_types"].append({
                    "name": label,
                    "value": counts["total"],
                    "resigned": counts["resigned"],
                    "stopped": counts["stopped"],
                    "percentage": round((counts["total"] / total) * 100, 2) if total > 0 else 0
                })
            
            # Sort by count descending
            stats["subscriber_types"].sort(key=lambda x: x['value'], reverse=True)

            stats["subscriber_communes"] = []
            # Iterate over all available communes for the sector, even those with 0 subscribers
            for codcom, label in commune_map.items():
                counts = commune_counts.get(codcom, {"total": 0, "resigned": 0, "stopped": 0, "quartiers": {}})
                
                formatted_quartiers = []
                for q_id, q_counts in counts.get("quartiers", {}).items():
                    q_label = quartier_names.get(q_id, f"Quartier {q_id}")
                    formatted_quartiers.append({
                        "id": q_id,
                        "name": q_label,
                        "value": q_counts["total"],
                        "resigned": q_counts["resigned"],
                        "stopped": q_counts["stopped"],
                        "percentage": round((q_counts["total"] / counts["total"]) * 100, 2) if counts["total"] > 0 else 0
                    })
                formatted_quartiers.sort(key=lambda x: x['value'], reverse=True)

                stats["subscriber_communes"].append({
                    "id": codcom,
                    "name": label,
                    "value": counts["total"],
                    "resigned": counts["resigned"],
                    "stopped": counts["stopped"],
                    "percentage": round((counts["total"] / total) * 100, 2) if total > 0 else 0,
                    "quartiers": formatted_quartiers
                })
            stats["subscriber_communes"].sort(key=lambda x: x['value'], reverse=True)

        # Removed table_abonment loop since it was moved up        
        if table_factures is not None:
            table_avoirs = load_dbf("AVOIR.DBF", load_all=False)
            total_rev = 0
            count = 0
            paid_count = 0
            limit = 100000 
            
            records = itertools.chain(
                ((r, False) for r in table_factures),
                ((r, True) for r in table_avoirs) if table_avoirs else []
            )

            for i, (record, is_avoir) in enumerate(records):
                if i >= limit: break
                
                tp = str(record.get('TYPE') or '').strip()
                monttc = float(record.get('MONTTC') or 0)
                
                # CA based on TYPE E, C, 6.
                if tp in ['E', 'C', '6']:
                    total_rev += monttc

                count += 1
                if record.get('DATREG'):
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
        table_abonne = load_dbf("ABONNE.DBF", load_all=False)
        table_rue = load_dbf("RUE.DBF", load_all=True)
        if table_abonne is None: return {"error": "File not found"}
        
        # Create street mapping
        rue_map = {}
        if table_rue is not None:
            for r in table_rue:
                rue_map[str(r.get('CODRUE'))] = r.get('NOUVNOM', '')

        # Create type mapping
        table_tabcode = load_dbf("TABCODE.DBF", load_all=True)
        type_map = {}
        if table_tabcode is not None:
            for r in table_tabcode:
                if r['CODE_AFFEC'].startswith('T'):
                    type_map[r['CODE_AFFEC'][1:]] = r['LIBELLE']

        # Create counter mapping
        table_abonment = load_dbf("ABONMENT.DBF", load_all=True)
        counter_map = {}
        if table_abonment is not None:
            for r in table_abonment:
                # Map NUMAB to its counter serial and state
                counter_map[str(r.get('NUMAB'))] = {
                    'NUMSER': r.get('NUMSER', ''),
                    'ETATCPT': r.get('ETATCPT', '')
                }

        results = []
        for record in table_abonne:
            numab = str(record.get('NUMAB', ''))
            raisoc = str(record.get('RAISOC', ''))
            nom = str(record.get('NOM', ''))
            
            if (search_term.lower() in numab.lower() or 
                search_term.lower() in raisoc.lower() or 
                search_term.lower() in nom.lower()):
                
                # Format for frontend
                res = dict(record)
                res['NOM'] = raisoc or nom
                
                # Resolve Address components
                codrue = str(record.get('CODRUE', '')).strip()
                street = rue_map.get(codrue, f"Code: {codrue}")
                bloc = str(record.get('BLOC', '')).strip()
                ndom = str(record.get('NDOM', '')).strip()
                
                full_address = f"{street}"
                if bloc: full_address += f" Bloc: {bloc}"
                if ndom: full_address += f" N°: {ndom}"
                res['ADRESSE'] = full_address
                
                # Tech Details
                res['TOURNEE'] = str(record.get('TOURNEE', '')).strip()
                res['NUMORDRE'] = str(record.get('NUMORDRE', '')).strip()
                abonment_info = counter_map.get(numab, {})
                res['NUMSER'] = abonment_info.get('NUMSER', '---')
                res['ETATCPT'] = abonment_info.get('ETATCPT', '---')
                
                # Resolve Type Label
                t_code = str(record.get('TYPABON', '')).strip()
                res['TYPE_LABEL'] = type_map.get(t_code, f"Autre ({t_code})" if t_code else "Inconnu")
                
                results.append(res)
                if len(results) >= 200: break # Standard limit for pagination
                
        return results
    except Exception as e:
        return {"error": str(e)}

@app.get("/subscribers")
def get_subscribers(quartier: str = None, etat: str = None):
    if not quartier:
        return {"error": "Missing parameters"}
    
    try:
        table_abonne = load_dbf("ABONNE.DBF", load_all=False)
        table_abonment = load_dbf("ABONMENT.DBF", load_all=True)
        
        # Load types mapping
        table_tabcode = load_dbf("TABCODE.DBF", load_all=True)
        type_map = {}
        if table_tabcode is not None:
            for r in table_tabcode:
                if r['CODE_AFFEC'].startswith('T'):
                    type_map[r['CODE_AFFEC'][1:]] = r['LIBELLE']
        
        table_rue = load_dbf("RUE.DBF", load_all=True)
        rue_map = {}
        if table_rue is not None:
            for r in table_rue:
                rue_map[str(r.get('CODRUE'))] = str(r.get('NOUVNOM', ''))

        abonment_map = {}
        if table_abonment is not None:
            for r in table_abonment:
                abonment_map[str(r.get('NUMAB', '')).strip()] = {
                    'ETATCPT': str(r.get('ETATCPT', '')).strip(),
                    'NUMSER': str(r.get('NUMSER', '')).strip()
                }

        results = []
        for record in table_abonne:
            numab = str(record.get('NUMAB', '')).strip()
            prefix = numab[:2]
            
            # Filter by Quartier (prefix of NUMAB)
            if prefix != quartier:
                continue
                
            # Filter by ETATCPT (optional — skip filter if etat is None or 'all')
            abonment_info = abonment_map.get(numab, {})
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
            adresse = rue_map.get(codrue, f"Code: {codrue}") if codrue else ""
            bloc = str(record.get('BLOC', '')).strip()
            ndom = str(record.get('NDOM', '')).strip()
            numordre = str(record.get('NUMORDRE', '')).strip()
            numser = abonment_info.get('NUMSER', '---')
                
            results.append({
                "numab": numab,
                "name": display_name,
                "type": type_label,
                "numser": numser,
                "adresse": adresse,
                "bloc": bloc,
                "ndom": ndom,
                "numordre": numordre
            })
            
        return results
    except Exception as e:
        return {"error": str(e)}

def get_official_ca(period_name: str):
    """Scans PROV*.DBF files to find official CA for a given period (e.g. 'Mois de Septembre 2025')"""
    path = "d:/epeor/"
    try:
        files = [f for f in os.listdir(path) if f.startswith("PROV") and f.endswith(".DBF")]
        # Sort to get latest version first
        for f in sorted(files, reverse=True):
            table = load_dbf(f, load_all=True)
            if table is None: continue
            
            # Check first record for period
            first = next(iter(table))
            p_compta = str(first.get('PER_COMPTA', '')).strip()
            
            if period_name.lower() in p_compta.lower() or p_compta.lower() in period_name.lower():
                # Found matching file!
                res = {"ca_eau": 0.0, "rfa": 0.0, "assainis": 0.0, "tva": 0.0}
                for r in table:
                    # Sum all records for the period (Dans Cycle + Hors Cycle)
                    # We look for the "Exercice/Total." which already sums everything
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
    cache_key = f"creance_{start_date or 'all'}_{end_date or 'all'}"
    cached = get_cache(cache_key)
    if cached:
        cached["from_cache"] = True
        return cached

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
        table_factures = load_dbf("FACTURES.DBF", load_all=False)
        table_avoirs = load_dbf("AVOIR.DBF", load_all=False)
        table_quartier = load_dbf("QUARTIER.DBF", load_all=True)
        table_commune  = load_dbf("COMMUNE.DBF",  load_all=True)
        table_tabcode  = load_dbf("TABCODE.DBF",  load_all=True)

        # Build commune map: CODCOM -> label
        commune_map = {}
        if table_commune:
            for r in table_commune:
                if r.get('SECTEUR') == '02':
                    commune_map[str(r.get('CODCOM', '')).zfill(2)] = r.get('LIBCOM', '')

        # Build quartier -> commune mapping
        quart_to_commune = {}
        if table_quartier:
            for r in table_quartier:
                q_id = str(r.get('QUART', '')).strip()
                quart_to_commune[q_id] = str(r.get('COMMUNE', '')).strip().zfill(2)

        # Build type label map
        type_map = {}
        if table_tabcode:
            for r in table_tabcode:
                if r['CODE_AFFEC'].startswith('T'):
                    type_map[r['CODE_AFFEC'][1:]] = r['LIBELLE']

        total_ca_eau        = 0.0
        total_ca_prestation = 0.0
        total_creance       = 0.0
        total_recouvre      = 0.0
        commune_ca          = {}   # codcom -> {ca_eau, ca_prestation, creance, recouvre}
        type_ca             = {}   # typabon -> {label, ca_eau, ca_prestation, creance, recouvre}
        raw_type_ca         = {}   # type -> {creance, count}

        EMPTY_DATE_VALUES = {'', '        ', '19000101', '00000000', None}

        # target_date for "Créance arrêtée" is end_date (or very far in future if not provided)
        target_date = end_date if end_date else '99991231'

        records = itertools.chain(
            ((r, False) for r in table_factures) if table_factures else [],
            ((r, True) for r in table_avoirs) if table_avoirs else []
        )

        for r, is_avoir in records:
            datsaisie = str(r.get('DATSAISIE') or '').strip()
            datreg  = str(r.get('DATREG') or '').strip()
            
            # 1. Activity filters (for CA and Recouvrement within the selected period)
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

            # 2. "Créance arrêtée" condition (matching calculate_all_creances.py logic)
            # Logic: DATSAISIE <= target_date AND (DATREG vide OR DATREG > target_date)
            # IMPORTANT: User insisted on using only the FACTURES.DBF method for this.
            is_creance_arretee = False
            if not is_avoir: # Only invoices contribute to this total as per requested method
                if datsaisie and datsaisie <= target_date:
                    if datreg in EMPTY_DATE_VALUES or datreg > target_date:
                        is_creance_arretee = True

            # Skip if doesn't match any criteria
            if not is_in_saisie and not is_in_reg and not is_creance_arretee:
                continue

            tp = str(r.get('TYPE') or '').strip()
            monttc  = float(r.get('MONTTC') or 0)
            timbre  = float(r.get('TIMBRE') or 0)
            
            numab   = str(r.get('NUMAB', '') or '').strip()
            typabon = str(r.get('TYPABON', '') or '').strip()
            prefix  = numab[:2]
            codcom  = quart_to_commune.get(prefix, '??')

            # Category determination
            cat_key = "Autre"
            cat_label = "Autres"
            if tp == 'C': cat_key = "411080"; cat_label = "Citernage"
            elif tp == '6': cat_key = "411090"; cat_label = "Manque à Gagner"
            elif tp == 'E':
                if typabon == '15': cat_key = "411050"; cat_label = "Vente en Gros"
                elif typabon.startswith('1'): cat_key = "411010"; cat_label = "Ménages"
                elif typabon.startswith('2'): cat_key = "411020"; cat_label = "Administrations"
                elif typabon.startswith('3'): cat_key = "411030"; cat_label = "Services"
                elif typabon.startswith('4'): cat_key = "411040"; cat_label = "Industrie & Tourisme"
            
            # Aggregation logic
            if codcom not in commune_ca:
                commune_ca[codcom] = {"ca_eau": 0.0, "ca_prestation": 0.0, "creance": 0.0, "recouvre": 0.0}
            if cat_key not in type_ca:
                type_ca[cat_key] = {"label": cat_label, "ca_eau": 0.0, "ca_prestation": 0.0, "creance": 0.0, "recouvre": 0.0}

            # CA logic (within range)
            if is_in_saisie:
                if tp in ['E', 'C', '6']:
                    total_ca_eau += monttc
                    commune_ca[codcom]["ca_eau"] += monttc
                    type_ca[cat_key]["ca_eau"] += monttc
                elif tp == 'A':
                    total_ca_prestation += monttc
                    commune_ca[codcom]["ca_prestation"] += monttc
                    type_ca[cat_key]["ca_prestation"] += monttc

            # Recouvrement logic (within range)
            if is_in_reg and not is_avoir:
                m_rec = monttc + timbre
                total_recouvre += m_rec
                commune_ca[codcom]["recouvre"] += m_rec
                type_ca[cat_key]["recouvre"] += m_rec

            # Créance arrêtée logic
            if is_creance_arretee:
                total_creance += monttc
                commune_ca[codcom]["creance"] += monttc
                type_ca[cat_key]["creance"] += monttc
                
                if tp not in raw_type_ca:
                    raw_type_ca[tp] = {"creance": 0.0, "count": 0}
                raw_type_ca[tp]["creance"] += monttc
                raw_type_ca[tp]["count"] += 1



        # Format communes
        communes_list = []
        for codcom, label in commune_map.items():
            d = commune_ca.get(codcom, {"ca_eau": 0.0, "ca_prestation": 0.0, "creance": 0.0, "recouvre": 0.0})
            tot_ca = d["ca_eau"] + d["ca_prestation"]
            taux = (d["creance"] / tot_ca * 100) if tot_ca > 0 else 0
            communes_list.append({
                "id": codcom,
                "name": label,
                "ca_eau": round(d["ca_eau"], 2),
                "ca_prestation": round(d["ca_prestation"], 2),
                "ca": round(tot_ca, 2),
                "creance": round(d["creance"], 2),
                "recouvre": round(d["recouvre"], 2),
                "taux": round(taux, 2)
            })
        communes_list.sort(key=lambda x: x["creance"], reverse=True)

        # Format types
        types_list = []
        for typabon, d in type_ca.items():
            tot_ca = d["ca_eau"] + d["ca_prestation"]
            if tot_ca < 100 and d["recouvre"] < 100: continue
            taux = (d["creance"] / tot_ca * 100) if tot_ca > 0 else 0
            types_list.append({
                "name": d["label"],
                "ca_eau": round(d["ca_eau"], 2),
                "ca_prestation": round(d["ca_prestation"], 2),
                "ca": round(tot_ca, 2),
                "creance": round(d["creance"], 2),
                "recouvre": round(d["recouvre"], 2),
                "taux": round(taux, 2)
            })
        types_list.sort(key=lambda x: x["ca"], reverse=True)

        total_ca = total_ca_eau + total_ca_prestation
        
        # Calibration with official figures if found
        # We no longer override the calculated total_ca_eau so that the result matches the raw SUM calculation.
        # if official:
        #     total_ca_eau = official["ca_eau"]
        #     total_ca = total_ca_eau + total_ca_prestation

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
            "by_commune": communes_list,
            "by_type": types_list,
            "by_raw_type": raw_types_list,
            "is_official": official is not None
        }
        save_cache(cache_key, result)
        return result

    except Exception as e:
        return {"error": str(e)}

@app.get("/creance_detaillee")
def get_creance_detaillee(date_arrete: str):
    cache_key = f"ventilation_{date_arrete}"
    cached = get_cache(cache_key)
    if cached:
        # If it's the wrapped format, return the data part
        if isinstance(cached, dict) and "data" in cached:
            return cached["data"]
        return cached

    """
    Calculates detailed debt (créance arrêtée) at a specific date.
    Follows the categorization logic from the provided SQL query.
    """
    try:
        table_factures = load_dbf("FACTURES.DBF", load_all=False)
        table_classe = load_dbf("CLASSE.DBF", load_all=True)
        
        # Build classe mapping: (CLASSE, S_CLASSE) -> DESIGN
        classe_map = {}
        if table_classe:
            for r in table_classe:
                c = str(r.get('CLASSE', '')).strip()
                sc = str(r.get('S_CLASSE', '')).strip()
                classe_map[(c, sc)] = str(r.get('DESIGN', '')).strip()

        # results: (section, ordre, type_code, categorie) -> {count, numabs, sum}
        stats = {}
        EMPTY_DATE_VALUES = {'', '        ', '19000101', '00000000', None}

        if table_factures is None:
            return {"error": "FACTURES.DBF not found"}

        for r in table_factures:
            datsaisie = str(r.get('DATSAISIE') or '').strip()
            datreg = str(r.get('DATREG') or '').strip()
            
            # Filter: DATSAISIE <= date_arrete AND (DATREG empty OR DATREG > date_arrete)
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
                    # Default for unknown TYPABON in Section EAU
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
                # Section PRESTATIONS
                # SQL: NOT (F.TYPE = 'C' AND F.PERIODE = '0002') already handled by elif above
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

        # Sort by SECTION desc, ORDRE, CATEGORIE
        # Custom sort: PRESTATIONS first (P > E), then by ORDRE and CATEGORIE
        final_list.sort(key=lambda x: (0 if x["SECTION"] == 'PRESTATIONS' else 1, x["ORDRE"], x["CATEGORIE"]))
        
        save_cache(cache_key, final_list)

        return final_list

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
