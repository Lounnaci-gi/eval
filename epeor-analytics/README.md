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

Pour choisir le mot de passe dès l'installation, créez le compte administrateur avant le premier démarrage du backend, avec une invite sécurisée (depuis la racine du dépôt) :

```powershell
python .\epeor-analytics\backend\create_user.py --create admin --display-name "Administrateur" --admin
```

Si le backend a déjà créé automatiquement le compte `admin`, définissez son mot de passe avec `python .\epeor-analytics\backend\create_user.py --reset-password admin`. Le mot de passe initial généré automatiquement n'est pas affiché dans les logs.

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

Le fichier [`epeor.env.example`](./epeor.env.example) répertorie les variables et leurs exemples, mais **n'est pas chargé automatiquement** :

- Next.js charge `epeor-analytics/.env.local`. Copiez-y les variables Next.js nécessaires depuis le modèle.
- FastAPI lit les variables de l'environnement Windows du processus ; le modèle ne configure pas ces variables à lui seul.

Exemple PowerShell pour définir la configuration du backend dans le terminal courant avant son démarrage :

```powershell
$env:EPEOR_DATA_DIR = "d:\epeor"
$env:EPEOR_HOST = "127.0.0.1"
$env:EPEOR_PORT = "8000"
.\.venv\Scripts\python.exe .\epeor-analytics\backend\main.py
```

| Variable | Service | Description |
|----------|---------|-------------|
| `BACKEND_URL` | Next.js | URL FastAPI utilisée par le proxy serveur ; défaut local `http://127.0.0.1:8000`. |
| `NEXT_PUBLIC_APP_URL` | Next.js | URL publique utilisée pour résoudre les URL côté serveur. |
| `NEXT_PUBLIC_API_URL` | Next.js | Surcharge facultative de l'API navigateur ; laisser vide pour utiliser le proxy same-origin `/backend-api`. |
| `ALLOWED_DEV_ORIGINS` | Next.js | Hôtes supplémentaires autorisés pour le développement. |
| `EPEOR_DATA_DIR` | FastAPI | Dossier des données EPEOR, prioritaire sur la configuration de l'interface ; défaut `d:\epeor`. |
| `CORS_ORIGINS` | FastAPI | Liste séparée par des virgules des origines autorisées ; limiter aux domaines de confiance. |
| `CORS_ORIGIN_REGEX` | FastAPI | Expression régulière facultative pour les origines dynamiques ; éviter les motifs trop larges. |
| `EPEOR_SECURE_COOKIE` | FastAPI | Cookie `Secure` activé par défaut ; mettre `0` uniquement pour le développement local en HTTP. |
| `SESSION_LIFETIME_HOURS` | FastAPI | Durée de session en heures ; défaut `24`. |
| `EPEOR_AUTH_ENABLED` | FastAPI | Authentification activée par défaut ; si elle est désactivée, les routes protégées et la connexion renvoient HTTP 503 au lieu d'ouvrir l'accès. |
| `EPEOR_HOST` / `EPEOR_PORT` | FastAPI | Adresse et port d'écoute ; défaut `0.0.0.0:8000` dans le code. |

En production HTTPS, le cookie de session `Secure` est activé par défaut ; ne le désactiver qu'en développement local HTTP. Configurer explicitement l'URL backend, les origines CORS et les hôtes autorisés. Ne pas placer de secrets dans `NEXT_PUBLIC_*` : ces variables sont exposées au navigateur. Les fichiers `.env*` locaux sont ignorés par Git.

Le limiteur de tentatives de connexion est stocké dans la base SQLite d'authentification afin d'être partagé entre les processus utilisant le même fichier `users.db`. Des instances sur des hôtes distincts doivent utiliser un stockage de données commun adapté ; des fichiers SQLite locaux séparés ne partagent pas leur compteur.

Le chemin des données peut aussi être modifié dans **Paramètres → Dossier des données (DBF)** ; il est enregistré dans `backend/epeor_config.json` si `EPEOR_DATA_DIR` n'est pas défini. Le cache binaire (pickle) est créé dans `backend/cache/` au premier chargement ; le premier démarrage peut être long.

Après le chargement, l'API `/stats` expose `data_quality` (`complete` ou `partial`) avec les fichiers DBF manquants ou illisibles. Le tableau de bord signale les chargements partiels tout en laissant disponibles les écrans alimentés par les tables chargées.

## Commandes utiles

```powershell
npm run lint      # ESLint
npm run build     # Build production Next.js
npx tsc --noEmit  # Vérification TypeScript
npm run test:e2e  # Tests navigateur Playwright (installer Chromium une fois avec npx playwright install chromium)
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
