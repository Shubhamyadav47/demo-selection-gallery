
let generatedHTML = null;

function generateGallery() {
    if (uploadedImages.length === 0) {
        showNotification("Please upload at least one image.");
        return;
    }

    // Prevent duplicate generation with same images
    if (isGalleryGenerated && uploadedImages.length === lastGeneratedImageCount) {
        showNotification("⚠️ Gallery already generated with these images. Clear and upload new images to generate again.");
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

            const imageTags = imageData.map((img, idx) => `
                <div class="gallery-item" data-name="${img.name}" data-image-src="${img.src}" role="button" tabindex="0" onclick="event.stopPropagation(); if(!event.target.closest('.zoom-btn')) toggleSelection(this);" onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); toggleSelection(this); }">
                    <img src="${img.src}" alt="${img.name}">
                    <button class="zoom-btn" onclick="event.stopPropagation(); openZoomModal('${img.src}', '${img.name}');" title="Zoom photo">🔍</button>
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
            padding: 0;
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
            width: 100%;
            text-align: center;
            margin-bottom: 40px;
            padding: 40px 20px 0;
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
            width: 100%;
            background: var(--card-bg);
            border-radius: 0;
            padding: 30px 20px;
            box-shadow: none;
            border: none;
            border-top: 1px solid var(--border-color);
            border-bottom: 1px solid var(--border-color);
        }

        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 30px;
            max-width: 1400px;
            margin-left: auto;
            margin-right: auto;
        }

        .gallery-item {
            position: relative;
            overflow: hidden;
            border-radius: 12px;
            cursor: pointer;
            border: 2px solid var(--border-color);
            transition: all 0.3s ease;
            background: #f0f0f0;
            min-height: 220px;
        }

        .gallery-item:hover {
            border-color: var(--primary);
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
        }

        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
            background: #f5f5f5;
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

        /* On touch devices there is no hover — keep overlay visible
           so users can see names and selection affordance */
        @media (hover: none) {
            .gallery-item .overlay { opacity: 1; }
            .gallery-item .checkmark { opacity: 0.85; }
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
            font-size: 13px;
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
            border-radius: 0;
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 0 auto;
            max-width: 1400px;
            width: 100%;
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
            .action-bar { flex-direction: column; gap: 12px; padding: 12px; margin: 0 20px; }
            .action-buttons { width: 100%; }
            .action-btn { flex: 1; justify-content: center; }
            .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
            .gallery-header { padding: 30px 20px 20px; }
        }

        .zoom-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: rgba(79, 70, 229, 0.9);
            color: white;
            font-size: 20px;
            cursor: pointer;
            z-index: 30;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(6px);
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .zoom-btn:hover {
            transform: scale(1.15);
            background: rgba(79, 70, 229, 1);
            box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
        }

        .zoom-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.95);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 99999;
            padding: 20px;
            overflow: hidden;
        }

        .zoom-overlay.show {
            display: flex;
        }

        .zoom-container {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: auto;
        }

        .zoom-overlay img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 8px;
            transition: transform 0.2s ease;
        }

        .zoom-controls {
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 100001;
        }

        .zoom-control-btn {
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 50%;
            background: rgba(255,255,255,0.15);
            color: white;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.2);
        }

        .zoom-control-btn:hover {
            background: rgba(255,255,255,0.25);
            transform: scale(1.1);
        }

        .close-zoom {
            position: absolute;
            top: 20px;
            left: 20px;
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 50%;
            background: rgba(255,255,255,0.15);
            color: white;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.2);
            z-index: 100001;
        }

        .close-zoom:hover {
            background: rgba(255,255,255,0.25);
            transform: scale(1.1);
        }

        .zoom-level {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.6);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            z-index: 100001;
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
