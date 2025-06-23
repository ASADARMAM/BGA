// Invoices management module - Simplified and Corrected
import {
    db,
    collection,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    runTransaction,
    serverTimestamp,
    increment,
    getDocs,
    getDoc,
    startAfter,
    limit,
    writeBatch
} from './firebaseConfig.js';
import {
    sendInvoiceNotification,
    sendPaymentReminder,
    sendDueReminder
} from './js/whatsapp.js';
import {
    getUserById
} from './users.js';
import {
    getPackageById
} from './packages.js';
import {
    generateFormattedInvoiceId
} from './invoiceGenerator.js';

// --- Firestore Collection References ---
const invoicesCollection = collection(db, "invoices");
const invoiceStatsCollection = collection(db, "invoice_stats");

/**
 * Adds a new invoice to the database, using the formatted ID as the document ID.
 * It also atomically updates the invoice counter for the month.
 * @param {object} invoiceData - The core data for the new invoice.
 * @param {boolean} sendNotification - Flag to control sending WhatsApp notifications.
 * @returns {Promise<string>} A promise that resolves with the new invoice's ID.
 */
export async function addInvoice(invoiceData, sendNotification = true) {
    try {
        // 1. Prepare Invoice Data
        invoiceData.createdAt = serverTimestamp();
        
        // Check if due date is already in the past
        const dueDate = new Date(invoiceData.dueDate);
        const today = new Date();
        
        // Reset time parts to compare dates only
        dueDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        console.log(`New invoice date comparison: Due date ${dueDate.toISOString()} vs Today ${today.toISOString()}`);
        
        // If due date is in the past and status is not explicitly set, mark as Overdue
        if (dueDate < today && !invoiceData.status) {
            invoiceData.status = 'Overdue';
            console.log(`New invoice automatically marked as Overdue because due date ${dueDate.toISOString()} is in the past`);
        } else {
            invoiceData.status = invoiceData.status || 'Due';
        }

        invoiceData.month = dueDate.getMonth(); // 0-indexed month
        invoiceData.year = dueDate.getFullYear();

        // 2. Generate the unique, sequential, user-friendly ID
        const formattedId = await generateFormattedInvoiceId(invoiceData.year, invoiceData.month);
        
        // 3. Add the formatted ID to the invoice data
        invoiceData.formattedId = formattedId;
        invoiceData.id = formattedId; // For backwards compatibility

        // 4. Create the invoice document with the formatted ID as the document ID
        const invoiceDocRef = doc(db, "invoices", formattedId);
        await setDoc(invoiceDocRef, invoiceData);

        console.log("Invoice added successfully with ID:", formattedId);

        // 5. Send Notification (if enabled)
        if (sendNotification) {
            try {
                const user = await getUserById(invoiceData.userId);
                const packageInfo = await getPackageById(invoiceData.packageId);
                const notificationData = {
                    id: formattedId,
                    amount: invoiceData.amount,
                    dueDate: invoiceData.dueDate,
                    packageName: packageInfo ? packageInfo.name : 'N/A'
                };
                await sendInvoiceNotification(user, notificationData);
                console.log("Invoice notification sent successfully");
            } catch (notificationError) {
                console.error("Failed to send invoice notification:", notificationError);
                // Continue execution even if notification fails
            }
        }

        return formattedId;

    } catch (error) {
        console.error("Error adding invoice:", error);
        throw error;
    }
}

/**
 * Updates an existing invoice in the database.
 * @param {string} invoiceId - The ID of the invoice to update.
 * @param {object} invoiceData - An object containing the fields to update.
 */
