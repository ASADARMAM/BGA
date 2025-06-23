@echo off
rem =============================================
rem  setup-waha-monitor-task.bat - Set up scheduled task to monitor WAHA
rem  This script creates a Windows scheduled task that runs
rem  the monitor-waha.bat script every 30 minutes.
rem =============================================

echo Setting up scheduled task to monitor WAHA...

:: Get the full path to the monitor script
set "MONITOR_SCRIPT=%~dp0monitor-waha.bat"

:: Create a scheduled task to run the monitor script every 30 minutes
schtasks /create /tn "WAHA Monitor" /tr "%MONITOR_SCRIPT%" /sc minute /mo 30 /ru SYSTEM /f

if %errorlevel% equ 0 (
    echo Scheduled task created successfully!
    echo The monitor-waha.bat script will run every 30 minutes to check WAHA status.
) else (
    echo Failed to create scheduled task. Please run this script as Administrator.
)

echo.
echo To view or modify the task:
echo 1. Open Task Scheduler (taskschd.msc)
echo 2. Look for the "WAHA Monitor" task
echo.
pause 