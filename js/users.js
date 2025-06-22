// Users management module
import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, where, getDoc, orderBy, startAfter, limit, writeBatch, runTransaction, serverTimestamp } from './firebaseConfig.js';

// Collection reference
const usersCollection = collection(db, "users");

// Constants for pagination and optimization
const USERS_PER_PAGE = 50;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PREFETCH_THRESHOLD = 3; // Prefetch when within 3 pages of current data
const MAX_BATCH_SIZE = 500; // Maximum batch size for Firestore

// Enhanced cache structure with TTL and region-based sharding
const cache = {
  users: {
    data: new Map(), // Map of page number to user data
    timestamp: null,
    lastVisible: new Map(), // Map of page number to last visible document
    totalUsers: 0,
    prefetchedPages: new Set(),
    regionIndex: new Map() // Index users by region for faster lookups
  }
};

// User regions for data partitioning
const USER_REGIONS = {
  NORTH: 'north',
  SOUTH: 'south',
  EAST: 'east',
  WEST: 'west',
  CENTRAL: 'central',
  OTHER: 'other'
};

/**
 * Determine user region based on location data
 * @param {object} userData - User data with location information
 * @returns {string} - Region identifier
 */
function determineUserRegion(userData) {
  // Default to 'other' if no location data
  if (!userData || !userData.location) {
    return USER_REGIONS.OTHER;
  }
  
  const location = userData.location.toLowerCase();
  
  // Simple region determination logic - enhance with actual geographic data
  if (location.includes('north')) return USER_REGIONS.NORTH;
  if (location.includes('south')) return USER_REGIONS.SOUTH;
  if (location.includes('east')) return USER_REGIONS.EAST;
  if (location.includes('west')) return USER_REGIONS.WEST;
  if (location.includes('central')) return USER_REGIONS.CENTRAL;
  
  return USER_REGIONS.OTHER;
}

// Format phone number to standard format
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove any non-numeric characters
  phone = phone.replace(/\D/g, '');
  
  // Remove leading 0 if present
  if (phone.startsWith('0')) {
    phone = phone.substring(1);
  }
  
  // Add country code if not present
  if (!phone.startsWith('92')) {
    phone = '92' + phone;
  }
  
  return phone;
}

/**
 * Add a new user with optimized write
 * @param {object} userData - User data object
 * @returns {Promise} - Promise with user document reference
 */
export async function addUser(userData) {
  try {
    // Format phone number before saving
    userData.phone = formatPhoneNumber(userData.phone);
    
    // Add timestamps and metadata
    userData.createdAt = serverTimestamp();
    userData.updatedAt = serverTimestamp();
    
    // Determine region for data partitioning
    userData.region = determineUserRegion(userData);
    
    // Add the document to Firestore
    const docRef = await addDoc(usersCollection, userData);
    console.log("User added with ID: ", docRef.id);
    
    // Invalidate cache
    resetCache();
    
    return docRef;
  } catch (error) {
    console.error("Error adding user: ", error);
    throw error;
  }
}

/**
 * Get all users with efficient pagination and caching
 * @returns {Promise} - Promise with array of users
 */
export async function getUsers() {
  try {
    // Check if we have cached data
    if (cache.users.data.has('all') && 
        cache.users.timestamp && 
        Date.now() - cache.users.timestamp < CACHE_DURATION) {
      console.log("Returning users from cache");
      return cache.users.data.get('all');
    }
    
    // Limit to 1000 users for performance (use pagination for more)
    const q = query(usersCollection, orderBy("createdAt", "desc"), limit(1000));
    const querySnapshot = await getDocs(q);
    const users = [];
    
    querySnapshot.forEach((doc) => {
      const userData = {
        id: doc.id,
        ...doc.data()
      };
      
      users.push(userData);
      
      // Update region index
      const region = userData.region || USER_REGIONS.OTHER;
      if (!cache.users.regionIndex.has(region)) {
        cache.users.regionIndex.set(region, []);
      }
      cache.users.regionIndex.get(region).push(userData);
    });
    
    // Update cache
    cache.users.data.set('all', users);
    cache.users.timestamp = Date.now();
    cache.users.totalUsers = users.length;
    
    return users;
  } catch (error) {
    console.error("Error getting users: ", error);
    throw error;
  }
}

