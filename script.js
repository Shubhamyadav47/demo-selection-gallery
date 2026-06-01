
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
//  TOKEN MANAGEMENT - Local Storage + Firestore
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
}

async function saveTokensToFirestore(uid, tokens) {
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
    }
}

async function loadTokensFromFirestore(uid) {
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
    try {
        await db.collection("users").doc(uid).collection("payments").add({
            ...paymentData,
            status: "completed"
        });
        console.log("✅ Payment record saved to Firestore");
    } catch (error) {
        console.error("❌ Error saving payment record:", error);
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

    } else {
        // ── Signed out ─────────────────────────────────────
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

function setupUploadZone() {
    const uploadZone = document.getElementById("uploadZone");
    const fileInput = document.getElementById("imageFileInput");

    uploadZone.addEventListener("click", () => fileInput.click());

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
        handleFileSelect(e.dataTransfer.files);
    });

    fileInput.addEventListener("change", (e) => {
        handleFileSelect(e.target.files);
    });
}

function handleFileSelect(files) {
    uploadedImages = [];
    const previewThumbs = document.getElementById("previewThumbs");
    const previewGrid = document.getElementById("previewGrid");
    const progressWrap = document.getElementById("progressWrap");

    previewThumbs.innerHTML = "";

    if (files.length === 0) {
        previewGrid.style.display = "none";
        progressWrap.style.display = "none";
        return;
    }

    previewGrid.style.display = "block";
    progressWrap.style.display = "block";

    const totalFiles = files.length;
    let processedFiles = 0;

    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();

        reader.onload = (e) => {
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
            const percent = Math.round((processedFiles / totalFiles) * 100);
            const progressFill = document.getElementById("progressFill");
            progressFill.style.width = percent + "%";
            document.getElementById("progressLabel").textContent = `Reading images… ${processedFiles} / ${totalFiles}`;

            if (processedFiles === totalFiles) {
                setTimeout(() => {
                    progressWrap.style.display = "none";
                    updatePreviewCount();
                }, 300);
            }
        };

        reader.readAsDataURL(file);
    });
}

function updatePreviewCount() {
    const count = uploadedImages.length;
    document.getElementById("previewCount").textContent = 
        count + (count === 1 ? " image selected" : " images selected");
}

function clearImages() {
    uploadedImages = [];
    document.getElementById("imageFileInput").value = "";
    document.getElementById("previewThumbs").innerHTML = "";
    document.getElementById("previewGrid").style.display = "none";
    document.getElementById("progressWrap").style.display = "none";
}

// =========================================================
//  GALLERY GENERATION
// =========================================================

let generatedHTML = null;

