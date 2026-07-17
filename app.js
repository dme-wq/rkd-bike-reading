// ==========================================
// CONFIGURATION
// ==========================================
// IMPORTANT: Replace this with your newly deployed Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbznaE1S4pOJjNYLdqKezHqHWbBYzYkbJIyQN6F1-v2D1tUvX_uRD74aQJcPRLfMRWpisw/exec";

// ==========================================
// STATE & UI ELEMENTS
// ==========================================
let currentUsername = localStorage.getItem('loggedInUser');
let locationText = '';
let selectedTimeType = '';

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
            const data = await response.json();
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
    }

    readingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const file = document.getElementById('picture').files[0];
        if (!selectedTimeType || !readingValue.value || !file || !locationText || locationText.startsWith('Detecting')) {
            return showToast('Please fill all fields and wait for location.', 'error');
        }
        
        showLoader(true, 'Processing...');
        submitButton.disabled = true;
        
        try {
            const imageFile = await compressImage(file);
            const formObject = {
                fullUsername: currentUsername, timeType: selectedTimeType,
                reading: readingValue.value, location: locationText
            };

            const response = await apiRequest('processSubmission', { formObject, imageFile });
            showToast(response.message || "Success!", 'success');
            readingForm.reset();
            personNameInput.value = currentUsername;
            readingInputGroup.classList.add('hidden');
            pictureGroup.classList.add('hidden');
            locationGroup.classList.add('hidden');
            submitButton.classList.add('hidden');
            onInitialData(response);
        } catch (error) {
            showLoader(false);
            submitButton.disabled = false;
            showToast(error.message || "Failed to submit.", 'error');
        }
    });

    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const MAX_WIDTH = 1024;
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(blob => {
                        const r = new FileReader();
                        r.onload = () => resolve({ data: r.result.split(',')[1], type: blob.type, name: file.name });
                        r.readAsDataURL(blob);
                    }, 'image/jpeg', 0.7);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
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
        locationEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
        locationText = message;
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