export async function updateInvoice(invoiceId, invoiceData) {
    try {
        const invoiceRef = doc(db, "invoices", invoiceId);
        
        // If we're updating a due date, check if we need to update the status
        if (invoiceData.dueDate) {
            // Get the current invoice to check its status
            const currentInvoice = await getDoc(invoiceRef);
            if (currentInvoice.exists()) {
                const currentStatus = currentInvoice.data().status;
                
                // Normalize dates for accurate comparison
                const dueDate = new Date(invoiceData.dueDate);
                const today = new Date();
                
                // Reset time parts to compare dates only
                dueDate.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                
                console.log(`Comparing dates for invoice ${invoiceId}: Due date ${dueDate.toISOString()} vs Today ${today.toISOString()}`);
                
                // Only auto-change status if it's Due or Overdue (don't change Paid status)
                if (currentStatus === 'Due' || currentStatus === 'Overdue') {
                    // If due date is in the past, mark as Overdue
                    if (dueDate < today && !invoiceData.status) {
                        invoiceData.status = 'Overdue';
                        console.log(`Invoice ${invoiceId} automatically marked as Overdue because due date is in the past`);
                    } 
                    // If due date is in the future and current status is Overdue, mark as Due
                    else if (dueDate >= today && currentStatus === 'Overdue' && !invoiceData.status) {
                        invoiceData.status = 'Due';
                        console.log(`Invoice ${invoiceId} automatically marked as Due because due date was changed to future`);
                    }
                }
            }
        }
        
        await updateDoc(invoiceRef, { ...invoiceData, updatedAt: serverTimestamp() });
        console.log("Invoice updated:", invoiceId);
    } catch (error) {
        console.error("Error updating invoice:", error);
        throw error;
    }
}

/**
 * Deletes an invoice from the database.
 * @param {string} invoiceId - The ID of the invoice to delete.
 */
export async function deleteInvoice(invoiceId) {
    try {
        const invoiceRef = doc(db, "invoices", invoiceId);
        await deleteDoc(invoiceRef);
        console.log("Invoice deleted:", invoiceId);
    } catch (error) {
        console.error("Error deleting invoice:", error);
        throw error;
    }
}

/**
 * Creates a real-time listener for invoices based on specified filters.
 * This is the function that makes the invoice list update automatically.
 * @param {object} filters - Filtering options (e.g., status, month, year).
 * @param {function} callback - The function to call with the updated list of invoices.
 * @returns {function} The unsubscribe function to detach the listener.
 */
