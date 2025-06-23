// Integration script for the GitHub Pages invoice viewer

// Replace with your GitHub Pages URL
const GITHUB_PAGES_URL = 'https://asadarmam.github.io/wecloud-invoices/view.html';

/**
 * Generates a direct link to the invoice viewer on GitHub Pages.
 * @param {string} formattedId - The formatted invoice ID (e.g., '202307WCID1234').
 * @returns {string} - The direct URL to view the invoice.
 */
export function generateInvoiceLink(formattedId) {
    if (!formattedId) {
        console.error("formattedId is required to generate an invoice link.");
        return '';
    }
    return `${GITHUB_PAGES_URL}?id=${formattedId}`;
}

/**
 * Generate a WhatsApp message with invoice link
 * @param {object} invoice - The invoice object
 * @param {object} user - The user object
 * @returns {string} - The formatted WhatsApp message
 */
export function generateInvoiceMessage(invoice, user) {
  // Format dates
  const dueDate = formatDate(invoice.dueDate);
  
  // Generate the direct link to the invoice
  const invoiceLink = generateInvoiceLink(invoice.id);
  
  // Create the message template
  return `Dear ${user.name},

Your invoice for WeCloud Internet Services is ready.

*Invoice #:* ${invoice.id}
*Amount:* PKR ${invoice.amount}
*Due Date:* ${dueDate}

View your invoice online: ${invoiceLink}

Thank you for choosing WeCloud Internet Services!`;
}

/**
 * Generate a payment reminder message with invoice link
 * @param {object} invoice - The invoice object
 * @param {object} user - The user object
 * @returns {string} - The formatted reminder message
 */
export function generatePaymentReminderMessage(invoice, user) {
  // Format dates
  const dueDate = formatDate(invoice.dueDate);
  
  // Generate the direct link to the invoice
  const invoiceLink = generateInvoiceLink(invoice.id);
  
  // Create the reminder message template
  return `Dear ${user.name},

This is a friendly reminder that your invoice #${invoice.id} for PKR ${invoice.amount} is due on ${dueDate}.

View your invoice and make payment: ${invoiceLink}

If you have already made the payment, please disregard this message.

Thank you for your business!
WeCloud Internet Services`;
}

/**
 * Format a date for display
 * @param {any} timestamp - The timestamp to format
 * @returns {string} - The formatted date string
 */
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  
  let date;
  if (timestamp.seconds) {
    // Handle Firestore timestamp
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
} 