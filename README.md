# WeCloud Internet Services

A lightweight ISP Billing Web Application built with HTML, CSS, JavaScript, and Firebase.

## WhatsApp Integration

WeCloud uses the WhatsApp HTTP API (WAHA) for sending notifications to customers. Follow these steps to set up WhatsApp integration:

### Initial Setup

1. Run `start-waha.bat` to start the WAHA server
2. The server will run on http://localhost:3000
3. When sending your first message, you'll need to scan a QR code to authenticate

### Troubleshooting QR Code Issues

If you're having trouble getting a QR code to scan:

1. Use the "Check Status" button on the Messages page to see the current session status
2. Click "Authenticate Now" to initiate the QR code scanning process
3. If that doesn't work, click "Get QR Directly" for step-by-step instructions
4. As a last resort, use `get-waha-qr.bat` and `qr-viewer.html` to retrieve and view the QR code

### Session Management

If WhatsApp messages aren't sending or you're seeing errors:

1. Click "Restart WhatsApp Session" on the Messages page
2. Wait for the session to restart, then try authenticating again
3. If problems persist, run `start-waha.bat restart` to completely reset the WAHA container

## Features

- **Responsive UI** – Works perfectly on mobile, tablet, and desktop
- **User Management** – Add, edit, and delete users
- **Package Management** – Create and manage internet service packages
- **Invoice Management** – Generate invoices and send WhatsApp notifications
- **Dashboard** – Overview of users, revenue, and pending invoices
- **WhatsApp Integration** – Send alerts for invoices and payment reminders

## How to Run the Application

### Option 1: Using Node.js (Recommended)

1. Make sure you have [Node.js](https://nodejs.org/) installed on your computer
2. Open a terminal/command prompt
3. Navigate to the `wecloud` directory
4. Run the following command:

```
node server.js
```

5. Open your browser and go to [http://localhost:3000](http://localhost:3000)

### Option 2: Using a Web Server Extension

If you're using Visual Studio Code:

1. Install the "Live Server" extension
2. Right-click on `index.html` and select "Open with Live Server"

For other editors, use a similar local server extension.

### Option 3: Using Python's Built-in HTTP Server

If you have Python installed:

1. Open a terminal/command prompt
2. Navigate to the `wecloud` directory
3. Run one of the following commands:

For Python 3:
```
python -m http.server
```

For Python 2:
```
python -m SimpleHTTPServer
```

4. Open your browser and go to [http://localhost:8000](http://localhost:8000)

## Important Notes

### Running the Application
This application cannot be run directly by opening the HTML files in a browser due to CORS restrictions with ES modules. You must use a web server as described above.

### WhatsApp API Integration
The WhatsApp integration uses CORS Anywhere proxy to make real API calls to UltraMsg. To enable this functionality:

1. Visit https://cors-anywhere.herokuapp.com/corsdemo
2. Click the "Request temporary access to the demo server" button
3. Return to the WeCloud application and try sending notifications

Note: CORS Anywhere is a temporary solution for development purposes. In a production environment, you should implement your own server-side proxy.

## Technologies Used

- HTML5, CSS3, JavaScript (ES6+)
- Firebase Firestore
- UltraMsg WhatsApp API

## DuckDNS Setup

1. Go to https://www.duckdns.org and sign in with your Google account
2. Create a subdomain (e.g., wecloud.duckdns.org)
3. Copy your token from the DuckDNS dashboard
4. Edit `update-duckdns.bat`:
   - Replace `wecloud` with your subdomain name
   - Replace `your-token-here` with your DuckDNS token
5. Double-click `update-duckdns.bat` to run it
   - This will keep your domain updated with your current IP address
   - Keep this window open

## Router Setup

1. Log into your router's admin panel
2. Set up port forwarding:
   - Forward port 3001 to your server's local IP address
   - Protocol: TCP
   - External port: 80 (for HTTP) and 443 (for HTTPS)
   - Internal port: 3001
3. Optional: Set up a static IP for your server

## Usage

Your invoice system will now be accessible at:
- https://your-domain.duckdns.org/invoice/INVOICE_ID

Replace `your-domain` with your DuckDNS subdomain name. 