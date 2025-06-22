// WhatsApp integration using WAHA API

// WAHA configuration
const WAHA_CONFIG = {
    baseUrl: 'http://localhost:3000/api',
    session: 'default',
    retryAttempts: 3,
    retryDelay: 2000,
    messageTimeout: 30000,
    batchSize: 50,
    headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': 'My1ncredibly$trongKey2024'
    }
};

// Import Firebase modules
import { db, collection, addDoc, getDocs, query, where, orderBy, limit, writeBatch, serverTimestamp } from './firebaseConfig.js';
// Import invoice viewer integration
import { generateInvoiceLink } from './invoiceViewer.js';

// Constants for optimization
const MESSAGE_BATCH_SIZE = 50;
const MAX_CONCURRENT_MESSAGES = 10;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000;
const MAX_QUEUE_SIZE = 1000;
const RATE_LIMIT_DELAY = 100;
const MESSAGE_TIMEOUT = 10000;

// Message templates - updated to use GitHub Pages invoice links
const MESSAGE_TEMPLATES = {
    INVOICE_NOTIFICATION: `*📋 INVOICE NOTIFICATION*
━━━━━━━━━━━━━━━━━━━━━

Dear *{userName}*,

Your invoice has been generated.

*📊 INVOICE DETAILS*
━━━━━━━━━━━━
• *Invoice ID:* {formattedId}
• *Amount:* {amount}
• *Due Date:* {dueDate}

*🔗 VIEW INVOICE*
━━━━━━━━━━━━
Click here to view your invoice:
{invoiceLink}

Please make payment before the due date to avoid service interruption.

Thank you for choosing WeCloud Internet Services! 🌟`,

    PAYMENT_CONFIRMATION: `*💰 PAYMENT CONFIRMATION*
━━━━━━━━━━━━━━━━━━━━━

Dear *{userName}*,

We have received your payment of *{amount}* for invoice *#{formattedId}*.

Thank you for your business! 🌟

WeCloud Internet Services`,

    PAYMENT_REMINDER: `*⚠️ PAYMENT REMINDER*
━━━━━━━━━━━━━━━━━━━━━

Dear *{userName}*,

This is a friendly reminder that your invoice #{formattedId} is due soon.

*📊 INVOICE DETAILS*
━━━━━━━━━━━━
• *Amount Due:* {amount}
• *Due Date:* {dueDate}

*🔗 VIEW INVOICE*
━━━━━━━━━━━━
Click here to view your invoice:
{invoiceLink}

Please make payment before the due date to avoid service interruption.

Thank you for choosing WeCloud Internet Services! 🌟`,

    BROADCAST_ALERT: `*📢 IMPORTANT NOTICE*
━━━━━━━━━━━━━━━━━━━━━

Dear *{userName}*,

{message}

Thank you for choosing WeCloud Internet Services! 🌟`,

    WHATSAPP_ALERT: `*⚡ ALERT*
━━━━━━━━━━━━━━━━━━━━━

Dear *{userName}*,

{message}

WeCloud Internet Services 🌟`
};

