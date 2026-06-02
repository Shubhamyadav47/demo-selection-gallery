// =========================================================
//  FIREBASE CONFIGURATION
//  ─────────────────────────────────────────────────────────
//  🔑 IMPORTANT: Replace these values with your Firebase config
//  1. Open https://console.firebase.google.com
//  2. Create (or open) a project
//  3. Project Settings → Your Apps → Add Web App → copy config
//  4. Authentication → Sign-in method → enable:
//       ✅  Email / Password
//       ✅  Google
//  5. Firestore Database → Create Database
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyDuupLK07-FteOsI-vOlA6qjNmteDj07ew",
  authDomain: "gallery-photo-selection.firebaseapp.com",
  projectId: "gallery-photo-selection",
  storageBucket: "gallery-photo-selection.firebasestorage.app",
  messagingSenderId: "100096652204",
  appId: "1:100096652204:web:fe2ec60567d88782be8009",
  measurementId: "G-VC6ERLG4BC"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); // Initialize Firestore

// =========================================================
//  RAZORPAY CONFIGURATION
//  ─────────────────────────────────────────────────────────
//  🔑 IMPORTANT: Replace with your Razorpay Key ID
//  Get it from: https://dashboard.razorpay.com/app/settings/api-keys
// =========================================================
const RAZORPAY_KEY_ID = "rzp_live_SwGNmwWnuOPH5e"; // Replace with your actual Key ID
const RAZORPAY_API_URL = "https://api.razorpay.com/v1"; // Razorpay API endpoint

const FREE_TOKENS_ON_SIGNUP = 2;
const TOKENS_PER_GENERATION = 1;

// Purchase price table: amount -> price (in paise, so 2500 = ₹25)
const PURCHASE_PRICES = {
    1: 2500,    // ₹25
    5: 9900,    // ₹99
    10: 17900,  // ₹179
    25: 49900,  // ₹499
};

// Display prices in Rupees (for UI)
const DISPLAY_PRICES = {
    1: 25,
    5: 99,
    10: 179,
    25: 499,
};

// =========================================================
//  OFFLINE SUPPORT SYSTEM
// =========================================================

let isOnline = navigator.onLine;
let offlineSyncQueue = [];

function getOfflineSyncKey(uid) {
    return `offlineSync_${uid}`;
}

function queueOfflineSync(uid, action) {
    const queue = JSON.parse(localStorage.getItem(getOfflineSyncKey(uid)) || "[]");
    queue.push({ ...action, timestamp: Date.now() });
    localStorage.setItem(getOfflineSyncKey(uid), JSON.stringify(queue));
}

async function processOfflineSyncQueue(uid) {
    const syncKey = getOfflineSyncKey(uid);
    const queue = JSON.parse(localStorage.getItem(syncKey) || "[]");
    
    if (queue.length === 0) return;
    
    console.log(`🔄 Processing ${queue.length} offline sync tasks...`);
    
    for (const action of queue) {
        try {
            if (action.type === "saveTokens") {
                await db.collection("users").doc(uid).set({
                    tokens: action.tokens,
                    lastUpdated: new Date(),
                    displayName: auth.currentUser?.displayName || "",
                    email: auth.currentUser?.email || ""
                }, { merge: true });
                console.log(`✅ Synced tokens: ${action.tokens}`);
            } else if (action.type === "savePayment") {
                await db.collection("users").doc(uid).collection("payments").add(action.paymentData);
                console.log(`✅ Synced payment record`);
            }
        } catch (error) {
            console.error(`❌ Failed to sync action:`, error);
            break; // Stop if one fails, will retry later
        }
    }
    
    // Clear successfully synced items
    localStorage.removeItem(syncKey);
    showNotification("✅ Offline changes synced successfully!");
}

// Setup online/offline event listeners
window.addEventListener("online", async () => {
    isOnline = true;
    updateConnectionStatus();
    console.log("🟢 Internet connection restored");
    
    const user = auth.currentUser;
    if (user) {
        await processOfflineSyncQueue(user.uid);
    }
});

