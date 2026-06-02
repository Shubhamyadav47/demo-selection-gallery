
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
 * @returns {number|null} - Token amount or null
 */
function getTokenCookie(uid) {
    if (!uid) return null;
    const cookieName = `token_${uid}`;
    const value = getCookie(cookieName);
    return value !== null ? parseInt(value, 10) : null;
}

/**
 * Store authentication token in cookie
 * @param {string} token - Auth token
 */
function setAuthTokenCookie(token) {
    if (!token) return;
    setCookie("authToken", token, 7); // Auth tokens expire in 7 days
}

/**
 * Retrieve authentication token from cookie
 * @returns {string|null} - Auth token or null
 */
function getAuthTokenCookie() {
    return getCookie("authToken");
}

/**
 * Store user session in cookie
 * @param {object} user - User object
 */
function setUserSessionCookie(user) {
    if (!user) return;
    const sessionData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        timestamp: Date.now()
    };
    setCookie("userSession", JSON.stringify(sessionData), 30);
}

/**
 * Retrieve user session from cookie
 * @returns {object|null} - User session object or null
 */
function getUserSessionCookie() {
    const session = getCookie("userSession");
    try {
        return session ? JSON.parse(session) : null;
    } catch (error) {
        console.error("❌ Error parsing user session cookie:", error);
        return null;
    }
}

/**
 * Clear all app-related cookies
 */
function clearAllCookies() {
    try {
        const user = auth.currentUser;
        if (user) {
            deleteCookie(`token_${user.uid}`);
        }
        deleteCookie("authToken");
        deleteCookie("userSession");
        console.log("✅ All cookies cleared");
    } catch (error) {
        console.error("❌ Error clearing cookies:", error);
    }
}

// =========================================================
//  TOKEN MANAGEMENT - Local Storage + Firestore + Cookies
// =========================================================

function getTokenStorageKey(uid) {
    return `galleryTokenBalance_${uid}`;
}

function getStoredTokenBalance(uid) {
    const raw = localStorage.getItem(getTokenStorageKey(uid));
    return raw === null ? null : parseInt(raw, 10) || 0;
}

function setStoredTokenBalance(uid, amount) {
    localStorage.setItem(getTokenStorageKey(uid), String(amount));
    // Also store in cookie for cross-tab synchronization
    setTokenCookie(uid, amount);
}

async function saveTokensToFirestore(uid, tokens) {
    if (!isOnline) {
        // Queue for sync when back online
        queueOfflineSync(uid, { type: "saveTokens", tokens });
        console.log("⏳ Tokens queued for sync (offline):", tokens);
        return;
    }
    
    try {
        await db.collection("users").doc(uid).set({
            tokens: tokens,
            lastUpdated: new Date(),
            displayName: auth.currentUser?.displayName || "",
            email: auth.currentUser?.email || ""
        }, { merge: true });
        console.log("✅ Tokens saved to Firestore:", tokens);
    } catch (error) {
        console.error("❌ Error saving tokens to Firestore:", error);
        // Queue for retry if online but Firestore fails
        if (isOnline) {
            queueOfflineSync(uid, { type: "saveTokens", tokens });
        }
    }
}

async function loadTokensFromFirestore(uid) {
    if (!isOnline) {
        console.log("⏳ Offline mode - using local tokens only");
        return null; // Use localStorage as fallback
    }
    
    try {
        const doc = await db.collection("users").doc(uid).get();
        if (doc.exists && doc.data().tokens) {
            return doc.data().tokens;
        }
    } catch (error) {
        console.error("❌ Error loading tokens from Firestore:", error);
    }
    return null;
}

function getCurrentTokenBalance() {
    const user = auth.currentUser;
    if (!user) return 0;
    const stored = getStoredTokenBalance(user.uid);
    return stored === null ? FREE_TOKENS_ON_SIGNUP : stored;
}

function updateTokenUI(balance) {
    const tokenCount = document.getElementById("tokenCount");
    const tokenCountInline = document.getElementById("tokenCountInline");
    if (tokenCount) tokenCount.textContent = balance;
    if (tokenCountInline) tokenCountInline.textContent = balance;
    const generateBtn = document.getElementById("generateBtn");
    if (generateBtn) {
        generateBtn.disabled = balance < TOKENS_PER_GENERATION;
        generateBtn.title = balance < TOKENS_PER_GENERATION ? "Buy tokens to generate a gallery" : "";
    }
}

