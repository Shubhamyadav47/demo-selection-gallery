// =========================================================
//  GALLERY GENERATION MODULE
//  Handles HTML gallery creation, image embedding,
//  and file downloads
// =========================================================

let generatedHTML = "";
let isGalleryGenerated = false;
let lastGeneratedImageCount = 0;

/**
 * Generate the complete gallery HTML with embedded images
 */
function generateGallery() {
    const btn = document.getElementById("generateBtn");
    const imageData = window.imageData || [];

    // Validation
    if (imageData.length === 0) {
        showNotification("Please upload at least one image.");
        return;
    }

    const title = document.getElementById("galleryTitle").value.trim() || "My Photo Gallery";
    const password = document.getElementById("galleryPassword").value || "";
    const whatsappNumber = document.getElementById("whatsappNumber").value.trim() || "";

    btn.disabled = true;
    btn.innerHTML = `<svg fill="none" height="20" stroke="currentColor" viewBox="0 0 24 24" width="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" fill="currentColor"/></svg> Generating...`;

    // Process image data asynchronously
    setTimeout(() => {
        try {
            // Build the gallery HTML
            generatedHTML = buildGalleryHTML(
                imageData,
                title,
                password,
                whatsappNumber
            );

            spendTokens(TOKENS_PER_GENERATION);
            const downloadBtn = document.getElementById("downloadBtn");
            downloadBtn.classList.add("active");

            // Mark gallery as generated and track image count
            isGalleryGenerated = true;
            lastGeneratedImageCount = imageData.length;

            // Calculate actual file size
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

/**
 * Build the complete HTML for the gallery
 * @param {Array} imageData - Array of image objects {name, dataUrl}
 * @param {string} title - Gallery title
 * @param {string} password - Optional password protection
 * @param {string} whatsappNumber - Optional WhatsApp number
 * @returns {string} - Complete HTML string
 */
function buildGalleryHTML(imageData, title, password, whatsappNumber) {
    // Generate password protection script if needed
    const passwordScript = password
        ? `
<script>
    function promptPassword() {
        const enteredPassword = prompt("This gallery is password protected.\\nEnter password:");
        const correctPassword = "${escapeForHTML(password)}";
        if (enteredPassword !== correctPassword) {
            document.body.innerHTML = "<div style='display:flex;align-items:center;justify-content:center;height:100vh;font-size:24px;color:#999;'>❌ Incorrect password</div>";
            throw new Error("Incorrect password");
        }
    }
    promptPassword();
<\/script>`
        : "";

    // Generate gallery items HTML
    const galleryItems = imageData
        .map((img, idx) => {
            const fileName = img.name || `image-${idx + 1}`;
            return `
            <div class="gallery-item" data-name="${escapeForHTML(fileName)}">
                <img src="${img.dataUrl}" alt="${escapeForHTML(fileName)}" onclick="openZoomModal(this.src, '${escapeForHTML(fileName)}')">
                <div class="overlay"></div>
                <span class="checkmark">✓</span>
                <div class="name">${escapeForHTML(fileName)}</div>
            </div>`;
        })
        .join("");

    // Generate the complete HTML
    const generatedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeForHTML(title)}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            width: 100%;
            max-width: 1200px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }

        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 14px;
            opacity: 0.9;
        }

        .content {
            padding: 40px 20px;
        }

        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .gallery-item {
            position: relative;
            cursor: pointer;
            border-radius: 12px;
            overflow: hidden;
            aspect-ratio: 1;
            background: #f0f0f0;
            transition: transform 0.2s ease;
            border: 2px solid #e0e0e0;
        }

        .gallery-item:hover {
            transform: scale(1.05);
            border-color: #667eea;
        }

        .gallery-item.selected {
            border-color: #667eea;
            background: #f0f4ff;
        }

        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .gallery-item .overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(102, 126, 234, 0.1);
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .gallery-item:hover .overlay {
            opacity: 1;
        }

        .gallery-item.selected .overlay {
            opacity: 1;
        }

        .gallery-item .checkmark {
            position: absolute;
            top: 5px;
            right: 5px;
            width: 24px;
            height: 24px;
            background: #667eea;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .gallery-item.selected .checkmark {
            opacity: 1;
        }

        .gallery-item .name {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 5px 8px;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-height: 32px;
            transition: all 0.2s ease;
        }

        .gallery-item:hover .name {
            background: rgba(0, 0, 0, 0.85);
        }

        .controls {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
        }

        .control-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }

        .selection-count {
            font-size: 16px;
            font-weight: bold;
            color: #333;
        }

        .action-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        button {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-primary:hover {
            background: #5568d3;
        }

        .btn-secondary {
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
        }

        .btn-secondary:hover {
            background: #f0f4ff;
        }

        .btn-whatsapp {
            background: #25D366;
            color: white;
        }

        .btn-whatsapp:hover {
            background: #1fa856;
        }

        .zoom-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }

        .zoom-overlay.show {
            display: flex;
        }

        .zoom-container {
            position: relative;
            max-width: 90%;
            max-height: 90%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .zoom-overlay img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .close-zoom {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
        }

        .zoom-controls {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            background: rgba(0, 0, 0, 0.6);
            padding: 10px;
            border-radius: 8px;
        }

        .zoom-control-btn {
            width: 36px;
            height: 36px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
        }

        .zoom-control-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .zoom-level {
            position: absolute;
            top: 20px;
            left: 20px;
            color: white;
            font-size: 14px;
            background: rgba(0, 0, 0, 0.5);
            padding: 8px 12px;
            border-radius: 6px;
        }

        .toast-notify {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            transition: transform 0.3s ease;
            z-index: 999;
            pointer-events: none;
        }

        .toast-notify.show {
            transform: translateX(-50%) translateY(0);
        }

        @media (max-width: 768px) {
            .gallery-grid {
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                gap: 10px;
            }

            .header h1 {
                font-size: 24px;
            }

            .control-row {
                flex-direction: column;
                align-items: stretch;
            }

            .action-buttons {
                flex-direction: column;
            }

            button {
                width: 100%;
            }
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <h1>${escapeForHTML(title)}</h1>
        <p>✨ Select your favorite photos — Click any image to zoom & explore</p>
    </div>

    <div class="content">
        <div class="controls">
            <div class="control-row">
                <div class="selection-count" id="count">0 Photos Selected</div>
                <div class="action-buttons">
                    <button class="btn-primary" onclick="copyListToClipboard()">
                        📋 Copy Selection
                    </button>
                    ${whatsappNumber ? `
                    <button class="btn-whatsapp" onclick="sendToWhatsApp()">
                        💬 Send via WhatsApp
                    </button>` : ""}
                </div>
            </div>
        </div>

        <div class="gallery-grid">
            ${galleryItems}
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

    let currentZoomLevel = 1;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 4;
    const ZOOM_STEP = 0.2;

    function openZoomModal(src, name) {
        currentZoomLevel = 1;
        const overlay = document.getElementById("zoomOverlay");
        const img = document.getElementById("zoomedImage");
        img.src = src;
        img.style.transform = 'scale(1)';
        overlay.classList.add("show");
        document.body.style.overflow = "hidden";
        updateZoomLevel();
    }

    function closeZoomModal() {
        const overlay = document.getElementById("zoomOverlay");
        overlay.classList.remove("show");
        document.body.style.overflow = "auto";
        currentZoomLevel = 1;
    }

    function zoomIn() {
        if (currentZoomLevel < MAX_ZOOM) {
            currentZoomLevel += ZOOM_STEP;
            updateZoomDisplay();
        }
    }

    function zoomOut() {
        if (currentZoomLevel > MIN_ZOOM) {
            currentZoomLevel -= ZOOM_STEP;
            updateZoomDisplay();
        }
    }

    function resetZoom() {
        currentZoomLevel = 1;
        updateZoomDisplay();
    }

    function updateZoomDisplay() {
        const img = document.getElementById("zoomedImage");
        if (img) {
            img.style.transform = 'scale(' + currentZoomLevel.toFixed(2) + ')';
        }
        updateZoomLevel();
    }

    function updateZoomLevel() {
        const levelEl = document.getElementById("zoomLevel");
        if (levelEl) {
            levelEl.textContent = Math.round(currentZoomLevel * 100) + '%';
        }
    }

    // Keyboard shortcuts for zoom
    document.addEventListener('keydown', function(e) {
        const overlay = document.getElementById("zoomOverlay");
        if (!overlay || !overlay.classList.contains("show")) return;
        if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
        else if (e.key === '-') { e.preventDefault(); zoomOut(); }
        else if (e.key === '0') { e.preventDefault(); resetZoom(); }
        else if (e.key === 'Escape') { e.preventDefault(); closeZoomModal(); }
    });

    // Mouse wheel zoom
    document.addEventListener('wheel', function(e) {
        const overlay = document.getElementById("zoomOverlay");
        if (!overlay || !overlay.classList.contains("show")) return;
        e.preventDefault();
        if (e.deltaY < 0) { zoomIn(); }
        else { zoomOut(); }
    }, { passive: false });
<\/script>

${passwordScript}

<div class="zoom-overlay" id="zoomOverlay" onclick="if(event.target === event.currentTarget) closeZoomModal();">
    <button class="close-zoom" onclick="closeZoomModal()" title="Close (ESC)">✕</button>
    <div class="zoom-controls">
        <button class="zoom-control-btn" onclick="zoomOut()" title="Zoom Out (- key or scroll)">−</button>
        <button class="zoom-control-btn" onclick="resetZoom()" title="Reset Zoom (0 key)">⟲</button>
        <button class="zoom-control-btn" onclick="zoomIn()" title="Zoom In (+ key or scroll)">+</button>
    </div>
    <div class="zoom-container">
        <img id="zoomedImage" src="" alt="Zoomed image">
    </div>
    <div class="zoom-level" id="zoomLevel">100%</div>
</div>

</body>
</html>`;

    return generatedHTML;
}

/**
 * Helper: Escape HTML special characters
 */
function escapeForHTML(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Download the generated gallery as an HTML file
 */
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

/**
 * Format bytes to human-readable file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
