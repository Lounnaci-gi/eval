@echo off
echo ===================================================
echo       Lancement de EPEOR Analytics Dashboard
echo ===================================================

echo [1/2] Lancement du Backend FastAPI...
start "EPEOR Backend" cmd /k "cd backend && ..\venv\Scripts\python.exe main.py"

echo [2/2] Lancement du Frontend Next.js...
start "EPEOR Frontend" cmd /c "npm run dev"

echo.
echo Les serveurs sont en cours de demarrage.
echo Le tableau de bord s'ouvrira bientot dans votre navigateur.
echo.
timeout /t 5 /nobreak >nul
start http://localhost:3000
