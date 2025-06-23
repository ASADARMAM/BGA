# WeCloud Invoice Viewer

This is a standalone invoice viewer for WeCloud Internet Services. It allows customers to view their invoices online via direct links sent through WhatsApp or email.

## Features

- View invoice details
- Print invoices
- Download invoices as PDF
- Mobile-responsive design

## Setup Instructions

1. Fork or clone this repository
2. Enable GitHub Pages in your repository settings
3. Update the following in the code:
   - Replace the Firebase configuration in `view.html` with your own Firebase project details
   - Update the logo URL in `view.html` to point to your own logo
   - Update the `INVOICE_BASE_URL` in `generate-links.js` to your GitHub Pages URL

## Usage

### Viewing Invoices

Customers can view their invoices by clicking on the direct link they receive. The URL format is:

```
https://yourusername.github.io/wecloud-invoices/view.html?id=INVOICE_ID
```

Where `INVOICE_ID` is the ID of the invoice in Firebase.

### Generating Invoice Links

Use the `generate-links.js` script to create direct links to invoices that can be sent to customers via WhatsApp or email.

Example:

```javascript
// Get invoice and user data from Firebase
const invoice = { id: 'INV-2023-001', amount: 1500, date: new Date(), dueDate: new Date() };
const user = { name: 'John Doe', phone: '+923001234567' };

// Generate message with link
const message = generateInvoiceMessage(invoice, user);
console.log(message);
```

## Integration with WhatsApp

To send invoice links via WhatsApp:

1. Retrieve invoice data from Firebase
2. Generate the message with the invoice link using `generateInvoiceMessage()`
3. Send the message using your WhatsApp API integration

## Customization

You can customize the appearance of the invoice by modifying the CSS in `view.html`.

## License

Copyright © 2023 WeCloud Internet Services. All rights reserved. 