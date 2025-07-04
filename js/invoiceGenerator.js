// Import required modules
import { getPackageById } from './packages.js';
import { getUserById } from './users.js';
import {
    db,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    getDoc,
    doc,
    setDoc,
    runTransaction,
    increment
} from './firebaseConfig.js';

// Constants for invoice generation
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1100;
// Use relative path for logo
const COMPANY_LOGO = 'assets/logo.svg';
// Fallback text if logo doesn't load
const COMPANY_NAME = 'WeCloud Internet Services';

// Cache for loaded images
const imageCache = new Map();

// Load and cache image with timeout and fallback
async function loadImage(src) {
  if (imageCache.has(src)) {
    return imageCache.get(src);
  }

  return new Promise((resolve, reject) => {
    // Set a timeout for image loading
    const timeoutId = setTimeout(() => {
      console.warn('Image loading timed out:', src);
      reject(new Error('Image loading timed out'));
    }, 5000);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      clearTimeout(timeoutId);
      imageCache.set(src, img);
      resolve(img);
    };
    
    img.onerror = (error) => {
      clearTimeout(timeoutId);
      console.warn('Failed to load image:', src, error);
      reject(new Error(`Failed to load image: ${src}`));
    };
    
    // Add cache-busting query parameter
    const cacheBuster = Date.now();
    img.src = src.includes('?') ? `${src}&_cb=${cacheBuster}` : `${src}?_cb=${cacheBuster}`;
  });
}

// Format currency
function formatCurrency(amount) {
  // Format as Rs1000.00 as shown in the example
  return `Rs${amount}.00`;
}

// Format amount with commas for readability
export function formatAmount(amount) {
    if (amount === null || amount === undefined) {
        return '0';
    }
    // Use Intl.NumberFormat for robust, locale-aware formatting
    return new Intl.NumberFormat('en-IN').format(amount);
}

// Format date
function formatDate(date) {
  try {
    // Handle different date formats
    let dateObj;
    if (!date) {
      dateObj = new Date();
    } else if (typeof date === 'object' && date.seconds) {
      // Handle Firestore timestamp
      dateObj = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      dateObj = new Date();
    }
    
    // Verify date is valid
    if (isNaN(dateObj.getTime())) {
      throw new Error("Invalid date");
    }
    
    // Format as DD/MM/YYYY as shown in the example
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'N/A';
  }
}

// Generate invoice image using HTML5 Canvas
export async function generateInvoiceImage(invoiceData) {
  try {
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    // Set background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Load company logo
    try {
      const logo = await loadImage(COMPANY_LOGO);
      ctx.drawImage(logo, 50, 50, 150, 75);
    } catch (error) {
      console.warn('Failed to load company logo:', error);
      
      // Draw company name as fallback
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#333333';
      ctx.fillText(COMPANY_NAME, 50, 80);
    }

    // Add invoice header
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText('INVOICE', CANVAS_WIDTH - 200, 80);

    // Ensure we have a valid invoice ID
    const invoiceId = invoiceData.formattedId || invoiceData.id || 'N/A';
    
    // Add invoice details
    ctx.font = '14px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText(`Invoice #: ${invoiceId}`, CANVAS_WIDTH - 200, 110);
    ctx.fillText(`Date: ${formatDate(invoiceData.createdAt)}`, CANVAS_WIDTH - 200, 130);
    ctx.fillText(`Due Date: ${formatDate(invoiceData.dueDate)}`, CANVAS_WIDTH - 200, 150);

    // Get user and package details with error handling
    let user, packageData;
    try {
      [user, packageData] = await Promise.all([
        getUserById(invoiceData.userId),
        getPackageById(invoiceData.packageId)
      ]);
    } catch (error) {
      console.error("Error fetching user or package data:", error);
      user = { 
        name: 'Customer',
        address: 'Address not available',
        phone: 'Phone not available'
      };
      packageData = {
        name: 'Package',
        description: 'Description not available',
        price: invoiceData.amount || 0
      };
    }

    // Add billing details
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText('Bill To:', 50, 200);

    ctx.font = '14px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText(user.name || 'Customer', 50, 225);
    ctx.fillText(user.address || 'Address not available', 50, 245);
    ctx.fillText(user.phone || 'Phone not available', 50, 265);
    if (user.email) {
      ctx.fillText(user.email, 50, 285);
    }

    // Add package details
    const startY = 350;
    
    // Table header
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(50, startY - 30, CANVAS_WIDTH - 100, 30);
    
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText('Description', 70, startY - 10);
    ctx.fillText('Amount', CANVAS_WIDTH - 150, startY - 10);

    // Table content
    ctx.font = '14px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText(packageData.name || 'Package', 70, startY + 20);
    ctx.fillText(packageData.description || 'Internet Service', 70, startY + 40);
    ctx.fillText(formatCurrency(invoiceData.amount || 0), CANVAS_WIDTH - 150, startY + 20);

    // Add total
    const totalY = startY + 100;
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(CANVAS_WIDTH - 250, totalY - 30, 200, 30);
    
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText('Total:', CANVAS_WIDTH - 230, totalY - 10);
    ctx.fillText(formatCurrency(invoiceData.amount || 0), CANVAS_WIDTH - 150, totalY - 10);

    // Add payment instructions
    const instructionsY = totalY + 50;
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Payment Instructions:', 50, instructionsY);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('1. Please pay the invoice by the due date.', 50, instructionsY + 25);
    ctx.fillText('2. Include your invoice number in payment reference.', 50, instructionsY + 45);
    ctx.fillText('3. For questions, contact support at support@wecloud.com', 50, instructionsY + 65);

    // Add footer
    ctx.font = '12px Arial';
    ctx.fillStyle = '#999999';
    ctx.fillText('WeCloud Internet Services', 50, CANVAS_HEIGHT - 50);
    ctx.fillText('Thank you for your business!', CANVAS_WIDTH - 200, CANVAS_HEIGHT - 50);

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate invoice image'));
            }
          },
          'image/png',
          1.0
        );
      } catch (error) {
        console.error("Error converting canvas to blob:", error);
        reject(error);
      }
    });
  } catch (error) {
    console.error('Error generating invoice image:', error);
    throw error;
  }
}

