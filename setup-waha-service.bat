@echo off
rem =============================================
rem  setup-waha-service.bat - Set up WAHA as a Windows service
rem  This script will download NSSM and set up WAHA as a service
rem  that starts automatically when Windows boots.
rem =============================================

echo Setting up WAHA as a Windows service...

:: Create a directory for NSSM if it doesn't exist
if not exist "%~dp0tools" mkdir "%~dp0tools"

:: Check if NSSM is already downloaded
if not exist "%~dp0tools\nssm.exe" (
    echo Downloading NSSM...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%~dp0tools\nssm.zip'}"
    
    echo Extracting NSSM...
    powershell -Command "& {Expand-Archive -Path '%~dp0tools\nssm.zip' -DestinationPath '%~dp0tools\nssm-temp'}"
    
    :: Copy the appropriate executable based on architecture
    if exist "%~dp0tools\nssm-temp\nssm-2.24\win64\nssm.exe" (
        copy "%~dp0tools\nssm-temp\nssm-2.24\win64\nssm.exe" "%~dp0tools\nssm.exe" > nul
    ) else (
        copy "%~dp0tools\nssm-temp\nssm-2.24\win32\nssm.exe" "%~dp0tools\nssm.exe" > nul
    )
    
    :: Clean up
    rmdir /s /q "%~dp0tools\nssm-temp"
    del "%~dp0tools\nssm.zip"
)

:: Get the full path to the start-waha-persistent.bat script
set "WAHA_SCRIPT=%~dp0start-waha-persistent.bat"

:: Check if the service already exists
"%~dp0tools\nssm.exe" status WAHAService >nul 2>&1
if %errorlevel% equ 0 (
    echo Removing existing WAHA service...
    "%~dp0tools\nssm.exe" remove WAHAService confirm
)

echo Installing WAHA as a Windows service...
"%~dp0tools\nssm.exe" install WAHAService "%COMSPEC%" "/c %WAHA_SCRIPT%"
"%~dp0tools\nssm.exe" set WAHAService DisplayName "WAHA WhatsApp HTTP API"
"%~dp0tools\nssm.exe" set WAHAService Description "WhatsApp HTTP API service for WeCloud"
"%~dp0tools\nssm.exe" set WAHAService Start SERVICE_AUTO_START
"%~dp0tools\nssm.exe" set WAHAService AppDirectory "%~dp0"
"%~dp0tools\nssm.exe" set WAHAService AppStdout "%~dp0waha-service.log"
"%~dp0tools\nssm.exe" set WAHAService AppStderr "%~dp0waha-service-error.log"
"%~dp0tools\nssm.exe" set WAHAService AppRotateFiles 1
"%~dp0tools\nssm.exe" set WAHAService AppRotateBytes 1048576
"%~dp0tools\nssm.exe" set WAHAService AppRestartDelay 10000
"%~dp0tools\nssm.exe" set WAHAService ObjectName LocalSystem

echo Starting WAHA service...
"%~dp0tools\nssm.exe" start WAHAService

echo.
echo WAHA service has been installed and started!
echo.
echo The service will:
echo - Start automatically when Windows boots
echo - Restart automatically if it crashes
echo - Keep your WhatsApp session alive permanently
echo.
echo Service commands:
echo - To check status: sc query WAHAService
echo - To stop: sc stop WAHAService
echo - To start: sc start WAHAService
echo - To remove: "%~dp0tools\nssm.exe" remove WAHAService confirm
echo.
echo Service logs are saved to:
echo - %~dp0waha-service.log
echo - %~dp0waha-service-error.log
echo.
pause 