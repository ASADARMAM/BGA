@echo off
REM Replace YOUR_DOMAIN and YOUR_TOKEN with your DuckDNS values
SET DOMAIN=we-cloud-internet
SET TOKEN=32ec27d8-0aac-4cdf-9b26-497ac0029f10

REM Update DuckDNS every 5 minutes
:loop
curl "https://www.duckdns.org/update?domains=%DOMAIN%&token=%TOKEN%&ip="
REM Wait for 5 minutes (300 seconds)
timeout /t 300 /nobreak
goto loop 