/**
 * Generates a unique, sequential, and user-friendly invoice ID.
 * It uses a separate 'invoice_stats' collection to reliably track the count for each month.
 * Example: 202506ZTFY0001
 * @param {number} year - The invoice year (e.g., 2025).
 * @param {number} month - The invoice month (0-indexed, e.g., 5 for June).
 * @returns {Promise<string>} A promise that resolves with the new formatted ID.
 */
export async function generateFormattedInvoiceId(year, month) {
    try {
        // Default to current month/year if not provided
        if (year === undefined || month === undefined) {
            const now = new Date();
            year = now.getFullYear();
            month = now.getMonth();
        }

        // The document ID for our counter will be unique for each month, like "2025_5"
        const statsDocRef = doc(db, "invoice_stats", `${year}_${month}`);
        
        // Use a transaction to ensure atomicity when reading and updating the counter
        const result = await runTransaction(db, async (transaction) => {
            const statsDoc = await transaction.get(statsDocRef);
            
            // If a counter for this month already exists, get the current count. Otherwise, start at 0.
            const currentCount = statsDoc.exists() ? statsDoc.data().totalInvoices || 0 : 0;
            const sequenceNumber = currentCount + 1;
            
            // Update the counter in the transaction
            transaction.set(statsDocRef, { 
                totalInvoices: sequenceNumber,
                lastUpdated: new Date()
            }, { merge: true });
            
            // Format the parts of the ID
            const yearStr = year.toString();
            const monthStr = (month + 1).toString().padStart(2, '0'); // User-facing month is 1-indexed
            const sequenceStr = sequenceNumber.toString().padStart(4, '0');
            const uniquePart = 'ZTFY'; // A constant identifier for your business
            
            return `${yearStr}${monthStr}${uniquePart}${sequenceStr}`;
        });
        
        console.log(`Generated new sequential Invoice ID: ${result}`);
        return result;
    } catch (error) {
        console.error("CRITICAL: Could not generate a new invoice ID.", error);
        // Fallback to prevent total failure, though this indicates a serious issue
        return `ID_ERR_${Date.now().toString().slice(-8)}`;
    }
}

// Generate invoice PDF using the canvas image
export async function generateInvoicePdf(invoiceData) {
  try {
    // Check if PDF generation library is available
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      // Load jsPDF dynamically if not available
      await loadJsPDF();
    }
    
    // Get the invoice image as a blob
    const imageBlob = await generateInvoiceImage(invoiceData);
    
    // Convert blob to base64 data URL
    const base64Image = await blobToBase64(imageBlob);
    
    // Create a new PDF document
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Add the invoice image to the PDF
    const imgWidth = doc.internal.pageSize.getWidth();
    const imgHeight = (CANVAS_HEIGHT * imgWidth) / CANVAS_WIDTH;
    
    doc.addImage(base64Image, 'PNG', 0, 0, imgWidth, imgHeight);
    
    // Generate PDF blob
    const pdfBlob = doc.output('blob');
    
    // Convert to base64 for WhatsApp sending
    const base64Pdf = await blobToBase64(pdfBlob);
    
    return {
      blob: pdfBlob,
      base64: base64Pdf,
      filename: `Invoice-${invoiceData.id}.pdf`
    };
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw error;
  }
}

// Helper function to convert blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper function to dynamically load jsPDF
async function loadJsPDF() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load jsPDF library'));
    document.head.appendChild(script);
  });
} 