function ensureUserTokenBalance(user) {
    if (!user) return;
    let balance = getStoredTokenBalance(user.uid);
    if (balance === null) {
        balance = FREE_TOKENS_ON_SIGNUP;
        setStoredTokenBalance(user.uid, balance);
        saveTokensToFirestore(user.uid, balance);
        showNotification(`Welcome! ${balance} free tokens have been added to your account.`);
    }
    // Ensure cookie is synced
    setTokenCookie(user.uid, balance);
    updateTokenUI(balance);
}

function changeTokenBalance(amount) {
    const user = auth.currentUser;
    if (!user) return 0;
    const current = getCurrentTokenBalance();
    const next = Math.max(0, current + amount);
    setStoredTokenBalance(user.uid, next);
    saveTokensToFirestore(user.uid, next);
    updateTokenUI(next);
    return next;
}

function spendTokens(amount) {
    const current = getCurrentTokenBalance();
    if (current < amount) return false;
    changeTokenBalance(-amount);
    return true;
}

// =========================================================
//  RAZORPAY PAYMENT INTEGRATION
// =========================================================

function initiateRazorpayPayment(tokenAmount, priceInPaise) {
    const user = auth.currentUser;
    if (!user) {
        showNotification("Please sign in before buying tokens.");
        return;
    }

    const options = {
        key: RAZORPAY_KEY_ID,
        amount: priceInPaise, // Amount in paise
        currency: "INR",
        name: "Gallery Generator",
        description: `Buy ${tokenAmount} Token${tokenAmount !== 1 ? "s" : ""}`,
        prefill: {
            name: user.displayName || "User",
            email: user.email,
        },
        handler: function (response) {
            // ✅ Payment successful
            console.log("✅ Payment successful:", response);
            
            // Update tokens immediately
            const newBalance = changeTokenBalance(tokenAmount);
            
            // Save payment record to Firestore
            savePaymentRecord(user.uid, {
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                tokens: tokenAmount,
                amount: priceInPaise,
                timestamp: new Date()
            });
            
            showNotification(`✅ Payment successful! Added ${tokenAmount} token${tokenAmount !== 1 ? "s" : ""}. You now have ${newBalance} tokens.`);
        },
        modal: {
            ondismiss: function () {
                console.log("❌ Payment cancelled by user");
                showNotification("Payment cancelled. Please try again.");
            }
        },
        theme: {
            color: "#4F46E5" // Purple to match your theme
        }
    };

    // Create and open Razorpay checkout
    const razorpay = new Razorpay(options);
    razorpay.on('payment.failed', function (response) {
        console.error("❌ Payment failed:", response.error);
        showNotification(`Payment failed: ${response.error.description}`);
    });
    razorpay.open();
}

async function savePaymentRecord(uid, paymentData) {
    if (!isOnline) {
        // Queue for sync when back online
        queueOfflineSync(uid, { type: "savePayment", paymentData: { ...paymentData, status: "completed" } });
        console.log("⏳ Payment record queued for sync (offline)");
        return;
    }
    
    try {
        await db.collection("users").doc(uid).collection("payments").add({
            ...paymentData,
            status: "completed"
        });
        console.log("✅ Payment record saved to Firestore");
    } catch (error) {
        console.error("❌ Error saving payment record:", error);
        // Queue for retry
        queueOfflineSync(uid, { type: "savePayment", paymentData: { ...paymentData, status: "completed" } });
    }
}

function buyTokens(amount) {
    if (!auth.currentUser) {
        showNotification("Please sign in before buying tokens.");
        return;
    }
    const price = PURCHASE_PRICES[amount];
    if (!price) {
        showNotification("Invalid token amount.");
        return;
    }
    
    // Initiate Razorpay payment
    initiateRazorpayPayment(amount, price);
}

