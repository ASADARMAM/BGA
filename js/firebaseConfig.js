// Import the Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc,
  getDocs,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  startAfter,
  limit,
  onSnapshot,
  writeBatch,
  runTransaction,
  connectFirestoreEmulator,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAExSaJx0_YU_ZkXcGqkAiDtgljo8cPJRQ",
  authDomain: "ispnet-6ab93.firebaseapp.com",
  projectId: "ispnet-6ab93",
  storageBucket: "ispnet-6ab93.firebasestorage.app",
  messagingSenderId: "332292008834",
  appId: "1:332292008834:web:60adaaee92ff9899363d9b",
  measurementId: "G-L3084YL4ZL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistence
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

console.log("Offline persistence enabled");

// Export the Firebase modules
export { 
  db, 
  collection, 
  doc,
  getDoc,
  getDocs,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query,
  where,
  orderBy,
  startAfter,
  limit,
  onSnapshot,
  writeBatch,
  runTransaction,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  setDoc
}; 