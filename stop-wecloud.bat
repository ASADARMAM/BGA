@echo off
echo Stopping WeCloud Services...

REM Stop the WAHA WhatsApp service
echo Stopping WhatsApp Service...
docker stop waha

REM Kill the node server process
echo Stopping Web Server...
taskkill /F /IM node.exe

echo.
echo All WeCloud services have been stopped.
echo You can close this window.
pause 