// Server status checker with QR code handling
const serverStatus = {
    isOnline: false,
    lastCheck: null,
    qrCode: null,
    sessionStatus: null,

    async check() {
        try {
            // First, check if the server is reachable
            try {
                // Use the Swagger UI endpoint to check if server is running
                const serverCheck = await fetch('http://localhost:3000/', {
                    method: 'GET',
                    mode: 'no-cors', // This allows us to check if the server is up even if CORS is not enabled
                    cache: 'no-cache',
                    timeout: 5000
                });
                
                // If we get here, the server is likely running (no-cors doesn't give us status)
                console.log("WAHA server appears to be running");
                this.isOnline = true; // Mark as online if we can reach the server
                
                // Now check if the API is accessible
                try {
                    const apiCheck = await fetch(`${WAHA_CONFIG.baseUrl}/sessions`, {
                        method: 'GET',
                        headers: WAHA_CONFIG.headers,
                        timeout: 5000
                    });
                    
                    // If we can access the sessions endpoint, the API is working
                    if (apiCheck.ok || apiCheck.status === 401) { // 401 means API is up but needs auth
                        console.log("WAHA API is accessible");
                        this.isOnline = true; // Confirm online status if API responds
                    } else {
                        console.warn("WAHA API returned status:", apiCheck.status);
                        // Continue anyway as the server might be running but returning errors
                        // Don't change online status here - we already know server is reachable
                    }
                } catch (apiError) {
                    console.warn("WAHA API check error:", apiError);
                    // Don't change online status - the server might be running but the API endpoint might be different
                }
            } catch (serverError) {
                console.error("WAHA server connection error:", serverError);
                this.isOnline = false;
                return false;
            }
            
            // Then check the session
            try {
                const response = await fetch(`${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}`, {
                    timeout: 5000,
                    headers: WAHA_CONFIG.headers
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.isOnline = true;
                    this.sessionStatus = data.status;
                    return true;
                } else if (response.status === 404) {
                    // Session doesn't exist, create it
                    console.log("Session not found (404). Creating a new session...");
                    
                    try {
                        // Create session
                        const createResponse = await fetch(`${WAHA_CONFIG.baseUrl}/sessions`, {
                            method: 'POST',
                            headers: WAHA_CONFIG.headers,
                            body: JSON.stringify({ name: WAHA_CONFIG.session })
                        });
                        
                        if (!createResponse.ok) {
                            console.error("Failed to create session:", await createResponse.text());
                            // Don't automatically set offline - if we could reach the server earlier, it's online
                            return false;
                        }
                        
                        // Start session
                        const startResponse = await fetch(`${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}/start`, {
                            method: 'POST',
                            headers: WAHA_CONFIG.headers,
                            body: JSON.stringify({})
                        });
                        
                        if (!startResponse.ok) {
                            console.error("Failed to start session:", await startResponse.text());
                            // Don't automatically set offline - if we could reach the server earlier, it's online
                            return false;
                        }
                        
                        const data = await startResponse.json();
                        this.isOnline = true;
                        this.sessionStatus = data.status || 'STARTING';
                        return true;
                    } catch (sessionError) {
                        console.error("Error creating/starting session:", sessionError);
                        // Don't automatically set offline - if we could reach the server earlier, it's online
                        return this.isOnline; // Return current online status
                    }
                } else if (response.status === 422 || response.status === 401) {
                    // 422 indicates server is running but has limitations (like in the Plus version error)
                    // 401 indicates authentication needed but server is running
                    console.warn("Session check returned status:", response.status);
                    this.isOnline = true; // Server is online even if it returns limitations
                    this.sessionStatus = 'CONNECTED'; // Assume connected if server responds with limitations
                    return true;
                } else {
                    console.error("Session check failed with status:", response.status);
                    // Don't automatically set offline - if we could reach the server earlier, it's online
                    return this.isOnline; // Return current online status
                }
            } catch (sessionCheckError) {
                console.error("Session check error:", sessionCheckError);
                // Don't automatically set offline - if we could reach the server earlier, it's online
                return this.isOnline; // Return current online status
            }
        } catch (error) {
            console.error("Server status check error:", error);
            this.isOnline = false;
            return false;
        }
    },

    async restartSession() {
        try {
            console.log("Attempting full session restart...");
            
            // First try to stop the session
            try {
                await fetch(`${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}/stop`, {
                    method: 'POST',
                    headers: WAHA_CONFIG.headers
                });
                console.log("Session stop request sent");
            } catch (e) {
                console.log("Session stop failed, continuing anyway:", e);
            }
            
            // Wait a moment for it to stop
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Delete the session if it exists
            try {
                await fetch(`${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}`, {
                    method: 'DELETE',
                    headers: WAHA_CONFIG.headers
                });
                console.log("Session delete request sent");
            } catch (e) {
                console.log("Session delete failed, continuing anyway:", e);
            }
            
            // Wait a moment for deletion to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Create a new session
            try {
                await fetch(`${WAHA_CONFIG.baseUrl}/sessions`, {
                    method: 'POST',
                    headers: WAHA_CONFIG.headers,
                    body: JSON.stringify({ name: WAHA_CONFIG.session })
                });
                console.log("New session created");
            } catch (e) {
                console.log("Session creation failed, continuing anyway:", e);
            }
            
            // Wait a moment for creation to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Then start it again
            const response = await fetch(`${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}/start`, {
      method: 'POST',
                headers: WAHA_CONFIG.headers
            });
            
            if (response.ok) {
                console.log("Session started successfully");
                return true;
            }
            
            console.log("Session start failed with status:", response.status);
            return false;
  } catch (error) {
            console.error("Session restart error:", error);
            return false;
        }
    },

    async getQR() {
        try {
            // Check if we need to restart the session
            await this.check();
            
            // If stuck in QR code state or any other problematic state, restart the session
            if (this.sessionStatus === 'SCAN_QR_CODE' || 
                this.sessionStatus === 'STARTING' || 
                this.sessionStatus === 'FAILED') {
                
                console.log(`Session in ${this.sessionStatus} state, attempting restart...`);
                await this.restartSession();
                
                // Give it a moment to initialize
                await new Promise(resolve => setTimeout(resolve, 5000));
                await this.check();
            } else if (this.sessionStatus !== 'CONNECTED' && this.sessionStatus !== 'WORKING') {
                // Normal startup - just ensure the session is started
                try {
                    await fetch(`${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}/start`, {
                        method: 'POST',
                        headers: WAHA_CONFIG.headers
                    });
                    console.log("Session start request sent");
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (e) {
                    console.log("Session start request failed:", e);
                }
            }

            console.log("Attempting to get QR code...");
            
            // Try multiple endpoints for QR code - different WAHA versions use different paths
            const endpoints = [
                `${WAHA_CONFIG.baseUrl}/${WAHA_CONFIG.session}/auth/qr`,
                `${WAHA_CONFIG.baseUrl}/auth/${WAHA_CONFIG.session}/qr`,
                `${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}/qr`
            ];
            
            let qrCode = null;
            let responseData = null;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`Trying QR endpoint: ${endpoint}`);
                    const response = await fetch(endpoint, {
                        headers: { ...WAHA_CONFIG.headers, 'Accept': 'application/json' }
                    });
                    
                    if (response.ok) {
                        responseData = await response.json();
                        console.log("QR response:", responseData);
                        
                        // Different WAHA versions return QR in different formats
                        if (responseData && responseData.qr) {
                            qrCode = responseData.qr;
                            console.log("Found QR code in 'qr' field");
                            break;
                        } else if (responseData && responseData.data) {
                            qrCode = responseData.data;
                            console.log("Found QR code in 'data' field");
                            break;
                        } else if (responseData && responseData.qrcode) {
                            qrCode = responseData.qrcode;
                            console.log("Found QR code in 'qrcode' field");
                            break;
                        }
    } else {
                        console.log(`Endpoint ${endpoint} returned status: ${response.status}`);
                    }
                } catch (error) {
                    console.log(`Error with endpoint ${endpoint}:`, error);
                }
            }
            
            if (qrCode) {
                this.qrCode = qrCode;
                return this.qrCode;
            } else {
                console.log("No QR code found in any response:", responseData);
                
                // If we still don't have a QR code, try forcing a new one
                try {
                    console.log("Attempting to force new QR code generation...");
                    await this.restartSession();
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Try the first endpoint again
                    const response = await fetch(endpoints[0], {
                        headers: { ...WAHA_CONFIG.headers, 'Accept': 'application/json' }
                    });
                    
                    if (response.ok) {
                        responseData = await response.json();
                        console.log("Forced QR response:", responseData);
                        
                        if (responseData && responseData.qr) {
                            this.qrCode = responseData.qr;
                            return this.qrCode;
                        }
                    }
                } catch (e) {
                    console.log("Failed to force new QR code:", e);
                }
            }
            
            return null;
        } catch (error) {
            console.error("Error getting QR code:", error);
            return null;
        }
    },

    async waitForAuthentication() {
        let attempts = 0;
        const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute timeout
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
            
            try {
                const response = await fetch(`${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}`, {
                    headers: WAHA_CONFIG.headers
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log("Session status check:", data.status);
                    
                    // Update the session status
                    this.sessionStatus = data.status;
                    
                    if (data.status === 'CONNECTED' || data.status === 'WORKING') {
                        return true;
                    } else if (data.status === 'FAILED') {
                        console.error("Session failed to authenticate");
                        return false;
                    }
                } else if (response.status === 404) {
                    console.error("Session not found during authentication check");
                    
                    // Try to recreate the session
                    try {
                        await fetch(`${WAHA_CONFIG.baseUrl}/sessions`, {
                            method: 'POST',
                            headers: WAHA_CONFIG.headers,
                            body: JSON.stringify({ name: WAHA_CONFIG.session })
                        });
                        
                        await fetch(`${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}/start`, {
                            method: 'POST',
                            headers: WAHA_CONFIG.headers,
                            body: JSON.stringify({})
                        });
                        
                        console.log("Session recreated during authentication check");
                    } catch (e) {
                        console.error("Failed to recreate session:", e);
                    }
                }
            } catch (error) {
                console.error("Authentication check error:", error);
            }
            
            attempts++;
        }
        
        return false;
    }
};