// =========================================================
//  AUTH STATE OBSERVER
//  Fires automatically on every sign-in / sign-out event
// =========================================================
auth.onAuthStateChanged(async (user) => {
    const authOverlay = document.getElementById("authOverlay");
    const mainApp     = document.getElementById("mainApp");

    if (user) {
        // ── Signed in ──────────────────────────────────────
        // Store user session in cookie
        setUserSessionCookie(user);
        
        // Smooth fade-out the auth overlay
        authOverlay.style.transition    = "opacity 0.35s ease";
        authOverlay.style.opacity       = "0";
        authOverlay.style.pointerEvents = "none";
        setTimeout(() => { authOverlay.style.display = "none"; }, 360);

        // Reveal main app
        mainApp.style.display = "flex";

        // Populate user bar
        const displayName = user.displayName || user.email.split("@")[0];
        document.getElementById("userDisplayName").textContent = displayName;
        document.getElementById("userEmailDisplay").textContent = user.email;

        const avatarImg    = document.getElementById("userAvatarImg");
        const userInitials = document.getElementById("userInitials");

        if (user.photoURL) {
            avatarImg.src          = user.photoURL;
            avatarImg.style.display = "block";
            userInitials.style.display = "none";
        } else {
            avatarImg.style.display    = "none";
            userInitials.style.display = "flex";
            userInitials.textContent   = displayName[0].toUpperCase();
        }

        // Load tokens from Firestore first, then ensure balance
        const firestoreTokens = await loadTokensFromFirestore(user.uid);
        if (firestoreTokens !== null && firestoreTokens !== undefined) {
            setStoredTokenBalance(user.uid, firestoreTokens);
        }
        ensureUserTokenBalance(user);
        
        // Process any offline sync queue
        if (isOnline) {
            await processOfflineSyncQueue(user.uid);
        }

    } else {
        // ── Signed out ─────────────────────────────────────
        // Clear all cookies on logout
        clearAllCookies();
        
        authOverlay.style.transition    = "";
        authOverlay.style.display       = "flex";
        authOverlay.style.opacity       = "1";
        authOverlay.style.pointerEvents = "";
        mainApp.style.display           = "none";
        updateTokenUI(0);
    }
});


// =========================================================
//  AUTH TAB SWITCHER
//  mode: "login" | "signup" | "forgot"
// =========================================================
let currentAuthMode = "login";

function switchAuthTab(mode) {
    currentAuthMode = mode;
    clearAuthMessages();

    const loginSignupForm = document.getElementById("authLoginSignupForm");
    const forgotForm      = document.getElementById("forgotForm");
    const authTabsEl      = document.getElementById("authTabs");
    const submitBtn       = document.getElementById("authSubmitBtn");
    const forgotLink      = document.getElementById("forgotPasswordLink");

    if (mode === "forgot") {
        loginSignupForm.style.display = "none";
        forgotForm.style.display      = "block";
        authTabsEl.style.display      = "none";
    } else {
        loginSignupForm.style.display = "block";
        forgotForm.style.display      = "none";
        authTabsEl.style.display      = "flex";
        forgotLink.style.display      = mode === "login" ? "block" : "none";
        submitBtn.textContent         = mode === "login" ? "Login" : "Sign Up";
    }

    // Update tab active state
    const tabs = document.querySelectorAll(".auth-tab");
    tabs.forEach(tab => {
        tab.classList.toggle("active", tab.getAttribute("data-mode") === mode);
    });
}

// =========================================================
//  AUTHENTICATION FUNCTIONS
// =========================================================

async function submitAuth() {
    const email    = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value.trim();

    if (!email || !password) {
        showAuthError("Please enter email and password.");
        return;
    }

    const submitBtn = document.getElementById("authSubmitBtn");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;

    try {
        if (currentAuthMode === "login") {
            await auth.signInWithEmailAndPassword(email, password);
            showAuthSuccess("Login successful! 🎉");
        } else {
            await auth.createUserWithEmailAndPassword(email, password);
            showAuthSuccess("Account created! Welcome! 🎉");
        }
    } catch (error) {
        console.error("Auth error:", error);
        let errorMsg = "Authentication failed.";
        if (error.code === "auth/email-already-in-use") {
            errorMsg = "Email already in use. Try logging in.";
        } else if (error.code === "auth/weak-password") {
            errorMsg = "Password should be at least 6 characters.";
        } else if (error.code === "auth/invalid-email") {
            errorMsg = "Invalid email address.";
        } else if (error.code === "auth/user-not-found") {
            errorMsg = "User not found. Try signing up.";
        } else if (error.code === "auth/wrong-password") {
            errorMsg = "Wrong password. Try again.";
        }
        showAuthError(errorMsg);
    } finally {
        submitBtn.disabled = false;
    }
}

