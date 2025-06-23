// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// Initialize Firebase
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
const db = getFirestore(app);

// New paid invoice template
const paidTemplate = `*✨ PAYMENT CONFIRMATION ✨*
━━━━━━━━━━━━━━━━━━━━━

Dear *{customerName}*,

Thank you! We have successfully received your payment.

*🧾 PAYMENT DETAILS*
━━━━━━━━━━━━
• *Invoice ID:* #{invoiceId}
• *Package:* {packageName} ({packageSpeed})
• *Amount Paid:* Rs. {amount}
• *Period:* {billingPeriod}
• *Status:* ✅ *PAID*

*🔗 VIEW RECEIPT*
━━━━━━━━━━━━
A receipt has been generated for your payment:
{invoiceLink}

We value your business and look forward to providing you with excellent internet service.

Best regards,
WeCloud Internet Services 🚀

Questions about your service?
�� 0300-1234567`;

// Update the template in Firestore
async function updateTemplate() {
  try {
    const templateRef = doc(db, "message_templates", "paid");
    await setDoc(templateRef, {
      content: paidTemplate,
      updatedAt: new Date()
    });
    document.getElementById('status').innerHTML = '<p style="color: green;">✅ Template updated successfully!</p>';
  } catch (error) {
    document.getElementById('status').innerHTML = `<p style="color: red;">❌ Error: ${error.message}</p>`;
  }
}

// Run when the page loads
window.onload = updateTemplate; 