/**
 * Update a user with optimized write
 * @param {string} userId - User document ID
 * @param {object} userData - Updated user data
 * @returns {Promise} - Promise with update result
 */
export async function updateUser(userId, userData) {
  try {
    // Format phone number before saving
    if (userData.phone) {
      userData.phone = formatPhoneNumber(userData.phone);
    }
    
    // Update region if location changed
    if (userData.location) {
      userData.region = determineUserRegion(userData);
    }
    
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: serverTimestamp()
    });
    console.log("User updated: ", userId);
    
    // Invalidate cache
    resetCache();
    
    return true;
  } catch (error) {
    console.error("Error updating user: ", error);
    throw error;
  }
}

/**
 * Delete a user with cleanup
 * @param {string} userId - User document ID
 * @returns {Promise} - Promise with delete result
 */
export async function deleteUser(userId) {
  try {
    // Transaction to delete user and related data
    await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", userId);
      
      // Check if user exists
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User does not exist");
      }
      
      // Delete user
      transaction.delete(userRef);
      
      // Note: In a production environment, you would also delete or mark related data
      // such as invoices, but we're keeping the transaction small for performance
    });
    
    console.log("User deleted: ", userId);
    
    // Invalidate cache
    resetCache();
    
    return true;
  } catch (error) {
    console.error("Error deleting user: ", error);
    throw error;
  }
}

/**
 * Get a single user by ID with caching
 * @param {string} userId - User document ID
 * @returns {Promise} - Promise with user data
 */
export async function getUserById(userId) {
  try {
    // Check all cached pages for this user first
    for (const [_, users] of cache.users.data) {
      const cachedUser = users.find(u => u.id === userId);
      if (cachedUser) {
        console.log("User found in cache:", userId);
        return cachedUser;
      }
    }
    
    // Not in cache, fetch from Firestore
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = {
        id: userSnap.id,
        ...userSnap.data()
      };
      
      return userData;
    } else {
      console.log("No such user!");
      return null;
    }
  } catch (error) {
    console.error("Error getting user: ", error);
    throw error;
  }
}

/**
 * Get users by region with efficient indexing
 * @param {string} region - Region identifier
 * @returns {Promise} - Promise with array of users in the region
 */
