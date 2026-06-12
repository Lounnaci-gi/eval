# AGENTS — Instructions pour AI coding agents

But: Lisez d'abord la documentation existante et ne dupliquez pas son contenu.

## Objectif
Fournir à un agent AI des informations minimales, actionnables et spécifiques au repo pour être productif immédiatement.

## Raccourcis utiles
- README principal : [epeor-analytics/README.md](epeor-analytics/README.md#L1)
- Frontend Next.js : [epeor-analytics/package.json](epeor-analytics/package.json#L1)
- Backend FastAPI : [epeor-analytics/backend/main.py](epeor-analytics/backend/main.py#L1)
- Dépendances Python : [epeor-analytics/requirements.txt](epeor-analytics/requirements.txt#L1)

## Quick-start (Windows)
1. Créer un venv Python à la racine : `python -m venv .venv` (voir [README](epeor-analytics/README.md#L1)).
2. Installer dépendances Python : `.\.venv\Scripts\pip install -r epeor-analytics\requirements.txt`.
3. Installer dépendances Node : `cd epeor-analytics && npm install`.
4. Lancer en dev : `.\start.bat` ou exécuter backend puis `npm run dev`.

## Points importants pour l'agent
- Ne pas committer des données DBF ni de fichiers `.pkl` binaires. Le cache est `epeor-analytics/backend/cache/`.
- Le backend attend la variable d'environnement `EPEOR_DATA_DIR` ou lit `backend/epeor_config.json`.
- Frontend : Next.js (port 3000). Backend : Uvicorn/FastAPI (port 8000).
- Respecter la règle "link, don't embed" : lier vers la doc existante plutôt que la copier.

## Suggestions d'agents complémentaires
- Agent `dbf-cache`: gérer génération et invalidation du cache `.pkl`.
- Agent `dev-runner`: commandes cross-platform pour démarrage et vérifications.

---
Dernière mise à jour automatique par l'agent.