// Show QR code in a modal
function showQRModal(qrCode) {
    // Remove any existing QR modal
    const existingModal = document.getElementById('whatsappQrModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHtml = `
        <div id="whatsappQrModal" class="modal" style="display: block; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.7);">
            <div class="modal-content" style="background-color: #fefefe; margin: 15% auto; padding: 20px; border: 1px solid #888; width: 350px; border-radius: 8px; text-align: center;">
                <h3 style="margin-top: 0;">Scan WhatsApp QR Code</h3>
                <p>Please scan this QR code with WhatsApp on your phone:</p>
                <div style="margin: 20px 0;">
                    <img src="${qrCode}" alt="WhatsApp QR Code" style="width: 256px; height: 256px; display: block; margin: 0 auto;">
                </div>
                <p style="margin-bottom: 5px;">1. Open WhatsApp on your phone</p>
                <p style="margin-bottom: 5px;">2. Go to Settings > Linked Devices</p>
                <p style="margin-bottom: 20px;">3. Tap "Link a Device" and scan this code</p>
                <p style="color: #666; font-size: 14px;">Waiting for scan... This window will close automatically once authenticated.</p>
                <button id="closeQrModal" style="background-color: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">Cancel</button>
            </div>
        </div>
    `;
    
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
    
    // Add event listener to close button
    document.getElementById('closeQrModal').addEventListener('click', () => {
        modalDiv.remove();
    });
    
    return modalDiv;
}

// Format phone number helper
function formatPhoneNumber(phone) {
  if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '92' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('92')) {
        cleaned = '92' + cleaned;
  }
    return cleaned;
}

// Enhanced message sender with QR authentication
async function sendMessage(phone, message, options = {}) {
    try {
        // Check server status and authentication
        if (!serverStatus.isOnline) {
            if (!await serverStatus.check()) {
                throw new Error('WAHA server is offline. Please start the server from your PC.');
            }
        }

        // If not authenticated or in wrong state, handle authentication
        if (serverStatus.sessionStatus !== 'CONNECTED' && 
            serverStatus.sessionStatus !== 'WORKING') {
            
            // Try to authenticate with QR code
            const authenticated = await authenticateWithQR();
            if (!authenticated) {
                throw new Error('WhatsApp authentication failed. Please restart the WAHA server and try again.');
            }
        }

        const chatId = formatPhoneNumber(phone);
        if (!chatId) {
            throw new Error('Invalid phone number');
        }

        let endpoint = 'sendText';
        if (options.media) {
            // Decide correct media endpoint
            if (options.media.mimetype && options.media.mimetype.startsWith('image')) {
                endpoint = 'sendImage';
            } else if (options.media.mimetype && options.media.mimetype.startsWith('video')) {
                endpoint = 'sendVideo';
            } else if (options.media.mimetype && options.media.mimetype.startsWith('audio')) {
                endpoint = 'sendVoice';
            } else {
                endpoint = 'sendFile'; // generic documents (PDF, etc.)
            }
        }

        const payload = {
            chatId: `${chatId}@c.us`,
            session: WAHA_CONFIG.session,
            ...(options.media ? {
                file: options.media,
                caption: message
            } : {
                text: message
            })
        };

        const response = await fetch(`${WAHA_CONFIG.baseUrl}/${endpoint}`, {
            method: 'POST',
            headers: WAHA_CONFIG.headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try { 
                errText = await response.text();
                // Try to parse the error as JSON
                try {
                    const errorJson = JSON.parse(errText);
                    errText = errorJson.message || errText;
                } catch (_) {}
            } catch (_) {}

            // Special handling for 422 errors (Plus version limitations)
            if (response.status === 422) {
                if (errText.includes("Plus version")) {
                    return { 
                        success: false, 
                        error: errText,
                        isPlusFeature: true  // Flag to indicate this is a Plus version limitation
                    };
                }
            }
            
            throw new Error(`Failed to send message (${response.status}) ${errText}`);
        }

        return { success: true, data: await response.json() };
    } catch (error) {
        console.error('Message send error:', error);
        
        // Only show server error if it's actually a server connection issue
        if (error.message.includes('offline') || error.message.includes('ECONNREFUSED') || error.message.includes('Failed to fetch')) {
            showServerError();
        }
        
        return { success: false, error: error.message };
    }
}

// Authenticate with QR code
async function authenticateWithQR() {
    console.log("Starting WhatsApp authentication process...");
    
    // If session is in a bad state, restart it
    if (serverStatus.sessionStatus === 'SCAN_QR_CODE' || 
        serverStatus.sessionStatus === 'STARTING' || 
        serverStatus.sessionStatus === 'FAILED') {
        console.log(`Session in problematic state: ${serverStatus.sessionStatus}, restarting...`);
        await serverStatus.restartSession();
        await new Promise(resolve => setTimeout(resolve, 5000));
        await serverStatus.check();
    }
    
    // Get QR code for authentication - try multiple times
    let qrCode = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!qrCode && attempts < maxAttempts) {
        attempts++;
        console.log(`QR code retrieval attempt ${attempts}/${maxAttempts}...`);
        
        qrCode = await serverStatus.getQR();
        
        if (!qrCode && attempts < maxAttempts) {
            console.log(`No QR code received, waiting before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    if (!qrCode) {
        console.error("Failed to get QR code after multiple attempts");
        
        // Try one last approach - run the get-waha-qr.bat script and load from file
        try {
            console.log("Attempting to run get-waha-qr.bat to retrieve QR code...");
            
            // Create a hidden iframe to run the script (this is a workaround since we can't directly execute batch files)
            const scriptFrame = document.createElement('iframe');
            scriptFrame.style.display = 'none';
            document.body.appendChild(scriptFrame);
            
            // Navigate to the script (this will download/run it in some browsers)
            scriptFrame.src = 'get-waha-qr.bat';
            
            // Show instructions for manual QR code viewing
            const manualQrModalDiv = document.createElement('div');
            manualQrModalDiv.innerHTML = `
                <div id="manualQrModal" class="modal" style="display: block; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.7);">
                    <div class="modal-content" style="background-color: #fefefe; margin: 15% auto; padding: 20px; border: 1px solid #888; width: 450px; border-radius: 8px; text-align: center;">
                        <h3 style="margin-top: 0;">QR Code Retrieval</h3>
                        <p>Attempting to get WhatsApp QR code. Please follow these steps:</p>
                        <ol style="text-align: left; margin: 20px 0;">
                            <li>Open <a href="qr-viewer.html" target="_blank">QR Viewer</a> in a new tab</li>
                            <li>Select the file "qr1.json" when prompted</li>
                            <li>Scan the QR code with your WhatsApp app</li>
                            <li>Return to this page after scanning</li>
                        </ol>
                        <div>
                            <button id="closeManualQrModal" style="background-color: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px; margin-right: 10px;">I've Scanned the QR Code</button>
                            <button id="cancelManualQrModal" style="background-color: #f44336; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(manualQrModalDiv);
            
            return new Promise((resolve) => {
                document.getElementById('closeManualQrModal').addEventListener('click', () => {
                    manualQrModalDiv.remove();
                    scriptFrame.remove();
                    
                    // Check if authentication succeeded
                    setTimeout(async () => {
                        await serverStatus.check();
                        resolve(serverStatus.sessionStatus === 'CONNECTED' || serverStatus.sessionStatus === 'WORKING');
                    }, 2000);
                });
                
                document.getElementById('cancelManualQrModal').addEventListener('click', () => {
                    manualQrModalDiv.remove();
                    scriptFrame.remove();
                    resolve(false);
                });
            });
        } catch (error) {
            console.error("Error with manual QR retrieval:", error);
        }
        
        // Show error modal instead of QR code
        const errorModalDiv = document.createElement('div');
        errorModalDiv.innerHTML = `
            <div id="whatsappErrorModal" class="modal" style="display: block; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.7);">
                <div class="modal-content" style="background-color: #fefefe; margin: 15% auto; padding: 20px; border: 1px solid #888; width: 400px; border-radius: 8px; text-align: center;">
                    <h3 style="margin-top: 0; color: #d32f2f;">QR Code Error</h3>
                    <p>Unable to retrieve WhatsApp QR code. Please try the following:</p>
                    <ol style="text-align: left; margin: 20px 0;">
                        <li>Check if the WAHA server is running</li>
                        <li>Restart the WAHA server using start-waha.bat</li>
                        <li>Try again after server restart</li>
                    </ol>
                    <div>
                        <button id="closeErrorModal" style="background-color: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(errorModalDiv);
        
        return new Promise((resolve) => {
            document.getElementById('closeErrorModal').addEventListener('click', () => {
                errorModalDiv.remove();
                resolve(false);
            });
        });
    }
    
    // Show QR code modal
    const modalDiv = showQRModal(qrCode);
    console.log("QR code displayed, waiting for scan...");
    
    // Wait for authentication
    const authenticated = await serverStatus.waitForAuthentication();
    modalDiv.remove();
    
    if (authenticated) {
        console.log("WhatsApp authentication successful!");
        return true;
    } else {
        console.error("WhatsApp authentication failed or timed out");
        return false;
    }
}

// Retry mechanism
async function sendWithRetry(sendFunction, attempts = RETRY_ATTEMPTS) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            return await sendFunction();
  } catch (error) {
            lastError = error;
            if (i < attempts - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }
    throw lastError;
  }
  
// Format domain based on environment
function getDomain() {
    // Check if we're in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.host; // includes port if any
    }
    // In production, use DuckDNS domain
    return 'we-cloud-internet.duckdns.org';
}

