@echo off
setlocal
set "ROOT=%~dp0"

echo ===================================================
echo   Lancement du tunnel ngrok - localhost:8000
echo ===================================================
echo.

where ngrok >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] ngrok introuvable dans le PATH.
    echo.
    echo 1. Telecharge ngrok : https://ngrok.com/download
    echo 2. Extrais ngrok.exe dans C:\Windows\System32\
    echo 3. Configure le token : ngrok config add-authtoken TON_TOKEN
    echo.
    pause
    exit /b 1
)

echo [INFO] Lancement du tunnel vers http://localhost:8000...
echo [INFO] L'URL publique s'affiche dans l'interface ci-dessous.
echo [INFO] NE PAS FERMER cette fenetre.
echo.
ngrok http 8000

echo.
pause
endlocal
