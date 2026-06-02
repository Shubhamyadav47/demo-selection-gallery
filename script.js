// =========================================================
//  FIREBASE CONFIGURATION
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
const db = firebase.firestore();

// =========================================================
//  RAZORPAY CONFIGURATION
// =========================================================
const RAZORPAY_KEY_ID = "rzp_live_SwGNmwWnuOPH5e"; 
const RAZORPAY_API_URL = "https://api.razorpay.com/v1"; 

const FREE_TOKENS_ON_SIGNUP = 2;
const TOKENS_PER_GENERATION = 1;

const PURCHASE_PRICES = {
    1: 2500,    // ₹25
    5: 9900,    // ₹99
    10: 17900,  // ₹179
    25: 49900,  // ₹499
};

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
            break; 
        }
    }
    
    localStorage.removeItem(syncKey);
    showNotification("✅ Offline changes synced successfully!");
}

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

function deleteCookie(name) {
    try {
        setCookie(name, "", -1);
        console.log(`✅ Cookie deleted: ${name}`);
    } catch (error) {
        console.error(`❌ Error deleting cookie ${name}:`, error);
    }
}

function setTokenCookie(uid, tokens) {
    if (!uid) return;
    const cookieName = `token_${uid}`;
    setCookie(cookieName, String(tokens), 30);
}

function getTokenCookie(uid) {
    if (!uid) return null;
    const cookieName = `token_${uid}`;
    const value = getCookie(cookieName);
    return value !== null ? parseInt(value, 10) : null;
}

function setAuthTokenCookie(token) {
    if (!token) return;
    setCookie("authToken", token, 7);
}

function getAuthTokenCookie() {
    return getCookie("authToken");
}

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

function getUserSessionCookie() {
    const session = getCookie("userSession");
    try {
        return session ? JSON.parse(session) : null;
    } catch (error) {
        console.error("❌ Error parsing user session cookie:", error);
        return null;
    }
}

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
//  TOKEN MANAGEMENT
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
    setTokenCookie(uid, amount);
}

async function saveTokensToFirestore(uid, tokens) {
    if (!isOnline) {
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
        if (isOnline) {
            queueOfflineSync(uid, { type: "saveTokens", tokens });
        }
    }
}

async function loadTokensFromFirestore(uid) {
    if (!isOnline) {
        console.log("⏳ Offline mode - using local tokens only");
        return null;
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
        amount: priceInPaise, 
        currency: "INR",
        name: "Gallery Generator",
        description: `Buy ${tokenAmount} Token${tokenAmount !== 1 ? "s" : ""}`,
        prefill: {
            name: user.displayName || "User",
            email: user.email,
        },
        handler: function (response) {
            console.log("✅ Payment successful:", response);
            
            const newBalance = changeTokenBalance(tokenAmount);
            
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
            color: "#4F46E5" 
        }
    };

    const razorpay = new Razorpay(options);
    razorpay.on('payment.failed', function (response) {
        console.error("❌ Payment failed:", response.error);
        showNotification(`Payment failed: ${response.error.description}`);
    });
    razorpay.open();
}

