// Invoices management module
import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, where, getDoc, orderBy, limit, startAfter, writeBatch, runTransaction, serverTimestamp, increment, setDoc } from './firebaseConfig.js';
import { sendInvoiceNotification, sendPaymentReminder, sendInvoicePdf } from './whatsapp.js';
import { getUserById } from './users.js';
import { getPackageById } from './packages.js';
import { generateInvoiceImage, generateFormattedInvoiceId, generateInvoicePdf } from './invoiceGenerator.js';

// Collection references with sharding
const invoicesCollection = collection(db, "invoices");
const invoiceStatsCollection = collection(db, "invoice_stats");

// Shard collections for better performance with large datasets
function getInvoiceShardCollection(year, month) {
  return collection(db, `invoices_${year}_${month}`);
}

// Constants for optimization
const INVOICE_BATCH_SIZE = 20; // Increased from 5 to 20
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PROCESSING_TIMEOUT = 60000; // 60 seconds timeout for each batch
const MAX_CONCURRENT_OPERATIONS = 10; // Increased from 5 to 10
const MAX_BATCH_SIZE = 500; // Maximum documents in a Firestore batch

// Enhanced cache structure
const cache = {
  invoices: {
    data: new Map(), // Map of page number to invoice data
    timestamp: null,
    lastVisible: null,
    totalInvoices: 0,
    prefetchedPages: new Set()
  },
  monthlyStats: {
    data: new Map(), // Map of month-year to statistics
    timestamp: null
  }
};

/**
 * Add a new invoice with sharding support
 * @param {object} invoiceData - Invoice data object
 * @param {boolean} sendNotification - Whether to send WhatsApp notification
 * @returns {Promise} - Promise with invoice document reference
 */
export async function addInvoice(invoiceData, sendNotification = true) {
  try {
    // Add timestamps and default status
    invoiceData.createdAt = serverTimestamp();
    invoiceData.status = invoiceData.status || 'Due';

    // Ensure month and year are set correctly from the due date
    const dueDate = new Date(invoiceData.dueDate);
    invoiceData.month = dueDate.getMonth();
    invoiceData.year = dueDate.getFullYear();

    // Generate the user-friendly, formatted ID which will also be the document ID
    const formattedId = await generateFormattedInvoiceId();
    invoiceData.formattedId = formattedId;

    // Use the formattedId as the document ID in Firestore
    const invoiceDocRef = doc(invoicesCollection, formattedId);
    await setDoc(invoiceDocRef, invoiceData);
    console.log("Invoice added with custom ID: ", formattedId);

    // Update invoice stats atomically
    try {
      const statsRef = doc(invoiceStatsCollection, `${invoiceData.year}_${invoiceData.month}`);
      await runTransaction(db, async (transaction) => {
        const statsDoc = await transaction.get(statsRef);
        
        if (!statsDoc.exists()) {
          transaction.set(statsRef, {
            totalInvoices: 1,
            totalAmount: invoiceData.amount || 0,
            paidInvoices: 0,
            paidAmount: 0,
            year: invoiceData.year,
            month: invoiceData.month,
            lastUpdated: serverTimestamp()
          });
        } else {
          transaction.update(statsRef, {
            totalInvoices: increment(1),
            totalAmount: increment(invoiceData.amount || 0),
            lastUpdated: serverTimestamp()
          });
        }
      });
    } catch (statsError) {
      console.error("Error updating invoice stats:", statsError);
      // Continue execution - stats update failure shouldn't block invoice creation
    }
    
    // Send WhatsApp notification if requested
    if (sendNotification) {
      try {
        // Get user details
        const user = await getUserById(invoiceData.userId);
        
        // Get package details
        const packageInfo = await getPackageById(invoiceData.packageId);
        
        // Prepare invoice data for notification
        const invoiceForNotification = {
          id: formattedId,
          amount: invoiceData.amount,
          dueDate: invoiceData.dueDate,
          packageName: packageInfo.name,
          month: invoiceData.month,
          year: invoiceData.year
        };
        
        // Send notification
        await sendInvoiceNotification(user, invoiceForNotification);
      } catch (error) {
        console.error("Error sending invoice notification: ", error);
        // Don't throw error here, as invoice was already created
      }
    }
    
    return invoiceDocRef;
  } catch (error) {
    console.error("Error adding invoice: ", error);
    throw error;
  }
}

/**
 * Get all invoices across all shards
 * @returns {Promise} - Promise with array of invoices
 */