export function listenToInvoices(filters, callback) {
    try {
        // First check for any overdue invoices and mark them
        markOverdueInvoices().then(result => {
            console.log(`Auto-checked for overdue invoices: ${result.markedCount || 0} invoices marked as overdue`);
        }).catch(err => {
            console.error("Error auto-marking overdue invoices:", err);
        });
        
        let q = query(invoicesCollection, orderBy('createdAt', 'desc'));

        const queryConstraints = [];
        if (filters.status && filters.status !== 'all') {
            queryConstraints.push(where('status', '==', filters.status));
        }
        if (filters.month && filters.month !== 'all') {
            queryConstraints.push(where('month', '==', parseInt(filters.month, 10)));
        }
        if (filters.year && filters.year !== 'all') {
            queryConstraints.push(where('year', '==', parseInt(filters.year, 10)));
        }

        // Apply all the active filters to the query
        if (queryConstraints.length > 0) {
            q = query(q, ...queryConstraints);
        }

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            // Process the invoices before sending them to the UI
            let invoices = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Check and fix invoice statuses based on due dates
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const updatedInvoices = [];
            const statusUpdates = [];
            
            for (const invoice of invoices) {
                // Parse the due date properly, handling different formats
                let dueDate;
                if (invoice.dueDate instanceof Date) {
                    dueDate = invoice.dueDate;
                } else if (invoice.dueDate?.toDate) {
                    // Handle Firestore Timestamp
                    dueDate = invoice.dueDate.toDate();
                } else if (invoice.dueDate) {
                    // Handle string or number
                    dueDate = new Date(invoice.dueDate);
                } else {
                    console.log(`Invoice ${invoice.id} has no valid due date, skipping status check`);
                    updatedInvoices.push(invoice);
                    continue;
                }
                
                // Reset time parts for accurate date comparison
                dueDate.setHours(0, 0, 0, 0);
                
                let correctStatus;
                if (dueDate < today) {
                    correctStatus = "Overdue";
                } else {
                    correctStatus = "Due";
                }
                
                // Only update if status is incorrect and not Paid
                if (invoice.status !== correctStatus && invoice.status !== "Paid") {
                    console.log(`Invoice ${invoice.id} status needs update: ${invoice.status} → ${correctStatus}`);
                    
                    // Update the invoice in the UI immediately
                    updatedInvoices.push({
                        ...invoice,
                        status: correctStatus
                    });
                    
                    // Queue update in Firestore (will be done in batch)
                    statusUpdates.push({
                        id: invoice.id,
                        oldStatus: invoice.status,
                        newStatus: correctStatus
                    });
                } else {
                    updatedInvoices.push(invoice);
                }
            }
            
            // Send the updated invoices to the UI immediately
            callback(updatedInvoices);
            
            // Process any needed Firestore updates in the background
            if (statusUpdates.length > 0) {
                console.log(`Updating ${statusUpdates.length} invoice statuses in Firestore`);
                
                // Use a batch for efficiency
                const batch = writeBatch(db);
                
                for (const update of statusUpdates) {
                    const invoiceRef = doc(db, "invoices", update.id);
                    batch.update(invoiceRef, { 
                        status: update.newStatus,
                        updatedAt: serverTimestamp()
                    });
                }
                
                // Commit the batch
                try {
                    await batch.commit();
                    console.log(`Successfully updated ${statusUpdates.length} invoice statuses`);
                } catch (error) {
                    console.error("Error updating invoice statuses:", error);
                }
            }
        }, (error) => {
            console.error("Error listening to invoices:", error);
            callback([], error); // Send error to UI
        });

        return unsubscribe;

    } catch (error) {
        console.error("Failed to create invoice listener:", error);
        return () => {}; // Return an empty function on failure
    }
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
    // Get current month and year from options or use current date
    const currentMonth = options.month !== undefined ? options.month : new Date().getMonth();
    const currentYear = options.year !== undefined ? options.year : new Date().getFullYear();
    
    // Generate formatted invoice ID with the specific month and year
    const formattedId = await generateFormattedInvoiceId(currentYear, currentMonth);
    
    // Ensure the ID is valid
    if (!formattedId) {
      throw new Error("Failed to generate invoice ID");
    }
    
    console.log("Generated invoice ID:", formattedId); // Debug log
    
    return {
      formattedId,
      id: formattedId, // Set both id and formattedId for consistency
      userId: user.id,
      packageId: user.packageId,
      amount: packageData.price,
      dueDate: options.dueDate,
      status: 'Due',
      createdAt: new Date(),
      month: currentMonth,
      year: currentYear
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
    
    // Generate the appropriate message based on invoice status
    const { formatMessage } = await import('./whatsapp.js');
    const message = await formatMessage(user, 'INVOICE_NOTIFICATION', fullInvoiceData);
    
    // Send the PDF via WhatsApp with the full message template
    return await sendInvoicePdf(user, fullInvoiceData, pdfData.base64, message);
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

/**
 * Send payment reminders for all overdue invoices
 * @param {object} options - Options for sending reminders
 * @returns {Promise<object>} - Results of the operation
 */
export async function sendPaymentReminders(options = {}) {
    try {
        console.log("Starting to send payment reminders for overdue invoices...");
        
        // First, mark any due invoices with past due dates as overdue
        const markResult = await markOverdueInvoices();
        console.log(`Marked ${markResult.markedCount || 0} invoices as overdue`);
        
        // Find all overdue invoices that need reminders
        const overdueQuery = query(
            collection(db, "invoices"),
            where("status", "==", "Overdue")
        );
        
        const snapshot = await getDocs(overdueQuery);
        const overdueInvoices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`Found ${overdueInvoices.length} overdue invoices to send reminders for`);
        
        if (overdueInvoices.length === 0) {
            return {
                success: true,
                message: "No overdue invoices found for reminders",
                remindersSent: 0
            };
        }
        
        // Import the sendPaymentReminder function from the WhatsApp module
        const { sendPaymentReminder } = await import('./modules/whatsapp/sendInvoiceLink.js');
        
        // Send reminders with rate limiting to avoid API throttling
        let successCount = 0;
        let failureCount = 0;
        
        for (const invoice of overdueInvoices) {
            try {
                // Send the reminder (invoice is already marked as Overdue)
                const result = await sendPaymentReminder(invoice.id);
                
                if (result.success) {
                    successCount++;
                    console.log(`Successfully sent reminder for invoice ${invoice.id}`);
                    
                    // Update the invoice to record when the reminder was sent
                    await updateInvoice(invoice.id, { 
                        reminderSentAt: new Date()
                    });
                } else {
                    failureCount++;
                    console.error(`Failed to send reminder for invoice ${invoice.id}: ${result.message}`);
                }
                
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                failureCount++;
                console.error(`Error processing reminder for invoice ${invoice.id}:`, error);
            }
        }
        
        return {
            success: true,
            message: `Sent ${successCount} reminders with ${failureCount} failures`,
            remindersSent: successCount,
            remindersFailed: failureCount,
            total: overdueInvoices.length,
            markedAsOverdue: markResult.markedCount || 0
        };
    } catch (error) {
        console.error("Error sending payment reminders:", error);
        return {
            success: false,
            message: `Failed to send payment reminders: ${error.message}`,
            remindersSent: 0
        };
    }
}