async function sendReset() {
    const email = document.getElementById("resetEmail").value.trim();
    if (!email) {
        showAuthError("Please enter your email.");
        return;
    }

    const resetBtn = document.getElementById("resetSubmitBtn");
    resetBtn.disabled = true;

    try {
        await auth.sendPasswordResetEmail(email);
        showAuthSuccess("Password reset email sent! Check your inbox.");
        setTimeout(() => switchAuthTab("login"), 2000);
    } catch (error) {
        console.error("Reset error:", error);
        showAuthError("Error sending reset email. Check your email address.");
    } finally {
        resetBtn.disabled = false;
    }
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const submitBtn = document.querySelector(".btn-google");
    submitBtn.disabled = true;

    try {
        await auth.signInWithPopup(provider);
        showAuthSuccess("Google sign-in successful! 🎉");
    } catch (error) {
        console.error("Google sign-in error:", error);
        showAuthError("Google sign-in failed. Please try again.");
    } finally {
        submitBtn.disabled = false;
    }
}

function logout() {
    clearAllCookies();
    auth.signOut().catch(error => {
        console.error("Logout error:", error);
        showNotification("Error logging out.");
    });
}

// =========================================================
//  AUTH UI HELPERS
// =========================================================

function clearAuthMessages() {
    document.getElementById("authError").textContent   = "";
    document.getElementById("authSuccess").textContent = "";
}

function showAuthError(msg) {
    const errorEl = document.getElementById("authError");
    errorEl.textContent = msg;
    errorEl.style.display = msg ? "block" : "none";
}

function showAuthSuccess(msg) {
    const successEl = document.getElementById("authSuccess");
    successEl.textContent = msg;
    successEl.style.display = msg ? "block" : "none";
}

function toggleAuthPw() {
    const field = document.getElementById("authPassword");
    field.type = field.type === "password" ? "text" : "password";
}

// =========================================================
//  IMAGE UPLOAD & PREVIEW
// =========================================================

let uploadedImages = [];
let uploadZoneInitialized = false; // Flag to prevent duplicate initialization
let isProcessingFiles = false; // Flag to prevent concurrent file processing
let isGalleryGenerated = false; // Flag to prevent duplicate gallery generation
let lastGeneratedImageCount = 0; // Track the last generated image count

function setupUploadZone() {
    // Prevent duplicate event listener initialization
    if (uploadZoneInitialized) {
        console.log("✅ Upload zone already initialized, skipping duplicate setup");
        return;
    }
    
    const uploadZone = document.getElementById("uploadZone");
    const fileInput = document.getElementById("imageFileInput");

    if (!uploadZone || !fileInput) {
        console.error("❌ Upload zone or file input not found");
        return;
    }

    // Handler for upload zone click
    const handleUploadClick = (e) => {
        if (isProcessingFiles) {
            console.log("⏳ Files already being processed, ignoring click");
            return;
        }
        e.stopPropagation();
        e.preventDefault();
        console.log("📁 Opening file picker...");
        fileInput.click();
    };

    // Handler for drag over
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add("drag-over");
    };

    // Handler for drag leave
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove("drag-over");
    };

    // Handler for drop
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove("drag-over");
        if (!isProcessingFiles) {
            console.log("📤 Files dropped, processing...");
            handleFileSelect(e.dataTransfer.files);
        }
    };

    // Handler for file input change
    const handleFileInputChange = (e) => {
        if (!isProcessingFiles) {
            console.log("📤 Files selected via dialog, processing...");
            handleFileSelect(e.target.files);
        }
    };

    // Attach event listeners
    uploadZone.addEventListener("click", handleUploadClick);
    uploadZone.addEventListener("dragover", handleDragOver);
    uploadZone.addEventListener("dragleave", handleDragLeave);
    uploadZone.addEventListener("drop", handleDrop);
    fileInput.addEventListener("change", handleFileInputChange);

    uploadZoneInitialized = true;
    console.log("✅ Upload zone initialized successfully");
}

