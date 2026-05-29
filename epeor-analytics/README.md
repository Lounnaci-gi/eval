# EPEOR Analytics

Tableau de bord d'analyse pour les données EPEOR. Stack : **Next.js** (frontend, port 3000) + **FastAPI** (backend, port 8000).

## Prérequis

- Node.js 20+
- Python 3.11+ avec venv à la racine du dépôt : `d:\eval\.venv`
- Dossier de données EPEOR (export base locale), par défaut `d:\epeor`
- Logo optionnel : placer `ade.png` dans `public/` pour les exports PDF

## Installation

```powershell
# Racine du dépôt (d:\eval)
python -m venv .venv
.\.venv\Scripts\pip install -r epeor-analytics\requirements.txt

cd epeor-analytics
npm install
```

## Démarrage rapide (Windows)

Double-cliquer sur `start.bat` ou :

```powershell
cd d:\eval\epeor-analytics
.\start.bat
```

Le script lance le backend puis le frontend et ouvre http://localhost:3000.

## Démarrage manuel

**Terminal 1 — backend**

```powershell
cd d:\eval\epeor-analytics\backend
$env:EPEOR_DATA_DIR = "d:\epeor"   # optionnel si chemin par défaut OK
d:\eval\.venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000
```

Ou : `d:\eval\.venv\Scripts\python.exe main.py`

**Terminal 2 — frontend**

```powershell
cd d:\eval\epeor-analytics
npm run dev
```

## Configuration

| Variable | Description | Défaut |
|----------|-------------|--------|
| `EPEOR_DATA_DIR` | Dossier des données EPEOR | `d:\epeor` |

Voir `epeor.env.example`. Le cache binaire (pickle) est créé dans `backend/cache/` au premier chargement ; le premier démarrage peut être long.

## Commandes utiles

```powershell
npm run lint      # ESLint
npm run build     # Build production Next.js
npx tsc --noEmit  # Vérification TypeScript
```

## Structure

```
epeor-analytics/
  backend/main.py    # API FastAPI
  backend/cache/     # Cache .pkl (ignoré par git)
  src/app/page.tsx   # Interface principale
  public/ade.png     # Logo PDF (à fournir)
  start.bat          # Lancement Windows
```