/**
 * Automatically mark invoices as overdue when their due date is in the past
 * @param {object} options - Options for marking overdue invoices
 * @returns {Promise<object>} - Results of the operation
 */
export async function markOverdueInvoices(options = {}) {
    try {
        console.log("Starting to mark overdue invoices...");
        
        // Find all due invoices with past due dates
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparison
        
        const overdueQuery = query(
            collection(db, "invoices"),
            where("status", "==", "Due"),
            where("dueDate", "<", today)
        );
        
        const snapshot = await getDocs(overdueQuery);
        const overdueInvoices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`Found ${overdueInvoices.length} invoices that need to be marked as overdue`);
        
        // Find all overdue invoices with future due dates that need to be corrected
        const incorrectOverdueQuery = query(
            collection(db, "invoices"),
            where("status", "==", "Overdue")
        );
        
        const incorrectSnapshot = await getDocs(incorrectOverdueQuery);
        const incorrectOverdueInvoices = incorrectSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter(invoice => {
                // Parse the due date properly, handling different formats
                let dueDate;
                if (invoice.dueDate instanceof Date) {
                    dueDate = invoice.dueDate;
                } else if (invoice.dueDate?.toDate) {
                    // Handle Firestore Timestamp
                    dueDate = invoice.dueDate.toDate();
                } else if (invoice.dueDate) {
                    // Handle string or number
                    dueDate = new Date(invoice.dueDate);
                } else {
                    console.log(`Invoice ${invoice.id} has no valid due date, skipping`);
                    return false;
                }
                
                // Reset time parts for accurate date comparison
                dueDate.setHours(0, 0, 0, 0);
                
                console.log(`Checking invoice ${invoice.id} in markOverdueInvoices: Due date ${dueDate.toISOString()} vs Today ${today.toISOString()}`);
                
                return dueDate > today;
            });
        
        console.log(`Found ${incorrectOverdueInvoices.length} invoices incorrectly marked as overdue that need to be fixed`);
        
        // Mark each invoice as overdue
        let markedCount = 0;
        let fixedCount = 0;
        let failureCount = 0;
        
        // Mark past due invoices as Overdue
        for (const invoice of overdueInvoices) {
            try {
                // Mark invoice as overdue
                await updateDoc(doc(db, "invoices", invoice.id), { 
                    status: "Overdue",
                    markedOverdueAt: new Date()
                });
                
                markedCount++;
                console.log(`Successfully marked invoice ${invoice.id} as overdue`);
                
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                failureCount++;
                console.error(`Error marking invoice ${invoice.id} as overdue:`, error);
            }
        }
        
        // Fix incorrectly marked invoices
        for (const invoice of incorrectOverdueInvoices) {
            try {
                // Mark invoice back to Due
                await updateDoc(doc(db, "invoices", invoice.id), { 
                    status: "Due"
                });
                
                fixedCount++;
                console.log(`Fixed invoice ${invoice.id} - changed from Overdue to Due as due date is in future`);
                
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                failureCount++;
                console.error(`Error fixing invoice ${invoice.id}:`, error);
            }
        }
        
        return {
            success: true,
            message: `Marked ${markedCount} invoices as overdue, fixed ${fixedCount} incorrect invoices, with ${failureCount} failures`,
            markedCount,
            fixedCount,
            failedCount: failureCount,
            total: overdueInvoices.length + incorrectOverdueInvoices.length
        };
    } catch (error) {
        console.error("Error marking overdue invoices:", error);
        return {
            success: false,
            message: `Failed to mark overdue invoices: ${error.message}`,
            markedCount: 0,
            fixedCount: 0
        };
    }
}

