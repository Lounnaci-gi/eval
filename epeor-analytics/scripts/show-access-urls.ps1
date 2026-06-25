# Affiche les URLs d acces et explique Wi-Fi vs 4G
Write-Host ""
Write-Host "=== EPEOR Analytics - diagnostic acces distant ===" -ForegroundColor Cyan
Write-Host ""

$localIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -ExpandProperty IPAddress

Write-Host "Wi-Fi maison (meme reseau) :" -ForegroundColor Green
foreach ($ip in $localIps) {
    Write-Host "  http://${ip}:3000"
}
Write-Host "  http://localhost:3000  (sur ce PC uniquement)"
Write-Host ""
Write-Host "4G / Internet :" -ForegroundColor Yellow
Write-Host "  Une adresse 192.168.x.x NE FONCTIONNE PAS en 4G."
Write-Host ""

try {
    $publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5).Trim()
    Write-Host "  IP publique de votre box : $publicIp"
    Write-Host "  Acces direct (si routeur configure) : http://${publicIp}:3000"
    Write-Host "  Requis : redirection port 3000 + pare-feu (open-firewall-port.bat)"
} catch {
    Write-Host "  IP publique : impossible a recuperer (hors ligne ?)"
}

Write-Host ""
Write-Host "Solution la plus simple pour 4G :" -ForegroundColor Cyan
Write-Host "  Double-cliquez start-tunnel.bat"
Write-Host "  Puis ouvrez l URL https://....trycloudflare.com sur le telephone."
Write-Host ""

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host "[OK] Un service ecoute sur le port 3000." -ForegroundColor Green
} else {
    Write-Host "[!!] Rien sur le port 3000 - lancez start-internet.bat" -ForegroundColor Red
}
Write-Host ""