async function savePaymentRecord(uid, paymentData) {
    if (!isOnline) {
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
    
    initiateRazorpayPayment(amount, price);
}

// =========================================================
//  AUTH STATE OBSERVER
// =========================================================
auth.onAuthStateChanged(async (user) => {
    const authOverlay = document.getElementById("authOverlay");
    const mainApp     = document.getElementById("mainApp");

    if (user) {
        setUserSessionCookie(user);
        
        authOverlay.style.transition    = "opacity 0.35s ease";
        authOverlay.style.opacity       = "0";
        authOverlay.style.pointerEvents = "none";
        setTimeout(() => { authOverlay.style.display = "none"; }, 360);

        mainApp.style.display = "flex";

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

        const firestoreTokens = await loadTokensFromFirestore(user.uid);
        if (firestoreTokens !== null && firestoreTokens !== undefined) {
            setStoredTokenBalance(user.uid, firestoreTokens);
        }
        ensureUserTokenBalance(user);
        
        if (isOnline) {
            await processOfflineSyncQueue(user.uid);
        }

    } else {
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
//  IMAGE UPLOAD, PROCESSING & PREVIEW
// =========================================================

let uploadedImages = [];
let uploadZoneInitialized = false; 
let isProcessingFiles = false; 
let isGalleryGenerated = false; 
let lastGeneratedImageCount = 0; 

function setupProcessingOptions() {
    const wmCheck = document.getElementById('enableWatermark');
    const wmGroup = document.getElementById('watermarkGroup');
    if (wmCheck && wmGroup) {
        wmCheck.addEventListener('change', (e) => {
            wmGroup.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    const compCheck = document.getElementById('compressImages');
    const compGroup = document.getElementById('compressGroup');
    if (compCheck && compGroup) {
        compCheck.addEventListener('change', (e) => {
            compGroup.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    const qualitySlider = document.getElementById('compressQuality');
    const qualityVal = document.getElementById('qualityVal');
    if (qualitySlider && qualityVal) {
        qualitySlider.addEventListener('input', (e) => {
            qualityVal.textContent = Math.round(e.target.value * 100) + '%';
        });
    }
}

function setupUploadZone() {
    if (uploadZoneInitialized) return;
    
    const uploadZone = document.getElementById("uploadZone");
    const fileInput = document.getElementById("imageFileInput");

    if (!uploadZone || !fileInput) return;

    uploadZone.addEventListener("click", (e) => {
        if (isProcessingFiles) return;
        e.stopPropagation(); e.preventDefault();
        fileInput.click();
    });

    uploadZone.addEventListener("dragover", (e) => { e.preventDefault(); uploadZone.classList.add("drag-over"); });
    uploadZone.addEventListener("dragleave", (e) => { e.preventDefault(); uploadZone.classList.remove("drag-over"); });
    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault(); uploadZone.classList.remove("drag-over");
        if (!isProcessingFiles) handleFileSelect(e.dataTransfer.files);
    });
    
    fileInput.addEventListener("change", (e) => {
        if (!isProcessingFiles) handleFileSelect(e.target.files);
    });

    uploadZoneInitialized = true;
}

// Promise wrapper to process an image with Canvas (Compress + Watermark)
function processImage(file) {
    return new Promise((resolve, reject) => {
        const compress = document.getElementById('compressImages').checked;
        const quality = parseFloat(document.getElementById('compressQuality').value);
        const watermark = document.getElementById('enableWatermark').checked;
        const watermarkText = document.getElementById('watermarkText').value.trim();

        const reader = new FileReader();
        reader.onload = (e) => {
            if (!compress && (!watermark || !watermarkText)) {
                resolve(e.target.result); // Return original if no processing needed
                return;
            }

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;

                if (compress) {
                    const MAX_DIMENSION = 1600; // Optimal max dimension for standard screens
                    if (width > height && width > MAX_DIMENSION) {
                        height = Math.round((height * MAX_DIMENSION) / width);
                        width = MAX_DIMENSION;
                    } else if (height > width && height > MAX_DIMENSION) {
                        width = Math.round((width * MAX_DIMENSION) / height);
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                if (watermark && watermarkText) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // Semi-transparent white
                    const fontSize = Math.max(30, Math.floor(width / 20));
                    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Shadow for high visibility
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;

                    ctx.translate(width / 2, height / 2);
                    ctx.rotate(-Math.PI / 6); // Slanted
                    ctx.fillText(watermarkText, 0, 0);
                }

                const outputType = compress ? 'image/jpeg' : file.type;
                const outputQuality = compress ? quality : 1.0;
                resolve(canvas.toDataURL(outputType, outputQuality));
            };
            img.onerror = () => reject(new Error("Image load error"));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsDataURL(file);
    });
}

// Async File processing loop to prevent browser freezing
async function handleFileSelect(files) {
    if (!files || files.length === 0) {
        clearImages();
        return;
    }

    isProcessingFiles = true;
    uploadedImages = []; 
    const previewThumbs = document.getElementById("previewThumbs");
    const previewGrid = document.getElementById("previewGrid");
    const progressWrap = document.getElementById("progressWrap");

    previewThumbs.innerHTML = "";
    previewGrid.style.display = "block";
    progressWrap.style.display = "block";

    const filesArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    const totalFiles = filesArray.length;
    let processedFiles = 0;

    for (let i = 0; i < totalFiles; i++) {
        const file = filesArray[i];
        
        try {
            // Give UI a tiny break to update the progress bar before halting via heavy canvas drawing
            await new Promise(resolve => setTimeout(resolve, 20));
            
            const dataUrl = await processImage(file);

            uploadedImages[i] = {
                name: file.name,
                data: dataUrl
            };

            const thumb = document.createElement("div");
            thumb.className = "preview-thumb";
            thumb.innerHTML = `
                <img src="${dataUrl}" alt="${file.name}">
                <div class="thumb-name">${file.name}</div>
            `;
            previewThumbs.appendChild(thumb);
        } catch (error) {
            console.error(`❌ Error processing file ${file.name}:`, error);
        }

        processedFiles++;
        updateProgressBar(processedFiles, totalFiles, progressWrap);
    }

    setTimeout(() => {
        progressWrap.style.display = "none";
        updatePreviewCount();
        const fileInput = document.getElementById("imageFileInput");
        if (fileInput) fileInput.value = "";
        isProcessingFiles = false;
        console.log("✅ File processing complete");
    }, 300);
}

function updateProgressBar(current, total, progressWrap) {
    const percent = Math.round((current / total) * 100);
    const progressFill = document.getElementById("progressFill");
    const progressLabel = document.getElementById("progressLabel");
    
    if (progressFill) progressFill.style.width = percent + "%";
    if (progressLabel) progressLabel.textContent = `Processing images… ${current} / ${total}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function estimateFileSizeInBytes() {
    let estimatedSize = 45000; 
    uploadedImages.forEach(img => {
        if (img.data) {
            estimatedSize += img.data.length;
        }
    });
    return estimatedSize;
}

function updatePreviewCount() {
    const count = uploadedImages.length;
    let countText = count + (count === 1 ? " image selected" : " images selected");
    
    if (count > 0) {
        const estimatedSize = estimateFileSizeInBytes();
        const formattedSize = formatFileSize(estimatedSize);
        countText += ` • Estimated Code Size: ${formattedSize}`;
        
        if (count !== lastGeneratedImageCount && isGalleryGenerated) {
            isGalleryGenerated = false;
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
    if (fileInput) fileInput.value = "";
    document.getElementById("previewThumbs").innerHTML = "";
    document.getElementById("previewGrid").style.display = "none";
    document.getElementById("progressWrap").style.display = "none";
}
// =========================================================
//  GALLERY GENERATION
// =========================================================

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let generatedHTML = null;

function generateGallery() {
    if (uploadedImages.length === 0) {
        showNotification("Please upload at least one image.");
        return;
    }

    if (isGalleryGenerated && uploadedImages.length === lastGeneratedImageCount) {
        showNotification("⚠️ Gallery already generated with these images. Clear and upload new images to generate again.");
        return;
    }

    const rawTitle = document.getElementById("galleryTitle").value.trim() || "My Selection Gallery";
    const title = escapeHtml(rawTitle);
    
    const password = document.getElementById("galleryPassword").value.trim();
    const escapedPasswordJs = password.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    
    const waNumber = document.getElementById("whatsappNumber").value.trim().replace(/[^0-9]/g, "");

    const btn = document.getElementById("generateBtn");
    btn.disabled = true;
    btn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></path></svg> Generating...`;

    setTimeout(() => {
        try {
            const imageData = uploadedImages.map(img => {
                const cleanName = img.name.replace(/\s*\([^)]*\)(?=\.[^.]+$)/i, '');
                return {
                    name: cleanName,
                    dataUrl: img.data
                };
            });

            const imageTags = imageData.map(({ name, dataUrl }) => {
                const escapedName = escapeHtml(name);
                const jsSafeName = escapedName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                return `
                <div class="photo-card" data-name="${jsSafeName}" onclick="toggleSelection(this)">
                    <div class="image-wrapper">
                        <div class="fallback-placeholder">${escapedName}</div>
                        <button class="zoom-btn" onclick="event.stopPropagation(); openZoom(this.closest('.photo-card').querySelector('img').src)">🔍</button>
                        <img src="${dataUrl}" alt="${escapedName}" loading="lazy">
                    </div>
                    <div class="photo-name">${escapedName}</div>
                </div>`;
            }).join("");

            const loginHTML = password ? `
            <div id="loginScreen" class="login-screen">
                <div class="login-card">
                    <div class="lock-icon">🔒</div>
                    <h2>Private Gallery</h2>
                    <p>Enter the passcode to view and select your photos.</p>
                    <input type="password" id="passwordInput" placeholder="Password Access">
                    <button class="btn-primary" onclick="checkPassword()">Unlock Gallery</button>
                    <div id="loginError" class="login-error">Incorrect password. Please try again.</div>
                </div>
            </div>` : "";

            const passwordScript = password ? `
            <script>
            const correctPassword = "${escapedPasswordJs}";
            function checkPassword() {
                const entered = document.getElementById("passwordInput").value;
                const errorDiv = document.getElementById("loginError");
                if (entered === correctPassword) {
                    document.getElementById("loginScreen").style.display = "none";
                    document.getElementById("galleryContent").style.display = "block";
                } else {
                    errorDiv.style.opacity = "1";
                    setTimeout(() => { errorDiv.style.opacity = "0"; }, 3000);
                }
            }
            document.getElementById("passwordInput")?.addEventListener("keyup", function(event) {
                if (event.key === "Enter") { checkPassword(); }
            });
            <\/script>` : "";

            generatedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        :root {
            --primary: #111827;
            --primary-hover: #1F2937;
            --accent: #10B981;
            --accent-hover: #059669;
            --bg-main: #F9FAFB;
            --bg-card: #FFFFFF;
            --text-title: #111827;
            --text-body: #4B5563;
            --border-color: #E5E7EB;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-main);
            color: var(--text-title);
            line-height: 1.5;
            padding-bottom: 90px;
        }
        .gallery-header {
            background-color: var(--bg-card);
            border-bottom: 1px solid var(--border-color);
            padding: 40px 20px;
            text-align: center;
        }
        .gallery-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.025em; }
        .gallery-header p { color: var(--text-body); font-size: 15px; max-width: 600px; margin: 0 auto; }
        .gallery-container { max-width: 1300px; margin: 0 auto; padding: 30px 20px; }
        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .photo-card {
            background-color: var(--bg-card);
            border: 2px solid transparent;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        }
        .photo-card:hover { transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
        .image-wrapper {
            position: relative;
            width: 100%;
            background-color: #F3F4F6;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px;
            min-height: 260px;
        }
        .fallback-placeholder {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-color: #E5E7EB; color: #6B7280;
            display: flex; align-items: center; justify-content: center;
            font-size: 13px; font-weight: 600; padding: 16px;
            text-align: center; box-sizing: border-box; word-break: break-all; z-index: 1;
        }
        .photo-card img {
            position: relative; max-width: 100%; max-height: 80vh;
            width: auto; height: auto; object-fit: contain; display: block;
            transition: transform 0.4s ease; z-index: 2;
        }
        .photo-card:hover img { transform: none; }
        .photo-name {
            padding: 12px 16px; font-size: 13px; font-weight: 600; color: #374151;
            text-align: center; border-top: 1px solid var(--border-color);
            background-color: var(--bg-card); white-space: nowrap;
            text-overflow: ellipsis; overflow: hidden;
        }
        .photo-card.selected { border-color: var(--accent); transform: scale(0.98); box-shadow: 0 0 0 2px rgba(16,185,129,0.15); }
        .photo-card.selected::after {
            content: "✓ Selected"; position: absolute; top: 12px; right: 12px;
            background-color: var(--accent); color: white; padding: 4px 10px;
            font-size: 11px; font-weight: 700; border-radius: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase;
            letter-spacing: 0.05em; z-index: 10;
        }
        .action-bar {
            position: fixed; bottom: 0; left: 0; right: 0;
            background-color: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
            border-top: 1px solid var(--border-color); padding: 16px 24px;
            box-shadow: 0 -10px 15px -3px rgba(0,0,0,0.05);
            display: flex; justify-content: space-between; align-items: center; z-index: 999;
        }
        .action-bar .info-wrap { display: flex; flex-direction: column; }
        .action-bar span.counter { font-size: 18px; font-weight: 800; color: var(--primary); }
        .action-bar p.help-text { font-size: 12px; color: var(--text-body); }
        .action-buttons { display: flex; gap: 12px; }
        .action-btn {
            padding: 12px 20px; font-size: 14px; font-weight: 700;
            border-radius: 8px; border: none; cursor: pointer;
            transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px;
        }
        .btn-copy { background-color: #E5E7EB; color: #374151; }
        .btn-copy:hover { background-color: #D1D5DB; }
        .btn-send-wa { background-color: var(--accent); color: white; }
        .btn-send-wa:hover { background-color: var(--accent-hover); }
        .login-screen {
            height: 100vh; width: 100vw;
            display: flex; justify-content: center; align-items: center;
            background-color: var(--bg-main); position: fixed; top: 0; left: 0; z-index: 10000;
        }
        .login-card {
            background-color: var(--bg-card); border: 1px solid var(--border-color);
            padding: 40px; max-width: 420px; width: 100%; border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); text-align: center;
        }
        .lock-icon { font-size: 40px; margin-bottom: 16px; }
        .login-card h2 { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
        .login-card p { font-size: 14px; color: var(--text-body); margin-bottom: 24px; }
        .login-card input {
            width: 100%; padding: 12px; border: 1px solid var(--border-color);
            border-radius: 8px; margin-bottom: 16px; font-size: 15px;
            text-align: center; background-color: #F9FAFB;
        }
        .login-card input:focus { outline: none; border-color: var(--accent); background-color: #FFF; }
        .btn-primary {
            width: 100%; padding: 12px; background-color: var(--primary); color: white;
            border: none; border-radius: 8px; font-weight: 700; cursor: pointer;
            font-size: 15px; transition: all 0.2s ease;
        }
        .btn-primary:hover { background-color: var(--primary-hover); }
        .login-error { color: #EF4444; font-size: 13px; margin-top: 12px; font-weight: 600; opacity: 0; transition: opacity 0.2s ease; }
        .toast-notify {
            position: fixed; bottom: 95px; left: 50%;
            transform: translateX(-50%) translateY(100px);
            background-color: #1F2937; color: #FFFFFF;
            padding: 12px 24px; border-radius: 50px; font-size: 14px; font-weight: 500;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
            transition: transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275);
            z-index: 1000; pointer-events: none; opacity: 0;
        }
        .toast-notify.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        #galleryContent { display: ${password ? "none" : "block"}; }
        @media(max-width: 640px) {
            .action-bar { flex-direction: column; gap: 12px; padding: 12px; }
            .action-buttons { width: 100%; }
            .action-btn { flex: 1; justify-content: center; }
        }
        .zoom-btn {
            position: absolute; top: 12px; left: 12px;
            width: 38px; height: 38px; border: none; border-radius: 50%;
            background: rgba(0,0,0,0.75); color: white; font-size: 18px;
            cursor: pointer; z-index: 20; display: flex; align-items: center;
            justify-content: center; backdrop-filter: blur(6px); transition: all 0.2s ease;
        }
        .zoom-btn:hover { transform: scale(1.1); background: rgba(0,0,0,0.9); }
        .zoom-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.94);
            display: none; justify-content: center; align-items: center;
            z-index: 99999; padding: 20px;
        }
        .zoom-overlay img { max-width: 96%; max-height: 96%; object-fit: contain; border-radius: 12px; }
    </style>
</head>
<body>

${loginHTML}

<div id="galleryContent">
    <header class="gallery-header">
        <h1>${title}</h1>
        <p>Select your favorite photos by clicking/tapping them. Once completed, share or copy the final list from the bottom action panel.</p>
    </header>

    <div class="gallery-container">
        <div class="gallery-grid">
            ${imageTags}
        </div>
    </div>

    <div class="action-bar">
        <div class="info-wrap">
            <span class="counter" id="count">0 Photos Selected</span>
            <p class="help-text">Click images to select/deselect</p>
        </div>
        <div class="action-buttons">
            <button class="action-btn btn-copy" onclick="copyListToClipboard()">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                Copy Selection
            </button>
            ${waNumber ? `
            <button class="action-btn btn-send-wa" onclick="sendToWhatsApp()">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.458L0 24zm6.052-4.144c1.6.95 3.177 1.45 4.809 1.451 5.485 0 9.947-4.46 9.951-9.948.002-2.66-1.019-5.162-2.87-7.017C16.141 2.488 13.64 1.47 11.002 1.47c-5.489 0-9.952 4.461-9.955 9.95-.001 1.724.47 3.413 1.365 4.907L1.442 20.89l4.667-1.034zM18.22 15c-.29-.146-1.713-.846-1.977-.942-.265-.096-.458-.145-.65.146-.193.29-.747.942-.916 1.135-.169.193-.338.217-.628.072-2.902-1.45-4.004-2.522-5.495-5.078-.393-.675.393-.627 1.125-2.088.13-.25.065-.47-.033-.664-.096-.193-.747-1.802-1.024-2.47-.27-.648-.544-.56-.747-.57l-.634-.012c-.217 0-.57.081-.868.41-.298.328-1.135 1.109-1.135 2.701 0 1.593 1.157 3.131 1.317 3.348.16.217 2.278 3.48 5.517 4.881 2.695 1.166 3.242.934 3.822.879.578-.055 1.714-.7 1.955-1.378.24-.678.24-1.259.169-1.378-.071-.12-.264-.193-.554-.339z"/></svg>
                Send via WhatsApp
            </button>` : ""}
        </div>
    </div>
</div>

<div id="toast" class="toast-notify">Selection Copied!</div>

<script>
    let selectedPhotos = new Set();
    const myWhatsAppNumber = "${waNumber}";

    function toggleSelection(element) {
        const photoName = element.getAttribute('data-name');
        if (selectedPhotos.has(photoName)) {
            selectedPhotos.delete(photoName);
            element.classList.remove('selected');
        } else {
            selectedPhotos.add(photoName);
            element.classList.add('selected');
        }
        document.getElementById('count').innerText = selectedPhotos.size + " Photos Selected";
    }

    function showToast(text) {
        const toast = document.getElementById("toast");
        toast.innerText = text;
        toast.classList.add("show");
        setTimeout(() => { toast.classList.remove("show"); }, 2500);
    }

    function getFormattedText() {
        if (selectedPhotos.size === 0) return "";
        return Array.from(selectedPhotos)
            .map(name => name.replace(/\\s*\\([^)]*\\)(?=\\.[^.]+$)/i, '').replace(/\\.[^/.]+$/, ".JPG"))
            .join(" OR ");
    }

    function copyListToClipboard() {
        if (selectedPhotos.size === 0) { showToast("Please select at least one photo first!"); return; }
        const textToCopy = getFormattedText();
        const tempTextarea = document.createElement("textarea");
        tempTextarea.value = textToCopy;
        document.body.appendChild(tempTextarea);
        tempTextarea.select();
        try { document.execCommand('copy'); showToast("Selection list copied to clipboard!"); }
        catch (err) { showToast("Failed to copy list."); }
        document.body.removeChild(tempTextarea);
    }

    function sendToWhatsApp() {
        if (selectedPhotos.size === 0) { showToast("Please select at least one photo first!"); return; }
        const message = encodeURIComponent(getFormattedText());
        window.open("https://wa.me/" + myWhatsAppNumber + "?text=" + message, '_blank');
    }

    function openZoom(src) {
        document.getElementById("zoomedImage").src = src;
        document.getElementById("zoomOverlay").style.display = "flex";
        document.body.style.overflow = "hidden";
    }

    function closeZoom() {
        document.getElementById("zoomOverlay").style.display = "none";
        document.body.style.overflow = "auto";
    }
<\/script>

${passwordScript}

<div class="zoom-overlay" id="zoomOverlay" onclick="closeZoom()">
    <img id="zoomedImage" src="">
</div>

</body>
</html>`;

            spendTokens(TOKENS_PER_GENERATION);
            const downloadBtn = document.getElementById("downloadBtn");
            downloadBtn.classList.add("active");
            
            isGalleryGenerated = true;
            lastGeneratedImageCount = imageData.length;
            
            const actualFileSize = new Blob([generatedHTML], { type: "text/html" }).size;
            const formattedSize = formatFileSize(actualFileSize);
            
            showNotification(`✅ Gallery Generated! (${imageData.length} images • ${formattedSize}) — 1 token used.`);

        } catch (err) {
            showNotification("Error building gallery: " + err.message);
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg fill="none" height="20" stroke="currentColor" viewBox="0 0 24 24" width="20"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></path></svg> Generate HTML Code`;
        }
    }, 50);
}

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