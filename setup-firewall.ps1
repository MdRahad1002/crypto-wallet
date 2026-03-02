# Run this script as Administrator
# Right-click and select "Run with PowerShell"

Write-Host "=== Crypto Wallet Platform - Firewall Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To run as administrator:" -ForegroundColor Yellow
    Write-Host "1. Right-click this file" -ForegroundColor Yellow
    Write-Host "2. Select 'Run with PowerShell'" -ForegroundColor Yellow
    Write-Host "3. Click 'Yes' on the UAC prompt" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "Adding firewall rules for ports 3000 and 5000..." -ForegroundColor Green
Write-Host ""

# Remove existing rules if they exist
Remove-NetFirewallRule -DisplayName "Crypto Wallet Frontend" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Crypto Wallet Backend" -ErrorAction SilentlyContinue

# Add rule for Frontend (port 3000)
try {
    New-NetFirewallRule -DisplayName "Crypto Wallet Frontend" `
        -Direction Inbound `
        -LocalPort 3000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Domain,Private `
        -Description "Allow inbound connections to crypto wallet frontend on port 3000"
    Write-Host "✅ Frontend firewall rule created (port 3000)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create frontend rule: $_" -ForegroundColor Red
}

# Add rule for Backend (port 5000)
try {
    New-NetFirewallRule -DisplayName "Crypto Wallet Backend" `
        -Direction Inbound `
        -LocalPort 5000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Domain,Private `
        -Description "Allow inbound connections to crypto wallet backend on port 5000"
    Write-Host "✅ Backend firewall rule created (port 5000)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create backend rule: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan
Write-Host ""

# Show created rules
$rules = Get-NetFirewallRule -DisplayName "Crypto Wallet*"
if ($rules) {
    Write-Host "Created rules:" -ForegroundColor Green
    $rules | Format-Table DisplayName, Enabled, Direction, Action
} else {
    Write-Host "Warning: No rules found!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Your Local IP Addresses ===" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*"} | Select-Object IPAddress, InterfaceAlias | Format-Table

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Make sure both servers are running" -ForegroundColor Yellow
Write-Host "2. Connect your phone/tablet to the SAME WiFi network" -ForegroundColor Yellow
Write-Host "3. On your mobile device, open browser and go to:" -ForegroundColor Yellow
Write-Host "   http://<Your-IP-Address>:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Example: http://192.168.0.102:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
