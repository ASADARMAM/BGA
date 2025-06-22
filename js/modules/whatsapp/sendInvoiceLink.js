// Import required modules
import { sendWhatsAppMessage } from '../../whatsapp.js';
import { getInvoiceById } from '../invoices/getInvoice.js';
import { getUserById } from '../../users.js';
import { db, doc, getDoc, setDoc, collection, query, where, getDocs } from '../../firebaseConfig.js';

// Replace with your GitHub Pages URL
const INVOICE_BASE_URL = "https://asadarmam.github.io/wecloud-invoices/view.html?id=";

// Get templates from Firestore
async function getMessageTemplate(type) {
  try {
    const templateDoc = await getDoc(doc(db, "message_templates", type));
    if (templateDoc.exists()) {
      return templateDoc.data().content;
    }
    return defaultTemplates[type] || defaultTemplates.due;
  } catch (error) {
    console.warn('Error fetching template from Firestore:', error);
    return defaultTemplates[type] || defaultTemplates.due;
  }
}

// Save template to Firestore
async function saveMessageTemplate(type, content) {
  try {
    await setDoc(doc(db, "message_templates", type), {
      content,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error saving template to Firestore:', error);
    return false;
  }
}

// Default templates as fallback
const defaultTemplates = {
  paid: `*✨ PAYMENT CONFIRMATION ✨*
━━━━━━━━━━━━━━━━━━━━━

Dear *{customerName}*,

This is to confirm that we have successfully received your payment. Thank you!

*🧾 PAYMENT DETAILS*
━━━━━━━━━━━━
• *Invoice ID:* #{invoiceId}
• *Package:* {packageName}
• *Amount Paid:* Rs. {amount}
• *Period:* {billingPeriod}
• *Status:* ✅ *PAID*

You can view your receipt here:
{invoiceLink}

We appreciate your prompt payment and value your business.

Best regards,
WeCloud Internet Services 🚀`,

  due: `*📋 INVOICE NOTIFICATION*
━━━━━━━━━━━━━━━━━━━━━

Dear *{customerName}*,

Your invoice has been generated.

*📊 INVOICE DETAILS*
━━━━━━━━━━━━
• *Invoice ID:* {invoiceId}
• *Package:* {packageName}
• *Amount:* Rs. {amount}
• *Due Date:* {dueDate}
• *Period:* {billingPeriod}

*🔗 VIEW INVOICE*
━━━━━━━━━━━━
Click here to view your invoice:
{invoiceLink}

Please make payment before the due date to avoid service interruption.

Thank you for choosing WeCloud Internet Services! 🌟`,

  unpaid: `*⚠️ PAYMENT REMINDER*
━━━━━━━━━━━━━━━━━━━━━

Dear *{customerName}*,

This is a reminder that your invoice #{invoiceId} is OVERDUE.

*📊 INVOICE DETAILS*
━━━━━━━━━━━━
• *Invoice ID:* {invoiceId}
• *Package:* {packageName}
• *Amount Due:* Rs. {amount}
• *Due Date:* {dueDate} (OVERDUE)
• *Period:* {billingPeriod}

*🔗 VIEW INVOICE*
━━━━━━━━━━━━
Click here to view your invoice:
{invoiceLink}

Please make your payment immediately to avoid service interruption.

If you have already made the payment, please share the payment proof with us.

Thank you for your attention to this matter.

WeCloud Internet Services ⚡`
};

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
    
    // Get package data if available
    let packageData = null;
    if (invoice.packageId) {
      try {
        const packageDoc = await getDoc(doc(db, "packages", invoice.packageId));
        if (packageDoc.exists()) {
          packageData = packageDoc.data();
        }
      } catch (err) {
        console.warn(`Could not fetch package data: ${err.message}`);
      }
    }
    
    // Generate the direct link to the invoice
    const invoiceLink = `${INVOICE_BASE_URL}${invoice.formattedId || invoice.id}`;
    
    // Generate the appropriate message based on invoice status
    const message = await generateWhatsAppMessage(invoice, user, packageData, invoiceLink);
    
    // Send the message via WhatsApp only once
    const result = await sendWhatsAppMessage(user.phone, message);
    
    // Log that the notification has been sent
    if (result.success) {
      await setDoc(notificationLogRef, {
        sentAt: new Date(),
        type: 'invoice_notification',
        status: invoice.status || 'Due'
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
    
    // Get package data if available
    let packageData = null;
    if (invoice.packageId) {
      try {
        const packageDoc = await getDoc(doc(db, "packages", invoice.packageId));
        if (packageDoc.exists()) {
          packageData = packageDoc.data();
        }
      } catch (err) {
        console.warn(`Could not fetch package data: ${err.message}`);
      }
    }
    
    // Generate the direct link to the invoice
    const invoiceLink = `${INVOICE_BASE_URL}${invoice.formattedId || invoice.id}`;
    
    // Force the status to unpaid for reminders
    const reminderInvoice = {...invoice, status: 'unpaid'};
    
    // Generate the unpaid/reminder message
    const message = await generateWhatsAppMessage(reminderInvoice, user, packageData, invoiceLink);
    
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

/**
 * Sends payment confirmation for a paid invoice via WhatsApp
 * @param {string} invoiceId - The ID of the invoice to send confirmation for
 * @returns {Promise<object>} - Result of the operation
 */
export async function sendPaymentConfirmation(invoiceId) {
  try {
    // Get invoice data
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }
    
    // Skip if invoice is not paid
    if (invoice.status !== 'Paid') {
      return {
        success: false,
        message: `Invoice ${invoiceId} is not paid, cannot send payment confirmation`
      };
    }
    
    // Get user data
    const user = await getUserById(invoice.userId);
    if (!user) {
      throw new Error(`User with ID ${invoice.userId} not found`);
    }
    
    // Get package data if available
    let packageData = null;
    if (invoice.packageId) {
      try {
        const packageDoc = await getDoc(doc(db, "packages", invoice.packageId));
        if (packageDoc.exists()) {
          packageData = packageDoc.data();
        }
      } catch (err) {
        console.warn(`Could not fetch package data: ${err.message}`);
      }
    }
    
    // Generate the direct link to the invoice
    const invoiceLink = `${INVOICE_BASE_URL}${invoice.formattedId || invoice.id}`;
    
    // Generate the paid confirmation message
    const message = await generateWhatsAppMessage(invoice, user, packageData, invoiceLink);
    
    // Send the message via WhatsApp
    const result = await sendWhatsAppMessage(user.phone, message);
    
    return {
      success: true,
      message: `Payment confirmation sent to ${user.name} (${user.phone})`,
      result
    };
  } catch (error) {
    console.error('Error sending payment confirmation:', error);
    return {
      success: false,
      message: `Failed to send payment confirmation: ${error.message}`
    };
  }
}

/**
 * Generate a WhatsApp message for an invoice based on its status
 * @param {Object} invoice - The invoice data
 * @param {Object} user - The user data
 * @param {Object} packageData - The package data
 * @param {string} invoiceLink - The link to view the invoice
 * @returns {Promise<string>} - The formatted WhatsApp message
 */
async function generateWhatsAppMessage(invoice, user, packageData, invoiceLink) {
  // Determine status and template
  const status = (invoice.status || '').toLowerCase();
  let templateType = 'due'; // default
  
  if (status === 'paid') {
    templateType = 'paid';
  } else if (status === 'unpaid' || status === 'overdue') {
    templateType = 'unpaid';
  }
  
  // Get the template from Firestore
  let template = await getMessageTemplate(templateType);
  
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
    .replace(/{customerName}/g, user.name || 'Valued Customer')
    .replace(/{userName}/g, user.name || 'Valued Customer')
    .replace(/{invoiceId}/g, invoice.formattedId || invoice.id)
    .replace(/{amount}/g, invoice.amount.toFixed(2))
    .replace(/{invoiceAmount}/g, invoice.amount.toFixed(2))
    .replace(/{packageName}/g, (packageData && packageData.name) || invoice.packageName || 'Internet Service')
    .replace(/{packageSpeed}/g, (packageData && packageData.speed) || '')
    .replace(/{billingPeriod}/g, periodText)
    .replace(/{invoiceMonth}/g, periodText.split('/')[0] || '')
    .replace(/{invoiceYear}/g, periodText.split('/')[1] || '')
    .replace(/{dueDate}/g, formatDate(invoice.dueDate))
    .replace(/{invoiceLink}/g, invoiceLink);
}

// Helper function to format date
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  
  let date;
  if (timestamp.seconds) {
    // Handle Firestore timestamp
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    date = new Date(timestamp);
  }
  
  if (isNaN(date.getTime())) return 'N/A';
  
  // Format as Month DD, YYYY (e.g., January 15, 2023)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Export the save function so it can be used from messages.html
export { saveMessageTemplate }; 
