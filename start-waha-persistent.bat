@echo off
rem =============================================
rem  start-waha-persistent.bat - Launch WAHA WhatsApp HTTP API with persistence
rem  This script creates a persistent WAHA container that will:
rem  1. Automatically restart if it crashes
rem  2. Persist session data across restarts
rem  3. Survive system reboots (if Docker is set to auto-start)
rem =============================================

:: >>>> SET YOUR KEY HERE <<<<
set "API_KEY=My1ncredibly$trongKey2024"

:: Check for clean parameter
set "CLEAN_MODE=%~1"
if /i "%CLEAN_MODE%"=="clean" (
    echo Starting with clean session data...
    set "CLEAN_START=true"
) else (
    set "CLEAN_START=false"
)

:: Stop & remove any existing container named "waha"
echo Stopping any running WAHA container...
docker stop waha >nul 2>&1

echo Removing old WAHA container...
docker rm waha >nul 2>&1

:: If in clean mode, remove the volume
if "%CLEAN_START%"=="true" (
    echo Removing old session data for clean start...
    docker volume rm waha-data >nul 2>&1
)

:: Create a named volume if it doesn't exist
echo Ensuring persistent volume exists...
docker volume create waha-data >nul 2>&1

:: Start a fresh container with the key and persistent settings
echo Starting WAHA server on port 3000 with persistent configuration...
docker run -d --name waha ^
    -p 3000:3000 ^
    -e WAHA_API_KEY=%API_KEY% ^
    -e WAHA_START_SESSION=true ^
    -e WAHA_AUTO_RECONNECT=true ^
    -e WAHA_RECONNECT_ATTEMPTS=10 ^
    -e WAHA_RECONNECT_INTERVAL=5000 ^
    -v waha-data:/app/sessions ^
    --restart always ^
    devlikeapro/waha:latest

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start WAHA container. Check if Docker is running.
    pause
    exit /b 1
)

echo.
echo WAHA server started with persistence!
echo.
echo API URL: http://localhost:3000/
echo API Key: %API_KEY%
echo.
echo This container is configured to:
echo - Automatically restart if it crashes
echo - Persist session data across restarts
echo - Reconnect automatically if WhatsApp disconnects
echo.
echo To access WhatsApp QR code:
echo 1. Open http://localhost:3000/
echo 2. Click "Authorize" and enter your API key
echo 3. Go to Auth section and try the QR code endpoint
echo.
echo To stop the server: docker stop waha
echo To start with clean session: start-waha-persistent.bat clean
echo.
echo You can close this window safely. The container will continue running.
pause 