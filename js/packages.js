// Packages management module
import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, getDoc, query, orderBy } from './firebaseConfig.js';

// Collection reference
const packagesCollection = collection(db, "packages");

/**
 * Add a new package
 * @param {object} packageData - Package data object
 * @returns {Promise} - Promise with package document reference
 */
export async function addPackage(packageData) {
  try {
    // Add timestamp
    packageData.createdAt = new Date();
    
    // Add the document to Firestore
    const docRef = await addDoc(packagesCollection, packageData);
    console.log("Package added with ID: ", docRef.id);
    return docRef;
  } catch (error) {
    console.error("Error adding package: ", error);
    throw error;
  }
}

/**
 * Get all packages
 * @returns {Promise} - Promise with array of packages
 */
export async function getPackages() {
  try {
    const querySnapshot = await getDocs(packagesCollection);
    const packages = [];
    
    querySnapshot.forEach((doc) => {
      packages.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return packages;
  } catch (error) {
    console.error("Error getting packages: ", error);
    throw error;
  }
}

/**
 * Update a package
 * @param {string} packageId - Package document ID
 * @param {object} packageData - Updated package data
 * @returns {Promise} - Promise with update result
 */
export async function updatePackage(packageId, packageData) {
  try {
    // Add update timestamp
    packageData.updatedAt = new Date();
    
    const packageRef = doc(db, "packages", packageId);
    await updateDoc(packageRef, packageData);
    console.log("Package updated: ", packageId);
    return true;
  } catch (error) {
    console.error("Error updating package: ", error);
    throw error;
  }
}

/**
 * Delete a package
 * @param {string} packageId - Package document ID
 * @returns {Promise} - Promise with delete result
 */
export async function deletePackage(packageId) {
  try {
    const packageRef = doc(db, "packages", packageId);
    await deleteDoc(packageRef);
    console.log("Package deleted: ", packageId);
    return true;
  } catch (error) {
    console.error("Error deleting package: ", error);
    throw error;
  }
}

/**
 * Get a single package by ID
 * @param {string} packageId - Package document ID
 * @returns {Promise} - Promise with package data
 */
export async function getPackageById(packageId) {
  try {
    const packageRef = doc(db, "packages", packageId);
    const packageSnap = await getDoc(packageRef);
    
    if (packageSnap.exists()) {
      return {
        id: packageSnap.id,
        ...packageSnap.data()
      };
    } else {
      console.log("No such package!");
      return null;
    }
  } catch (error) {
    console.error("Error getting package: ", error);
    throw error;
  }
}

/**
 * Creates a real-time listener for packages.
 * @param {function} callback - The function to call with the packages data.
 * @returns {function} - The unsubscribe function for the listener.
 */
export function listenToPackages(callback) {
    const q = query(collection(db, "packages"), orderBy("name"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const packages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(packages);
    }, (error) => {
        console.error("Error listening to packages:", error);
    });

    return unsubscribe;
}