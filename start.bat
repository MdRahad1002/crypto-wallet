@echo off
echo Starting Crypto Wallet Platform...
echo.

echo [1/3] Starting MongoDB (if not running)...
net start MongoDB 2>nul || echo MongoDB already running or not installed as service

echo.
echo [2/3] Starting Backend Server...
start "Backend Server" cmd /k "cd /d %~dp0 && node backend/server.js"

timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting Frontend Development Server...
start "Frontend Server" cmd /k "cd /d %~dp0frontend && set BROWSER=none && set HOST=0.0.0.0 && npm start"

echo.
echo ============================================
echo  Crypto Wallet Platform is starting...
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:3000
echo ============================================
echo.
echo Press any key to open the application in your browser...
pause >nul
start http://localhost:3000
