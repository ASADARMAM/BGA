/**
 * WhatsApp Message Generator for WeCloud Invoices
 * 
 * This script helps generate professional WhatsApp messages for invoice notifications
 * based on the invoice status (paid, due, or unpaid).
 */

// Message templates for different invoice statuses
const messageTemplates = {
  paid: `Dear {customerName},

Thank you for your payment! 🙏

A receipt has been generated for your WeCloud Internet Services payment.

*Receipt Details:*
📋 Invoice #: {invoiceId}
💰 Amount Paid: PKR {amount}
📦 Package: {packageName}
📅 Period: {billingPeriod}
✅ Status: *PAID*

View your receipt online: {invoiceLink}

We appreciate your business and prompt payment. If you have any questions about your service or need technical assistance, please don't hesitate to contact our support team.

Thank you for choosing WeCloud Internet Services!

Best regards,
WeCloud Support Team
+92-300-1234567`,

  due: `Dear {customerName},

Your invoice for WeCloud Internet Services is ready.

*Invoice Details:*
📋 Invoice #: {invoiceId}
💰 Amount: PKR {amount}
📦 Package: {packageName}
📅 Period: {billingPeriod}
⏰ Due Date: {dueDate}
🔶 Status: *DUE*

View your invoice online: {invoiceLink}

Please make your payment before the due date to ensure uninterrupted service. If you have already made the payment, please disregard this message.

Thank you for choosing WeCloud Internet Services!

Best regards,
WeCloud Support Team
+92-300-1234567`,

  unpaid: `Dear {customerName},

REMINDER: Your invoice for WeCloud Internet Services is overdue.

*Invoice Details:*
📋 Invoice #: {invoiceId}
💰 Amount: PKR {amount}
📦 Package: {packageName}
📅 Period: {billingPeriod}
⚠️ Due Date: {dueDate} (OVERDUE)
🔴 Status: *UNPAID*

View your invoice online: {invoiceLink}

Your service may be suspended if payment is not received soon. Please settle your outstanding balance at your earliest convenience.

If you're experiencing any difficulties with payment or have questions about your invoice, please contact us immediately.

Thank you for your attention to this matter.

Best regards,
WeCloud Support Team
+92-300-1234567`
};

/**
 * Format currency amount
 * @param {number} amount - The amount to format
 * @returns {string} - Formatted amount
 */
function formatAmount(amount) {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format date to a readable string
 * @param {Date|Object|number|string} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  if (!date) return 'N/A';
  
  let dateObj;
  if (date instanceof Date) {
    dateObj = date;
  } else if (date.toDate && typeof date.toDate === 'function') {
    dateObj = date.toDate();
  } else if (date.seconds) {
    dateObj = new Date(date.seconds * 1000);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    return 'N/A';
  }
  
  if (isNaN(dateObj.getTime())) return 'N/A';
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Generate a WhatsApp message for an invoice
 * @param {Object} invoice - The invoice data
 * @param {Object} user - The user data
 * @param {Object} packageData - The package data
 * @param {string} invoiceLink - The link to view the invoice
 * @returns {string} - The formatted WhatsApp message
 */
function generateWhatsAppMessage(invoice, user, packageData, invoiceLink) {
  if (!invoice) return 'Error: Invoice data is missing';
  
  // Determine status
  const status = (invoice.status || '').toLowerCase();
  let templateType = 'due'; // default
  
  if (status === 'paid') {
    templateType = 'paid';
  } else if (status === 'unpaid' || status === 'overdue') {
    templateType = 'unpaid';
  }
  
  // Get the appropriate template
  let template = messageTemplates[templateType];
  
  // Format billing period
  let periodText = 'N/A';
  if (invoice.billingPeriod) {
    periodText = invoice.billingPeriod;
  } else if (invoice.period) {
    periodText = invoice.period;
  } else if (invoice.date && invoice.dueDate) {
    periodText = `${formatDate(invoice.date)} - ${formatDate(invoice.dueDate)}`;
  } else if (invoice.formattedId && invoice.formattedId.length >= 6) {
    const yr = invoice.formattedId.substring(0,4);
    const mo = invoice.formattedId.substring(4,6);
    periodText = `${mo}/${yr}`;
  }
  
  // Replace placeholders in the template
  return template
    .replace('{customerName}', (user && user.name) || invoice.customerName || 'Valued Customer')
    .replace('{invoiceId}', invoice.formattedId || invoice.id || 'N/A')
    .replace('{amount}', formatAmount(invoice.amount || 0))
    .replace('{packageName}', (packageData && packageData.name) || invoice.packageName || 'Internet Service')
    .replace('{billingPeriod}', periodText)
    .replace('{dueDate}', formatDate(invoice.dueDate))
    .replace('{invoiceLink}', invoiceLink);
}

// Export the functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateWhatsAppMessage,
    formatAmount,
    formatDate,
    messageTemplates
  };
} 