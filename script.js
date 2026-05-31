
// =========================================================
//  FIREBASE CONFIGURATION
//  ─────────────────────────────────────────────────────────
//  1. Open https://console.firebase.google.com
//  2. Create (or open) a project
//  3. Project Settings → Your Apps → Add Web App → copy config
//  4. Authentication → Sign-in method → enable:
//       ✅  Email / Password
//       ✅  Google
//  5. Authentication → Settings → Authorized domains → add your
//     domain (localhost is allowed by default for testing)
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
// Initialize Firebase only once
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
let currentCredits = 0;
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentCredits = 0; // Global variable to track user credits


// =========================================================
//  AUTH STATE OBSERVER
//  Fires automatically on every sign-in / sign-out event
// =========================================================
auth.onAuthStateChanged(async (user) => {
    const authOverlay = document.getElementById("authOverlay");
    const mainApp     = document.getElementById("mainApp");

    if (user) {
        // Handle UI Fade Out
        authOverlay.style.transition    = "opacity 0.35s ease";
        authOverlay.style.opacity       = "0";
        authOverlay.style.pointerEvents = "none";
        setTimeout(() => { authOverlay.style.display = "none"; }, 360);
        mainApp.style.display = "flex";

        // Populate User Info
        const displayName = user.displayName || user.email.split("@")[0];
        document.getElementById("userDisplayName").textContent = displayName;
        document.getElementById("userEmailDisplay").textContent = user.email;
        
        // Handle Avatar
        const avatarImg    = document.getElementById("userAvatarImg");
        const userInitials = document.getElementById("userInitials");
        if (user.photoURL) {
            avatarImg.src = user.photoURL;
            avatarImg.style.display = "block";
            userInitials.style.display = "none";
        } else {
            avatarImg.style.display = "none";
            userInitials.style.display = "flex";
            userInitials.textContent = displayName[0].toUpperCase();
        }

        // --- FIRESTORE CREDIT LOGIC ---
        document.getElementById("userCreditsDisplay").style.display = "flex";
        const userRef = db.collection("users").doc(user.uid);
        
        // Check if user is new, if so, give 1 free credit
        const docSnap = await userRef.get();
        if (!docSnap.exists) {
            await userRef.set({
                email: user.email,
                credits: 1, // 1 Free Credit for new users
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // Listen for real-time credit updates
        userRef.onSnapshot((doc) => {
            if (doc.exists) {
                currentCredits = doc.data().credits || 0;
                document.getElementById("creditCount").textContent = currentCredits;
            }
        });

    } else {
        // Signed out
        authOverlay.style.transition    = "";
        authOverlay.style.display       = "flex";
        authOverlay.style.opacity       = "1";
        authOverlay.style.pointerEvents = "";
        mainApp.style.display           = "none";
        document.getElementById("userCreditsDisplay").style.display = "none";
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

        document.querySelectorAll(".auth-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.mode === mode);
        });

        submitBtn.textContent    = mode === "login" ? "Login" : "Create Account";
        forgotLink.style.display = mode === "login" ? "block" : "none";
    }
}

function clearAuthMessages() {
    document.getElementById("authError").textContent   = "";
    document.getElementById("authSuccess").textContent = "";
}

function showAuthError(msg) {
    document.getElementById("authError").textContent   = msg;
    document.getElementById("authSuccess").textContent = "";
}

function showAuthSuccess(msg) {
    document.getElementById("authSuccess").textContent = msg;
    document.getElementById("authError").textContent   = "";
}


// =========================================================
//  EMAIL / PASSWORD  —  LOGIN & SIGN UP
// =========================================================
async function submitAuth() {
    const email    = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    clearAuthMessages();

    if (!email || !password) {
        showAuthError("Please enter your email and password.");
        return;
    }

    const btn  = document.getElementById("authSubmitBtn");
    const orig = btn.textContent;
    btn.disabled    = true;
    btn.textContent = currentAuthMode === "login" ? "Logging in…" : "Creating account…";

    try {
        if (currentAuthMode === "login") {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            await auth.createUserWithEmailAndPassword(email, password);
        }
        // onAuthStateChanged handles the transition
    } catch (err) {
        showAuthError(firebaseErrorMsg(err.code));
        btn.disabled    = false;
        btn.textContent = orig;
    }
}


// =========================================================
//  GOOGLE SIGN IN
// =========================================================
async function signInWithGoogle() {
    clearAuthMessages();
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    } catch (err) {
        if (err.code !== "auth/popup-closed-by-user" &&
            err.code !== "auth/cancelled-popup-request") {
            showAuthError(firebaseErrorMsg(err.code));
        }
    }
}


// =========================================================
//  FORGOT PASSWORD  —  sends reset email
// =========================================================
async function sendReset() {
    const email = document.getElementById("resetEmail").value.trim();
    clearAuthMessages();

    if (!email) {
        showAuthError("Please enter your email address.");
        return;
    }

    const btn = document.getElementById("resetSubmitBtn");
    btn.disabled    = true;
    btn.textContent = "Sending…";

    try {
        await auth.sendPasswordResetEmail(email);
        showAuthSuccess("Reset link sent! Check your inbox (and spam folder).");
    } catch (err) {
        showAuthError(firebaseErrorMsg(err.code));
    } finally {
        btn.disabled    = false;
        btn.textContent = "Send Reset Link";
    }
}


// =========================================================
//  LOGOUT
// =========================================================
async function logout() {
    try {
        await auth.signOut();
        showNotification("You have been logged out.");
    } catch {
        showNotification("Could not log out. Please try again.");
    }
}


// =========================================================
//  PASSWORD VISIBILITY TOGGLE
// =========================================================
function toggleAuthPw() {
    const inp = document.getElementById("authPassword");
    inp.type = inp.type === "password" ? "text" : "password";
}


// =========================================================
//  FIREBASE → HUMAN-READABLE ERROR MESSAGES
// =========================================================
function firebaseErrorMsg(code) {
    const map = {
        "auth/invalid-email":            "Invalid email address format.",
        "auth/user-not-found":           "No account found with this email.",
        "auth/wrong-password":           "Incorrect password. Try again.",
        "auth/invalid-credential":       "Incorrect email or password.",
        "auth/email-already-in-use":     "An account with this email already exists.",
        "auth/weak-password":            "Password must be at least 6 characters.",
        "auth/too-many-requests":        "Too many attempts. Please wait and try again.",
        "auth/network-request-failed":   "Network error. Check your connection.",
        "auth/popup-blocked":            "Popup was blocked. Please allow popups for this site.",
        "auth/operation-not-allowed":    "This sign-in method is not enabled in Firebase.",
        "auth/user-disabled":            "This account has been disabled.",
        "auth/requires-recent-login":    "Please log in again to continue.",
    };
    return map[code] || `Authentication error (${code}). Please try again.`;
}


// =========================================================
//  KEYBOARD SHORTCUTS FOR AUTH FORM
// =========================================================
document.getElementById("authEmail").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("authPassword").focus();
});
document.getElementById("authPassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitAuth();
});
document.getElementById("resetEmail").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendReset();
});


