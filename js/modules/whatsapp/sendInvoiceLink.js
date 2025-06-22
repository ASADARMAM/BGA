// Import required modules
import { sendWhatsAppMessage } from '../../whatsapp.js';
import { getInvoiceById } from '../invoices/getInvoice.js';
import { getUserById } from '../../users.js';

// Replace with your GitHub Pages URL
const INVOICE_BASE_URL = "https://asadarmam.github.io/wecloud-invoices/view.html?id=";

/**
 * Sends an invoice link to a customer via WhatsApp
 * @param {string} invoiceId - The ID of the invoice to send
 * @returns {Promise<object>} - Result of the operation
 */
export async function sendInvoiceLink(invoiceId) {
  try {
    // Get invoice data
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }
    
    // Get user data
    const user = await getUserById(invoice.userId);
    if (!user) {
      throw new Error(`User with ID ${invoice.userId} not found`);
    }
    
    // Format dates
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
    
    // Send the message via WhatsApp
    const result = await sendWhatsAppMessage(user.phone, message);
    
    return {
      success: true,
      message: `Invoice link sent to ${user.name} (${user.phone})`,
      result
    };
  } catch (error) {
    console.error('Error sending invoice link:', error);
    return {
      success: false,
      message: `Failed to send invoice link: ${error.message}`
    };
  }
}

/**
 * Sends a payment reminder for an invoice via WhatsApp
 * @param {string} invoiceId - The ID of the invoice to send a reminder for
 * @returns {Promise<object>} - Result of the operation
 */
export async function sendPaymentReminder(invoiceId) {
  try {
    // Get invoice data
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }
    
    // Skip if invoice is already paid
    if (invoice.status === 'Paid') {
      return {
        success: false,
        message: `Invoice ${invoiceId} is already paid, no reminder needed`
      };
    }
    
    // Get user data
    const user = await getUserById(invoice.userId);
    if (!user) {
      throw new Error(`User with ID ${invoice.userId} not found`);
    }
    
    // Format dates
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
    
    // Send the message via WhatsApp
    const result = await sendWhatsAppMessage(user.phone, message);
    
    return {
      success: true,
      message: `Payment reminder sent to ${user.name} (${user.phone})`,
      result
    };
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    return {
      success: false,
      message: `Failed to send payment reminder: ${error.message}`
    };
  }
}

// Helper function to format date
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