// ==========================================
// CONFIGURATION
// ==========================================
// IMPORTANT: Replace this with your newly deployed Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbwNB83lhq_U_LEfey7OyqUGcGoLKOiliIqv9IWiL4dBSFRTba9GXJ7nPogGDCe_wwaZvw/exec";

// ==========================================
// STATE & UI ELEMENTS
// ==========================================
let currentUsername = localStorage.getItem('loggedInUser');
let locationText = '';
let selectedTimeType = '';
let compressedImageData = null;
let currentData = null;

document.addEventListener('DOMContentLoaded', function() {
    google.charts.load('current', {'packages':['gauge']});
    
    // Elements
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');
    const toast = document.getElementById('toast');
    
    // Login Elements
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('loginButton');
    const loginContainer = document.getElementById('loginContainer');
    const autoSubmitProgress = document.getElementById('autoSubmitProgress');
    const userDropdown = document.getElementById('userDropdown');
    const dropdownDisplay = document.getElementById('dropdownDisplay');
    const dropdownOptions = document.getElementById('dropdownOptions');

    // Dashboard Elements
    const personNameInput = document.getElementById('personName');
    const timeTypeContainer = document.getElementById('timeTypeContainer');
    const readingInputGroup = document.getElementById('readingInputGroup');
    const pictureGroup = document.getElementById('pictureGroup');
    const locationGroup = document.getElementById('locationGroup');
    const readingLabel = document.getElementById('readingLabel');
    const readingValue = document.getElementById('readingValue');
    const locationEl = document.getElementById('location');
    const readingForm = document.getElementById('readingForm');
    const submitButton = document.getElementById('submitButton');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Picture & Modal Elements
    const pictureInput = document.getElementById('picture');
    const openCameraBtn = document.getElementById('openCameraBtn');
    const openGalleryBtn = document.getElementById('openGalleryBtn');
    const cameraModal = document.getElementById('cameraModal');
    const closeCameraBtn = document.getElementById('closeCameraBtn');
    const cameraVideo = document.getElementById('cameraVideo');
    const captureSnapBtn = document.getElementById('captureSnapBtn');
    const pictureStatus = document.getElementById('pictureStatus');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');
    const imageSizeBadge = document.getElementById('imageSizeBadge');
    const successModal = document.getElementById('successModal');
    const syncStatusBadge = document.getElementById('syncStatusBadge');
    const closeSuccessBtn = document.getElementById('closeSuccessBtn');
    let mediaStream = null;
    
    const body = document.body;
    const heroIcon = document.getElementById('heroIcon');
    const heroTitle = document.getElementById('heroTitle');
    const heroSubtitle = document.getElementById('heroSubtitle');

    // ==========================================
    // UTILITIES
    // ==========================================
    function showLoader(show, text = 'Loading...') {
        loaderText.textContent = text;
        loader.style.display = show ? 'flex' : 'none';
    }

    function showToast(message, type) {
        const icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
        toast.innerHTML = `${icon} ${message}`;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 4000);
    }

    function showError(message) {
        errorMessage.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
        errorMessage.style.display = 'block';
        loginContainer.style.animation = 'none';
        loginContainer.offsetHeight;
        loginContainer.style.animation = 'shake 0.4s ease-in-out';
    }

    async function apiRequest(action, payload = {}) {
        if (API_URL === "YOUR_GOOGLE_SCRIPT_WEB_APP_URL") {
            throw new Error("API URL is not configured. Please add your Google Script Web App URL in app.js.");
        }
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                // Using text/plain to avoid CORS preflight issues with Google Apps Script
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: action, ...payload })
            });
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                console.error("Non-JSON API response:", text);
                throw new Error("Server communication error. Please try again.");
            }
            if (data.status === 'error') throw new Error(data.message);
            return data;
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    }

    // ==========================================
    // LOGIN FLOW
    // ==========================================
    
    function switchView(view) {
        if (view === 'login') {
            loginView.classList.add('active');
            dashboardView.classList.remove('active');
        } else {
            loginView.classList.remove('active');
            dashboardView.classList.add('active');
            personNameInput.value = currentUsername;
        }
    }

    async function fetchUsernames() {
        const cachedUsers = localStorage.getItem('cachedUsernames');
        
        if (cachedUsers) {
            // Instantly load from cache
            setupDropdown(JSON.parse(cachedUsers));
            
            // Silently update cache in background for next time
            apiRequest('getUsernames').then(result => {
                if (result.status === 'success' && result.data) {
                    localStorage.setItem('cachedUsernames', JSON.stringify(result.data));
                    // Re-setup dropdown only if user hasn't selected anything yet to prevent interrupting their flow
                    if (!usernameInput.value) {
                        setupDropdown(result.data);
                    }
                }
            }).catch(console.error);
        } else {
            // No cache exists, show loading modal
            showLoader(true, 'Loading Users...');
            try {
                const result = await apiRequest('getUsernames');
                if (result.status === 'success' && result.data) {
                    localStorage.setItem('cachedUsernames', JSON.stringify(result.data));
                    setupDropdown(result.data);
                } else {
                    throw new Error("Invalid user data received");
                }
            } catch (error) {
                dropdownOptions.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--danger-color);">Error loading users</div>';
                showError("Failed to fetch user list: " + error.message);
            } finally {
                showLoader(false);
            }
        }
    }

    function setupDropdown(usernames) {
        dropdownOptions.innerHTML = '';
        if (!usernames || usernames.length === 0) {
            dropdownOptions.innerHTML = '<div style="padding:1rem;text-align:center;">No users found.</div>';
            return;
        }
        usernames.forEach(user => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-option';
            const parts = user.split('|')[0].trim().split(' ');
            const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]) : user.substring(0, 2);
            optionDiv.innerHTML = `
                <div class="option-avatar">${initials.toUpperCase()}</div>
                <div class="option-name">${user}</div>
            `;
            optionDiv.addEventListener('click', () => {
                usernameInput.value = user;
                dropdownDisplay.textContent = user;
                dropdownDisplay.classList.add('selected-value');
                dropdownDisplay.classList.remove('placeholder');
                userDropdown.classList.remove('open');
                errorMessage.style.display = 'none';
                setTimeout(() => passwordInput.focus(), 100);
            });
            dropdownOptions.appendChild(optionDiv);
        });
        
        userDropdown.querySelector('.custom-select').addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('open');
        });
        
        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target)) userDropdown.classList.remove('open');
        });
    }

    let autoSubmitTimer;
    passwordInput.addEventListener('input', function(e) {
        errorMessage.style.display = 'none';
        const val = this.value.trim();
        if (val.length >= 4) {
            autoSubmitProgress.style.display = 'block';
            autoSubmitProgress.style.width = '100%';
            clearTimeout(autoSubmitTimer);
            autoSubmitTimer = setTimeout(() => {
                if (usernameInput.value) {
                    passwordInput.blur();
                    triggerLogin();
                } else {
                    showError("Please select your name first");
                    autoSubmitProgress.style.display = 'none';
                    autoSubmitProgress.style.width = '0%';
                }
            }, 400);
        } else {
            clearTimeout(autoSubmitTimer);
            autoSubmitProgress.style.display = 'none';
            autoSubmitProgress.style.width = '0%';
            if (val.length >= 5) loginButton.classList.add('show');
            else loginButton.classList.remove('show');
        }
    });

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        clearTimeout(autoSubmitTimer);
        triggerLogin();
    });

    async function triggerLogin() {
        errorMessage.style.display = 'none';
        const username = usernameInput.value;
        const password = passwordInput.value;

        if (!username) return showError('Please select your name.');
        if (!password) return showError('Please enter your passcode.');
        
        showLoader(true, 'Authenticating...');
        loginButton.disabled = true;

        try {
            const result = await apiRequest('authenticateUser', { username, password });
            localStorage.setItem('loggedInUser', username);
            currentUsername = username;
            
            // Instantly load data from the combined API response
            switchView('dashboard');
            onInitialData(result.initData);
            getLocation();
        } catch (error) {
            showLoader(false);
            loginButton.disabled = false;
            autoSubmitProgress.style.display = 'none';
            autoSubmitProgress.style.width = '0%';
            passwordInput.value = '';
            passwordInput.focus();
            showError(error.message);
        }
    }
    
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('loggedInUser');
        currentUsername = null;
        switchView('login');
        passwordInput.value = '';
        autoSubmitProgress.style.display = 'none';
        autoSubmitProgress.style.width = '0%';
        loginButton.disabled = false;
        body.className = 'theme-default';
    });

    // ==========================================
    // DASHBOARD FLOW
    // ==========================================

    function applyTheme(type) {
        body.className = '';
        if (type === 'Morning') {
            body.classList.add('theme-morning');
            heroIcon.innerHTML = '<i class="fa-solid fa-sun"></i>';
            heroTitle.textContent = 'Good Morning!';
            heroSubtitle.textContent = 'Enter your starting reading';
        } else if (type === 'Evening') {
            body.classList.add('theme-evening');
            heroIcon.innerHTML = '<i class="fa-solid fa-moon"></i>';
            heroTitle.textContent = 'Good Evening!';
            heroSubtitle.textContent = 'Enter your ending reading';
        } else if (type === 'Complete') {
            body.classList.add('theme-complete');
            heroIcon.innerHTML = '<i class="fa-solid fa-check-double"></i>';
            heroTitle.textContent = 'All Done!';
            heroSubtitle.textContent = 'You have completed your entries for today.';
        } else {
            body.classList.add('theme-default');
            heroIcon.innerHTML = '<i class="fa-solid fa-motorcycle"></i>';
            heroTitle.textContent = 'Ready to Ride';
            heroSubtitle.textContent = 'Select your reading time to begin';
        }
    }

    async function loadDashboardData() {
        try {
            const data = await apiRequest('getInitializationData', { username: currentUsername });
            onInitialData(data);
            getLocation();
        } catch (error) {
            showLoader(false);
            showToast("Failed to load dashboard: " + error.message, 'error');
        }
    }

    function onInitialData(data) {
        showLoader(false); 
        currentData = data;
        
        const { morningExists, eveningExists } = data.entryState;
        timeTypeContainer.innerHTML = '';
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Reading';

        if (morningExists && eveningExists) {
            applyTheme('Complete');
            timeTypeContainer.innerHTML = '<div style="grid-column: span 2; text-align:center; padding: 1rem; border-radius:12px; background: rgba(0,0,0,0.05);"><i class="fa-solid fa-check-circle" style="color:var(--success-color); font-size:2rem; margin-bottom:10px;"></i><br>All entries for today are complete.</div>';
            readingInputGroup.classList.add('hidden');
            pictureGroup.classList.add('hidden');
            locationGroup.classList.add('hidden');
            submitButton.classList.add('hidden');
        } else {
            applyTheme('Default');
            createTimeTypeButton('Morning', 'fa-sun', !morningExists); 
            createTimeTypeButton('Evening', 'fa-moon', morningExists && !eveningExists);
            
            if (morningExists) {
                const morningBtn = document.querySelector('[data-type="Morning"]');
                if(morningBtn) morningBtn.disabled = true;
            }
        }
        
        if(google.visualization && google.visualization.Gauge) {
            drawWeeklyChart(data.weeklyTotal);
        } else {
            google.charts.setOnLoadCallback(() => drawWeeklyChart(data.weeklyTotal));
        }
        
        updateReadingSummary(data.readings);
        updateScorecard(data.monthlySummary);
    }

    function createTimeTypeButton(type, iconClass, isActive) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn-timeType ${isActive ? 'active' : ''}`;
        button.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${type}`;
        button.dataset.type = type;
        timeTypeContainer.appendChild(button);
        if (isActive) selectTimeType(type);
    }

    timeTypeContainer.addEventListener('click', function(e) {
        const btn = e.target.closest('.btn-timeType');
        if (btn && !btn.disabled) {
            document.querySelectorAll('.btn-timeType').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectTimeType(btn.dataset.type);
        }
    });

    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast('Live camera is not supported on this browser. Please use gallery.', 'error');
            if (openGalleryBtn) openGalleryBtn.click();
            return;
        }

        try {
            if (cameraModal) cameraModal.classList.remove('hidden');
            let constraints = { video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } };
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (e1) {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            }
            if (cameraVideo) {
                cameraVideo.srcObject = mediaStream;
                await cameraVideo.play();
            }
        } catch (err) {
            console.error("Camera access error:", err);
            stopCamera();
            showToast('Unable to access camera. Please choose photo from gallery.', 'error');
            if (openGalleryBtn) openGalleryBtn.click();
        }
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (cameraVideo) cameraVideo.srcObject = null;
        if (cameraModal) cameraModal.classList.add('hidden');
    }

    if (openCameraBtn) openCameraBtn.addEventListener('click', startCamera);
    if (closeCameraBtn) closeCameraBtn.addEventListener('click', stopCamera);
    if (openGalleryBtn) openGalleryBtn.addEventListener('click', () => { if (pictureInput) pictureInput.click(); });

    if (captureSnapBtn) {
        captureSnapBtn.addEventListener('click', function() {
            if (!cameraVideo || !cameraVideo.videoWidth) {
                showToast('Camera initializing... Please wait a moment.', 'error');
                return;
            }
            
            const canvas = document.createElement('canvas');
            let w = cameraVideo.videoWidth || 800;
            let h = cameraVideo.videoHeight || 600;
            const MAX_DIM = 800;
            if (w > MAX_DIM || h > MAX_DIM) {
                if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
                else { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(cameraVideo, 0, 0, w, h);
            
            try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                const base64Data = dataUrl.split(',')[1];
                compressedImageData = {
                    data: base64Data,
                    type: 'image/jpeg',
                    name: 'odometer_' + Date.now() + '.jpg'
                };
                
                if (imagePreview) imagePreview.src = `data:image/jpeg;base64,${base64Data}`;
                if (imageSizeBadge) {
                    const approxKb = Math.round((base64Data.length * 0.75) / 1024);
                    imageSizeBadge.textContent = `Optimized: ~${approxKb} KB`;
                }
                
                stopCamera();
                
                if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
                if (openCameraBtn) openCameraBtn.classList.add('hidden');
                if (openGalleryBtn) openGalleryBtn.classList.add('hidden');
                showToast('Photo captured!', 'success');
            } catch (err) {
                console.error("Snap error:", err);
                showToast('Failed to capture photo. Please try again.', 'error');
            }
        });
    }

    function resetPictureSelection() {
        stopCamera();
        compressedImageData = null;
        if (pictureInput) pictureInput.value = '';
        if (openCameraBtn) openCameraBtn.classList.remove('hidden');
        if (openGalleryBtn) openGalleryBtn.classList.remove('hidden');
        if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
        if (imagePreview) imagePreview.src = '';
    }

    if (pictureInput) {
        pictureInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                showToast('Please select a valid image file.', 'error');
                pictureInput.value = '';
                return;
            }

            if (pictureStatus) pictureStatus.style.display = 'block';

            try {
                compressedImageData = await compressImage(file);
                if (imagePreview) {
                    imagePreview.src = `data:${compressedImageData.type};base64,${compressedImageData.data}`;
                }
                if (imageSizeBadge) {
                    const approxKb = Math.round((compressedImageData.data.length * 0.75) / 1024);
                    imageSizeBadge.textContent = `Optimized: ~${approxKb} KB`;
                }
                if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
                if (openCameraBtn) openCameraBtn.classList.add('hidden');
                if (openGalleryBtn) openGalleryBtn.classList.add('hidden');
            } catch (err) {
                console.error("Compression error:", err);
                showToast('Failed to process picture. Please try taking photo again.', 'error');
                resetPictureSelection();
            } finally {
                if (pictureStatus) pictureStatus.style.display = 'none';
            }
        });
    }

    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', resetPictureSelection);
    }

    function selectTimeType(type) {
        selectedTimeType = type;
        applyTheme(type);
        readingInputGroup.classList.remove('hidden');
        pictureGroup.classList.remove('hidden');
        locationGroup.classList.remove('hidden');
        submitButton.classList.remove('hidden');
        readingLabel.innerHTML = `<i class="fa-solid ${type === 'Morning' ? 'fa-sun' : 'fa-moon'}"></i> Enter ${type} Odometer Reading`;
        readingValue.placeholder = `0.0`;
        readingValue.value = '';
        resetPictureSelection();
    }

    function showSuccessModal() {
        if (syncStatusBadge) {
            syncStatusBadge.style.background = 'rgba(243, 156, 18, 0.15)';
            syncStatusBadge.style.color = 'var(--primary-accent)';
            syncStatusBadge.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-spin"></i> Saving to cloud...';
        }
        if (successModal) successModal.classList.remove('hidden');
    }

    function updateSyncStatus(isSuccess, message) {
        if (!syncStatusBadge) return;
        if (isSuccess) {
            syncStatusBadge.style.background = 'rgba(0, 184, 148, 0.15)';
            syncStatusBadge.style.color = 'var(--success-color)';
            syncStatusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
        } else {
            syncStatusBadge.style.background = 'rgba(255, 71, 87, 0.15)';
            syncStatusBadge.style.color = 'var(--danger-color)';
            syncStatusBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
        }
    }

    if (closeSuccessBtn) {
        closeSuccessBtn.addEventListener('click', () => {
            if (successModal) successModal.classList.add('hidden');
        });
    }

    readingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!selectedTimeType) {
            return showToast('Please select entry time (Morning/Evening).', 'error');
        }
        if (!readingValue.value) {
            return showToast('Please enter odometer reading.', 'error');
        }
        if (!compressedImageData) {
            return showToast('Please take or select an odometer picture.', 'error');
        }
        if (!locationText || locationText.startsWith('Detecting')) {
            return showToast('Please wait for location detection to complete.', 'error');
        }
        
        const submitTimeType = selectedTimeType;
        const submitReadingVal = parseFloat(readingValue.value);
        const submitPayload = {
            formObject: {
                fullUsername: currentUsername,
                timeType: selectedTimeType,
                reading: readingValue.value,
                location: locationText
            },
            imageFile: compressedImageData
        };

        // 1. INSTANT OPTIMISTIC UI RESET (< 10ms)
        readingForm.reset();
        resetPictureSelection();
        personNameInput.value = currentUsername;
        readingInputGroup.classList.add('hidden');
        pictureGroup.classList.add('hidden');
        locationGroup.classList.add('hidden');
        submitButton.classList.add('hidden');

        if (currentData && currentData.entryState) {
            if (submitTimeType === 'Morning') {
                currentData.entryState.morningExists = true;
                currentData.readings.morning = submitReadingVal;
            } else if (submitTimeType === 'Evening') {
                currentData.entryState.eveningExists = true;
                currentData.readings.evening = submitReadingVal;
            }
            onInitialData(currentData);
        }

        // 2. INSTANT POPUP SUCCESS MODAL
        showSuccessModal();

        // 3. BACKGROUND ASYNC SAVING (No blocking fullscreen loader)
        apiRequest('processSubmission', submitPayload)
            .then(response => {
                updateSyncStatus(true, "Synced to Cloud");
                if (response && response.entryState) {
                    onInitialData(response);
                }
            })
            .catch(error => {
                console.error("Background sync error:", error);
                updateSyncStatus(false, "Sync Pending");
                showToast(error.message || "Background sync failed. Will retry.", 'error');
            });
    });

    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const MAX_DIM = 800; // Optimal 800px box size - high clarity for reading numbers, ultra low RAM & tiny payload (~50-80KB)
            const blobUrl = URL.createObjectURL(file);
            const img = new Image();
            
            img.onload = () => {
                URL.revokeObjectURL(blobUrl); // Instantly free memory
                
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_DIM || height > MAX_DIM) {
                    if (width > height) {
                        height = Math.round((height * MAX_DIM) / width);
                        width = MAX_DIM;
                    } else {
                        width = Math.round((width * MAX_DIM) / height);
                        height = MAX_DIM;
                    }
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    const base64Data = dataUrl.split(',')[1];
                    resolve({
                        data: base64Data,
                        type: 'image/jpeg',
                        name: (file.name || 'picture').replace(/\.[^/.]+$/, "") + ".jpg"
                    });
                } catch (err) {
                    reject(err);
                }
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                reject(new Error("Failed to load picture file"));
            };
            
            img.src = blobUrl;
        });
    }

    function getLocation() {
        locationEl.innerHTML = '<i class="fa-solid fa-location-crosshairs fa-spin"></i> Detecting...';
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(showPosition, showErrorLoc, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
        } else {
            locationEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Not supported';
            locationText = "Geolocation not supported.";
        }
    }
    
    async function showPosition(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        locationEl.innerHTML = '<i class="fa-solid fa-location-crosshairs fa-spin"></i> Fetching address...';
        try {
            const res = await apiRequest('reverseGeocode', { lat, lon });
            locationText = res.address;
            locationEl.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> ${locationText}`;
        } catch (err) {
            locationText = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
            locationEl.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> ${locationText}`;
        }
    }
    
    function showErrorLoc(error) {
        let message = "Could not get location. ";
        switch(error.code) {
            case error.PERMISSION_DENIED: message += "Please allow location access."; break;
            case error.POSITION_UNAVAILABLE: message += "Location information is unavailable."; break;
            case error.TIMEOUT: message += "Location request timed out."; break;
            default: message += "An unknown error occurred."; break;
        }
        locationEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message} <span id="retryLocBtn" style="margin-left:8px; cursor:pointer; text-decoration:underline; font-weight:bold;"><i class="fa-solid fa-arrows-rotate"></i> Retry</span>`;
        locationText = message;
        
        const retryBtn = document.getElementById('retryLocBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                getLocation();
            });
        }
    }

    // Chart & UI Update Functions
    function drawWeeklyChart(weeklyTotal) {
        if(!google.visualization || !google.visualization.arrayToDataTable) return;
        const data = google.visualization.arrayToDataTable([ ['Label', 'Value'], ['KM', Number(weeklyTotal) || 0] ]);
        const options = { width: '100%', height: 220, redFrom: 350, redTo: 500, yellowFrom: 200, yellowTo: 350, minorTicks: 5, max: 500, backgroundColor: 'transparent' };
        const chartDiv = document.getElementById('chart_div');
        if (chartDiv) {
            document.getElementById('chartContainer').classList.remove('hidden');
            new google.visualization.Gauge(chartDiv).draw(data, options);
        }
    }

    function updateReadingSummary(readings) {
        const rSummary = document.getElementById('readingSummary');
        const mVal = readings.morning, eVal = readings.evening;
        if (mVal !== null || eVal !== null) rSummary.classList.remove('hidden');
        else { rSummary.classList.add('hidden'); return; }
        
        document.getElementById('morningReadingValue').textContent = mVal !== null ? mVal : '-';
        document.getElementById('eveningReadingValue').textContent = eVal !== null ? eVal : '-';
        
        if (mVal !== null && eVal !== null) {
            document.getElementById('totalReadingValue').textContent = (parseFloat(eVal) - parseFloat(mVal)).toFixed(2) + ' KM';
            document.getElementById('totalReadingSection').classList.remove('hidden');
        } else {
            document.getElementById('totalReadingSection').classList.add('hidden');
        }
    }

    function updateScorecard(summary) {
        if (!summary) return;
        document.getElementById('scorecard').classList.remove('hidden');
        document.getElementById('scorecardMonth').textContent = summary.monthName;
        document.getElementById('scorecardTotal').textContent = summary.totalReading;
        
        const list = document.getElementById('scorecardSummaryList');
        list.innerHTML = '';
        for (const date in summary.dateWiseSummary) {
            const readings = summary.dateWiseSummary[date];
            const morning = readings.morning !== null ? readings.morning.toFixed(2) : '-';
            const evening = readings.evening !== null ? readings.evening.toFixed(2) : '-';
            let dailyTotal = '-';
            if (readings.morning !== null && readings.evening !== null) dailyTotal = (readings.evening - readings.morning).toFixed(2) + ' km';
            
            const dateObj = new Date(date);
            const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
            const item = document.createElement('div');
            item.className = 'summary-list-item';
            item.innerHTML = `
                <div class="summary-list-date">${formattedDate}</div>
                <div class="summary-list-value"><i class="fa-solid fa-sun" style="width:16px"></i> ${morning}</div>
                <div class="summary-list-value"><i class="fa-solid fa-moon" style="width:16px"></i> ${evening}</div>
                <div class="summary-list-total">${dailyTotal}</div>
            `;
            list.appendChild(item);
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    if (currentUsername) {
        switchView('dashboard');
        // Show non-blocking skeleton loader in the container
        document.getElementById('timeTypeContainer').innerHTML = '<div style="grid-column: span 2; text-align:center; padding: 1.5rem; border-radius:12px; background: rgba(0,0,0,0.05); color: var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading Data...</div>';
        loadDashboardData();
    } else {
        switchView('login');
        fetchUsernames();
    }
});