// =========================================================
//  ─────────────────────────────────────────────────────────
//  GALLERY GENERATOR  (original code — unchanged below)
//  ─────────────────────────────────────────────────────────
// =========================================================

        // =========================
        // STATE
        // =========================
        let generatedHTML = "";

        // imageData stores: { name: string, dataUrl: string }
        let imageData = [];

        // =========================
        // DRAG & DROP WIRING
        // =========================
        const uploadZone = document.getElementById("uploadZone");

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
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
            if (files.length > 0) readFiles(files);
        });

        document.getElementById("imageFileInput").addEventListener("change", function () {
            const files = Array.from(this.files);
            if (files.length > 0) readFiles(files);
        });

        // =========================
        // READ FILES → BASE64
        // =========================
        function readFiles(files) {
            const progressWrap = document.getElementById("progressWrap");
            const progressFill = document.getElementById("progressFill");
            const progressLabel = document.getElementById("progressLabel");

            progressWrap.style.display = "block";
            progressFill.style.width = "0%";
            progressLabel.textContent = `Reading images… 0 / ${files.length}`;

            // Append new images (allow adding more)
            let done = 0;
            const total = files.length;
            const thumbsContainer = document.getElementById("previewThumbs");
            const previewGrid = document.getElementById("previewGrid");
            const previewCount = document.getElementById("previewCount");

            previewGrid.style.display = "block";

            files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const dataUrl = e.target.result;
                    // Strip variant suffixes like (Medium), (Phone), (Small), (Custom), (Large), etc.
                    const name = file.name.replace(/\s*\([^)]*\)(?=\.[^.]+$)/i, '');

                    // Avoid duplicates by name
                    if (!imageData.find(img => img.name === name)) {
                        imageData.push({ name, dataUrl });

                        // Add thumbnail
                        const thumb = document.createElement("div");
                        thumb.className = "preview-thumb";
                        thumb.innerHTML = `
                            <img src="${dataUrl}" alt="${escapeHtml(name)}">
                            <div class="thumb-name">${escapeHtml(name)}</div>
                        `;
                        thumbsContainer.appendChild(thumb);
                    }

                    done++;
                    const pct = Math.round((done / total) * 100);
                    progressFill.style.width = pct + "%";
                    progressLabel.textContent = `Reading images… ${done} / ${total}`;

                    if (done === total) {
                        setTimeout(() => {
                            progressWrap.style.display = "none";
                        }, 600);
                        previewCount.textContent = `${imageData.length} image${imageData.length !== 1 ? "s" : ""} selected`;
                        showNotification(`${imageData.length} image${imageData.length !== 1 ? "s" : ""} loaded and ready.`);
                    }
                };
                reader.readAsDataURL(file);
            });
        }

        function clearImages() {
            imageData = [];
            document.getElementById("previewThumbs").innerHTML = "";
            document.getElementById("previewGrid").style.display = "none";
            document.getElementById("imageFileInput").value = "";
            document.getElementById("downloadBtn").classList.remove("active");
            generatedHTML = "";
            showNotification("All images cleared.");
        }

        // =========================
        // UTILITIES
        // =========================
        function showNotification(text) {
            const toast = document.getElementById("toast");
            toast.innerText = text;
            toast.classList.add("show");
            setTimeout(() => { toast.classList.remove("show"); }, 3000);
        }

        function escapeHtml(str) {
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // =========================
        // GENERATE GALLERY
        // =========================
        function generateGallery() {
            const rawTitle = document.getElementById("galleryTitle").value.trim() || "My Selection Gallery";
            const title = escapeHtml(rawTitle);
            const password = document.getElementById("galleryPassword").value.trim();
            const escapedPasswordJs = password.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const waNumber = document.getElementById("whatsappNumber").value.trim().replace(/[^0-9]/g, "");

            if (imageData.length === 0) {
                showNotification("Please upload at least one image first.");
                return;
            }

            const btn = document.getElementById("generateBtn");
            btn.disabled = true;
            btn.textContent = "Building gallery…";

            // Small delay to let UI update before heavy string building
            setTimeout(() => {
                try {
                    // Build image cards — src uses the embedded Base64 Data URL
                    // data-name stores the original filename for the selection list
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

                    /* PASSWORD MODULES */
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

                    // Build the final self-contained gallery HTML
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

                    generatedHTML = generatedHTML; // assign is already done above

                    const downloadBtn = document.getElementById("downloadBtn");
                    downloadBtn.classList.add("active");
                    showNotification("Interactive Gallery Compiled! (" + imageData.length + " images embedded)");

                } catch (err) {
                    showNotification("Error building gallery: " + err.message);
                    console.error(err);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg> Generate HTML Code`;
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
//  CREDIT & PAYMENT SYSTEM (RAZORPAY)
// =========================================================

// Intercept the Generate Button Click
async function handleGenerateClick() {
    if (imageData.length === 0) {
        showNotification("Please upload at least one image first.");
        return;
    }

    if (currentCredits >= 1) {
        // Deduct 1 credit in Firestore, then generate
        const user = auth.currentUser;
        if (user) {
            try {
                const btn = document.getElementById("generateBtn");
                btn.disabled = true;
                btn.textContent = "Deducting credit...";

                await db.collection("users").doc(user.uid).update({
                    credits: firebase.firestore.FieldValue.increment(-1)
                });
                
                // Credit deducted successfully, build gallery
                generateGallery(); 
            } catch (error) {
                showNotification("Error verifying credits. Please try again.");
                document.getElementById("generateBtn").disabled = false;
            }
        }
    } else {
        // Not enough credits, show pricing modal
        openPricingModal();
    }
}

function openPricingModal() {
    document.getElementById("pricingModal").style.display = "flex";
}

function closePricingModal() {
    document.getElementById("pricingModal").style.display = "none";
}

// Handle Razorpay Checkout
function initiatePayment(amountInINR, creditsToGive) {
    const user = auth.currentUser;
    if (!user) return;

    // REPLACE 'YOUR_RAZORPAY_KEY_ID' with your actual Razorpay Key ID
    const razorpayKey = "YOUR_RAZORPAY_KEY_ID"; 

    const options = {
        key: razorpayKey, 
        amount: amountInINR * 100, // Razorpay accepts amount in paise (multiply by 100)
        currency: "INR",
        name: "Shubhda Studios",
        description: `Purchase ${creditsToGive} Gallery Credits`,
        image: "https://your-logo-url-here.png", // Optional: Add your studio logo URL
        handler: async function (response) {
            // Payment Success Handler
            const paymentId = response.razorpay_payment_id;
            showNotification("Payment successful! Adding credits...");
            closePricingModal();

            try {
                const batch = db.batch();
                const userRef = db.collection("users").doc(user.uid);
                const txRef = db.collection("transactions").doc(); // auto-generate ID

                // 1. Add credits to user
                batch.update(userRef, {
                    credits: firebase.firestore.FieldValue.increment(creditsToGive)
                });

                // 2. Log the transaction
                batch.set(txRef, {
                    uid: user.uid,
                    email: user.email,
                    amount: amountInINR,
                    creditsAdded: creditsToGive,
                    paymentId: paymentId,
                    date: firebase.firestore.FieldValue.serverTimestamp()
                });

                await batch.commit();
                showNotification(`${creditsToGive} credits added to your account!`);
                
            } catch (error) {
                console.error("Error updating database: ", error);
                showNotification("Credits delayed. Please contact support with Payment ID: " + paymentId);
            }
        },
        prefill: {
            email: user.email,
            name: user.displayName || "Photographer"
        },
        theme: {
            color: "#4F46E5" // Matches your --primary CSS variable
        }
    };

    const rzp1 = new Razorpay(options);
    rzp1.on('payment.failed', function (response){
        showNotification("Payment failed: " + response.error.description);
    });
    rzp1.open();
}