function handleFileSelect(files) {
    if (!files || files.length === 0) {
        uploadedImages = [];
        document.getElementById("previewThumbs").innerHTML = "";
        document.getElementById("previewGrid").style.display = "none";
        document.getElementById("progressWrap").style.display = "none";
        isProcessingFiles = false;
        return;
    }

    // Set processing flag to prevent duplicate triggers
    isProcessingFiles = true;

    uploadedImages = []; // Clear previous uploads
    const previewThumbs = document.getElementById("previewThumbs");
    const previewGrid = document.getElementById("previewGrid");
    const progressWrap = document.getElementById("progressWrap");

    previewThumbs.innerHTML = "";
    previewGrid.style.display = "block";
    progressWrap.style.display = "block";

    const totalFiles = files.length;
    let processedFiles = 0;
    const filesArray = Array.from(files);

    filesArray.forEach((file, index) => {
        // Validate file is actually an image
        if (!file.type.startsWith("image/")) {
            console.warn(`⚠️ Skipping non-image file: ${file.name}`);
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                uploadedImages[index] = {
                    name: file.name,
                    data: e.target.result
                };

                // Create preview thumbnail
                const thumb = document.createElement("div");
                thumb.className = "preview-thumb";
                thumb.innerHTML = `
                    <img src="${e.target.result}" alt="${file.name}">
                    <div class="thumb-name">${file.name}</div>
                `;
                previewThumbs.appendChild(thumb);

                processedFiles++;
                updateProgressBar(processedFiles, totalFiles, progressWrap);

                if (processedFiles === totalFiles) {
                    setTimeout(() => {
                        progressWrap.style.display = "none";
                        updatePreviewCount();
                        // Reset file input for re-upload capability
                        const fileInput = document.getElementById("imageFileInput");
                        if (fileInput) fileInput.value = "";
                        // Clear processing flag after all files are processed
                        isProcessingFiles = false;
                        console.log("✅ File processing complete");
                    }, 300);
                }
            } catch (error) {
                console.error(`❌ Error processing file ${file.name}:`, error);
                processedFiles++;
                updateProgressBar(processedFiles, totalFiles, progressWrap);
                if (processedFiles === totalFiles) {
                    isProcessingFiles = false;
                }
            }
        };

        reader.onerror = () => {
            console.error(`❌ Failed to read file: ${file.name}`);
            processedFiles++;
            updateProgressBar(processedFiles, totalFiles, progressWrap);
            if (processedFiles === totalFiles) {
                isProcessingFiles = false;
            }
        };

        reader.readAsDataURL(file);
    });
}

function updateProgressBar(current, total, progressWrap) {
    const percent = Math.round((current / total) * 100);
    const progressFill = document.getElementById("progressFill");
    const progressLabel = document.getElementById("progressLabel");
    
    if (progressFill) progressFill.style.width = percent + "%";
    if (progressLabel) progressLabel.textContent = `Reading images… ${current} / ${total}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function estimateFileSizeInBytes() {
    // Estimate base HTML template size (includes all the styling and scripts)
    let estimatedSize = 45000; // Approximate size of base HTML template
    
    // Add size of all Base64 images
    uploadedImages.forEach(img => {
        if (img.data) {
            // Base64 string length is roughly the size in bytes when decoded
            estimatedSize += img.data.length;
        }
    });
    
    return estimatedSize;
}

function updatePreviewCount() {
    const count = uploadedImages.length;
    let countText = count + (count === 1 ? " image selected" : " images selected");
    
    // Add estimated file size
    if (count > 0) {
        const estimatedSize = estimateFileSizeInBytes();
        const formattedSize = formatFileSize(estimatedSize);
        countText += ` • Estimated: ${formattedSize}`;
        
        // Reset generation flag if image count changed
        if (count !== lastGeneratedImageCount && isGalleryGenerated) {
            isGalleryGenerated = false;
            console.log("♻️ Image count changed, generation flag reset");
        }
    }
    
    document.getElementById("previewCount").textContent = countText;
}

function clearImages() {
    uploadedImages = [];
    isProcessingFiles = false;
    isGalleryGenerated = false;
    lastGeneratedImageCount = 0;
    const fileInput = document.getElementById("imageFileInput");
    if (fileInput) {
        fileInput.value = "";
    }
    document.getElementById("previewThumbs").innerHTML = "";
    document.getElementById("previewGrid").style.display = "none";
    document.getElementById("progressWrap").style.display = "none";
    console.log("✅ Images cleared and ready for new upload");
}

// =========================================================
//  GALLERY GENERATION
// =========================================================

// =========================
// DOWNLOAD
// =========================
function downloadFile() {
    if (!generatedHTML) {
        showNotification("Please generate your gallery first.");
        return;
    }
    const blob = new Blob([generatedHTML], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "interactive-selection-gallery.html";
    link.click();
    showNotification("Your gallery was successfully saved.");
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

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    setupUploadZone();
    updateConnectionStatus();
    console.log("✅ Gallery App initialized");
    console.log("🔑 Firebase configured:", firebase.app() ? "✅" : "❌");
    console.log("💳 Razorpay Key ID:", RAZORPAY_KEY_ID ? "✅" : "❌");
    console.log("📡 Connection Status:", isOnline ? "🟢 Online" : "🔴 Offline");
});
