@echo off
setlocal
set "ROOT=%~dp0"
set "VENV=%ROOT%..\.venv\Scripts\python.exe"

echo ===================================================
echo       Lancement de EPEOR Analytics Dashboard
echo ===================================================

if not exist "%VENV%" (
    echo [ERREUR] Python introuvable: %VENV%
    echo Creez le venv a la racine du depot: python -m venv ..\.venv
    echo Puis installez: ..\.venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

echo [1/3] Lancement du Backend FastAPI (port 8000)...
if "%EPEOR_DATA_DIR%"=="" (
    start "EPEOR Backend" cmd /k "cd /d "%ROOT%backend" && "%VENV%" main.py"
) else (
    echo [INFO] Utilisation de la variable d'environnement existante EPEOR_DATA_DIR: %EPEOR_DATA_DIR%
    start "EPEOR Backend" cmd /k "cd /d "%ROOT%backend" && set "EPEOR_DATA_DIR=%EPEOR_DATA_DIR%" && "%VENV%" main.py"
)

echo [2/3] Lancement du Frontend Next.js (port 3000)...
start "EPEOR Frontend" cmd /k "cd /d "%ROOT%" && npm run dev"

echo.
where ngrok >nul 2>&1
if errorlevel 1 (
    echo [INFO] ngrok introuvable dans le PATH. Le tunnel ne sera pas lance.
    echo [INFO] Installez ngrok et configurez son token pour activer le tunnel.
) else (
    echo [3/3] Lancement du tunnel ngrok vers localhost:8000...
    start "EPEOR ngrok Tunnel" cmd /k "ngrok http 8000"
)

echo.
echo Les serveurs demarrent. Le premier chargement des DBF peut prendre plusieurs minutes.
echo.
timeout /t 5 /nobreak >nul
start http://localhost:3000