window.addEventListener("offline", () => {
    isOnline = false;
    updateConnectionStatus();
    console.log("🔴 Internet connection lost");
    
    // Automatically logout when internet is disconnected
    auth.signOut().then(() => {
        showNotification("⚠️ Internet disconnected. You have been logged out for security. Please reconnect and sign in again.");
        console.log("✅ User logged out due to internet disconnection");
    }).catch(error => {
        console.error("❌ Error during logout:", error);
        showNotification("Internet connection lost. Please refresh the page.");
    });
});

function updateConnectionStatus() {
    const statusEl = document.getElementById("connectionStatus");
    if (statusEl) {
        if (isOnline) {
            statusEl.className = "connection-status online";
            statusEl.innerHTML = '<span class="status-dot"></span>Online';
        } else {
            statusEl.className = "connection-status offline";
            statusEl.innerHTML = '<span class="status-dot"></span>Offline Mode';
        }
    }
}

// =========================================================
//  COOKIE MANAGEMENT UTILITIES
// =========================================================

/**
 * Set a cookie with optional expiration
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Days until expiration (default: 30 days)
 * @param {boolean} secure - Use secure flag (default: true)
 */
function setCookie(name, value, days = 30, secure = true) {
    try {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        const secureFrag = secure && location.protocol === "https:" ? "; Secure" : "";
        const sameSite = "; SameSite=Strict";
        document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}${secureFrag}${sameSite}; path=/`;
        console.log(`✅ Cookie set: ${name}`);
    } catch (error) {
        console.error(`❌ Error setting cookie ${name}:`, error);
    }
}

/**
 * Get a cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} - Cookie value or null if not found
 */
function getCookie(name) {
    try {
        const nameEQ = encodeURIComponent(name) + "=";
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.indexOf(nameEQ) === 0) {
                return decodeURIComponent(cookie.substring(nameEQ.length));
            }
        }
        return null;
    } catch (error) {
        console.error(`❌ Error getting cookie ${name}:`, error);
        return null;
    }
}

/**
 * Delete a cookie
 * @param {string} name - Cookie name
 */
function deleteCookie(name) {
    try {
        setCookie(name, "", -1);
        console.log(`✅ Cookie deleted: ${name}`);
    } catch (error) {
        console.error(`❌ Error deleting cookie ${name}:`, error);
    }
}

/**
 * Store token balance in cookie
 * @param {string} uid - User ID
 * @param {number} tokens - Token amount
 */
function setTokenCookie(uid, tokens) {
    if (!uid) return;
    const cookieName = `token_${uid}`;
    setCookie(cookieName, String(tokens), 30);
}

/**
 * Retrieve token balance from cookie
 * @param {string} uid - User ID
 * @returns {number} - Token balance or 0
 */
function getTokenCookie(uid) {
    if (!uid) return 0;
    const cookieName = `token_${uid}`;
    const value = getCookie(cookieName);
    return value ? parseInt(value, 10) : 0;
}

// =========================================================
//  USER AUTHENTICATION
// =========================================================

let currentUser = null;

function updateUI() {
    if (currentUser) {
        // User is logged in
        document.getElementById("authOverlay").style.display = "none";
        document.getElementById("mainApp").style.display = "block";
        updateUserBar();
    } else {
        // User is logged out
        document.getElementById("authOverlay").style.display = "flex";
        document.getElementById("mainApp").style.display = "none";
    }
}

function updateUserBar() {
    if (!currentUser) return;

    document.getElementById("userDisplayName").textContent = currentUser.displayName || "User";
    document.getElementById("userEmailDisplay").textContent = currentUser.email || "";

    // Avatar
    if (currentUser.photoURL) {
        document.getElementById("userAvatarImg").src = currentUser.photoURL;
        document.getElementById("userAvatarImg").style.display = "block";
        document.getElementById("userInitials").style.display = "none";
    } else {
        document.getElementById("userAvatarImg").style.display = "none";
        document.getElementById("userInitials").style.display = "flex";
        const initials = (currentUser.displayName || "U").split(" ").map(n => n[0]).join("").toUpperCase();
        document.getElementById("userInitials").textContent = initials;
    }

    // Update token display
    loadTokenCount();
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        currentUser = result.user;

        // Check if this is a new user
        const userDoc = await db.collection("users").doc(currentUser.uid).get();
        if (!userDoc.exists) {
            // New user - give free tokens
            await db.collection("users").doc(currentUser.uid).set({
                displayName: currentUser.displayName,
                email: currentUser.email,
                photoURL: currentUser.photoURL,
                tokens: FREE_TOKENS_ON_SIGNUP,
                createdAt: new Date(),
                lastUpdated: new Date()
            });
            setTokenCookie(currentUser.uid, FREE_TOKENS_ON_SIGNUP);
            showNotification(`✅ Welcome! You received ${FREE_TOKENS_ON_SIGNUP} free tokens.`);
        }

        updateUI();
        console.log("✅ Signed in with Google:", currentUser.email);
    } catch (error) {
        console.error("❌ Google Sign-In Error:", error);
        document.getElementById("authError").textContent = "Error: " + error.message;
    }
}

function logout() {
    auth.signOut().then(() => {
        currentUser = null;
        updateUI();
        showNotification("You have been logged out.");
        console.log("✅ User logged out");
    }).catch(error => {
        console.error("❌ Logout Error:", error);
    });
}

// =========================================================
//  TOKEN MANAGEMENT
// =========================================================

async function loadTokenCount() {
    if (!currentUser) return;

    try {
        const userDoc = await db.collection("users").doc(currentUser.uid).get();
        if (userDoc.exists) {
            const tokens = userDoc.data().tokens || 0;
            updateTokenDisplay(tokens);
            setTokenCookie(currentUser.uid, tokens);
        }
    } catch (error) {
        console.error("❌ Error loading tokens:", error);
    }
}

function updateTokenDisplay(count) {
    document.getElementById("tokenCount").textContent = count;
    document.getElementById("tokenCountInline").textContent = count;
    
    const btn = document.getElementById("generateBtn");
    if (count <= 0) {
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.title = "You need at least 1 token to generate a gallery";
    } else {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.title = "";
    }
}

function spendTokens(amount) {
    if (!currentUser) return;

    const cookieName = `token_${currentUser.uid}`;
    let currentTokens = getTokenCookie(currentUser.uid);
    currentTokens = Math.max(0, currentTokens - amount);

    // Update locally
    setTokenCookie(currentUser.uid, currentTokens);
    updateTokenDisplay(currentTokens);

    // Sync with Firestore
    db.collection("users").doc(currentUser.uid).set(
        { tokens: currentTokens, lastUpdated: new Date() },
        { merge: true }
    ).then(() => {
        console.log(`✅ Tokens spent: ${amount} (Remaining: ${currentTokens})`);
    }).catch(error => {
        console.error("❌ Error updating tokens:", error);
        queueOfflineSync(currentUser.uid, {
            type: "saveTokens",
            tokens: currentTokens
        });
    });
}

function buyTokens(amount) {
    if (!currentUser) {
        showNotification("Please sign in first.");
        return;
    }

    const priceInPaise = PURCHASE_PRICES[amount];
    if (!priceInPaise) {
        showNotification("Invalid purchase amount");
        return;
    }

    // Razorpay payment flow
    const options = {
        key: RAZORPAY_KEY_ID,
        amount: priceInPaise,
        currency: "INR",
        name: "Gallery Generator",
        description: `Purchase ${amount} tokens`,
        handler: function(response) {
            // Payment successful
            addTokens(amount, response.razorpay_payment_id);
        },
        prefill: {
            email: currentUser.email,
            name: currentUser.displayName
        },
        theme: {
            color: "#4F46E5"
        }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function(response) {
        showNotification("Payment failed: " + response.error.description);
        console.error("❌ Payment failed:", response.error);
    });

    rzp.open();
}

async function addTokens(amount, paymentId) {
    if (!currentUser) return;

    try {
        // Get current token count
        const userDoc = await db.collection("users").doc(currentUser.uid).get();
        const currentTokens = userDoc.data()?.tokens || 0;
        const newTokenCount = currentTokens + amount;

        // Update Firestore
        await db.collection("users").doc(currentUser.uid).set(
            {
                tokens: newTokenCount,
                lastUpdated: new Date()
            },
            { merge: true }
        );

        // Log payment
        await db.collection("users").doc(currentUser.uid).collection("payments").add({
            amount: amount,
            paymentId: paymentId,
            timestamp: new Date(),
            type: "token_purchase"
        });

        // Update local storage and UI
        setTokenCookie(currentUser.uid, newTokenCount);
        updateTokenDisplay(newTokenCount);

        const displayPrice = DISPLAY_PRICES[amount];
        showNotification(`✅ Payment successful! ${amount} tokens added. (₹${displayPrice})`);
        console.log(`✅ Added ${amount} tokens. Total: ${newTokenCount}`);

    } catch (error) {
        console.error("❌ Error adding tokens:", error);
        showNotification("Error processing payment. Please contact support.");
        
        // Queue for offline sync
        queueOfflineSync(currentUser.uid, {
            type: "savePayment",
            paymentData: { paymentId, amount, timestamp: Date.now() }
        });
    }
}

// =========================================================
//  IMAGE UPLOAD MANAGEMENT
// =========================================================

let imageData = [];

function setupUploadZone() {
    const uploadZone = document.getElementById("uploadZone");
    const fileInput = document.getElementById("imageFileInput");

    uploadZone.addEventListener("click", () => fileInput.click());

    // Drag and drop
    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("drag-over");
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("drag-over");
    });

    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("drag-over");
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    fileInput.addEventListener("change", () => {
        handleFiles(fileInput.files);
    });
}

function handleFiles(files) {
    const validFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
        showNotification("No valid image files selected.");
        return;
    }

    readImages(validFiles);
}

function readImages(files) {
    const progressWrap = document.getElementById("progressWrap");
    const progressLabel = document.getElementById("progressLabel");
    const progressFill = document.getElementById("progressFill");

    progressWrap.style.display = "block";
    imageData = [];

    let completed = 0;

    files.forEach((file, index) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            imageData.push({
                name: file.name,
                dataUrl: e.target.result
            });

            completed++;
            const percent = (completed / files.length) * 100;
            progressFill.style.width = percent + "%";
            progressLabel.textContent = `Reading images… ${completed} / ${files.length}`;

            if (completed === files.length) {
                progressWrap.style.display = "none";
                updatePreview();
            }
        };

        reader.onerror = () => {
            console.error(`Error reading file: ${file.name}`);
            completed++;
            if (completed === files.length) {
                progressWrap.style.display = "none";
                updatePreview();
            }
        };

        reader.readAsDataURL(file);
    });
}

function updatePreview() {
    const previewGrid = document.getElementById("previewGrid");
    const previewCount = document.getElementById("previewCount");
    const previewThumbs = document.getElementById("previewThumbs");

    if (imageData.length === 0) {
        previewGrid.style.display = "none";
        return;
    }

    previewGrid.style.display = "block";
    previewCount.textContent = `${imageData.length} images selected`;

    previewThumbs.innerHTML = imageData
        .map((img, idx) => `
            <div class="preview-thumb">
                <img src="${img.dataUrl}" alt="Preview ${idx + 1}">
                <div class="thumb-name">${img.name}</div>
            </div>
        `)
        .join("");
}

function clearImages() {
    imageData = [];
    document.getElementById("imageFileInput").value = "";
    document.getElementById("previewGrid").style.display = "none";
    showNotification("All images cleared.");
}

// =========================================================
//  NOTIFICATION TOAST
// =========================================================

function showNotification(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// =========================================================
//  AUTH STATE LISTENER
// =========================================================

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        updateUI();
        console.log("✅ User authenticated:", user.email);
    } else {
        currentUser = null;
        updateUI();
        console.log("User not authenticated");
    }
});

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    setupUploadZone();
    updateConnectionStatus();
    console.log("✅ Gallery App initialized");
    console.log("🔑 Firebase configured:", firebase.app() ? "✅" : "❌");
    console.log("💳 Razorpay Key ID:", RAZORPAY_KEY_ID ? "✅" : "❌");
    console.log("📡 Connection Status:", isOnline ? "🟢 Online" : "🔴 Offline");
});