/**
 * Fix any invoices that are incorrectly marked as Overdue despite having future due dates
 * @returns {Promise<object>} - Results of the operation
 */
export async function fixIncorrectOverdueInvoices() {
    try {
        console.log("Starting to fix incorrectly marked overdue invoices...");
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparison
        
        // Find all overdue invoices
        const overdueQuery = query(
            collection(db, "invoices"),
            where("status", "==", "Overdue")
        );
        
        const snapshot = await getDocs(overdueQuery);
        const allOverdueInvoices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Filter to find only those with future due dates
        const incorrectInvoices = allOverdueInvoices.filter(invoice => {
            // Parse the due date properly, handling different formats
            let dueDate;
            if (invoice.dueDate instanceof Date) {
                dueDate = invoice.dueDate;
            } else if (invoice.dueDate?.toDate) {
                // Handle Firestore Timestamp
                dueDate = invoice.dueDate.toDate();
            } else if (invoice.dueDate) {
                // Handle string or number
                dueDate = new Date(invoice.dueDate);
            } else {
                console.log(`Invoice ${invoice.id} has no valid due date, skipping`);
                return false;
            }
            
            // Reset time parts for accurate date comparison
            dueDate.setHours(0, 0, 0, 0);
            
            console.log(`Checking invoice ${invoice.id}: Due date ${dueDate.toISOString()} vs Today ${today.toISOString()}`);
            
            return dueDate > today;
        });
        
        console.log(`Found ${incorrectInvoices.length} invoices incorrectly marked as overdue`);
        
        if (incorrectInvoices.length === 0) {
            return {
                success: true,
                message: "No incorrectly marked invoices found",
                fixedCount: 0
            };
        }
        
        // Fix each incorrectly marked invoice
        let successCount = 0;
        let failureCount = 0;
        
        for (const invoice of incorrectInvoices) {
            try {
                // Change status back to Due
                await updateDoc(doc(db, "invoices", invoice.id), { 
                    status: "Due"
                });
                
                successCount++;
                console.log(`Fixed invoice ${invoice.id} - changed from Overdue to Due`);
                
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                failureCount++;
                console.error(`Error fixing invoice ${invoice.id}:`, error);
            }
        }
        
        return {
            success: true,
            message: `Fixed ${successCount} incorrectly marked invoices with ${failureCount} failures`,
            fixedCount: successCount,
            failedCount: failureCount,
            total: incorrectInvoices.length
        };
    } catch (error) {
        console.error("Error fixing incorrectly marked invoices:", error);
        return {
            success: false,
            message: `Failed to fix incorrectly marked invoices: ${error.message}`,
            fixedCount: 0
        };
    }
}

/**
 * Fix a specific invoice by ID - useful for troubleshooting
 * @param {string} invoiceId - The ID of the invoice to fix
 * @returns {Promise<object>} - Result of the operation
 */