// This function is being removed to prevent duplication. 
// The paginated version `getInvoices(filters, lastVisible)` should be used instead.

/**
 * Update an invoice
 * @param {string} invoiceId - Invoice document ID
 * @param {object} invoiceData - Updated invoice data
 * @returns {Promise} - Promise with update result
 */
export async function updateInvoice(invoiceId, invoiceData) {
  try {
    // Add update timestamp
    invoiceData.updatedAt = new Date();
    
    const invoiceRef = doc(db, "invoices", invoiceId);
    await updateDoc(invoiceRef, invoiceData);
    console.log("Invoice updated: ", invoiceId);
    return true;
  } catch (error) {
    console.error("Error updating invoice: ", error);
    throw error;
  }
}

/**
 * Delete an invoice
 * @param {string} invoiceId - Invoice document ID
 * @returns {Promise} - Promise with delete result
 */
export async function deleteInvoice(invoiceId) {
  try {
    const invoiceRef = doc(db, "invoices", invoiceId);
    await deleteDoc(invoiceRef);
    console.log("Invoice deleted: ", invoiceId);
    return true;
  } catch (error) {
    console.error("Error deleting invoice: ", error);
    throw error;
  }
}

/**
 * Get a single invoice by ID
 * @param {string} invoiceId - Invoice document ID
 * @returns {Promise} - Promise with invoice data
 */
