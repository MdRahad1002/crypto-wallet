@echo off
title Crypto Wallet Platform Launcher
color 0A
echo.
echo ================================================
echo   CRYPTO WALLET PLATFORM - NETWORK MODE
echo ================================================
echo.
echo This will start the servers accessible from
echo your local network (mobile devices, tablets)
echo.
echo Current Network IPs:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do echo   - http:%%a:3000
echo.
echo ================================================
echo.

echo [1/3] Checking MongoDB...
sc query MongoDB | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✓ MongoDB is running
) else (
    echo ! MongoDB is not running. Starting...
    net start MongoDB 2>nul
    if %errorlevel% neq 0 (
        echo WARNING: Could not start MongoDB service
        echo Make sure MongoDB is installed
    )
)

echo.
echo [2/3] Starting Backend Server (Port 5000)...
start "Backend Server - DO NOT CLOSE" cmd /k "cd /d "%~dp0backend" && echo Starting backend server on all network interfaces... && node server.js"

timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting Frontend Server (Port 3000)...
start "Frontend Server - DO NOT CLOSE" cmd /k "cd /d "%~dp0frontend" && echo Starting frontend server on all network interfaces... && set BROWSER=none && set HOST=0.0.0.0 && npm start"

echo.
echo ================================================
echo   SERVERS STARTING...
echo ================================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Network Access (for mobile/tablet):
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set ip=%%a
    setlocal enabledelayedexpansion
    set ip=!ip: =!
    echo   http://!ip!:3000
    endlocal
)
echo.
echo ================================================
echo.
echo IMPORTANT:
echo - Do NOT close the Backend and Frontend windows
echo - Make sure Windows Firewall allows ports 3000 and 5000
echo - Connect your mobile device to the SAME WiFi network
echo.
echo To configure firewall, run: setup-firewall.ps1
echo   (Right-click and "Run with PowerShell" as Admin)
echo.
echo ================================================
echo.
echo Press any key to open the browser...
pause >nul
start http://localhost:3000
