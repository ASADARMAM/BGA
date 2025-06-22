@echo off
rem =============================================
rem  restart-waha-session.bat – Restart WAHA session
rem  This script restarts just the WhatsApp session
rem  without restarting the entire container.
rem =============================================

:: >>>> SET YOUR KEY HERE <<<<
set "API_KEY=My1ncredibly$trongKey2024"

echo Restarting WhatsApp session...

:: Stop the session
curl -X POST "http://localhost:3000/api/sessions/default/stop" ^
  -H "Content-Type: application/json" ^
  -H "X-Api-Key: %API_KEY%" ^
  -d "{}"

echo Waiting for session to stop...
timeout /t 3 /nobreak > nul

:: Start the session again
curl -X POST "http://localhost:3000/api/sessions/default/start" ^
  -H "Content-Type: application/json" ^
  -H "X-Api-Key: %API_KEY%" ^
  -d "{}"

echo.
echo Session restart command sent!
echo.
echo You can now:
echo 1. Open http://localhost:3000/ in your browser
echo 2. Go to the Auth section and get a new QR code
echo 3. Scan it with your phone
echo.
pause 