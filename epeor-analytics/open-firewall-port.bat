@echo off
:: Ouvre le port 3000 entrant (pare-feu Windows). Executer en tant qu'administrateur.
netsh advfirewall firewall show rule name="EPEOR Analytics (TCP 3000)" >nul 2>&1
if %errorlevel%==0 (
    echo Regle pare-feu deja presente.
    exit /b 0
)
netsh advfirewall firewall add rule name="EPEOR Analytics (TCP 3000)" dir=in action=allow protocol=TCP localport=3000
if %errorlevel%==0 (
    echo Port 3000 autorise dans le pare-feu Windows.
) else (
    echo Echec. Clic droit sur ce fichier ^> Executer en tant qu'administrateur.
    exit /b 1
)
