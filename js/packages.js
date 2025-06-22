 // Packages management module
import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, getDoc } from './firebaseConfig.js';

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
 * Listen to packages collection changes
 * @param {function} callback - Function to call when data changes
 * @returns {function} - Unsubscribe function
 */
export function listenToPackages(callback) {
  return onSnapshot(packagesCollection, (snapshot) => {
    const packages = [];
    snapshot.forEach((doc) => {
      packages.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(packages);
  });
}