export async function getInvoiceById(invoiceId) {
  try {
    const invoiceRef = doc(db, "invoices", invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    
    if (invoiceSnap.exists()) {
      return {
        id: invoiceSnap.id,
        ...invoiceSnap.data()
      };
    } else {
      console.log("No such invoice!");
      return null;
    }
  } catch (error) {
    console.error("Error getting invoice: ", error);
    throw error;
  }
}

/**
 * Get invoices by user ID
 * @param {string} userId - User ID
 * @returns {Promise} - Promise with array of invoices
 */
export async function getInvoicesByUser(userId) {
  try {
    const q = query(
      invoicesCollection,
      where("userId", "==", userId),
      orderBy("dueDate", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const invoices = [];
    
    querySnapshot.forEach((doc) => {
      invoices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return invoices;
  } catch (error) {
    console.error("Error getting user invoices: ", error);
    throw error;
  }
}

/**
 * Get overdue invoices
 * @returns {Promise} - Promise with array of overdue invoices
 */
export async function getOverdueInvoices() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const q = query(
      invoicesCollection,
      where("dueDate", "<", today),
      where("status", "==", "Due")
    );
    
    const querySnapshot = await getDocs(q);
    const invoices = [];
    
    querySnapshot.forEach((doc) => {
      invoices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return invoices;
  } catch (error) {
    console.error("Error getting overdue invoices: ", error);
    throw error;
  }
}

/**
 * Send payment reminders for overdue invoices
 * @param {string} reminderType - Type of reminder: 'all', 'overdue', 'due', 'upcoming'
 * @returns {Promise} - Promise with results
 */
export async function sendPaymentReminders(reminderType = 'overdue') {
  try {
    let invoices = [];
    // Only get invoices with status 'Overdue'
    const overdueQuery = query(
      invoicesCollection,
      where("status", "==", "Overdue")
    );
    const overdueSnapshot = await getDocs(overdueQuery);
    overdueSnapshot.forEach((doc) => {
      invoices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    const results = [];
    
    for (const invoice of invoices) {
      try {
        // Get user details
        const user = await getUserById(invoice.userId);
        // Get package details
        const packageInfo = await getPackageById(invoice.packageId);
        // Get current month and year if not available in invoice
        const currentDate = new Date();
        const month = invoice.month !== undefined ? invoice.month : currentDate.getMonth();
        const year = invoice.year !== undefined ? invoice.year : currentDate.getFullYear();
        // Prepare invoice data for notification
        const invoiceForReminder = {
          id: invoice.id,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          packageName: packageInfo.name,
          month: month,
          year: year
        };
        // Send reminder
        await sendPaymentReminder(user, invoiceForReminder);
        results.push({
          invoiceId: invoice.id,
          userId: invoice.userId,
          userName: user.name,
          success: true
        });
      } catch (error) {
        console.error(`Error sending reminder for invoice ${invoice.id}:`, error);
        results.push({
          invoiceId: invoice.id,
          userId: invoice.userId,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      total: invoices.length,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    };
  } catch (error) {
    console.error("Error sending payment reminders: ", error);
    throw error;
  }
}

/**
 * Creates a real-time listener for invoices.
 * @param {object} filters - Filtering options (status, month, year).
 * @param {function} callback - The function to call with the invoices data.
 * @returns {function} - The unsubscribe function for the listener.
 */
export function listenToInvoices(filters, callback) {
    let q = collection(db, 'invoices');
    let queryConstraints = [];

    // Filtering
    if (filters.status && filters.status !== 'all') {
        queryConstraints.push(where('status', '==', filters.status));
    }
     if (filters.month && filters.month !== 'all') {
        const year = filters.year || new Date().getFullYear();
        const startDate = new Date(year, parseInt(filters.month), 1);
        const endDate = new Date(year, parseInt(filters.month) + 1, 1);
        queryConstraints.push(where('dueDate', '>=', startDate));
        queryConstraints.push(where('dueDate', '<', endDate));
    } else if (filters.year && filters.year !== 'all') {
        const startDate = new Date(filters.year, 0, 1);
        const endDate = new Date(parseInt(filters.year) + 1, 0, 1);
        queryConstraints.push(where('dueDate', '>=', startDate));
        queryConstraints.push(where('dueDate', '<', endDate));
    }

    // Ordering and limiting for performance
    queryConstraints.push(orderBy('dueDate', 'desc'));
    queryConstraints.push(limit(50)); // Listen to the 50 most recent invoices

    q = query(q, ...queryConstraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(invoices);
    }, (error) => {
        console.error("Error listening to invoices:", error);
        // Optionally, you could have a callback for errors as well
    });

    return unsubscribe;
}

/**
 * Get total revenue (sum of all paid invoices)
 * @returns {Promise} - Promise with total revenue
 */
export async function getTotalRevenue() {
  try {
    const q = query(
      invoicesCollection,
      where("status", "==", "Paid")
    );
    
    const querySnapshot = await getDocs(q);
    let totalRevenue = 0;
    
    querySnapshot.forEach((doc) => {
      const invoiceData = doc.data();
      totalRevenue += parseFloat(invoiceData.amount || 0);
    });
    
    return totalRevenue;
  } catch (error) {
    console.error("Error calculating total revenue: ", error);
    throw error;
  }
}

// Get paginated invoices with caching - THIS IS BEING REMOVED
// The new getInvoices function at the end of the file provides better filtering and pagination
/*
export async function getPaginatedInvoices(page = 1, filters = {}) {
  try {
    const cacheKey = JSON.stringify({ page, filters });
    
    // Check cache first
    if (cache.invoices.data.has(cacheKey) && 
        cache.invoices.timestamp && 
        Date.now() - cache.invoices.timestamp < CACHE_DURATION) {
      return cache.invoices.data.get(cacheKey);
    }

    // Build query based on filters
    const invoicesRef = collection(db, "invoices");
    let queryConstraints = [orderBy("createdAt", "desc")];

    if (filters.status) {
      queryConstraints.push(where("status", "==", filters.status));
    }
    if (filters.month) {
      queryConstraints.push(where("month", "==", filters.month));
    }
    if (filters.year) {
      queryConstraints.push(where("year", "==", filters.year));
    }

    let queryRef;
    if (page === 1) {
      queryRef = query(
        invoicesRef,
        ...queryConstraints,
        limit(INVOICE_BATCH_SIZE)
      );
    } else if (cache.invoices.lastVisible) {
      queryRef = query(
        invoicesRef,
        ...queryConstraints,
        startAfter(cache.invoices.lastVisible),
        limit(INVOICE_BATCH_SIZE)
      );
    } else {
      throw new Error("Cannot paginate without last document reference");
    }

    const snapshot = await getDocs(queryRef);
    
    if (!snapshot.empty) {
      cache.invoices.lastVisible = snapshot.docs[snapshot.docs.length - 1];
    }

    const invoices = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Cache the results
    cache.invoices.data.set(cacheKey, invoices);
    cache.invoices.timestamp = Date.now();

    return invoices;
  } catch (error) {
    console.error("Error getting paginated invoices:", error);
    throw error;
  }
}
*/

// Process invoices in optimized batches
async function processBatch(users, options = {}) {
  const results = {
    success: 0,
    failed: 0,
    details: []
  };

  try {
    // Process users in smaller chunks for better memory management
    const chunks = [];
    for (let i = 0; i < users.length; i += MAX_CONCURRENT_OPERATIONS) {
      chunks.push(users.slice(i, i + MAX_CONCURRENT_OPERATIONS));
    }

    for (const chunk of chunks) {
      await Promise.race([
        Promise.all(chunk.map(async (user) => {
          try {
            const packageData = options.packagesMap.get(user.packageId);
            if (!packageData) {
              throw new Error("Package not found");
            }

            // Generate invoice data
            const invoiceData = await generateInvoiceData(user, packageData, options);
            
            // Add invoice to database
            const docRef = await addDoc(collection(db, "invoices"), invoiceData);

            // Process notifications in parallel if needed
            if (options.sendNotifications) {
              await Promise.all([
                generateAndSendInvoice(user, invoiceData),
                updateMonthlyStats(invoiceData)
              ]);
            }

            results.success++;
            results.details.push({
              userId: user.id,
              userName: user.name,
              invoiceId: invoiceData.formattedId,
              success: true
            });
          } catch (error) {
            console.error(`Error processing invoice for user ${user.id}:`, error);
            results.failed++;
            results.details.push({
              userId: user.id,
              userName: user.name,
              success: false,
              error: error.message
            });
          }
        })),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Batch processing timeout')), PROCESSING_TIMEOUT)
        )
      ]);

      // Add small delay between chunks to prevent system overload
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error("Batch processing error:", error);
    // Mark remaining users as failed
    users.forEach(user => {
      if (!results.details.find(d => d.userId === user.id)) {
        results.failed++;
        results.details.push({
          userId: user.id,
          userName: user.name,
          success: false,
          error: error.message
        });
      }
    });
  }

  return results;
}

// Generate invoice data
async function generateInvoiceData(user, packageData, options) {
  try {
    // Generate formatted invoice ID
    const formattedId = await generateFormattedInvoiceId();
    
    // Ensure the ID is valid
    if (!formattedId) {
      throw new Error("Failed to generate invoice ID");
    }
    
    console.log("Generated invoice ID:", formattedId); // Debug log
    
    return {
      formattedId,
      id: formattedId, // Add id as a fallback
      userId: user.id,
      packageId: user.packageId,
      amount: packageData.price,
      dueDate: options.dueDate,
      status: 'Due',
      createdAt: new Date(),
      month: options.currentMonth,
      year: options.currentYear
    };
  } catch (error) {
    console.error("Error generating invoice data:", error);
    throw error;
  }
}

// Generate and send an invoice via WhatsApp
async function generateAndSendInvoice(user, invoiceData) {
  try {
    // Get package details to include in invoice
    const packageData = await getPackageById(invoiceData.packageId);
    
    // Merge package details into invoice data
    const fullInvoiceData = {
      ...invoiceData,
      packageName: packageData.name,
      packageSpeed: packageData.speed,
      packagePrice: packageData.price
    };
    
    // Generate the PDF invoice
    const pdfData = await generateInvoicePdf(fullInvoiceData);
    
    // Send the PDF via WhatsApp
    return await sendInvoicePdf(user, fullInvoiceData, pdfData.base64);
  } catch (error) {
    console.error("Error generating and sending invoice:", error);
    throw error;
  }
}

// Update monthly statistics
async function updateMonthlyStats(invoiceData) {
  try {
    const key = `${invoiceData.month}-${invoiceData.year}`;
    const stats = cache.monthlyStats.data.get(key) || {
      totalInvoices: 0,
      totalAmount: 0,
      paidInvoices: 0,
      paidAmount: 0
    };

    stats.totalInvoices++;
    stats.totalAmount += parseFloat(invoiceData.amount);

    cache.monthlyStats.data.set(key, stats);
    cache.monthlyStats.timestamp = Date.now();
  } catch (error) {
    console.error("Error updating monthly stats:", error);
  }
}

/**
 * Generate invoices for all users with optimized batch processing
 * @param {object} options - Options for invoice generation
 * @returns {Promise} - Promise with generation results
 */
export async function generateInvoicesForAllUsers(options = {}) {
  try {
    const startTime = Date.now();
    console.log("Starting invoice generation for all users...");
    
    // Default options
    const defaultOptions = {
      batchSize: INVOICE_BATCH_SIZE,
      maxConcurrent: MAX_CONCURRENT_OPERATIONS,
      dryRun: false,
      sendNotifications: true,
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
      processingTimeout: PROCESSING_TIMEOUT
    };
    
    // Merge options
    const mergedOptions = { ...defaultOptions, ...options };
    console.log("Using options:", mergedOptions);
    
    // Get all users
    const { users } = await import('./users.js');
    const allUsers = await users.getUsers();
    
    if (!allUsers || allUsers.length === 0) {
      console.warn("No users found!");
      return { success: false, message: "No users found" };
    }
    
    console.log(`Found ${allUsers.length} users to process`);
    
    // Split users into batches
    const batches = [];
    for (let i = 0; i < allUsers.length; i += mergedOptions.batchSize) {
      batches.push(allUsers.slice(i, i + mergedOptions.batchSize));
    }
    
    console.log(`Split into ${batches.length} batches of ${mergedOptions.batchSize} users each`);
    
    // Process batches with controlled concurrency
    let completedBatches = 0;
    let failedBatches = 0;
    let totalInvoicesGenerated = 0;
    let totalErrors = 0;
    
    // Process batches with semaphore pattern for concurrency control
    let activeBatches = 0;
    const batchResults = [];
    
    // Create a queue of batch processing promises
    const queue = batches.map((batch, index) => async () => {
      while (activeBatches >= mergedOptions.maxConcurrent) {
        // Wait for some active batches to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      activeBatches++;
      console.log(`Starting batch ${index + 1}/${batches.length} (${activeBatches} active)`);
      
      try {
        // Add timeout to each batch
        const batchPromise = processBatch(batch, mergedOptions);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Batch ${index + 1} timed out after ${mergedOptions.processingTimeout}ms`)), 
            mergedOptions.processingTimeout);
        });
        
        // Race between batch completion and timeout
        const result = await Promise.race([batchPromise, timeoutPromise]);
        
        completedBatches++;
        totalInvoicesGenerated += result.invoicesGenerated || 0;
        totalErrors += result.errors || 0;
        
        console.log(`Completed batch ${index + 1}/${batches.length}: ${result.invoicesGenerated} invoices, ${result.errors} errors`);
        batchResults.push(result);
      } catch (error) {
        console.error(`Batch ${index + 1} failed:`, error);
        failedBatches++;
        batchResults.push({ 
          success: false, 
          error: error.message, 
          invoicesGenerated: 0,
          errors: 1
        });
      } finally {
        activeBatches--;
      }
    });
    
    // Execute the queue with controlled concurrency
    const executeQueue = async () => {
      for (const task of queue) {
        await task();
      }
    };
    
    await executeQueue();
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`Invoice generation completed in ${duration.toFixed(2)} seconds`);
    console.log(`Generated ${totalInvoicesGenerated} invoices with ${totalErrors} errors`);
    
    return {
      success: true,
      completedBatches,
      failedBatches,
      totalBatches: batches.length,
      totalInvoicesGenerated,
      totalErrors,
      duration,
      results: batchResults
    };
  } catch (error) {
    console.error("Error generating invoices for all users:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Reset cache
export function resetCache() {
  cache.invoices = {
    data: new Map(),
    timestamp: null,
    lastVisible: null,
    totalInvoices: 0,
    prefetchedPages: new Set()
  };
  cache.monthlyStats = {
    data: new Map(),
    timestamp: null
  };
}

// Get invoices with pagination and filtering
export async function getInvoices(filters = {}, lastVisible) {
    let q = collection(db, 'invoices');
    let queryConstraints = [];

    // Filtering
    if (filters.status && filters.status !== 'all') {
        queryConstraints.push(where('status', '==', filters.status));
    }
    if (filters.userId) {
        queryConstraints.push(where('userId', '==', filters.userId));
    }
    if (filters.month && filters.month !== 'all') {
        const year = filters.year || new Date().getFullYear();
        const startDate = new Date(year, parseInt(filters.month), 1);
        const endDate = new Date(year, parseInt(filters.month) + 1, 1);
        queryConstraints.push(where('dueDate', '>=', startDate));
        queryConstraints.push(where('dueDate', '<', endDate));
    } else if (filters.year && filters.year !== 'all') {
        const startDate = new Date(filters.year, 0, 1);
        const endDate = new Date(parseInt(filters.year) + 1, 0, 1);
        queryConstraints.push(where('dueDate', '>=', startDate));
        queryConstraints.push(where('dueDate', '<', endDate));
    }

    // Ordering
    queryConstraints.push(orderBy('dueDate', 'desc'));

    // Pagination
    if (lastVisible) {
        queryConstraints.push(startAfter(lastVisible));
    }
    queryConstraints.push(limit(15)); // Fetch 15 invoices per page

    q = query(q, ...queryConstraints);

    const snapshot = await getDocs(q);
    const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return {
        invoices,
        lastVisible: snapshot.docs[snapshot.docs.length - 1]
    };
} 