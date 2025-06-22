// Import required modules
import { sendWhatsAppMessage } from '../../whatsapp.js';
import { getInvoiceById } from '../invoices/getInvoice.js';
import { getUserById } from '../../users.js';
import { db, doc, getDoc, setDoc } from '../../firebaseConfig.js';

// Replace with your GitHub Pages URL
const INVOICE_BASE_URL = "https://asadarmam.github.io/wecloud-invoices/view.html?id=";

/**
 * Sends an invoice link to a customer via WhatsApp
 * @param {string} invoiceId - The ID of the invoice to send
 * @returns {Promise<object>} - Result of the operation
 */
export async function sendInvoiceLink(invoiceId) {
  try {
    // Prevent duplicate notifications
    const notificationLogRef = doc(db, 'notification_logs', `invoice_${invoiceId}`);
    const notificationLogSnap = await getDoc(notificationLogRef);

    if (notificationLogSnap.exists()) {
      console.log(`Notification for invoice ${invoiceId} already sent. Skipping.`);
      return {
        success: false,
        message: `Notification for invoice ${invoiceId} has already been sent.`
      };
    }

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
    
    // Format the invoice ID properly
    const invoiceId = invoice.formattedId || invoice.id;
    
    // Create a single consolidated message template
    const message = `*📋 INVOICE NOTIFICATION*
━━━━━━━━━━━━━━━━━━━━━

Dear *${user.name}*,

Your invoice has been generated.

*📊 INVOICE DETAILS*
━━━━━━━━━━━━
• *Invoice ID:* ${invoiceId}
• *Amount:* PKR ${invoice.amount}.00
• *Due Date:* ${dueDate}

*🔗 VIEW INVOICE*
━━━━━━━━━━━━
Click here to view your invoice:
${invoiceLink}

Please make payment before the due date to avoid service interruption.

Thank you for choosing WeCloud Internet Services! 🌟`;
    
    // Send the message via WhatsApp only once
    const result = await sendWhatsAppMessage(user.phone, message);
    
    // Log that the notification has been sent
    if (result.success) {
      await setDoc(notificationLogRef, {
        sentAt: new Date(),
        type: 'invoice_notification'
      });
    }
    
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
    
    // Format the invoice ID properly
    const invoiceId = invoice.formattedId || invoice.id;
    
    // Create a single consolidated reminder message
    const message = `*⚠️ PAYMENT REMINDER*
━━━━━━━━━━━━━━━━━━━━━

Dear *${user.name}*,

This is a friendly reminder that your invoice is due soon.

*📊 INVOICE DETAILS*
━━━━━━━━━━━━
• *Invoice #:* ${invoiceId}
• *Amount Due:* PKR ${invoice.amount}.00
• *Due Date:* ${dueDate}

*🔗 VIEW INVOICE*
━━━━━━━━━━━━
Click here to view your invoice:
${invoiceLink}

If you have already made the payment, please disregard this message.

Thank you for your business!
WeCloud Internet Services 🌟`;
    
    // Send the message via WhatsApp only once
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
  
  // Format as DD/MM/YYYY as shown in the example
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
} 