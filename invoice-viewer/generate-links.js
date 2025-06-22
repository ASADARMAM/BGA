// This script helps generate direct invoice links for WhatsApp messages
// You can run this in the browser console or integrate it with your main application

// Replace with your GitHub Pages URL
const INVOICE_BASE_URL = "https://asadarmam.github.io/wecloud-invoices/view.html?id=";

// Function to generate a WhatsApp message with invoice link
function generateInvoiceMessage(invoice, user) {
  // Format the invoice date
  const invoiceDate = formatDate(invoice.date);
  const dueDate = formatDate(invoice.dueDate);
  
  // Generate the direct link to the invoice
  const invoiceLink = `${INVOICE_BASE_URL}${invoice.id}`;
  
  // Create the message template
  const message = `Dear ${user.name},

Your invoice for WeCloud Internet Services is ready.

*Invoice #:* ${invoice.id}
*Amount:* PKR ${invoice.amount}
*Due Date:* ${dueDate}

View your invoice online: ${invoiceLink}

Thank you for choosing WeCloud Internet Services!`;

  return message;
}

// Function to format a date
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

// Function to generate a payment reminder message
function generatePaymentReminderMessage(invoice, user) {
  // Format the invoice date
  const dueDate = formatDate(invoice.dueDate);
  
  // Generate the direct link to the invoice
  const invoiceLink = `${INVOICE_BASE_URL}${invoice.id}`;
  
  // Create the reminder message template
  const message = `Dear ${user.name},

This is a friendly reminder that your invoice #${invoice.id} for PKR ${invoice.amount} is due on ${dueDate}.

View your invoice and make payment: ${invoiceLink}

If you have already made the payment, please disregard this message.

Thank you for your business!
WeCloud Internet Services`;

  return message;
}

// Example usage:
// 1. First, get the invoice and user data from Firestore
// 2. Then generate the message with the link
/*
async function sendInvoiceLink(invoiceId) {
  try {
    // Get invoice data
    const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      console.error('Invoice not found');
      return;
    }
    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() };
    
    // Get user data
    const userDoc = await db.collection('users').doc(invoice.userId).get();
    if (!userDoc.exists) {
      console.error('User not found');
      return;
    }
    const user = { id: userDoc.id, ...userDoc.data() };
    
    // Generate the message with invoice link
    const message = generateInvoiceMessage(invoice, user);
    
    // Send the message via WhatsApp API or copy to clipboard
    console.log(message);
    
    // You can integrate with your WhatsApp sending function here
    // sendWhatsAppMessage(user.phone, message);
  } catch (error) {
    console.error('Error generating invoice link:', error);
  }
}
*/

// Export functions if using as a module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateInvoiceMessage,
    generatePaymentReminderMessage,
    formatDate
  };
} 