// Send invoice notification
async function sendInvoiceNotification(user, invoice) {
    try {
        const message = MESSAGE_TEMPLATES.INVOICE_NOTIFICATION
            .replace('{userName}', user.name)
            .replace('{formattedId}', invoice.formattedId || invoice.id)
            .replace('{amount}', formatAmount(invoice.amount))
            .replace('{dueDate}', formatDate(invoice.dueDate))
            .replace('{invoiceLink}', generateInvoiceLink(invoice.id));

        await sendMessage(user.phone, message);
    } catch (error) {
        console.error('Error sending invoice notification:', error);
        throw error;
    }
}

async function sendPaymentReminder(user, invoice) {
    const message = MESSAGE_TEMPLATES.PAYMENT_REMINDER
        .replace('{userName}', user.name)
        .replace('{formattedId}', invoice.formattedId || invoice.id)
        .replace('{amount}', formatAmount(invoice.amount))
        .replace('{dueDate}', formatDate(invoice.dueDate))
        .replace('{invoiceLink}', generateInvoiceLink(invoice.id));

    return await sendWithRetry(() => sendMessage(user.phone, message));
}

async function sendPaymentConfirmation(user, invoice) {
    try {
        const message = MESSAGE_TEMPLATES.PAYMENT_CONFIRMATION
            .replace('{userName}', user.name)
            .replace('{formattedId}', invoice.formattedId)
            .replace('{amount}', formatAmount(invoice.amount));

        await sendMessage(user.phone, message);
    } catch (error) {
        console.error('Error sending payment confirmation:', error);
        throw error;
    }
}