export async function getUsersByRegion(region) {
  try {
    // Check if we have the region indexed in cache
    if (cache.users.regionIndex.has(region) && 
        cache.users.timestamp && 
        Date.now() - cache.users.timestamp < CACHE_DURATION) {
      console.log(`Returning ${region} users from cache`);
      return cache.users.regionIndex.get(region);
    }
    
    // Not in cache, query Firestore
    const q = query(
      usersCollection, 
      where("region", "==", region),
      orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const users = [];
    
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Update region index
    cache.users.regionIndex.set(region, users);
    
    return users;
  } catch (error) {
    console.error(`Error getting users by region ${region}:`, error);
    throw error;
  }
}

/**
 * Get paginated users with efficient cursor-based pagination
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Number of users per page
 * @returns {Promise} - Promise with paginated users and metadata
 */
export async function getPaginatedUsers(page = 1, pageSize = USERS_PER_PAGE) {
  try {
    // Validate page number
    page = Math.max(1, page);
    
    // Check if we have this page in cache
    if (cache.users.data.has(page) && 
        cache.users.timestamp && 
        Date.now() - cache.users.timestamp < CACHE_DURATION) {
      console.log(`Returning page ${page} from cache`);
      
      // Check if we should prefetch next pages
      if (page + PREFETCH_THRESHOLD > Math.max(...cache.users.prefetchedPages)) {
        // Calculate total pages
        const totalPages = Math.ceil(cache.users.totalUsers / pageSize);
        prefetchNextPages(page, totalPages).catch(err => console.error("Prefetch error:", err));
      }
      
      return {
        users: cache.users.data.get(page),
        page,
        totalUsers: cache.users.totalUsers,
        totalPages: Math.ceil(cache.users.totalUsers / pageSize),
        hasMore: page * pageSize < cache.users.totalUsers
      };
    }
    
    // Not in cache, fetch from Firestore
    let q;
    
    if (page === 1) {
      // First page query
      q = query(
        usersCollection,
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );
    } else {
      // Subsequent pages - need last document from previous page
      const lastVisible = cache.users.lastVisible.get(page - 1);
      
      if (!lastVisible) {
        // We don't have the previous page's last document, fetch it
        await fetchUsersPage(page - 1, pageSize);
        return getPaginatedUsers(page, pageSize); // Retry now that we have the previous page
      }
      
      q = query(
        usersCollection,
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(pageSize)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const users = [];
    let lastDoc = null;
    
    querySnapshot.forEach((doc) => {
      lastDoc = doc;
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Update cache
    cache.users.data.set(page, users);
    if (lastDoc) {
      cache.users.lastVisible.set(page, lastDoc);
    }
    cache.users.prefetchedPages.add(page);
    
    // If this is the first time, get total count
    if (!cache.users.timestamp) {
      await getTotalUsersCount();
    }
    
    cache.users.timestamp = Date.now();
    
    // Check if we should prefetch next pages
    const totalPages = Math.ceil(cache.users.totalUsers / pageSize);
    if (page + PREFETCH_THRESHOLD <= totalPages) {
      prefetchNextPages(page, totalPages).catch(err => console.error("Prefetch error:", err));
    }
    
    return {
      users,
      page,
      totalUsers: cache.users.totalUsers,
      totalPages,
      hasMore: users.length === pageSize && page * pageSize < cache.users.totalUsers
    };
  } catch (error) {
    console.error(`Error getting paginated users for page ${page}:`, error);
    throw error;
  }
}

/**
 * Bulk update users for efficient batch operations
 * @param {Array} userUpdates - Array of {id, data} objects for users to update
 * @returns {Promise} - Promise with update results
 */
export async function bulkUpdateUsers(userUpdates) {
  try {
    // Split updates into batches to avoid Firestore limits
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationCount = 0;
    
    for (const update of userUpdates) {
      if (operationCount >= MAX_BATCH_SIZE) {
        // Current batch is full, add it to batches array and create a new one
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        operationCount = 0;
      }
      
      // Add update to current batch
      const userRef = doc(db, "users", update.id);
      currentBatch.update(userRef, {
        ...update.data,
        updatedAt: serverTimestamp()
      });
      operationCount++;
    }
    
    // Add the last batch if it has operations
    if (operationCount > 0) {
      batches.push(currentBatch);
    }
    
    // Execute all batches
    const results = await Promise.all(batches.map(batch => batch.commit()));
    console.log(`Updated ${userUpdates.length} users in ${batches.length} batches`);
    
    // Invalidate cache
    resetCache();
    
    return {
      success: true,
      updatedCount: userUpdates.length,
      batchCount: batches.length
    };
  } catch (error) {
    console.error("Error bulk updating users:", error);
    throw error;
  }
}

// Prefetch next pages for smoother pagination
async function prefetchNextPages(currentPage, totalPages) {
  try {
    const pagesToPrefetch = [];
    
    // Determine which pages to prefetch
    for (let i = 1; i <= PREFETCH_THRESHOLD; i++) {
      const pageToFetch = currentPage + i;
      if (pageToFetch <= totalPages && !cache.users.prefetchedPages.has(pageToFetch)) {
        pagesToPrefetch.push(pageToFetch);
      }
    }
    
    // Prefetch pages in parallel
    if (pagesToPrefetch.length > 0) {
      console.log(`Prefetching pages: ${pagesToPrefetch.join(', ')}`);
      await Promise.all(pagesToPrefetch.map(page => fetchUsersPage(page)));
    }
  } catch (error) {
    console.error("Error prefetching pages:", error);
    // Don't throw - prefetching errors shouldn't affect main functionality
  }
}

// Helper function to fetch a specific page
async function fetchUsersPage(page, pageSize = USERS_PER_PAGE) {
  try {
    // Skip if already prefetched
    if (cache.users.prefetchedPages.has(page)) {
      return cache.users.data.get(page);
    }
    
    let q;
    
    if (page === 1) {
      // First page query
      q = query(
        usersCollection,
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );
    } else {
      // Need last document from previous page
      const lastVisible = cache.users.lastVisible.get(page - 1);
      
      if (!lastVisible) {
        // We don't have the previous page, fetch it first
        await fetchUsersPage(page - 1, pageSize);
        return fetchUsersPage(page, pageSize); // Retry now that we have the previous page
      }
      
      q = query(
        usersCollection,
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(pageSize)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const users = [];
    let lastDoc = null;
    
    querySnapshot.forEach((doc) => {
      lastDoc = doc;
      const userData = {
        id: doc.id,
        ...doc.data()
      };
      users.push(userData);
      
      // Update region index
      const region = userData.region || USER_REGIONS.OTHER;
      if (!cache.users.regionIndex.has(region)) {
        cache.users.regionIndex.set(region, []);
      }
      
      // Add to region index if not already there
      const regionUsers = cache.users.regionIndex.get(region);
      if (!regionUsers.some(u => u.id === userData.id)) {
        regionUsers.push(userData);
      }
    });
    
    // Update cache
    cache.users.data.set(page, users);
    if (lastDoc) {
      cache.users.lastVisible.set(page, lastDoc);
    }
    cache.users.prefetchedPages.add(page);
    
    return users;
  } catch (error) {
    console.error(`Error fetching users page ${page}:`, error);
    throw error;
  }
}

/**
 * Reset pagination and cache
 */
export function resetCache() {
  cache.users.data.clear();
  cache.users.lastVisible.clear();
  cache.users.prefetchedPages.clear();
  cache.users.regionIndex.clear();
  cache.users.timestamp = null;
  console.log("Users cache reset");
}

/**
 * Listen to users collection changes
 * @param {function} callback - Function to call when data changes
 * @returns {function} - Unsubscribe function
 */
export function listenToUsers(callback) {
  return onSnapshot(usersCollection, (snapshot) => {
    const users = [];
    snapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(users);
  });
}

/**
 * Get total users count with caching
 * @returns {Promise} - Promise with total users count
 */
export async function getTotalUsersCount() {
  try {
    if (cache.users.timestamp && Date.now() - cache.users.timestamp < CACHE_DURATION) {
      return cache.users.totalUsers;
    }

    const snapshot = await getDocs(collection(db, "users"));
    cache.users.totalUsers = snapshot.size;
    return cache.users.totalUsers;
  } catch (error) {
    console.error("Error getting total users count:", error);
    throw error;
  }
}

// Optimized search with caching
export async function searchUsersByName(searchTerm) {
  try {
    // Use cached data for search if available
    if (cache.users.data.size > 0 && 
        cache.users.timestamp && 
        Date.now() - cache.users.timestamp < CACHE_DURATION) {
      const allUsers = Array.from(cache.users.data.values()).flat();
      return allUsers.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // If no cache, perform server search
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      orderBy("name"),
      limit(1000) // Limit to prevent excessive data fetching
    );
    
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Cache the results
    cache.users.data.set(1, users);
    cache.users.timestamp = Date.now();
    
    return users.filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  } catch (error) {
    console.error("Error searching users:", error);
    throw error;
  }
}

// Reset cache and pagination
export function resetPagination() {
  cache.users = {
    data: new Map(),
    timestamp: null,
    lastVisible: null,
    totalUsers: 0,
    prefetchedPages: new Set()
  };
} 