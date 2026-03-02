@echo off
echo ===============================================
echo   Crypto Wallet Platform - Firewall Setup
echo ===============================================
echo.
echo This script will create firewall rules to allow
echo access from other devices on your network.
echo.
echo You need to run this as Administrator!
echo.
pause

echo Creating firewall rule for Frontend (port 3000)...
netsh advfirewall firewall add rule name="Crypto Wallet Frontend" dir=in action=allow protocol=TCP localport=3000
echo.

echo Creating firewall rule for Backend (port 5000)...
netsh advfirewall firewall add rule name="Crypto Wallet Backend" dir=in action=allow protocol=TCP localport=5000
echo.

echo ===============================================
echo   Firewall Rules Created Successfully!
echo ===============================================
echo.
echo Your crypto wallet is now accessible from other devices:
echo   Frontend: http://192.168.0.102:3000
echo   Backend:  http://192.168.0.102:5000
echo.
echo Make sure both servers are running!
echo.
pause
