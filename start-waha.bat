@echo off
rem =============================================
rem  start-waha.bat – Launch WAHA WhatsApp HTTP API
rem  This version has the API key hard-coded so it runs
rem  without any prompts.  Edit API_KEY below if needed.
rem =============================================

:: >>>> SET YOUR KEY HERE <<<<
set "API_KEY=My1ncredibly$trongKey2024"

:: Check for restart parameter
set "RESTART_MODE=%~1"
if /i "%RESTART_MODE%"=="restart" (
    echo Restarting WAHA server with clean state...
    set "CLEAN_RESTART=true"
) else (
    set "CLEAN_RESTART=false"
)

:: Stop & remove any existing container named "waha"
echo Stopping any running WAHA container...
docker stop waha >nul 2>&1

echo Removing old WAHA container...
docker rm waha >nul 2>&1

:: If in clean restart mode, remove the sessions directory
if "%CLEAN_RESTART%"=="true" (
    echo Removing old session data for clean restart...
    docker volume rm waha-data >nul 2>&1
)

:: Start a fresh container with the key
echo Starting WAHA server on port 3000 with fixed API key...
docker run -d --name waha ^
    -p 3000:3000 ^
    -e WAHA_API_KEY=%API_KEY% ^
    devlikeapro/waha:latest

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start WAHA container. Check if Docker is running.
    pause
    exit /b 1
)

echo.
echo WAHA server started!
echo.
echo API URL: http://localhost:3000/
echo API Key: %API_KEY%
echo.
echo To access WhatsApp QR code directly:
echo 1. Open http://localhost:3000/
echo 2. Click "Authorize" and enter your API key
echo 3. Go to Auth section and try the QR code endpoint
echo.
echo To stop the server: docker stop waha
echo To restart with clean session: start-waha.bat restart
echo.
echo You can minimize this window.
pause 