// Wrapper: alias for backward compatibility
async function sendPaidInvoiceNotification(user, invoice) {
    return await sendPaymentConfirmation(user, invoice);
}

// Batch message sending
async function sendBatchMessages(users, messageType, data = {}) {
    const results = {
        success: [],
        failed: []
    };

    const batches = [];
    for (let i = 0; i < users.length; i += MESSAGE_BATCH_SIZE) {
        batches.push(users.slice(i, i + MESSAGE_BATCH_SIZE));
    }

    for (const batch of batches) {
        const promises = batch.map(async (user) => {
            try {
                const message = await formatMessage(user, messageType, data);
                const result = await sendWithRetry(() => sendMessage(user.phone, message));
                if (result.success) {
                    results.success.push(user.id);
                } else {
                    results.failed.push({ userId: user.id, error: result.error });
                }
            } catch (error) {
                results.failed.push({ userId: user.id, error: error.message });
            }
        });

        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  }
  
  return results;
}

// Helper function to format messages
async function formatMessage(user, type, data) {
    let template = MESSAGE_TEMPLATES[type] || '';
    
    // Replace user-specific placeholders
    template = template.replace(/{userName}/g, user.name);

    // Replace data-specific placeholders
    if (data) {
        // Ensure amount is formatted correctly
        if (data.amount) {
            template = template.replace(/{amount}/g, formatAmount(data.amount));
        }
        // Ensure dueDate is formatted correctly
        if (data.dueDate) {
            template = template.replace(/{dueDate}/g, formatDate(data.dueDate));
        }
        // Replace other invoice data
        template = template.replace(/{invoiceLink}/g, data.invoiceLink || '');
        template = template.replace(/{formattedId}/g, data.formattedId || data.id || '');
        template = template.replace(/{message}/g, data.message || '');
    }
    
    return template;
}

