@echo off
rem =============================================
rem  monitor-waha.bat - Monitor and restart WAHA if needed
rem  This script checks if the WAHA API is responding
rem  and restarts it if necessary.
rem =============================================

:: >>>> SET YOUR KEY HERE <<<<
set "API_KEY=My1ncredibly$trongKey2024"

echo Checking WAHA service status...

:: Check if the API is responding
curl -s -o nul -w "%%{http_code}" "http://localhost:3000/" > temp.txt
set /p STATUS=<temp.txt
del temp.txt

if "%STATUS%" NEQ "200" (
    echo [WARNING] WAHA API is not responding. Attempting to restart...
    
    :: Check if running as Docker container
    docker ps | findstr waha > nul
    if %errorlevel% equ 0 (
        echo Restarting WAHA Docker container...
        docker restart waha
    ) else (
        :: Check if running as a service
        sc query WAHAService | findstr RUNNING > nul
        if %errorlevel% equ 0 (
            echo Restarting WAHA service...
            sc stop WAHAService
            timeout /t 5 /nobreak > nul
            sc start WAHAService
        ) else (
            :: Fallback to starting the script directly
            echo Starting WAHA using start-waha-persistent.bat...
            call "%~dp0start-waha-persistent.bat"
        )
    )
    
    echo Waiting for WAHA to initialize...
    timeout /t 10 /nobreak > nul
    
    :: Check if it's responding now
    curl -s -o nul -w "%%{http_code}" "http://localhost:3000/" > temp.txt
    set /p STATUS=<temp.txt
    del temp.txt
    
    if "%STATUS%" NEQ "200" (
        echo [ERROR] Failed to restart WAHA. Please check logs and restart manually.
    ) else (
        echo WAHA restarted successfully!
    )
) else (
    echo WAHA API is responding normally.
    
    :: Now check if the WhatsApp session is connected
    curl -s -X GET "http://localhost:3000/api/sessions/default" -H "X-Api-Key: %API_KEY%" -H "Accept: application/json" -o session_status.json
    
    findstr /C:"connected" session_status.json > nul
    if %errorlevel% neq 0 (
        echo [WARNING] WhatsApp session is not connected. Attempting to reconnect...
        
        :: Try to start the session
        curl -s -X POST "http://localhost:3000/api/sessions/default/start" -H "Content-Type: application/json" -H "X-Api-Key: %API_KEY%" -d "{}"
        
        echo Session restart command sent. Check WhatsApp on your phone.
    ) else (
        echo WhatsApp session is connected and working properly.
    )
    
    del session_status.json
)

echo.
echo Monitoring complete. To set up automatic monitoring:
echo 1. Open Task Scheduler
echo 2. Create a new task to run this script every 30 minutes
echo.
pause 