export async function fixSpecificInvoice(invoiceId) {
    try {
        console.log(`Attempting to fix specific invoice: ${invoiceId}`);
        
        // Get the invoice
        const invoiceRef = doc(db, "invoices", invoiceId);
        const invoiceDoc = await getDoc(invoiceRef);
        
        if (!invoiceDoc.exists()) {
            console.error(`Invoice ${invoiceId} not found`);
            return {
                success: false,
                message: `Invoice ${invoiceId} not found`
            };
        }
        
        const invoice = invoiceDoc.data();
        console.log(`Found invoice ${invoiceId}:`, invoice);
        
        // Parse the due date, ensuring it's a proper Date object
        let dueDate;
        if (invoice.dueDate instanceof Date) {
            dueDate = invoice.dueDate;
        } else if (invoice.dueDate?.toDate) {
            // Handle Firestore Timestamp
            dueDate = invoice.dueDate.toDate();
        } else if (invoice.dueDate) {
            // Handle string or number
            dueDate = new Date(invoice.dueDate);
        } else {
            console.error(`Invoice ${invoiceId} has no valid due date`);
            return {
                success: false,
                message: `Invoice ${invoiceId} has no valid due date`
            };
        }
        
        // Get today's date for comparison
        const today = new Date();
        
        // Reset time parts for both dates to compare dates only
        dueDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        console.log(`Invoice ${invoiceId} due date: ${dueDate.toISOString()}, Today: ${today.toISOString()}`);
        
        // Determine the correct status
        let newStatus;
        if (dueDate < today) {
            newStatus = "Overdue";
        } else {
            newStatus = "Due";
        }
        
        console.log(`Invoice ${invoiceId} should be: ${newStatus}, current status: ${invoice.status}`);
        
        // Update if needed
        if (invoice.status !== newStatus) {
            await updateDoc(invoiceRef, { 
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            
            console.log(`Successfully updated invoice ${invoiceId} from ${invoice.status} to ${newStatus}`);
            
            return {
                success: true,
                message: `Invoice ${invoiceId} updated from ${invoice.status} to ${newStatus}`,
                oldStatus: invoice.status,
                newStatus
            };
        } else {
            console.log(`Invoice ${invoiceId} already has correct status: ${invoice.status}`);
            
            return {
                success: true,
                message: `Invoice ${invoiceId} already has correct status: ${invoice.status}`,
                status: invoice.status
            };
        }
    } catch (error) {
        console.error(`Error fixing invoice ${invoiceId}:`, error);
        return {
            success: false,
            message: `Error fixing invoice ${invoiceId}: ${error.message}`
        };
    }
}

/**
 * Send payment reminders for all due invoices
 * @param {object} options - Options for sending reminders
 * @returns {Promise<object>} - Results of the operation
 */
export async function sendDueReminders(options = {}) {
    try {
        console.log("Starting to send payment reminders for due invoices...");
        // Find all invoices with status 'Due'
        const dueQuery = query(
            collection(db, "invoices"),
            where("status", "==", "Due")
        );
        const snapshot = await getDocs(dueQuery);
        const dueInvoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Found ${dueInvoices.length} due invoices to send reminders for`);
        if (dueInvoices.length === 0) {
            return {
                success: true,
                message: "No due invoices found for reminders",
                remindersSent: 0,
                remindersFailed: 0,
                total: 0
            };
        }

        let successCount = 0;
        let failureCount = 0;
        for (const invoice of dueInvoices) {
            try {
                const user = await getUserById(invoice.userId);
                if (!user) {
                    throw new Error('User not found');
                }
                // Send custom due reminder
                const result = await sendDueReminder(user, invoice);
                if (result.success) {
                    successCount++;
                    // Record when reminder was sent
                    await updateInvoice(invoice.id, { reminderSentAt: new Date() });
                } else {
                    failureCount++;
                }
            } catch (error) {
                console.error(`Failed to send due reminder for invoice ${invoice.id}:`, error);
                failureCount++;
            }
            // Delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return {
            success: true,
            message: `Sent ${successCount} reminders with ${failureCount} failures`,
            remindersSent: successCount,
            remindersFailed: failureCount,
            total: dueInvoices.length
        };
    } catch (error) {
        console.error("Error sending due reminders:", error);
        return {
            success: false,
            message: `Failed to send due reminders: ${error.message}`,
            remindersSent: 0,
            total: 0
        };
    }
} 