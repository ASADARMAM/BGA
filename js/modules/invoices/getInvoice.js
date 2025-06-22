// Import required modules
import { db, doc, getDoc } from '../../firebaseConfig.js';

/**
 * Get invoice by ID
 * @param {string} invoiceId - The ID of the invoice to retrieve
 * @returns {Promise<object|null>} - The invoice object or null if not found
 */
export async function getInvoiceById(invoiceId) {
  try {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    
    if (!invoiceSnap.exists()) {
      console.warn(`Invoice with ID ${invoiceId} not found`);
      return null;
    }
    
    return {
      id: invoiceSnap.id,
      ...invoiceSnap.data()
    };
  } catch (error) {
    console.error(`Error getting invoice ${invoiceId}:`, error);
    throw error;
  }
} 