// Utility function to format dates
function formatDate(date) {
    if (!date) return 'N/A';
    try {
        // Handle Firestore Timestamp objects, Date objects, and date strings
        const d = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return 'N/A'; // Invalid date
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.error("Error formatting date:", error);
        return 'N/A';
    }
}

// Format amount with PKR currency
function formatAmount(amount) {
    if (!amount) return 'PKR 0';
    
    try {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(numAmount)) return 'PKR 0';
        
        return `PKR ${numAmount.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        })}`;
    } catch (error) {
        console.error("Error formatting amount:", error);
        return 'PKR 0';
    }
}

// UI feedback for server status
function showServerError() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'server-error-alert';
    errorDiv.innerHTML = `
        <div style="background: #ff5555; color: white; padding: 15px; border-radius: 5px; margin: 10px;">
            <h4>WhatsApp Server Offline</h4>
            <p>Please follow these steps:</p>
            <ol>
                <li>Open the "start-waha.bat" file on your PC</li>
                <li>Wait for the server to start (about 30 seconds)</li>
                <li>Try sending your message again</li>
            </ol>
            <button onclick="this.parentElement.remove()">Close</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}

// Send invoice PDF
async function sendInvoicePdf(user, invoice, imageBlob, caption) {
    try {
        if (!imageBlob) {
            console.error("No image blob provided to sendInvoicePdf.");
            return;
        }

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(imageBlob);
        await new Promise(resolve => reader.onload = resolve);
        const base64Image = reader.result;

        console.log("Attempting to send invoice image via WhatsApp...");

        const response = await fetch(`${WAHA_CONFIG.baseUrl}/files`, {
            method: 'POST',
            headers: WAHA_CONFIG.headers,
            body: JSON.stringify({
                chatId: `${user.phone}@c.us`,
                file: base64Image,
                fileName: `invoice-${invoice.formattedId}.png`,
                caption: caption, // Send message as caption
            })
        });

        if (response.ok) {
            console.log('Invoice image sent successfully');
        } else {
            const errorData = await response.json();
            console.error('Failed to send invoice image:', response.status, errorData);
            // Fallback to sending a text link if image fails
            console.log("Falling back to sending invoice link as text.");
            const invoiceLink = generateInvoiceLink(invoice.id);
            const fallbackMessage = `Your paid invoice is ready. View it here: ${invoiceLink}`;
            await sendMessage(user.phone, fallbackMessage);
        }
    } catch (error) {
        console.error('Error in sendInvoicePdf:', error);
    }
}

// Send generic WhatsApp alert to a single user
async function sendWhatsAppAlert(user, message) {
    const formattedMessage = MESSAGE_TEMPLATES.WHATSAPP_ALERT
        .replace('{userName}', user.name)
        .replace('{message}', message);

    return await sendWithRetry(() => sendMessage(user.phone, formattedMessage));
}

// Send broadcast alert to many users
async function sendBroadcastAlert(users, message) {
    return await sendBatchMessages(users, 'BROADCAST_ALERT', { message });
}

// Check WAHA connection
async function testWhatsAppConnection() {
    try {
        // Check if server is online
        const isServerOnline = await serverStatus.check();
        
        if (!isServerOnline && !serverStatus.isOnline) {
            return {
                success: false,
                message: 'WAHA server is not running or not accessible.'
            };
        }
        
        // If we get here, the server is online
        // Try to send a test message to the API (even if it fails due to limitations)
        try {
            const response = await fetch(`${WAHA_CONFIG.baseUrl}/sessions/${WAHA_CONFIG.session}/health`, {
                method: 'GET',
                headers: WAHA_CONFIG.headers
            });
            
            if (response.ok) {
                return { success: true };
            } else if (response.status === 422) {
                // 422 status means the server is running but has limitations (Plus version features)
                return { 
                    success: true,
                    message: 'Server is running with free version limitations'
                };
            } else {
                const errorData = await response.text();
                return {
                    success: false,
                    message: `Server responded with status ${response.status}: ${errorData}`
                };
            }
        } catch (error) {
            console.error('Error testing connection:', error);
            
            // Even if the health check fails, if we know the server is online, return partial success
            if (serverStatus.isOnline) {
                return {
                    success: true,
                    message: 'Server is reachable but health check failed. WhatsApp may still be operational.'
                };
            }
            
            return {
                success: false,
                message: error.message
            };
        }
  } catch (error) {
        console.error('WhatsApp connection test error:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Show authentication prompt
async function promptForAuthentication() {
    return new Promise((resolve) => {
        // Create modal
        const modalHtml = `
            <div id="whatsappAuthModal" class="modal" style="display: block; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.7);">
                <div class="modal-content" style="background-color: #fefefe; margin: 15% auto; padding: 20px; border: 1px solid #888; width: 400px; border-radius: 8px;">
                    <h3 style="margin-top: 0;">WhatsApp Authentication Required</h3>
                    <p>Current status: <strong>${serverStatus.sessionStatus || 'UNKNOWN'}</strong></p>
                    <p>You need to authenticate WhatsApp before sending messages.</p>
                    <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                        <button id="cancelAuthBtn" style="background-color: #f44336; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                        <button id="startAuthBtn" style="background-color: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer;">Authenticate Now</button>
                    </div>
                </div>
            </div>
        `;
        
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHtml;
        document.body.appendChild(modalDiv);
        
        // Add event listeners
        document.getElementById('cancelAuthBtn').addEventListener('click', () => {
            modalDiv.remove();
            resolve({ success: false, message: 'Authentication cancelled by user.' });
        });
        
        document.getElementById('startAuthBtn').addEventListener('click', async () => {
            modalDiv.remove();
            
            // Start authentication process
            const authenticated = await authenticateWithQR();
            if (authenticated) {
                resolve({ success: true, message: 'WhatsApp authentication successful!' });
            } else {
                resolve({ success: false, message: 'WhatsApp authentication failed. Please try again.' });
            }
        });
    });
}

// Show QR code from Swagger UI
function showSwaggerQRInstructions() {
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = `
        <div id="swaggerQrModal" class="modal" style="display: block; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.7);">
            <div class="modal-content" style="background-color: #fefefe; margin: 10% auto; padding: 20px; border: 1px solid #888; width: 600px; border-radius: 8px;">
                <h3 style="margin-top: 0;">Get WhatsApp QR Code Directly</h3>
                <p>Follow these steps to get the QR code directly from the WAHA API:</p>
                
                <ol style="text-align: left; margin-bottom: 20px;">
                    <li>Open <a href="http://localhost:3000/" target="_blank">http://localhost:3000/</a> in a new tab</li>
                    <li>Click the green "Authorize" button in the top-right</li>
                    <li>Enter your API key: <code>${WAHA_CONFIG.headers['X-Api-Key']}</code></li>
                    <li>Click "Authorize" and then "Close"</li>
                    <li>Scroll down to the <strong>Auth</strong> section</li>
                    <li>Find <code>GET /{session}/auth/qr</code> and click "Try it out"</li>
                    <li>Enter <code>default</code> in the session parameter</li>
                    <li>Click "Execute"</li>
                    <li>The QR code should appear in the response section</li>
                    <li>Scan it with WhatsApp on your phone</li>
                </ol>
                
                <p>If you don't see a QR code, try these alternate endpoints:</p>
                <ul style="text-align: left; margin-bottom: 20px;">
                    <li><code>GET /auth/{session}/qr</code> (with session = default)</li>
                    <li><code>GET /sessions/{session}/qr</code> (with session = default)</li>
                </ul>
                
                <p>If you still can't get a QR code, try restarting the WAHA server with:</p>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">start-waha.bat restart</pre>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button id="closeSwaggerModal" style="background-color: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer;">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalDiv);
    
    // Add event listener to close button
    document.getElementById('closeSwaggerModal').addEventListener('click', () => {
        modalDiv.remove();
    });
    
    return modalDiv;
}

// Export all the functions
export {
    sendMessage,
  sendInvoiceNotification,
    sendPaymentReminder,
    sendPaymentConfirmation,
    sendPaidInvoiceNotification,
  sendInvoicePdf,
    sendWhatsAppAlert,
  sendBroadcastAlert,
  testWhatsAppConnection,
    sendBatchMessages,
    formatMessage,
    formatDate,
    formatAmount,
    serverStatus,
    authenticateWithQR,
    showSwaggerQRInstructions
}; 