@echo off
echo Starting WeCloud Services...

REM Get the current IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /r "IPv4.*192.168"') do set LOCAL_IP=%%a
set LOCAL_IP=%LOCAL_IP:~1%

echo.
echo ============ IMPORTANT IP INFORMATION ============
echo Your current IP address is: %LOCAL_IP%
echo.
echo For port forwarding, use these settings in your router:
echo 1. WhatsApp API:
echo    - External Port: 3000
echo    - Internal Port: 3000
echo    - Protocol: TCP
echo    - Internal IP: %LOCAL_IP%
echo.
echo 2. WeCloud Interface:
echo    - External Port: 80
echo    - Internal Port: 80
echo    - Protocol: TCP
echo    - Internal IP: %LOCAL_IP%
echo ==============================================
echo.

REM Start WAHA WhatsApp service
echo Starting WhatsApp Service...
call start-waha.bat

REM Update DuckDNS domain
echo Updating DuckDNS domain...
curl "https://www.duckdns.org/update?domains=we-cloud-internet&token=32ec27d8-0aac-4cdf-9b26-497ac0029f10"

REM Start the web server
echo Starting Web Server...
start /B node server.js

echo.
echo WeCloud services are now running!
echo.
echo Your services are available at:
echo - WhatsApp API: http://we-cloud-internet.duckdns.org:3000
echo - WeCloud Interface: http://we-cloud-internet.duckdns.org
echo.
echo To stop all services:
echo 1. Press Ctrl+C to stop the web server
echo 2. Run 'docker stop waha' to stop WhatsApp service
echo.
echo You can minimize this window while services are running.
pause 