function generateGallery() {
    if (uploadedImages.length === 0) {
        showNotification("Please upload at least one image.");
        return;
    }

    const title = document.getElementById("galleryTitle").value || "My Gallery";
    const password = document.getElementById("galleryPassword").value;
    const whatsappNumber = document.getElementById("whatsappNumber").value;

    const btn = document.getElementById("generateBtn");
    btn.disabled = true;
    btn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></path></svg> Generating...`;

    setTimeout(() => {
        try {
            const imageData = uploadedImages.map(img => ({
                name: img.name.replace(/\.[^/.]+$/, "").toUpperCase(),
                src: img.data
            }));

            const imageTags = imageData.map(img => `
                <div class="gallery-item" onclick="toggleSelection(this)">
                    <img src="${img.src}" alt="${img.name}">
                    <div class="overlay">
                        <span class="name">${img.name}</span>
                        <svg class="checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></path>
                        </svg>
                    </div>
                </div>
            `).join("");

            const loginHTML = password ? `
                <div id="passwordOverlay" class="password-overlay">
                    <div class="password-card">
                        <h3>Gallery Protected</h3>
                        <p>This gallery is password protected. Enter password to view:</p>
                        <input type="password" id="passwordInput" placeholder="Enter password" />
                        <button onclick="verifyPassword('${password}')">Unlock</button>
                        <div id="passwordError" class="password-error"></div>
                    </div>
                </div>
            ` : "";

            const passwordScript = password ? `
                <script>
                    function verifyPassword(correctPassword) {
                        const input = document.getElementById('passwordInput').value;
                        const errorDiv = document.getElementById('passwordError');
                        if (input === correctPassword) {
                            document.getElementById('passwordOverlay').style.display = 'none';
                            document.getElementById('galleryContent').style.display = 'block';
                        } else {
                            errorDiv.textContent = '❌ Incorrect password';
                        }
                    }
                    document.getElementById('passwordInput').addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') verifyPassword('${password}');
                    });
                </script>
            ` : "";

            generatedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        :root {
            --primary: #4F46E5;
            --primary-hover: #4338CA;
            --success: #10B981;
            --success-hover: #059669;
            --background: #F3F4F6;
            --card-bg: #FFFFFF;
            --text-main: #1F2937;
            --text-body: #6B7280;
            --border-color: #E5E7EB;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: var(--background);
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
        }

        .password-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .password-card {
            background: white;
            padding: 40px;
            border-radius: 12px;
            max-width: 400px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }

        .password-card h3 {
            font-size: 20px;
            margin-bottom: 10px;
            color: var(--text-main);
        }

        .password-card p {
            color: var(--text-body);
            margin-bottom: 20px;
            font-size: 14px;
        }

        .password-card input {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 15px;
            text-align: center;
            background-color: #F9FAFB;
        }

        .password-card input:focus {
            outline: none;
            border-color: var(--primary);
            background-color: #FFF;
        }

        .password-card button {
            width: 100%;
            padding: 12px;
            background-color: var(--primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            font-size: 15px;
            transition: all 0.2s ease;
        }

        .password-card button:hover {
            background-color: var(--primary-hover);
        }

        .password-error {
            color: #EF4444;
            font-size: 13px;
            margin-top: 12px;
            font-weight: 600;
        }

        #galleryContent {
            display: ${password ? "none" : "block"};
        }

        .gallery-header {
            max-width: 900px;
            width: 100%;
            text-align: center;
            margin-bottom: 40px;
        }

        .gallery-header h1 {
            font-size: 32px;
            font-weight: 800;
            color: var(--text-main);
            margin-bottom: 12px;
        }

        .gallery-header p {
            color: var(--text-body);
            font-size: 15px;
            line-height: 1.6;
        }

        .gallery-container {
            max-width: 900px;
            width: 100%;
            background: var(--card-bg);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
            border: 1px solid var(--border-color);
        }

        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 30px;
        }

        .gallery-item {
            position: relative;
            overflow: hidden;
            border-radius: 12px;
            aspect-ratio: 1;
            cursor: pointer;
            border: 2px solid var(--border-color);
            transition: all 0.3s ease;
            background: #f0f0f0;
        }

        .gallery-item:hover {
            border-color: var(--primary);
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
        }

        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .gallery-item .overlay {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .gallery-item:hover .overlay {
            opacity: 1;
        }

        .gallery-item.selected .overlay {
            opacity: 1;
            background: rgba(79, 70, 229, 0.6);
        }

        .gallery-item .name {
            color: white;
            font-size: 12px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 8px;
        }

        .gallery-item .checkmark {
            width: 32px;
            height: 32px;
            stroke: white;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .gallery-item.selected .checkmark {
            opacity: 1;
        }

        .action-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            padding: 20px;
            background: #F9FAFB;
            border-radius: 12px;
            border: 1px solid var(--border-color);
        }

        .info-wrap {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .counter {
            font-size: 16px;
            font-weight: 700;
            color: var(--primary);
        }

        .help-text {
            font-size: 13px;
            color: var(--text-body);
        }

        .action-buttons {
            display: flex;
            gap: 12px;
        }

        .action-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            background: white;
            border: 1.5px solid var(--border-color);
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s ease;
        }

        .action-btn:hover {
            border-color: var(--primary);
            background: var(--primary);
            color: white;
        }

        .btn-copy { color: var(--primary); }
        .btn-send-wa { color: #25D366; }

        .btn-copy:hover { border-color: var(--primary); }
        .btn-send-wa:hover { border-color: #25D366; }

        .toast-notify {
            position: fixed;
            bottom: 95px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background-color: #1F2937;
            color: #FFFFFF;
            padding: 12px 24px;
            border-radius: 50px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
            transition: transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275);
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
        }

        .toast-notify.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }

        #galleryContent { display: ${password ? "none" : "block"}; }

        @media(max-width: 640px) {
            .action-bar { flex-direction: column; gap: 12px; padding: 12px; }
            .action-buttons { width: 100%; }
            .action-btn { flex: 1; justify-content: center; }
            .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
        }

        .zoom-btn {
            position: absolute;
            top: 12px;
            left: 12px;
            width: 38px;
            height: 38px;
            border: none;
            border-radius: 50%;
            background: rgba(0,0,0,0.75);
            color: white;
            font-size: 18px;
            cursor: pointer;
            z-index: 20;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(6px);
            transition: all 0.2s ease;
        }

        .zoom-btn:hover {
            transform: scale(1.1);
            background: rgba(0,0,0,0.9);
        }

        .zoom-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.94);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 99999;
            padding: 20px;
        }

        .zoom-overlay img {
            max-width: 96%;
            max-height: 96%;
            object-fit: contain;
            border-radius: 12px;
        }
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
            ${whatsappNumber ? `
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
    const myWhatsAppNumber = "${whatsappNumber}";

    function toggleSelection(element) {
        const photoName = element.getAttribute('data-name') || element.querySelector('.name').textContent;
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
            showNotification("Interactive Gallery Compiled! (" + imageData.length + " images embedded) — 1 token used.");

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
    console.log("✅ Gallery App initialized");
    console.log("🔑 Firebase configured:", firebase.app() ? "✅" : "❌");
    console.log("💳 Razorpay Key ID:", RAZORPAY_KEY_ID ? "✅" : "❌");
});
