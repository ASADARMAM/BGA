@echo off
rem =============================================
rem  get-waha-qr.bat - Get WhatsApp QR Code
rem  This script tries to get a QR code from the WAHA server
rem  and save it to a file for easy scanning.
rem =============================================

:: >>>> SET YOUR KEY HERE <<<<
set "API_KEY=My1ncredibly$trongKey2024"

echo Checking if WAHA server is running...

:: Check if server is running
curl -s -o nul -w "%%{http_code}" "http://localhost:3000/" > temp.txt
set /p STATUS=<temp.txt
del temp.txt

if "%STATUS%" NEQ "200" (
    echo [ERROR] WAHA server is not running or not accessible.
    echo Please run start-waha.bat first and wait for it to initialize.
    pause
    exit /b 1
)

echo WAHA server is running. Checking session status...

:: Try to get session status
curl -s -X GET "http://localhost:3000/api/sessions/default" -H "X-Api-Key: %API_KEY%" -H "Accept: application/json" -o session.json

echo Starting WhatsApp session...
curl -s -X POST "http://localhost:3000/api/sessions/default/start" -H "Content-Type: application/json" -H "X-Api-Key: %API_KEY%" -d "{}"

echo Waiting for session to initialize...
timeout /t 5 /nobreak > nul

echo Attempting to get QR code...

:: Try multiple endpoints to get QR code
curl -s -X GET "http://localhost:3000/api/default/auth/qr" -H "X-Api-Key: %API_KEY%" -H "Accept: application/json" -o qr1.json
curl -s -X GET "http://localhost:3000/api/auth/default/qr" -H "X-Api-Key: %API_KEY%" -H "Accept: application/json" -o qr2.json
curl -s -X GET "http://localhost:3000/api/sessions/default/qr" -H "X-Api-Key: %API_KEY%" -H "Accept: application/json" -o qr3.json

echo.
echo If successful, QR code data has been saved to qr1.json, qr2.json, and qr3.json
echo.
echo To view the QR code:
echo 1. Open qr-viewer.html in your browser
echo 2. Select one of the generated JSON files
echo 3. The QR code will be displayed if found
echo.
echo Alternatively:
echo 1. Open http://localhost:3000/ in your browser
echo 2. Click "Authorize" and enter your API key: %API_KEY%
echo 3. Go to the Auth section and try the QR code endpoint
echo.
echo If you still can't get a QR code, try restarting the WAHA server:
echo   start-waha.bat restart
echo.

pause 