# WAHA Persistent Setup

This directory contains scripts to make your WAHA (WhatsApp HTTP API) installation persistent, ensuring it stays running even after system restarts or crashes.

## Available Scripts

### 1. `start-waha-persistent.bat`

This script starts WAHA in a Docker container with persistence settings:
- Automatically restarts if it crashes
- Persists session data across restarts
- Reconnects automatically if WhatsApp disconnects

**Usage:**
- Normal start: `start-waha-persistent.bat`
- Clean start (removes old session data): `start-waha-persistent.bat clean`

### 2. `setup-waha-service.bat`

This script sets up WAHA as a Windows service that:
- Starts automatically when Windows boots
- Runs in the background without a console window
- Restarts automatically if it crashes

**Requirements:**
- Must be run as Administrator
- Requires internet access to download NSSM

**Usage:**
- Just run: `setup-waha-service.bat`

### 3. `monitor-waha.bat`

This script checks if WAHA is responding and restarts it if necessary:
- Checks if the API is responding
- Verifies if the WhatsApp session is connected
- Attempts to reconnect if needed

**Usage:**
- Manual check: `monitor-waha.bat`

### 4. `setup-waha-monitor-task.bat`

This script creates a Windows scheduled task that runs the monitor script every 30 minutes:
- Ensures WAHA is always running
- Automatically restarts it if it crashes or disconnects

**Requirements:**
- Must be run as Administrator

**Usage:**
- Just run: `setup-waha-monitor-task.bat`

## Recommended Setup

For maximum reliability, follow these steps:

1. Run `setup-waha-service.bat` as Administrator to install WAHA as a service
2. Run `setup-waha-monitor-task.bat` as Administrator to set up automatic monitoring
3. Open the WhatsApp QR code and scan it once

After completing these steps, your WAHA installation will:
- Start automatically when Windows boots
- Keep running in the background
- Restart automatically if it crashes
- Maintain your WhatsApp session permanently

## Troubleshooting

If WAHA is not working properly:

1. Check the service status: `sc query WAHAService`
2. Check the logs: `waha-service.log` and `waha-service-error.log`
3. Run the monitor script manually: `monitor-waha.bat`
4. Restart the service: `sc stop WAHAService` then `sc start WAHAService`
5. For a clean start: Stop the service, run `start-waha-persistent.bat clean`, then start the service again 