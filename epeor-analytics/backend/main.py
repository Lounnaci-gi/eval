from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dbfread import DBF
import os
import itertools
import json
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

def _normalize_data_dir(path: str) -> str:
    return os.path.normpath(str(path or "").strip())


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "epeor_config.json")
CACHE_DIR = os.path.join(BASE_DIR, "cache")


def _read_config_file() -> dict:
    try:
        if os.path.isfile(CONFIG_PATH):
            with open(CONFIG_PATH, encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        else:
            default_cfg = {"data_dir": r"d:\epeor"}
            _save_config_file(default_cfg)
            return default_cfg
    except Exception as e:
        print(f"[WARNING] Impossible de lire ou initialiser {CONFIG_PATH}: {e}")
    return {}


def _save_config_file(data: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _is_valid_data_dir(path: str) -> bool:
    normalized = _normalize_data_dir(path)
    if not normalized or not os.path.isdir(normalized):
        return False
    try:
        for entry in os.listdir(normalized):
            if entry.lower() == "abonne.dbf":
                return True
    except Exception:
        pass
    return False


def _resolve_initial_data_dir() -> str:
    env = os.environ.get("EPEOR_DATA_DIR", "").strip()
    if env and _is_valid_data_dir(env):
        return _normalize_data_dir(env)
    saved = _read_config_file().get("data_dir", "")
    if saved and str(saved).strip():
        return _normalize_data_dir(saved)
    return ""


def _env_overrides_data_dir() -> bool:
    env = os.environ.get("EPEOR_DATA_DIR", "").strip()
    return bool(env and _is_valid_data_dir(env))


def _count_dbf_files(data_dir: str | None = None) -> int:
    root = data_dir or DATA_DIR
    if not os.path.isdir(root):
        return 0
    return len([f for f in os.listdir(root) if f.lower().endswith(".dbf")])


def _validate_data_dir(path: str) -> tuple[bool, str]:
    normalized = _normalize_data_dir(path)
    if not normalized:
        return False, "Veuillez indiquer un chemin de dossier."
    if not os.path.isdir(normalized):
        return False, f"Dossier introuvable : {normalized}"
    has_abonne = False
    try:
        for entry in os.listdir(normalized):
            if entry.lower() == "abonne.dbf":
                has_abonne = True
                break
    except OSError as e:
        return False, f"Impossible de lire le dossier : {e}"
    if not has_abonne:
        n = _count_dbf_files(normalized)
        return (
            False,
            f"Fichier ABONNE.DBF introuvable dans ce dossier ({n} fichier(s) DBF détecté(s)).",
        )
    return True, ""


DATA_DIR = _resolve_initial_data_dir()
if not os.path.isdir(DATA_DIR):
    print(f"[WARNING] EPEOR data directory not found: {DATA_DIR}")
    print("          Définissez le chemin dans Paramètres ou via EPEOR_DATA_DIR.")
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

_load_retry_count = 0
_MAX_LOAD_RETRIES = 3

# Libellés affichés à l'utilisateur (jamais les noms de fichiers sources)
_DATASET_LABELS = {
    "ABONNE.DBF": "référentiel abonnés",
    "FACTURES.DBF": "historique de facturation",
    "AVOIR.DBF": "avoirs et régularisations",
    "ABONMENT.DBF": "contrats et compteurs",
    "TABCODE.DBF": "codes et libellés",
    "COMMUNE.DBF": "communes",
    "QUARTIER.DBF": "quartiers",
    "RUE.DBF": "voies",
    "CLASSE.DBF": "classes tarifaires",
    "UNITE.DBF": "unités",
    "CAISSE.DBF": "caisses",
    "ABINSTIT.DBF": "liens institutionnels",
    "INSTIT.DBF": "organismes payeurs",
}


def _dataset_label(filename: str) -> str:
    return _DATASET_LABELS.get(str(filename or "").upper(), "jeu de données")


def _set_loading_status(message: str) -> None:
    global db_loading_status
    db_loading_status = message


def resolve_dbf_path(filename: str) -> str:
    """Résout un fichier DBF (insensible à la casse sous Windows)."""
    direct = os.path.join(DATA_DIR, filename)
    if os.path.isfile(direct):
        return direct
    if os.path.isdir(DATA_DIR):
        target = filename.lower()
        for entry in os.listdir(DATA_DIR):
            if entry.lower() == target:
                return os.path.join(DATA_DIR, entry)
    return direct


def diagnose_data_dir() -> str:
    """Message de diagnostic utilisateur (sans noms de tables)."""
    if not os.path.isdir(DATA_DIR):
        return f"Le dossier de données configuré est introuvable ({DATA_DIR})."
    abonne_path = resolve_dbf_path("ABONNE.DBF")
    if not os.path.isfile(abonne_path):
        data_files = len([f for f in os.listdir(DATA_DIR) if f.lower().endswith(".dbf")])
        return (
            f"Le référentiel abonnés est absent dans {DATA_DIR} "
            f"({data_files} fichier(s) de données détecté(s)). Vérifiez EPEOR_DATA_DIR."
        )
    size = os.path.getsize(abonne_path)
    if size < 100:
        return f"Le référentiel abonnés est vide ou illisible ({size} octets)."
    return f"Référentiel abonnés détecté ({size:,} octets)."

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
indexes_ready = False
db_loading_status = "Initialisation du serveur backend..."
cached_dashboard_stats = None
_data_load_lock = threading.Lock()

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
MEM_ABINSTIT = []
MEM_INSTIT = []

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
instit_by_codinstit = {}    # CODINSTIT (upper) -> INSTIT record
instit_by_unite_cod = {}    # (UNITE, CODINSTIT upper) -> INSTIT record

def load_table_cached(filename, encoding='cp1256'):
    """Checks cache validation and loads DBF or Pickle binary for maximum speed"""
    global db_loading_status
    dbf_path = resolve_dbf_path(filename)
    if not os.path.isfile(dbf_path):
        print(f"[WARNING] {filename} does not exist at {dbf_path}")
        return []
    
    pkl_path = os.path.join(CACHE_DIR, filename.lower().replace('.dbf', '.pkl'))
    
    # Check if cache is valid (pkl exists and is newer than the actual DBF file)
    if os.path.exists(pkl_path):
        dbf_mtime = os.path.getmtime(dbf_path)
        pkl_mtime = os.path.getmtime(pkl_path)
        if pkl_mtime >= dbf_mtime:
            try:
                _set_loading_status(f"Chargement ({_dataset_label(filename)}) depuis le cache…")
                t0 = time.time()
                import gc
                gc.disable()
                try:
                    with open(pkl_path, 'rb') as f:
                        data = pickle.load(f)
                finally:
                    gc.enable()
                if len(data) == 0:
                    print(f"[CACHE] Cache vide pour {filename}, reconstruction...")
                else:
                    print(f"[CACHE] Loaded {filename} in {time.time()-t0:.2f}s ({len(data)} records)")
                    return data
            except Exception as e:
                print(f"Error reading cache for {filename}: {e}. Rebuilding...")
                try:
                    os.unlink(pkl_path)
                except OSError:
                    pass
    
    # Missing or invalid cache -> Load from DBF
    try:
        _set_loading_status(f"Import ({_dataset_label(filename)}) — préparation du cache…")
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

def build_invoice_indexes():
    """Builds per-subscriber invoice indexes (slow; runs after dashboard is ready)."""
    global factures_by_numab, avoirs_by_numab, indexes_ready, db_loading_status

    _set_loading_status("Indexation de l'historique de facturation par abonné…")
    print("[INFO] Building invoice indexes...")
    t0 = time.time()

    factures_by_numab = {}
    for r in MEM_FACTURES:
        numab = str(r.get('NUMAB', '')).strip().upper()
        if numab:
            if numab not in factures_by_numab:
                factures_by_numab[numab] = []
            factures_by_numab[numab].append(r)

    for numab in factures_by_numab:
        factures_by_numab[numab].sort(key=lambda x: str(x.get('DATFACT', '')).strip(), reverse=True)

    avoirs_by_numab = {}
    for r in MEM_AVOIRS:
        numab = str(r.get('NUMAB', '')).strip().upper()
        if numab:
            if numab not in avoirs_by_numab:
                avoirs_by_numab[numab] = []
            avoirs_by_numab[numab].append(r)

    for numab in avoirs_by_numab:
        avoirs_by_numab[numab].sort(key=lambda x: str(x.get('DATFACT', '')).strip(), reverse=True)

    indexes_ready = True
    _set_loading_status("Prêt")
    print(f"[SUCCESS] Invoice indexes ready in {time.time()-t0:.2f}s")


def _secteur_numabs_set(secteur: str | None):
    """NUMAB (upper) des abonnés du secteur/centre, ou None = toute l'unité."""
    if not secteur or not str(secteur).strip():
        return None
    secteur_zfill = str(secteur).strip().zfill(2)
    return {
        str(a.get('NUMAB', '')).strip().upper()
        for a in MEM_ABONNES
        if str(a.get('SECTEUR', '')).strip().zfill(2) == secteur_zfill
    }


def _centre_code_zfill(secteur: str | None) -> str | None:
    if not secteur or not str(secteur).strip():
        return None
    return str(secteur).strip().zfill(2)


def _commune_codcoms_for_centre(secteur: str | None) -> set[str] | None:
    """CODCOM des communes rattachées au centre (COMMUNE.SECTEUR = code centre TABCODE)."""
    centre = _centre_code_zfill(secteur)
    if centre is None:
        return None
    return {
        codcom
        for codcom, r in communes_by_code.items()
        if str(r.get('SECTEUR', '')).strip().zfill(2) == centre
    }


def _commune_map_for_centre(secteur: str | None) -> dict[str, str]:
    """CODCOM -> libellé commune pour un centre, ou toutes les communes si secteur absent."""
    centre = _centre_code_zfill(secteur)
    if centre is None:
        return {
            codcom: str(r.get('LIBCOM', '')).strip()
            for codcom, r in communes_by_code.items()
        }
    return {
        codcom: str(r.get('LIBCOM', '')).strip()
        for codcom, r in communes_by_code.items()
        if str(r.get('SECTEUR', '')).strip().zfill(2) == centre
    }


def _abonne_codcom(numab: str) -> str:
    prefix = str(numab or '').strip()[:2]
    return quartier_to_commune.get(prefix, '02')


def _abonne_in_centre(numab: str, allowed_communes: set[str] | None) -> bool:
    if allowed_communes is None:
        return True
    return _abonne_codcom(numab) in allowed_communes


def compute_dashboard_stats(secteur: str | None = None):
    """KPIs tableau de bord ; secteur optionnel = filtre par centre (COMMUNE.SECTEUR)."""
    allowed_communes = _commune_codcoms_for_centre(secteur) if is_db_ready else None
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
    resigned = stopped = no_meter = 0
    for record in MEM_ABONMENTS:
        numab = str(record.get('NUMAB', '')).strip()
        if not _abonne_in_centre(numab, allowed_communes):
            continue
        etat = str(record.get('ETATCPT', '')).strip()
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

    type_counts = {}
    commune_counts = {}
    commune_map = _commune_map_for_centre(secteur)

    for record in MEM_ABONNES:
        numab = str(record.get('NUMAB', '')).strip()
        if not _abonne_in_centre(numab, allowed_communes):
            continue
        t = str(record.get('TYPABON', '')).strip()
        if t == '':
            continue

        stats["total_subscribers"] += 1
        if t not in type_counts:
            type_counts[t] = {"total": 0, "resigned": 0, "stopped": 0, "no_meter": 0}
        type_counts[t]["total"] += 1

        codcom = _abonne_codcom(numab)
        if codcom not in commune_map:
            continue

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

        prefix = numab[:2]
        if prefix not in commune_counts[codcom]["quartiers"]:
            commune_counts[codcom]["quartiers"][prefix] = {"total": 0, "resigned": 0, "stopped": 0, "no_meter": 0}
        commune_counts[codcom]["quartiers"][prefix]["total"] += 1
        if is_resigned:
            commune_counts[codcom]["quartiers"][prefix]["resigned"] += 1
        if is_stopped:
            commune_counts[codcom]["quartiers"][prefix]["stopped"] += 1
        if is_no_meter:
            commune_counts[codcom]["quartiers"][prefix]["no_meter"] += 1

    # Sans filtre centre : n'afficher que les communes ayant des abonnés
    if allowed_communes is None:
        commune_map = {
            codcom: commune_map.get(codcom) or communes_by_code.get(codcom, {}).get('LIBCOM', f'Commune {codcom}')
            for codcom in commune_counts
        }

    total = stats["total_subscribers"]

    for t_code, counts in type_counts.items():
        if counts["total"] < 10:
            continue
        label = mapping.get(t_code, f"Autre ({t_code})" if t_code else "Inconnu")
        stats["subscriber_types"].append({
            "code": t_code,
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
        if allowed_communes is not None and counts["total"] == 0:
            # Centre choisi : garder les communes du centre même sans abonné
            pass
        elif allowed_communes is None and counts["total"] == 0:
            continue
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
            "name": label or f"Commune {codcom}",
            "value": counts["total"],
            "resigned": counts["resigned"],
            "stopped": counts["stopped"],
            "no_meter": counts["no_meter"],
            "percentage": round((counts["total"] / total) * 100, 2) if total > 0 else 0,
            "quartiers": formatted_quartiers
        })
    stats["subscriber_communes"].sort(key=lambda x: x['value'], reverse=True)

    # Group by sectors (centres)
    sector_counts = {}
    for r_tab in MEM_TABCODES:
        code_affec = str(r_tab.get('CODE_AFFEC', '')).strip().upper()
        if code_affec.startswith('S'):
            sec_code = code_affec[1:].strip().zfill(2)
            libelle = str(r_tab.get('LIBELLE', '')).strip()
            if sec_code and sec_code not in sector_counts:
                sector_counts[sec_code] = {
                    "id": sec_code,
                    "name": libelle or f"Secteur {sec_code}",
                    "value": 0,
                    "resigned": 0,
                    "stopped": 0,
                    "no_meter": 0
                }

    for codcom, counts in commune_counts.items():
        commune_rec = communes_by_code.get(codcom)
        secteur_code = str(commune_rec.get('SECTEUR', '')).strip().zfill(2) if commune_rec else None
        if not secteur_code:
            continue
        if secteur_code not in sector_counts:
            libcom = None
            for r_tab in MEM_TABCODES:
                code_affec = str(r_tab.get('CODE_AFFEC', '')).strip().upper()
                if code_affec == 'S' + secteur_code:
                    libcom = str(r_tab.get('LIBELLE', '')).strip()
                    break
            sector_counts[secteur_code] = {
                "id": secteur_code,
                "name": libcom or f"Secteur {secteur_code}",
                "value": 0,
                "resigned": 0,
                "stopped": 0,
                "no_meter": 0
            }
        sector_counts[secteur_code]["value"] += counts["total"]
        sector_counts[secteur_code]["resigned"] += counts["resigned"]
        sector_counts[secteur_code]["stopped"] += counts["stopped"]
        sector_counts[secteur_code]["no_meter"] += counts["no_meter"]

    stats["subscriber_sectors"] = []
    for sec_code, s_data in sector_counts.items():
        if s_data["value"] > 0:
            s_data["percentage"] = round((s_data["value"] / total) * 100, 2) if total > 0 else 0
            stats["subscriber_sectors"].append(s_data)
    stats["subscriber_sectors"].sort(key=lambda x: x['value'], reverse=True)


    months = {
        "01": "Janvier", "02": "Février", "03": "Mars", "04": "Avril",
        "05": "Mai", "06": "Juin", "07": "Juillet", "08": "Août",
        "09": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre"
    }

    def format_period(period_str):
        if not period_str or len(period_str) < 6:
            return "Période en cours"
        year = period_str[:4]
        month = period_str[4:6]
        return f"{months.get(month, month)} {year}"

    latest_period = ''
    total_rev = 0
    count = 0
    paid_count = 0

    def _facture_in_scope(r):
        numab_r = str(r.get('NUMAB', '') or '').strip()
        return _abonne_in_centre(numab_r, allowed_communes)

    for r in MEM_FACTURES:
        if not _facture_in_scope(r):
            continue
        tp = str(r.get('TYPE') or '').strip()
        monttc = float(r.get('MONTTC') or 0)
        df = str(r.get('DATFACT') or '').strip()
        count += 1
        if r.get('DATREG'):
            paid_count += 1
        if len(df) >= 6:
            p = df[:6]
            if p > latest_period:
                latest_period = p

    for r in MEM_AVOIRS:
        if not _facture_in_scope(r):
            continue
        tp = str(r.get('TYPE') or '').strip()
        monttc = float(r.get('MONTTC') or 0)
        df = str(r.get('DATFACT') or '').strip()
        count += 1
        if r.get('DATREG'):
            paid_count += 1
        if len(df) >= 6:
            p = df[:6]
            if p > latest_period:
                latest_period = p

    for r in MEM_FACTURES:
        if not _facture_in_scope(r):
            continue
        tp = str(r.get('TYPE') or '').strip()
        monttc = float(r.get('MONTTC') or 0)
        df = str(r.get('DATFACT') or '').strip()
        if latest_period and df.startswith(latest_period) and tp in ['E', 'C', '6']:
            total_rev += monttc

    for r in MEM_AVOIRS:
        if not _facture_in_scope(r):
            continue
        tp = str(r.get('TYPE') or '').strip()
        monttc = float(r.get('MONTTC') or 0)
        df = str(r.get('DATFACT') or '').strip()
        if latest_period and df.startswith(latest_period) and tp in ['E', 'C', '6']:
            total_rev += monttc

    stats["total_revenue"] = round(total_rev, 2)
    stats["revenue_period"] = format_period(latest_period) if latest_period else "Période en cours"
    stats["recent_invoices_count"] = count
    stats["recovery_rate"] = round((paid_count / count) * 100, 2) if count > 0 else 0
    return stats


def load_all_data_to_memory():
    """Initializes and builds O(1) in-memory indexes on startup"""
    global MEM_ABONNES, MEM_FACTURES, MEM_AVOIRS, MEM_ABONMENTS, MEM_TABCODES
    global MEM_COMMUNES, MEM_QUARTIERS, MEM_RUES, MEM_CLASSES, MEM_UNITES, MEM_CAISSES
    global MEM_ABINSTIT, MEM_INSTIT
    global abonnes_by_numab, rues_by_codrue, tabcodes_by_code, abonments_by_numab
    global instit_by_codinstit, instit_by_unite_cod
    global factures_by_numab, avoirs_by_numab, unites_by_code, caisses_by_code
    global communes_by_code, quartier_to_commune, quartier_names, classe_map
    global is_db_ready, indexes_ready, db_loading_status, cached_dashboard_stats
    global _load_retry_count

    acquired = _data_load_lock.acquire(blocking=True, timeout=900)
    if not acquired:
        print("[ERROR] Timeout en attente du verrou de chargement des données.")
        db_loading_status = "Chargement déjà en cours (timeout). Réessayez dans quelques instants."
        return

    try:
        is_db_ready = False
        indexes_ready = False
        cached_dashboard_stats = None
        db_loading_status = "Initialisation de la base de données..."
        print(f"[INFO] Initializing EPEOR database from {DATA_DIR}")
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
        MEM_ABINSTIT = load_table_cached("ABINSTIT.DBF", encoding='cp1256')
        MEM_INSTIT = load_table_cached("INSTIT.DBF", encoding='cp1256')

        if len(MEM_ABONNES) == 0:
            detail = diagnose_data_dir()
            db_loading_status = (
                f"Aucune donnée chargée depuis {DATA_DIR}. "
                f"{detail}"
            )
            print(f"[ERROR] {db_loading_status}")
            if _load_retry_count < _MAX_LOAD_RETRIES:
                _load_retry_count += 1
                wait_s = 3 * _load_retry_count
                print(f"[INFO] Nouvelle tentative de chargement ({_load_retry_count}/{_MAX_LOAD_RETRIES}) dans {wait_s}s...")
                db_loading_status = f"Échec du chargement — nouvelle tentative dans {wait_s}s… ({detail})"
                threading.Timer(wait_s, load_all_data_to_memory).start()
            return

        _load_retry_count = 0
        print("[INFO] Building indexes and hash mappings...")

        abonnes_by_numab = {}
        for r in MEM_ABONNES:
            numab = str(r.get('NUMAB', '')).strip().upper()
            if numab:
                abonnes_by_numab[numab] = r

        rues_by_codrue = {}
        for r in MEM_RUES:
            codrue = str(r.get('CODRUE', '')).strip()
            if codrue:
                rues_by_codrue[codrue] = r
                rues_by_codrue[codrue.lstrip('0')] = r

        tabcodes_by_code = {}
        for r in MEM_TABCODES:
            code_affec = str(r.get('CODE_AFFEC', '')).strip().upper()
            if code_affec:
                tabcodes_by_code[code_affec] = r

        abonments_by_numab = {}
        for r in MEM_ABONMENTS:
            numab = str(r.get('NUMAB', '')).strip().upper()
            if numab:
                abonments_by_numab[numab] = r

        unites_by_code = {}
        for r in MEM_UNITES:
            code_unite = str(r.get('UNITE', '')).strip()
            if code_unite:
                unites_by_code[code_unite] = r
                unites_by_code[code_unite.lstrip('0')] = r

        caisses_by_code = {}
        for r in MEM_CAISSES:
            code_caisse = str(r.get('CODCAIS', '')).strip()
            if code_caisse:
                caisses_by_code[code_caisse] = r

        communes_by_code = {}
        for r in MEM_COMMUNES:
            codcom = str(r.get('CODCOM', '')).strip()
            if codcom:
                communes_by_code[codcom.zfill(2)] = r

        quartier_to_commune = {}
        quartier_names = {}
        for r in MEM_QUARTIERS:
            q_id = str(r.get('QUART', '')).strip()
            if q_id:
                quartier_to_commune[q_id] = str(r.get('COMMUNE', '')).strip().zfill(2)
                quartier_names[q_id] = str(r.get('LIBQUART', '')).strip()

        classe_map = {}
        for r in MEM_CLASSES:
            c = str(r.get('CLASSE', '')).strip()
            sc = str(r.get('S_CLASSE', '')).strip()
            classe_map[(c, sc)] = str(r.get('DESIGN', '')).strip()

        instit_by_codinstit = {}
        instit_by_unite_cod = {}
        for r in MEM_INSTIT:
            cod = str(r.get('CODINSTIT', '')).strip().upper()
            unite = str(r.get('UNITE', '')).strip()
            if cod:
                instit_by_codinstit[cod] = r
            if unite and cod:
                instit_by_unite_cod[(unite, cod)] = r

        print(f"[INFO] Computing dashboard statistics...")
        cached_dashboard_stats = compute_dashboard_stats()
        is_db_ready = True
        print(
            f"[SUCCESS] Dashboard ready in {time.time()-t_start:.2f}s "
            f"({cached_dashboard_stats['total_subscribers']} abonnés, "
            f"{len(MEM_FACTURES)} factures)"
        )
        threading.Thread(target=build_invoice_indexes, daemon=True).start()
    except Exception as e:
        db_loading_status = f"Erreur lors du chargement : {e}"
        print(f"[ERROR] {db_loading_status}")
        import traceback
        traceback.print_exc()
        if _load_retry_count < _MAX_LOAD_RETRIES:
            _load_retry_count += 1
            wait_s = 5 * _load_retry_count
            db_loading_status = f"Erreur : {e} — nouvelle tentative dans {wait_s}s…"
            threading.Timer(wait_s, load_all_data_to_memory).start()
    finally:
        _data_load_lock.release()

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
    print("[INFO] Clearing cache requested...")
    clear_cache_directory()
    global is_db_ready, cached_dashboard_stats, indexes_ready
    is_db_ready = False
    cached_dashboard_stats = None
    indexes_ready = False
    threading.Thread(target=load_all_data_to_memory, daemon=True).start()
    return {"status": "success", "message": "Cache vidé, rechargement en cours..."}

# -------------------------------------------------------------
# TABCODE / RUE lookup helpers
# -------------------------------------------------------------
def resolve_typabon_label(typabon_code: str) -> str:
    """LIBELLE from TABCODE (CODE_AFFEC = T + TYPABON)."""
    raw = str(typabon_code or '').strip()
    if not raw or raw == '—':
        return '—'
    lookup = raw.upper()
    if not lookup.startswith('T'):
        lookup = 'T' + lookup
    t_rec = tabcodes_by_code.get(lookup)
    if t_rec:
        lib = str(t_rec.get('LIBELLE', '')).strip()
        if lib:
            return lib
    return f"Autre ({raw})"


def resolve_etatcpt_label(etat_code: str) -> str:
    """LIBELLE from TABCODE (CODE_AFFEC = E + ETATCPT)."""
    raw = str(etat_code or '').strip()
    if not raw or raw == '—':
        return '—'
    lookup = raw.upper()
    if not lookup.startswith('E'):
        lookup = 'E' + lookup
    t_rec = tabcodes_by_code.get(lookup)
    if t_rec:
        lib = str(t_rec.get('LIBELLE', '')).strip()
        if lib:
            return lib
    return raw


def _normalize_etatcpt_code(val) -> str:
    s = str(val or '').strip()
    if not s:
        return ''
    try:
        return str(int(float(s)))
    except (ValueError, TypeError):
        return s


def _invoice_period_key(r) -> tuple:
    """Clé (année, mois) extraite de DATFACT pour tri chronologique par période."""
    d = str(r.get('DATFACT', '')).strip()
    if len(d) >= 6 and d[:4].isdigit() and d[4:6].isdigit():
        return (int(d[:4]), int(d[4:6]))
    return (0, 0)


def _invoices_newest_first(invoices: list) -> list:
    """Une facture par période (année-mois), la plus récente en premier."""
    by_period: dict[tuple, dict] = {}
    for inv in invoices:
        key = _invoice_period_key(inv)
        if key == (0, 0):
            continue
        prev = by_period.get(key)
        if prev is None or str(inv.get('DATFACT', '')).strip() >= str(prev.get('DATFACT', '')).strip():
            by_period[key] = inv
    return sorted(by_period.values(), key=_invoice_period_key, reverse=True)


def count_consecutive_etatcpt(invoices: list, target_etat: str = '20') -> int:
    """
    Nombre de périodes de facturation consécutives (les plus récentes) avec ETATCPT = target_etat.
    Parcourt de la dernière facture vers les plus anciennes et s'arrête dès qu'une période
    n'a pas cet état (ex. T1–T3 2025=20, T4 2025≠20, T1 2026=20 → 1, pas 4).
    """
    target = _normalize_etatcpt_code(target_etat)
    if not target:
        return 0
    ordered = _invoices_newest_first(invoices)
    count = 0
    for inv in ordered:
        if _normalize_etatcpt_code(inv.get('ETATCPT')) == target:
            count += 1
        else:
            break
    return count


EMPTY_DATE_VALUES = frozenset({'', '        ', '19000101', '00000000', None})


def _creance_date_arrete() -> str:
    """Date d'arrêté pour le calcul des créances en cours (aujourd'hui)."""
    return datetime.now().strftime('%Y%m%d')


def is_unpaid_creance(r, is_avoir: bool, date_arrete: str | None = None) -> bool:
    """
    Créance impayée à la date d'arrêté — même règles que get_creance / creance_detaillee.
    Facture : saisie avant arrêté et non réglée (DATREG vide ou après arrêté).
    Avoir : validé après l'arrêté (DATANUL > arrêté) et non réglé — les anciens avoirs
    déjà validés (DATANUL passé) ne sont pas des créances ouvertes.
    """
    if date_arrete is None:
        date_arrete = _creance_date_arrete()
    datsaisie = str(r.get('DATSAISIE') or '').strip()
    datreg = str(r.get('DATREG') or '').strip()
    if not datsaisie or datsaisie > date_arrete:
        return False
    if not is_avoir:
        return datreg in EMPTY_DATE_VALUES or datreg > date_arrete
    datanul = str(r.get('DATANUL') or '').strip()
    if not datanul or datanul <= date_arrete:
        return False
    return datreg in EMPTY_DATE_VALUES or datreg > date_arrete


def creance_monttc_delta(r, is_avoir: bool) -> float:
    """Contribution signée au solde créance (factures +, avoirs -)."""
    monttc = float(r.get('MONTTC') or 0)
    return -monttc if is_avoir else monttc


def resolve_instit_record(codinstit: str, unite: str = ""):
    """INSTIT.DBF row from CODINSTIT, with optional UNITE fallback."""
    cod = str(codinstit or '').strip().upper()
    if not cod:
        return None
    inst = instit_by_codinstit.get(cod)
    if inst:
        return inst
    u = str(unite or '').strip()
    if u:
        return instit_by_unite_cod.get((u, cod))
    return None


def resolve_unite_label(unite_code: str) -> str:
    """DENOM from UNITE.DBF."""
    raw = str(unite_code or '').strip()
    if not raw or raw == '—':
        return '—'
    u_rec = unites_by_code.get(raw) or unites_by_code.get(raw.lstrip('0'))
    if u_rec:
        denom = str(u_rec.get('DENOM', '')).strip()
        if denom:
            return denom
    return raw


def resolve_rue_adresse(abonne_rec) -> str:
    """Street name from RUE.DBF NOUVNOM via CODRUE."""
    if not abonne_rec:
        return '—'
    codrue = str(abonne_rec.get('CODRUE', '')).strip()
    if not codrue:
        return '—'
    street_rec = rues_by_codrue.get(codrue) or rues_by_codrue.get(codrue.lstrip('0'))
    if street_rec:
        nom = str(street_rec.get('NOUVNOM', '')).strip()
        if nom:
            return nom
    return f"Code rue: {codrue}"


# -------------------------------------------------------------
# API HANDLERS (Blazing Fast In-Memory Processing)
# -------------------------------------------------------------
@app.get("/stats")
def get_stats(secteur: str = None):
    if not is_db_ready or cached_dashboard_stats is None:
        msg = db_loading_status or "Chargement en cours..."
        is_error = (
            "Aucune donnée chargée" in msg
            or "introuvable" in msg.lower()
            or msg.startswith("Erreur")
        ) and _load_retry_count >= _MAX_LOAD_RETRIES
        return {
            "status": "error" if is_error else "loading",
            "message": msg,
            "ready": False,
            "data_dir": DATA_DIR,
            "can_reload": True,
        }
    if len(MEM_ABONNES) == 0:
        return {
            "status": "error",
            "ready": False,
            "error": db_loading_status or f"Aucune donnée dans {DATA_DIR}. Redémarrez le backend.",
            "message": db_loading_status,
            "data_dir": DATA_DIR,
            "can_reload": True,
        }
    if secteur and str(secteur).strip():
        scoped = compute_dashboard_stats(secteur=str(secteur).strip())
        return {**scoped, "ready": True, "data_dir": DATA_DIR, "secteur": str(secteur).strip()}
    if cached_dashboard_stats.get("total_subscribers", 0) == 0:
        return {
            "status": "error",
            "ready": False,
            "error": db_loading_status or f"Aucune donnée dans {DATA_DIR}. Redémarrez le backend.",
            "message": db_loading_status,
            "data_dir": DATA_DIR,
            "can_reload": True,
        }
    return {**cached_dashboard_stats, "ready": True, "data_dir": DATA_DIR}


@app.get("/api/status")
def get_api_status():
    """Diagnostic rapide du backend et du dossier données."""
    abonne_path = resolve_dbf_path("ABONNE.DBF")
    return {
        "data_dir": DATA_DIR,
        "data_dir_exists": os.path.isdir(DATA_DIR),
        "dbf_count": _count_dbf_files(),
        "locked_by_env": _env_overrides_data_dir(),
        "primary_source_ready": os.path.isfile(abonne_path) and os.path.getsize(abonne_path) >= 100,
        "is_db_ready": is_db_ready,
        "indexes_ready": indexes_ready,
        "subscribers_loaded": len(MEM_ABONNES),
        "billing_records_loaded": len(MEM_FACTURES),
        "loading_status": db_loading_status,
        "load_retries": _load_retry_count,
        "diagnostic": diagnose_data_dir(),
    }


@app.get("/api/subscribers_evolution")
def get_subscribers_evolution(secteur: str = None, commune: str = None, type_abon: str = None):
    if not is_db_ready or len(MEM_ABONNES) == 0:
        return {"ready": False, "evolution": [], "total": 0, "missing_dates_handled": 0}

    allowed_communes = _commune_codcoms_for_centre(secteur) if secteur and str(secteur).strip() else None

    abonment_dates = {}
    abonment_state_map = {}
    for r in MEM_ABONMENTS:
        numab = str(r.get('NUMAB') or '').strip().upper()
        if not numab:
            continue
        di = str(r.get('DATEINST') or '').strip()
        abonment_dates[numab] = di if di and len(di) == 8 and di.isdigit() else ''
        abonment_state_map[numab] = str(r.get('ETATCPT') or '').strip()

    join_dates = []
    missing_count = 0
    resigned_join_dates = []
    missing_resigned_count = 0

    for r in MEM_ABONNES:
        numab = str(r.get('NUMAB') or '').strip().upper()
        if not _abonne_in_centre(numab, allowed_communes):
            continue

        if commune and str(commune).strip():
            if _abonne_codcom(numab) != str(commune).strip():
                continue

        if type_abon and str(type_abon).strip():
            if str(r.get('TYPABON') or '').strip() != str(type_abon).strip():
                continue

        dp = str(r.get('DATEPRISE') or '').strip()
        dc = str(r.get('DATECRE') or '').strip()
        ff = str(r.get('FIRSTFACT') or '').strip()
        di = abonment_dates.get(numab, '')

        resolved_date = None
        for d in [dp, dc, ff, di]:
            if d and len(d) == 8 and d.isdigit():
                y = int(d[:4])
                if 1980 <= y <= 2026:
                    resolved_date = d
                    break

        if resolved_date:
            join_dates.append(resolved_date)
        else:
            missing_count += 1

        state = abonment_state_map.get(numab)
        if state == '40':
            if resolved_date:
                resigned_join_dates.append(resolved_date)
            else:
                missing_resigned_count += 1

    if not join_dates and missing_count == 0:
        return {"ready": True, "evolution": [], "total": 0, "missing_dates_handled": 0}

    min_date = min(join_dates) if join_dates else "20100101"
    min_year = int(min_date[:4])
    if min_year < 2000:
        min_year = 2000

    monthly_counts = {}
    monthly_resigned_counts = {}
    current_year = 2026
    current_month = 6

    year_ptr = min_year
    month_ptr = 1
    while year_ptr < current_year or (year_ptr == current_year and month_ptr <= current_month):
        period_str = f"{year_ptr}-{month_ptr:02d}"
        monthly_counts[period_str] = 0
        monthly_resigned_counts[period_str] = 0
        month_ptr += 1
        if month_ptr > 12:
            month_ptr = 1
            year_ptr += 1

    def normalize_period(date_str: str) -> str:
        yr = int(date_str[:4])
        mo = int(date_str[4:6])
        if yr < min_year:
            return f"{min_year}-01"
        if yr > current_year or (yr == current_year and mo > current_month):
            return f"{current_year}-{current_month:02d}"
        return f"{yr}-{mo:02d}"

    for d in join_dates:
        period_str = normalize_period(d)
        if period_str in monthly_counts:
            monthly_counts[period_str] += 1
        else:
            monthly_counts[f"{min_year}-01"] += 1

    for d in resigned_join_dates:
        period_str = normalize_period(d)
        if period_str in monthly_resigned_counts:
            monthly_resigned_counts[period_str] += 1
        else:
            monthly_resigned_counts[f"{min_year}-01"] += 1

    first_period = f"{min_year}-01"
    if first_period in monthly_counts:
        monthly_counts[first_period] += missing_count
    if first_period in monthly_resigned_counts:
        monthly_resigned_counts[first_period] += missing_resigned_count

    evolution = []
    cumulative = 0
    resigned_cumulative = 0
    sorted_periods = sorted(monthly_counts.keys())
    for period in sorted_periods:
        new_regs = monthly_counts[period]
        cumulative += new_regs
        resigned_cumulative += monthly_resigned_counts.get(period, 0)
        evolution.append({
            "period": period,
            "count": cumulative,
            "new_registrations": new_regs,
            "resigned_count": resigned_cumulative
        })

    return {
        "ready": True,
        "evolution": evolution,
        "total": cumulative,
        "missing_dates_handled": missing_count
    }


class DataDirUpdate(BaseModel):
    data_dir: str


@app.get("/api/data_dir")
def get_data_dir_settings():
    """Chemin actuel du dossier EPEOR (DBF) et diagnostic."""
    abonne_path = resolve_dbf_path("ABONNE.DBF")
    primary_ok = os.path.isfile(abonne_path) and os.path.getsize(abonne_path) >= 100
    dir_ok = os.path.isdir(DATA_DIR)
    needs_configuration = (not dir_ok) or (not primary_ok)
    return {
        "data_dir": DATA_DIR,
        "data_dir_exists": dir_ok,
        "primary_source_ready": primary_ok,
        "needs_configuration": needs_configuration,
        "dbf_count": _count_dbf_files(),
        "diagnostic": diagnose_data_dir(),
        "locked_by_env": _env_overrides_data_dir(),
        "config_path": CONFIG_PATH,
        "is_db_ready": is_db_ready,
        "loading_status": db_loading_status,
    }


@app.post("/api/data_dir")
def update_data_dir_settings(body: DataDirUpdate):
    """Change le dossier des données, enregistre la config et recharge les DBF."""
    global DATA_DIR, is_db_ready, cached_dashboard_stats, indexes_ready, _load_retry_count, db_loading_status

    if _env_overrides_data_dir():
        return {
            "status": "error",
            "message": (
                "Le chemin est imposé par la variable d'environnement EPEOR_DATA_DIR. "
                "Modifiez-la dans start.bat ou les variables système, puis redémarrez le backend."
            ),
            "data_dir": DATA_DIR,
            "locked_by_env": True,
        }

    ok, err = _validate_data_dir(body.data_dir)
    if not ok:
        return {"status": "error", "message": err, "data_dir": DATA_DIR}

    new_dir = _normalize_data_dir(body.data_dir)
    changed = new_dir != DATA_DIR
    DATA_DIR = new_dir

    cfg = _read_config_file()
    if not isinstance(cfg, dict):
        cfg = {}
    cfg["data_dir"] = DATA_DIR
    _save_config_file(cfg)
    print(f"[INFO] Dossier données EPEOR défini sur : {DATA_DIR}")

    is_db_ready = False
    cached_dashboard_stats = None
    indexes_ready = False
    _load_retry_count = 0
    db_loading_status = "Changement de dossier données — rechargement..."
    if changed:
        clear_cache_directory()
    threading.Thread(target=load_all_data_to_memory, daemon=True).start()

    return {
        "status": "success",
        "message": "Dossier enregistré. Rechargement des données en cours...",
        "data_dir": DATA_DIR,
        "changed": changed,
    }


@app.post("/api/reload_data")
def reload_data_endpoint():
    """Force un rechargement des données en mémoire."""
    global is_db_ready, cached_dashboard_stats, indexes_ready, _load_retry_count, db_loading_status
    is_db_ready = False
    cached_dashboard_stats = None
    indexes_ready = False
    _load_retry_count = 0
    db_loading_status = "Rechargement demandé..."
    threading.Thread(target=load_all_data_to_memory, daemon=True).start()
    return {"status": "started", "message": "Rechargement des données en cours...", "data_dir": DATA_DIR}

@app.get("/api/unites_settings")
def get_unites_settings():
    try:
        if not is_db_ready:
            return []
        unites_list = []
        for r_unite in MEM_UNITES:
            code_unite = str(r_unite.get('UNITE', '')).strip()
            denom = str(r_unite.get('DENOM', '')).strip()
            adr = str(r_unite.get('ADR', '')).strip()
            tel = str(r_unite.get('TEL', '')).strip()
            identfisc = str(r_unite.get('IDENTFISC', '')).strip()
            nartfisc = str(r_unite.get('NARTFISC', '')).strip()
            ncompte = str(r_unite.get('NCOMPTE', '')).strip()
            dombanq = str(r_unite.get('DOMBANQ', '')).strip()

            sectors_list = []
            for r_tab in MEM_TABCODES:
                code_affec = str(r_tab.get('CODE_AFFEC', '')).strip()
                if code_affec.startswith('S'):
                    sec_unite = str(r_tab.get('UNITE', '')).strip()
                    if sec_unite == code_unite or sec_unite.lstrip('0') == code_unite.lstrip('0'):
                        sectors_list.append({
                            "code": code_affec[1:],
                            "libelle": str(r_tab.get('LIBELLE', '')).strip(),
                            "unite": sec_unite
                        })
            
            sectors_list.sort(key=lambda x: x["code"])

            unites_list.append({
                "code": code_unite,
                "denom": denom,
                "adresse": adr,
                "telephone": tel,
                "identfisc": identfisc,
                "nartfisc": nartfisc,
                "ncompte": ncompte,
                "dombanq": dombanq,
                "sectors": sectors_list
            })
        return unites_list
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
def get_subscribers(quartier: str = None, etat: str = None, secteur: str = None):
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

        allowed_communes = _commune_codcoms_for_centre(secteur)

        results = []
        for record in MEM_ABONNES:
            numab = str(record.get('NUMAB', '')).strip()
            prefix = numab[:2]
            
            # Filter by Quartier
            if prefix != quartier:
                continue

            # Filtre centre : commune géographique (COMMUNE.SECTEUR)
            if not _abonne_in_centre(numab, allowed_communes):
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
            
            sub_invoices = factures_by_numab.get(numab, [])
            raw_nouvelx = sub_invoices[0].get('NOUVELX') if sub_invoices else 0
            try:
                nouvelx = float(raw_nouvelx) if raw_nouvelx is not None else 0
            except:
                nouvelx = 0

            consecutive_etat20 = count_consecutive_etatcpt(sub_invoices, '20')
            consecutive_etat30 = count_consecutive_etatcpt(sub_invoices, '30')
                
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
                "numordre":   numordre,
                "nouvelx":    nouvelx,
                "consecutive_etat20": consecutive_etat20,
                "consecutive_etat30": consecutive_etat30,
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
def get_creance(
    start_date: str = None,
    end_date: str = None,
    hist_type: str = "monthly_12",
    hist_start: str = None,
    hist_end: str = None,
    secteur: str = None
):
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

        # Build commune map: CODCOM -> label, filtered by sector if provided
        commune_map = _commune_map_for_centre(secteur)

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

        secteur_numabs = _secteur_numabs_set(secteur)

        # Chain all records in memory
        records = itertools.chain(
            ((r, False) for r in MEM_FACTURES),
            ((r, True) for r in MEM_AVOIRS)
        )

        for r, is_avoir in records:
            numab_r = str(r.get('NUMAB', '') or '').strip().upper()
            if secteur_numabs is not None and numab_r not in secteur_numabs:
                continue

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
            else:
                datanul = str(r.get('DATANUL') or '').strip()
                if datsaisie and datsaisie <= target_date:
                    if datanul and datanul > target_date:
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

        # Historical Data Calculation (Eau & Prestations) - Support custom intervals
        history_list = []
        try:
            hist_target = target_date
            if not hist_target or hist_target == '99991231' or len(hist_target) < 8:
                latest_ds = "20240831"
                for r in MEM_FACTURES:
                    ds = str(r.get('DATSAISIE') or '').strip()
                    if ds and ds > latest_ds and len(ds) == 8 and ds < '9999':
                        latest_ds = ds
                hist_target = latest_ds

            import calendar
            intervals = []

            if hist_type == "years":
                # Year interval, e.g. 2001 to 2015
                y_start = int(hist_start) if hist_start else 2015
                y_end = int(hist_end) if hist_end else datetime.now().year
                if y_start > y_end:
                    y_start, y_end = y_end, y_start

                for y in range(y_start, y_end + 1):
                    intervals.append({
                        "year": y,
                        "month": 12,
                        "start": f"{y}0101",
                        "end": f"{y}1231",
                        "label": f"{y}",
                        "short_label": f"{y}",
                        "ca_eau": 0.0,
                        "ca_prest": 0.0,
                        "recouvre_eau": 0.0,
                        "recouvre_prest": 0.0,
                        "ca_recouvre_eau": 0.0,
                        "ca_recouvre_prest": 0.0,
                        "creance_eau": 0.0,
                        "creance_prest": 0.0
                    })
            elif hist_type == "months":
                # Month interval, e.g. Mars 2015 (201503) to Avril 2020 (202004)
                if hist_start and len(hist_start) == 6:
                    y_start = int(hist_start[:4])
                    m_start = int(hist_start[4:6])
                else:
                    y_start = 2015
                    m_start = 1

                if hist_end and len(hist_end) == 6:
                    y_end = int(hist_end[:4])
                    m_end = int(hist_end[4:6])
                else:
                    y_end = int(hist_target[:4])
                    m_end = int(hist_target[4:6])

                start_val = y_start * 12 + (m_start - 1)
                end_val = y_end * 12 + (m_end - 1)
                if start_val > end_val:
                    start_val, end_val = end_val, start_val

                for val in range(start_val, end_val + 1):
                    y = val // 12
                    m = (val % 12) + 1
                    last_day = calendar.monthrange(y, m)[1]
                    intervals.append({
                        "year": y,
                        "month": m,
                        "start": f"{y}{m:02d}01",
                        "end": f"{y}{m:02d}{last_day:02d}",
                        "label": f"{months_fr[m-1]} {y}",
                        "short_label": f"{m:02d}/{y}",
                        "ca_eau": 0.0,
                        "ca_prest": 0.0,
                        "recouvre_eau": 0.0,
                        "recouvre_prest": 0.0,
                        "ca_recouvre_eau": 0.0,
                        "ca_recouvre_prest": 0.0,
                        "creance_eau": 0.0,
                        "creance_prest": 0.0
                    })
            else: # Default: monthly_12 (last 12 months)
                y_end = int(hist_target[:4])
                m_end = int(hist_target[4:6])

                # Generate 12 months backwards
                months_list = []
                cur_y, cur_m = y_end, m_end
                for _ in range(12):
                    months_list.append((cur_y, cur_m))
                    cur_m -= 1
                    if cur_m == 0:
                        cur_m = 12
                        cur_y -= 1
                months_list.reverse()

                for y, m in months_list:
                    last_day = calendar.monthrange(y, m)[1]
                    intervals.append({
                        "year": y,
                        "month": m,
                        "start": f"{y}{m:02d}01",
                        "end": f"{y}{m:02d}{last_day:02d}",
                        "label": f"{months_fr[m-1]} {y}",
                        "short_label": f"{m:02d}/{y}",
                        "ca_eau": 0.0,
                        "ca_prest": 0.0,
                        "recouvre_eau": 0.0,
                        "recouvre_prest": 0.0,
                        "ca_recouvre_eau": 0.0,
                        "ca_recouvre_prest": 0.0,
                        "creance_eau": 0.0,
                        "creance_prest": 0.0
                    })

            records_hist = itertools.chain(
                ((r, False) for r in MEM_FACTURES),
                ((r, True) for r in MEM_AVOIRS)
            )

            for r, is_avoir in records_hist:
                numab_r = str(r.get('NUMAB', '') or '').strip().upper()
                if secteur_numabs is not None and numab_r not in secteur_numabs:
                    continue

                datsaisie = str(r.get('DATSAISIE') or '').strip()
                datreg = str(r.get('DATREG') or '').strip()
                tp = str(r.get('TYPE') or '').strip()
                monttc = float(r.get('MONTTC') or 0)
                timbre = float(r.get('TIMBRE') or 0)

                is_eau = tp in ['E', 'C', '6']
                m_rec = monttc + timbre

                for interval in intervals:
                    start_str = interval["start"]
                    end_str = interval["end"]

                    if start_str <= datsaisie <= end_str:
                        if is_eau:
                            interval["ca_eau"] += monttc
                        else:
                            interval["ca_prest"] += monttc

                    if not is_avoir and datreg not in EMPTY_DATE_VALUES and start_str <= datreg <= end_str:
                        if is_eau:
                            interval["recouvre_eau"] += m_rec
                        else:
                            interval["recouvre_prest"] += m_rec

                    if not is_avoir and start_str <= datsaisie <= end_str:
                        if datreg not in EMPTY_DATE_VALUES and datreg <= hist_target:
                            if is_eau:
                                interval["ca_recouvre_eau"] += monttc
                            else:
                                interval["ca_recouvre_prest"] += monttc

                    is_creance_arretee = False
                    if not is_avoir:
                        if datsaisie and datsaisie <= end_str:
                            if datreg in EMPTY_DATE_VALUES or datreg > end_str:
                                is_creance_arretee = True
                    else:
                        datanul = str(r.get('DATANUL') or '').strip()
                        if datsaisie and datsaisie <= end_str:
                            if datanul and datanul > end_str:
                                if datreg in EMPTY_DATE_VALUES or datreg > end_str:
                                    is_creance_arretee = True

                    if is_creance_arretee:
                        if is_eau:
                            interval["creance_eau"] += monttc
                        else:
                            interval["creance_prest"] += monttc

            for interval in intervals:
                ca_total = interval["ca_eau"] + interval["ca_prest"]
                recouvre_total = interval["recouvre_eau"] + interval["recouvre_prest"]
                ca_recouvre_total = interval["ca_recouvre_eau"] + interval["ca_recouvre_prest"]
                creance_total = interval["creance_eau"] + interval["creance_prest"]

                history_list.append({
                    "month": interval["short_label"],
                    "label": interval["label"],
                    "ca_eau": round(interval["ca_eau"], 2),
                    "ca_prest": round(interval["ca_prest"], 2),
                    "ca_total": round(ca_total, 2),
                    "encaissement_eau": round(interval["recouvre_eau"], 2),
                    "encaissement_prest": round(interval["recouvre_prest"], 2),
                    "encaissement_total": round(recouvre_total, 2),
                    "ca_recouvre_eau": round(interval["ca_recouvre_eau"], 2),
                    "ca_recouvre_prest": round(interval["ca_recouvre_prest"], 2),
                    "ca_recouvre_total": round(ca_recouvre_total, 2),
                    "creance_eau": round(interval["creance_eau"], 2),
                    "creance_prest": round(interval["creance_prest"], 2),
                    "creance_total": round(creance_total, 2)
                })
        except Exception as ex:
            print("Error computing history:", ex)

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
            "is_official": official is not None,
            "history": history_list
        }
        return result

    except Exception as e:
        return {"error": str(e)}


@app.get("/creance_detaillee")
def get_creance_detaillee(date_arrete: str, secteur: str = None):
    try:
        stats = {}
        EMPTY_DATE_VALUES = {'', '        ', '19000101', '00000000', None}
        secteur_numabs = _secteur_numabs_set(secteur)

        # Chain all records in memory
        records = itertools.chain(
            ((r, False) for r in MEM_FACTURES),
            ((r, True) for r in MEM_AVOIRS)
        )

        for r, is_avoir in records:
            numab_r = str(r.get('NUMAB', '') or '').strip().upper()
            if secteur_numabs is not None and numab_r not in secteur_numabs:
                continue

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

            if is_avoir:
                datanul = str(r.get('DATANUL') or '').strip()
                if not datanul or datanul <= date_arrete:
                    continue
            
            tp = str(r.get('TYPE') or '').strip()
            typabon = str(r.get('TYPABON') or '').strip()
            periode = str(r.get('PERIODE') or '').strip()
            numab = str(r.get('NUMAB') or '').strip()
            monttc = float(r.get('MONTTC') or 0)
            amount = monttc

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
                stats[key]["creance"] += amount

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
    if not indexes_ready:
        return {"status": "loading", "message": "Indexation de l'historique de facturation en cours…"}
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
    if not indexes_ready:
        return {"status": "loading", "message": "Indexation de l'historique de facturation en cours…"}
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

@app.get("/creances_abonnes")
def get_creances_abonnes(secteur: str = None):
    try:
        secteur_numabs = _secteur_numabs_set(secteur)
        date_arrete = _creance_date_arrete()
        debtors = {}
        tournees_set = set()

        records = itertools.chain(
            ((r, False) for r in MEM_FACTURES),
            ((r, True) for r in MEM_AVOIRS)
        )

        for r, is_avoir in records:
            numab = str(r.get('NUMAB', '') or '').strip()
            if not numab: continue
            if secteur_numabs is not None and numab.upper() not in secteur_numabs: continue

            datreg = str(r.get('DATREG') or '').strip()
            is_creance = is_unpaid_creance(r, is_avoir, date_arrete)

            if numab not in debtors:
                numab_key = numab.strip().upper()
                abonne_rec = abonnes_by_numab.get(numab_key)
                name = abonne_rec.get('RAISOC', '') or abonne_rec.get('NOM', '') if abonne_rec else 'Nom inconnu'
                if not name: name = 'Nom inconnu'
                tournee = str(abonne_rec.get('TOURNEE', '') if abonne_rec else '').strip()
                if tournee:
                    tournees_set.add(tournee)

                raw_typabon = str(abonne_rec.get('TYPABON', '') if abonne_rec else '').strip()
                bloc = str(abonne_rec.get('BLOC', '') if abonne_rec else '').strip() or '—'
                ndom = str(abonne_rec.get('NDOM', '') if abonne_rec else '').strip() or '—'

                abonment_rec = abonments_by_numab.get(numab_key)
                numser = str(abonment_rec.get('NUMSER', '') if abonment_rec else '').strip() or '—'
                raw_etat = str(abonment_rec.get('ETATCPT', '') if abonment_rec else '').strip()

                debtors[numab] = {
                    "numab": numab,
                    "name": name,
                    "tournee": tournee if tournee else "—",
                    "type_abon": resolve_typabon_label(raw_typabon),
                    "type_abon_code": raw_typabon or '—',
                    "etat_cpt": resolve_etatcpt_label(raw_etat),
                    "etat_cpt_code": raw_etat or '—',
                    "adresse": resolve_rue_adresse(abonne_rec),
                    "bloc": bloc,
                    "ndom": ndom,
                    "numser": numser,
                    "raw_last_payment": None,   # YYYYMMDD string for day arithmetic
                    "derniere_date_paiement": "Aucun",
                    "nombre_creance": 0,
                    "montant_creance": 0.0,
                    "factures": []
                }

            if datreg and datreg not in EMPTY_DATE_VALUES:
                cur_last = debtors[numab]["raw_last_payment"]
                if not cur_last or datreg > cur_last:
                    debtors[numab]["raw_last_payment"] = datreg

            if is_creance:
                debtors[numab]["nombre_creance"] += 1
                debtors[numab]["montant_creance"] += creance_monttc_delta(r, is_avoir)
                periode_val = r.get('PERIODE')
                try:
                    periode = int(periode_val) if periode_val else 3
                except (ValueError, TypeError):
                    periode = 3
                debtors[numab]["factures"].append({
                    "date_fact": str(r.get('DATFACT', '') or '').strip(),
                    "montant": creance_monttc_delta(r, is_avoir),
                    "periode": periode,
                })

        debtor_list = []
        for d in debtors.values():
            d["montant_creance"] = round(d["montant_creance"], 2)
            if d["montant_creance"] >= 0.01:
                ld = d["raw_last_payment"]
                if ld and len(ld) == 8:
                    d["derniere_date_paiement"] = f"{ld[6:8]}/{ld[4:6]}/{ld[:4]}"
                else:
                    d["derniere_date_paiement"] = "Aucun"
                    d["raw_last_payment"] = None

                debtor_list.append(d)

        debtor_list.sort(key=lambda x: x["montant_creance"], reverse=True)

        tournees_list = sorted(tournees_set)

        return {"subscribers": debtor_list, "tournees": tournees_list}

    except Exception as e:
        return {"error": str(e)}


@app.get("/creances_institutions")
def get_creances_institutions(only_with_creance: bool = True, secteur: str = None):
    """
    Créances liées aux institutions (liens institutionnels + organismes payeurs),
    enrichies via abonnés, contrats, adresses et factures impayées.
    """
    if not is_db_ready:
        return {"status": "loading", "message": db_loading_status, "ready": False}
    try:
        date_arrete = _creance_date_arrete()
        secteur_numabs = _secteur_numabs_set(secteur)

        abinstit_numabs = set()
        for link in MEM_ABINSTIT:
            numab = str(link.get('NUMAB', '') or '').strip().upper()
            if numab:
                if secteur_numabs is None or numab in secteur_numabs:
                    abinstit_numabs.add(numab)

        debtors = {}
        records = itertools.chain(
            ((r, False) for r in MEM_FACTURES),
            ((r, True) for r in MEM_AVOIRS)
        )

        for r, is_avoir in records:
            numab = str(r.get('NUMAB', '') or '').strip()
            if not numab:
                continue
            numab_key = numab.upper()
            if numab_key not in abinstit_numabs:
                continue

            datreg = str(r.get('DATREG') or '').strip()
            is_creance = is_unpaid_creance(r, is_avoir, date_arrete)

            if numab_key not in debtors:
                debtors[numab_key] = {
                    "raw_last_payment": None,
                    "derniere_date_paiement": "Aucun",
                    "nombre_creance": 0,
                    "montant_creance": 0.0,
                    "factures": [],
                }

            if datreg and datreg not in EMPTY_DATE_VALUES:
                cur_last = debtors[numab_key]["raw_last_payment"]
                if not cur_last or datreg > cur_last:
                    debtors[numab_key]["raw_last_payment"] = datreg

            if is_creance:
                debtors[numab_key]["nombre_creance"] += 1
                debtors[numab_key]["montant_creance"] += creance_monttc_delta(r, is_avoir)
                periode_val = r.get('PERIODE')
                try:
                    periode = int(periode_val) if periode_val else 3
                except (ValueError, TypeError):
                    periode = 3
                debtors[numab_key]["factures"].append({
                    "date_fact": str(r.get('DATFACT', '') or '').strip(),
                    "montant": creance_monttc_delta(r, is_avoir),
                    "periode": periode,
                })

        rows = []
        for link in MEM_ABINSTIT:
            numab = str(link.get('NUMAB', '') or '').strip()
            if not numab:
                continue
            numab_key = numab.upper()
            if numab_key not in abinstit_numabs:
                continue

            codinstit = str(link.get('CODINSTIT', '') or '').strip()
            unite_link = str(link.get('UNITE', '') or '').strip()
            raisoc_link = str(link.get('RAISOC', '') or '').strip()
            agent = str(link.get('AGENT', '') or '').strip() or '—'

            inst_rec = resolve_instit_record(codinstit, unite_link)
            lib_instit = str(inst_rec.get('LIBINSTIT', '') if inst_rec else '').strip() or '—'
            adr_instit = str(inst_rec.get('ADR1', '') if inst_rec else '').strip()
            if inst_rec and str(inst_rec.get('ADR2', '')).strip():
                adr_instit = (adr_instit + ' — ' + str(inst_rec.get('ADR2', '')).strip()).strip(' —')

            abonne_rec = abonnes_by_numab.get(numab_key)
            abonment_rec = abonments_by_numab.get(numab_key)

            if raisoc_link:
                name = raisoc_link
            elif abonne_rec:
                name = str(abonne_rec.get('RAISOC', '') or abonne_rec.get('NOM', '') or '').strip()
            else:
                name = '—'
            if not name:
                name = '—'

            raw_typabon = str(abonne_rec.get('TYPABON', '') if abonne_rec else '').strip()
            bloc = str(abonne_rec.get('BLOC', '') if abonne_rec else '').strip() or '—'
            ndom = str(abonne_rec.get('NDOM', '') if abonne_rec else '').strip() or '—'
            tournee = str(abonne_rec.get('TOURNEE', '') if abonne_rec else '').strip() or '—'

            numser = str(abonment_rec.get('NUMSER', '') if abonment_rec else '').strip() or '—'
            raw_etat = str(abonment_rec.get('ETATCPT', '') if abonment_rec else '').strip()

            debt = debtors.get(numab_key, {
                "raw_last_payment": None,
                "nombre_creance": 0,
                "montant_creance": 0.0,
                "factures": [],
            })
            montant = round(float(debt.get("montant_creance") or 0), 2)
            nb_creance = int(debt.get("nombre_creance") or 0)
            if only_with_creance and (montant < 0.01 or nb_creance < 1):
                continue

            ld = debt.get("raw_last_payment")
            if ld and len(ld) == 8:
                derniere_date_paiement = f"{ld[6:8]}/{ld[4:6]}/{ld[:4]}"
            else:
                derniere_date_paiement = "Aucun"

            unite_code = unite_link or (str(inst_rec.get('UNITE', '')).strip() if inst_rec else '')
            rows.append({
                "codinstit": codinstit or '—',
                "lib_instit": lib_instit,
                "adr_instit": adr_instit or '—',
                "numab": numab,
                "raisoc": name,
                "adresse": resolve_rue_adresse(abonne_rec),
                "bloc": bloc,
                "ndom": ndom,
                "type_abon": resolve_typabon_label(raw_typabon),
                "etat_cpt": resolve_etatcpt_label(raw_etat),
                "numser": numser,
                "tournee": tournee,
                "agent": agent,
                "unite": resolve_unite_label(unite_code),
                "unite_code": unite_code or '—',
                "nombre_creance": nb_creance,
                "montant_creance": montant,
                "derniere_date_paiement": derniere_date_paiement,
                "raw_last_payment": ld if ld and len(ld) == 8 else None,
                "factures": debt.get("factures", []),
            })

        rows.sort(key=lambda x: (-x["montant_creance"], x["lib_instit"], x["numab"]))

        return {
            "rows": rows,
            "total_links": len(MEM_ABINSTIT),
            "institutions_count": len(MEM_INSTIT),
            "with_creance_count": len(rows) if only_with_creance else sum(1 for r in rows if r["montant_creance"] >= 0.01),
        }

    except Exception as e:
        return {"error": str(e)}


@app.get("/creance_subscribers")
def get_creance_subscribers(start_date: str = None, end_date: str = None, target_name: str = None, column: str = None, secteur: str = None):
    try:
        EMPTY_DATE_VALUES = {'', '        ', '19000101', '00000000', None}
        target_date = end_date if end_date else '99991231'
        secteur_numabs = _secteur_numabs_set(secteur)

        records = itertools.chain(
            ((r, False) for r in MEM_FACTURES),
            ((r, True) for r in MEM_AVOIRS)
        )

        subscribers_data = {} # numab -> {numab, name, type_abonne, commune, amount, count}

        for r, is_avoir in records:
            numab_r = str(r.get('NUMAB', '') or '').strip().upper()
            if secteur_numabs is not None and numab_r not in secteur_numabs:
                continue

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

            is_creance_arretee = False
            if not is_avoir:
                if datsaisie and datsaisie <= target_date:
                    if datreg in EMPTY_DATE_VALUES or datreg > target_date:
                        is_creance_arretee = True
            else:
                datanul = str(r.get('DATANUL') or '').strip()
                if datsaisie and datsaisie <= target_date:
                    if datanul and datanul > target_date:
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
            categorie = ""

            if tp == 'E':
                section = 'EAU'
                if typabon == '15':
                    categorie = 'VENTE EN GROS'
                elif '10' <= typabon <= '19':
                    categorie = 'MENAGES'
                elif '20' <= typabon <= '29':
                    categorie = 'ADMINISTRATIONS'
                elif '30' <= typabon <= '39':
                    categorie = 'SERVICES'
                elif '40' <= typabon <= '49':
                    categorie = 'INDUSTRIE & TOURISME'
                else:
                    categorie = f'AUTRE EAU ({typabon})'
            elif tp == 'C' and periode == '0002':
                section = 'EAU'
                categorie = 'E/CITERNE'
            elif tp == '6':
                section = 'EAU'
                categorie = 'E/MANQUE A GAGNER'
            elif tp != '':
                section = 'PRESTATIONS'
                cl_design = classe_map.get((tp, '****'), tp)
                cs_design = classe_map.get((tp, periode), periode)
                categorie = f"{cl_design} / {cs_design}"

            if not section:
                continue

            # Filter by category name
            if target_name and categorie != target_name:
                continue

            # Determine matching amount based on selected column
            amount = 0.0
            matched = False

            if column == 'ca_eau':
                if section == 'EAU' and is_in_saisie and not is_avoir:
                    amount = monttc
                    matched = True
            elif column == 'ca_prestation':
                if section == 'PRESTATIONS' and is_in_saisie and not is_avoir:
                    amount = monttc
                    matched = True
            elif column == 'ca': # Total CA
                if is_in_saisie and not is_avoir:
                    amount = monttc
                    matched = True
            elif column == 'ca_recouvre':
                if is_in_saisie and not is_avoir:
                    is_paid = datreg not in EMPTY_DATE_VALUES and datreg <= target_date
                    if is_paid:
                        amount = monttc
                        matched = True
            elif column == 'recouvre':
                if is_in_reg:
                    amount = monttc + timbre
                    matched = True
            elif column == 'creance':
                if is_creance_arretee:
                    amount = monttc
                    matched = True

            if matched and abs(amount) >= 0.01:
                if numab not in subscribers_data:
                    abonne_rec = abonnes_by_numab.get(numab)
                    name = abonne_rec.get('RAISOC', 'Nom inconnu') if abonne_rec else 'Nom inconnu'
                    raw_typabon = str(abonne_rec.get('TYPABON', '')).strip() if abonne_rec else typabon
                    t_rec = tabcodes_by_code.get("T" + raw_typabon)
                    type_abonne_str = t_rec.get('LIBELLE', f"Type {raw_typabon}") if t_rec else f"Type {raw_typabon}"

                    libcom = communes_by_code.get(codcom, {}).get('LIBCOM', codcom)

                    subscribers_data[numab] = {
                        "numab": numab,
                        "name": name,
                        "type_abonne": type_abonne_str,
                        "commune": libcom,
                        "amount": 0.0,
                        "count": 0
                    }
                
                subscribers_data[numab]["amount"] += amount
                subscribers_data[numab]["count"] += 1

        # Format list and sort by amount desc
        result_list = list(subscribers_data.values())
        for x in result_list:
            x["amount"] = round(x["amount"], 2)
        result_list.sort(key=lambda x: abs(x["amount"]), reverse=True)

        return {"subscribers": result_list}

    except Exception as e:
        return {"error": str(e)}

@app.get("/api/nin_stats")
def get_nin_stats(secteur: str = None, date_from: str = None, date_to: str = None):
    """
    Statistiques des abonnés ayant le champ NIN renseigné (non vide).
    - total avec NIN
    - répartition par type d'abonné (TYPABON)
    - répartition mensuelle par date de saisie (DATEMAJ)
    Filtre optionnel par centre (secteur) et par plage de dates (date_from, date_to au format YYYY-MM).
    """
    if not is_db_ready or len(MEM_ABONNES) == 0:
        return {"ready": False, "total_with_nin": 0, "by_type": [], "by_month": []}

    allowed_communes = _commune_codcoms_for_centre(secteur) if secteur and str(secteur).strip() else None

    # Parse date filters (format: YYYY-MM)
    date_from_period = None
    date_to_period = None
    if date_from and str(date_from).strip():
        try:
            date_from_period = str(date_from).strip()
            if len(date_from_period) == 10:  # YYYY-MM-DD format
                date_from_period = date_from_period[:7]  # Convert to YYYY-MM
        except Exception:
            pass
    if date_to and str(date_to).strip():
        try:
            date_to_period = str(date_to).strip()
            if len(date_to_period) == 10:  # YYYY-MM-DD format
                date_to_period = date_to_period[:7]  # Convert to YYYY-MM
        except Exception:
            pass

    # Build type label mapping from TABCODE
    type_label_map = {}
    for code_affec, r in tabcodes_by_code.items():
        if code_affec.startswith('T'):
            type_label_map[code_affec[1:]] = str(r.get('LIBELLE', '')).strip()

    total_with_nin = 0
    type_counts: dict = {}   # typabon_code -> {"label": str, "count": int}
    month_counts: dict = {}  # "YYYY-MM" -> int

    for record in MEM_ABONNES:
        numab = str(record.get('NUMAB', '') or '').strip()
        if not _abonne_in_centre(numab, allowed_communes):
            continue

        nin = str(record.get('NIN', '') or '').strip()
        if not nin:
            continue

        # --- Par mois de saisie (DATEMAJ) - Extraction d'abord pour filtrage ---
        datemaj = str(record.get('DATEMAJ', '') or '').strip()
        period = None
        if datemaj:
            # handle datetime.date objects (dbfread converts date fields)
            if hasattr(datemaj, 'year'):
                period = f"{datemaj.year}-{datemaj.month:02d}"
            elif len(datemaj) >= 6 and datemaj[:4].isdigit():
                yr = int(datemaj[:4])
                mo = int(datemaj[4:6]) if len(datemaj) >= 6 else 1
                if 1980 <= yr <= 2030 and 1 <= mo <= 12:
                    period = f"{yr}-{mo:02d}"

        # Re-check: datemaj might be a date object from dbfread (not a string)
        raw_datemaj = record.get('DATEMAJ')
        if raw_datemaj and hasattr(raw_datemaj, 'year'):
            try:
                period = f"{raw_datemaj.year}-{raw_datemaj.month:02d}"
            except Exception:
                pass

        # Apply date range filter if specified
        # Skip if date filters are specified but we don't have a valid period
        if date_from_period or date_to_period:
            if not period:
                continue
            if date_from_period and period < date_from_period:
                continue
            if date_to_period and period > date_to_period:
                continue
        
        # At this point, the subscriber has passed all filters (date filter if specified)
        total_with_nin += 1

        # --- Par type ---
        typabon = str(record.get('TYPABON', '') or '').strip()
        label = type_label_map.get(typabon, f"Autre ({typabon})" if typabon else "Inconnu")
        if typabon not in type_counts:
            type_counts[typabon] = {"label": label, "count": 0}
        type_counts[typabon]["count"] += 1

        # --- Add to monthly counts ---
        if period:
            month_counts[period] = month_counts.get(period, 0) + 1

    # Format by_type
    by_type = []
    for code, info in type_counts.items():
        by_type.append({
            "code": code,
            "label": info["label"],
            "count": info["count"],
            "percentage": round((info["count"] / total_with_nin) * 100, 1) if total_with_nin > 0 else 0
        })
    by_type.sort(key=lambda x: x["count"], reverse=True)

    # Format by_month (sorted chronologically)
    by_month = []
    for period in sorted(month_counts.keys()):
        yr, mo = period.split("-")
        months_fr = {
            "01": "Jan", "02": "Fev", "03": "Mar", "04": "Avr",
            "05": "Mai", "06": "Juin", "07": "Juil", "08": "Aou",
            "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
        }
        label = f"{months_fr.get(mo, mo)} {yr}"
        by_month.append({"period": period, "label": label, "count": month_counts[period]})

    return {
        "ready": True,
        "total_with_nin": total_with_nin,
        "by_type": by_type,
        "by_month": by_month,
        "date_from": date_from_period,
        "date_to": date_to_period,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
