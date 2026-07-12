// GramSetu Core Application JavaScript

// Application State
let activeTab = 'news';
let cattleMap = null;
let birdsMap = null;
let groundwaterMap = null;
let priceData = [];
let diseaseData = [];
let birdSightings = [];
let groundwaterData = [];
let institutionsData = [];
let selectedGroundwaterDistrict = null;
let activeGroundwaterYear = 2026;
let isSewageOverlayVisible = true;

// Audio Recording Variables
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyserNode = null;
let animationFrameId = null;
let isRecording = false;
let currentClassification = null;

// Default India coordinates
const INDIA_CENTER = [22.9734, 78.6569];

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
    // Load data on startup
    loadDashboardStats();
    loadMandiPrices();
    loadCattleDiseases();
    loadBirdSightings();
    loadMarketProducts();
    // loadGroundwaterData();

    // Initialize Visualizer Canvas default state
    clearCanvas();

    // Initialize Home Morphing Animation
    initMorphVisualizer();
});

// 1. Tab Navigation Routing
function switchTab(tabId) {
    console.log("switchTab called with:", tabId);
    try {
        if (activeTab === tabId) return;

        // Hide active panel and show target panel
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        // Special handling for new top-level tabs mapped to farming sub-views
        if (tabId === 'prices' || tabId === 'bio') {
            const farmingPanel = document.getElementById('panel-farming');
            if (farmingPanel) farmingPanel.classList.add('active');
            
            if (tabId === 'prices') switchFarmingSubView('mandi');
            if (tabId === 'bio') switchFarmingSubView('market');
        } else {
            const panel = document.getElementById(`panel-${tabId}`);
            if (panel) {
                panel.classList.add('active');
            } else {
                console.warn(`Panel not found for tabId: ${tabId}`);
            }
        }

        const btn = document.getElementById(`nav-btn-${tabId}`);
        if (btn) {
            btn.classList.add('active');
        }

        activeTab = tabId;

        // Lazy initialize and resize maps when they become visible
        if (tabId === 'farming') {
            switchFarmingSubView(activeFarmingSubView || 'mandi');
        } else if (tabId === 'fisheries') {
            initFisheriesMap();
            loadFisheriesData();
            if (fisheriesMap) setTimeout(() => fisheriesMap.invalidateSize(), 100);
        } else if (tabId === 'news') {
            loadNews();
        } else if (tabId === 'weather') {
            if (climateTrendsData) {
                // Data already fetched – just re-render the chart now that tab is visible
                requestAnimationFrame(() => renderClimateTrendsChart(climateTrendsData));
            }
            loadWeather();
            initGroundwaterMap();
            if (groundwaterMap) setTimeout(() => groundwaterMap.invalidateSize(), 100);
        } else if (tabId === 'birds') {
            initBirdsMap();
            if (birdsMap) setTimeout(() => birdsMap.invalidateSize(), 100);
        } else if (tabId === 'mesh') {
            initMeshTab();
        } else if (tabId === 'feedback') {
            initFeedbackTab();
        } else if (tabId === 'dashboard') {
            loadDashboardStats();
        }
    } catch (error) {
        console.error("Error inside switchTab:", error);
    }
}

// 1.5 Farming Sub-tab Navigation Routing
let activeFarmingSubView = 'mandi';
let mandiPricesMap = null;

function switchFarmingSubView(viewId) {
    console.log("switchFarmingSubView called with:", viewId);
    try {
        activeFarmingSubView = viewId;

        // Toggles visibility of farming sub-panels
        document.querySelectorAll('.farming-sub-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.farming-subnav .subnav-btn').forEach(b => b.classList.remove('active'));

        const targetPanel = document.getElementById(`farming-sub-${viewId}`);
        if (targetPanel) targetPanel.classList.add('active');

        const targetBtn = document.getElementById(`btn-farm-sub-${viewId}`);
        if (targetBtn) targetBtn.classList.add('active');

        // Lazy initialize maps
        if (viewId === 'cattle') {
            initCattleMap();
            if (cattleMap) setTimeout(() => cattleMap.invalidateSize(), 100);
        } else if (viewId === 'mandi') {
            initMandiPricesMap();
            renderMandiPriceMarkers();
            if (mandiPricesMap) setTimeout(() => mandiPricesMap.invalidateSize(), 100);
        } else if (viewId === 'market') {
            loadMarketProducts();
            updateSellerUI();
        }
    } catch (error) {
        console.error("Error inside switchFarmingSubView:", error);
    }
}

// 2. Dashboard Stats Loader
async function loadDashboardStats() {
    try {
        // Fetch stats from endpoints
        const resDiseases = await fetch('http://localhost:8000/diseases');
        const resSightings = await fetch('http://localhost:8000/birds/sightings');
        const resPrices = await fetch('http://localhost:8000/prices');

        const diseasesRes = await resDiseases.json();
        const sightingsRes = await resSightings.json();
        const pricesRes = await resPrices.json();

        const diseases = Array.isArray(diseasesRes) ? diseasesRes : (diseasesRes.data || []);
        const sightings = Array.isArray(sightingsRes) ? sightingsRes : (sightingsRes.data || []);
        const prices = Array.isArray(pricesRes) ? pricesRes : (pricesRes.data || []);

        // Outbreaks Count
        let totalOutbreaks = 0;
        diseases.forEach(d => totalOutbreaks += d.activeCases);
        document.getElementById('stats-outbreaks-count').innerText = totalOutbreaks;

        // Bird Sightings Count
        document.getElementById('stats-bird-sightings').innerText = sightings.length;

        // Average Wheat Price Modal
        const wheatPrices = prices.filter(p => p.commodity.toLowerCase().includes('wheat'));
        if (wheatPrices.length > 0) {
            const sum = wheatPrices.reduce((acc, curr) => acc + curr.modalPrice, 0);
            const avg = Math.round(sum / wheatPrices.length);
            document.getElementById('stats-wheat-price').innerText = `₹ ${avg}`;
        } else {
            document.getElementById('stats-wheat-price').innerText = `N/A`;
        }
    } catch (e) {
        console.warn("Could not fetch dashboard summary stats.", e);
        document.getElementById('stats-outbreaks-count').innerText = "0";
        document.getElementById('stats-wheat-price').innerText = "N/A";
        document.getElementById('stats-bird-sightings').innerText = "0";
    }
}

// 3. Cattle Diseases Map & Advisor Module
function initCattleMap() {
    if (cattleMap) {
        // Recalculate container bounds in case window resized while hidden
        setTimeout(() => cattleMap.invalidateSize(), 100);
        return;
    }

    // Set up Leaflet Map
    cattleMap = L.map('cattle-heatmap-container').setView(INDIA_CENTER, 5);

    // Tile Layer: OpenStreetMap standard layout
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(cattleMap);

    renderCattleMarkers();
}

async function loadCattleDiseases() {
    try {
        const [instRes, disRes] = await Promise.all([
            fetch('http://localhost:8000/institutions'),
            fetch('http://localhost:8000/diseases')
        ]);
        institutionsData = await instRes.json();
        diseaseData = await disRes.json();
        if (activeTab === 'cattle') renderCattleMarkers();
        
        // Render Disease Table
        const tbody = document.getElementById('disease-outbreaks-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (diseaseData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No data found</td></tr>';
            } else {
                diseaseData.forEach(d => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${d.disease}</td>
                        <td>${d.species}</td>
                        <td>${d.outbreaks}</td>
                        <td>${d.attacks}</td>
                        <td>${d.deaths}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (e) {
        console.error("Error loading cattle/institutions data:", e);
    }
}

function renderCattleMarkers() {
    if (!cattleMap || !institutionsData.length) return;

    // Clear old markers (just re-creating is simple for demo)
    cattleMap.eachLayer((layer) => {
        if (layer instanceof L.Circle) {
            cattleMap.removeLayer(layer);
        }
    });

    // Create circle overlay markers based on institutions parameters
    institutionsData.forEach(d => {
        let color = '#3b82f6'; // Medium - Blue
        let radius = Math.max(10000, Math.min(50000, d.total_institutions * 10)); // Scale radius by count

        const circle = L.circle([d.latitude, d.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.45,
            radius: radius
        }).addTo(cattleMap);

        // Binding a popup message details
        const popupContent = `
            <div style="font-family: var(--font-body); padding: 5px;">
                <h4 style="margin-bottom: 5px; color:var(--text-primary);">${d.state}</h4>
                <p><strong>Total Institutions:</strong> ${d.total_institutions}</p>
            </div>
        `;
        circle.bindPopup(popupContent);

        // Hook up mouse clicks to Advisory Box update
        circle.on('click', () => {
            showAdvisory(d);
        });
    });
}

function showAdvisory(outbreak) {
    const prompt = document.getElementById('cattle-advisory-prompt');
    if (prompt) prompt.style.display = 'none';
    
    const content = document.getElementById('cattle-advisory-content');
    if (content) content.style.display = 'block';

    const dName = document.getElementById('adv-district-title');
    if (dName) dName.innerText = `State: ${outbreak.state}`;

    const cases = document.getElementById('adv-cases-count');
    if (cases) cases.innerText = outbreak.total_institutions;
}

// Coordinates mapping for major agricultural districts in India
const DISTRICT_COORDINATES = {
    // Punjab
    "Ludhiana": [30.9010, 75.8573],
    "Amritsar": [31.6340, 74.8723],
    "Patiala": [30.3398, 76.3869],
    "Bathinda": [30.2110, 74.9454],
    "Jalandhar": [31.3260, 75.5762],
    // Haryana
    "Karnal": [29.6857, 76.9905],
    "Hisar": [29.1492, 75.7217],
    "Ambala": [30.3782, 76.7767],
    "Sirsa": [29.5312, 75.0318],
    "Rohtak": [28.8955, 76.6066],
    // Uttar Pradesh
    "Bareilly": [28.3670, 79.4304],
    "Meerut": [28.9845, 77.7064],
    "Mathura": [27.4924, 77.6737],
    "Kanpur": [26.4499, 80.3319],
    "Varanasi": [25.3176, 82.9739],
    // Madhya Pradesh
    "Indore": [22.7196, 75.8577],
    "Bhopal": [23.2599, 77.4126],
    "Ujjain": [23.1760, 75.7885],
    "Jabalpur": [23.1815, 79.9864],
    "Gwalior": [26.2183, 78.1828],
    // Rajasthan
    "Jaipur": [26.9124, 75.7873],
    "Jodhpur": [26.2389, 73.0243],
    "Kota": [25.2138, 75.8648],
    "Bikaner": [28.0166, 73.3119],
    "Udaipur": [24.5854, 73.7125],
    // Maharashtra
    "Pune": [18.5204, 73.8567],
    "Nagpur": [21.1458, 79.0882],
    "Nashik": [19.9975, 73.7898],
    "Aurangabad": [19.8762, 75.3433],
    "Kolhapur": [16.7050, 74.2433],
    // Karnataka
    "Dharwad": [15.4589, 75.0078],
    "Mysore": [12.2958, 76.6394],
    "Belgaum": [15.8497, 74.4977],
    "Shimoga": [13.9299, 75.5681],
    "Tumkur": [13.3392, 77.1140],
    // Andhra Pradesh
    "Guntur": [16.3067, 80.4365],
    "Nellore": [14.4426, 79.9865],
    "Vijayawada": [16.5062, 80.6480],
    "Kurnool": [15.8281, 78.0373],
    "Chittoor": [13.2161, 79.1003],
    // Tamil Nadu
    "Coimbatore": [11.0168, 76.9558],
    "Madurai": [9.9252, 78.1198],
    "Salem": [11.6643, 78.1460],
    "Tiruchirappalli": [10.7905, 78.7047],
    "Erode": [11.3410, 77.7172]
};

// 4. Mandi prices filter, table, and data fetching
async function loadMandiPrices() {
    try {
        const response = await fetch('http://localhost:8000/prices');
        const json = await response.json();
        priceData = Array.isArray(json) ? json : (json.data || []);

        populateFilterDropdowns();
        renderPricesTable(priceData);
        if (activeTab === 'farming' && activeFarmingSubView === 'mandi') {
            initMandiPricesMap();
            renderMandiPriceMarkers();
        }
    } catch (e) {
        console.error("Error loading commodity prices:", e);
    }
}

function initMandiPricesMap() {
    if (mandiPricesMap) {
        setTimeout(() => mandiPricesMap.invalidateSize(), 100);
        return;
    }
    mandiPricesMap = L.map('mandi-prices-map').setView(INDIA_CENTER, 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mandiPricesMap);
}

let mandiMarkersList = [];

function renderMandiPriceMarkers() {
    if (!mandiPricesMap) return;

    // Clear old markers
    mandiMarkersList.forEach(m => mandiPricesMap.removeLayer(m));
    mandiMarkersList = [];

    const stateVal = document.getElementById('filter-state').value;
    const commVal = document.getElementById('filter-commodity').value;
    const searchVal = document.getElementById('search-market').value.toLowerCase();

    const filtered = priceData.filter(p => {
        const matchState = stateVal === 'all' || p.state === stateVal;
        const matchComm = commVal === 'all' || p.commodity === commVal;
        const matchSearch = p.market.toLowerCase().includes(searchVal) ||
            p.district.toLowerCase().includes(searchVal);
        return matchState && matchComm && matchSearch;
    });

    if (filtered.length === 0) return;

    // Calculate average modal price of filtered commodities to color-code
    const sum = filtered.reduce((acc, curr) => acc + curr.modalPrice, 0);
    const avgPrice = sum / filtered.length;

    filtered.forEach(p => {
        let coords = DISTRICT_COORDINATES[p.district] || DISTRICT_COORDINATES[p.market.replace(" Mandi", "")];
        if (!coords) {
            // Random offset around INDIA_CENTER as fallback
            const latOffset = (Math.random() - 0.5) * 4.5;
            const lngOffset = (Math.random() - 0.5) * 4.5;
            coords = [INDIA_CENTER[0] + latOffset, INDIA_CENTER[1] + lngOffset];
        }

        let color = '#fbbf24'; // Orange/Gold (average)
        if (p.modalPrice > avgPrice * 1.05) {
            color = '#ef4444'; // Red (High Price)
        } else if (p.modalPrice < avgPrice * 0.95) {
            color = '#10b981'; // Green (Low Price)
        }

        const marker = L.circleMarker(coords, {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(mandiPricesMap);

        const popupContent = `
            <div style="font-family: var(--font-body); padding: 5px; color: var(--text-primary); line-height: 1.4;">
                <h4 style="margin-bottom: 5px; color: var(--text-primary);"><i class="fa-solid fa-wheat-awn"></i> ${p.commodity}</h4>
                <p style="font-size:0.85rem;"><strong>Mandi:</strong> ${p.market} (${p.district}, ${p.state})</p>
                <p style="font-size:0.85rem;"><strong>Variety:</strong> ${p.variety}</p>
                <hr style="border-color: var(--border-glass); margin: 5px 0;">
                <p style="font-size:0.85rem;"><strong>Modal Rate:</strong> <strong style="color:var(--color-accent-light);">₹ ${p.modalPrice.toLocaleString('en-IN')}</strong> / ${p.unit}</p>
                <p style="font-size:0.8rem; color:var(--text-secondary);">Min: ₹${p.minPrice.toLocaleString('en-IN')} | Max: ₹${p.maxPrice.toLocaleString('en-IN')}</p>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:5px;">Last Updated: ${p.lastUpdated}</p>
            </div>
        `;
        marker.bindPopup(popupContent);
        mandiMarkersList.push(marker);
    });
}

function populateFilterDropdowns() {
    const states = [...new Set(priceData.map(p => p.state))].sort();
    const commodities = [...new Set(priceData.map(p => p.commodity))].sort();

    const stateSelect = document.getElementById('filter-state');
    const commSelect = document.getElementById('filter-commodity');

    // Clear and keep first 'All' option
    stateSelect.innerHTML = '<option value="all">All States</option>';
    commSelect.innerHTML = '<option value="all">All Grains</option>';

    states.forEach(s => {
        stateSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    commodities.forEach(c => {
        commSelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

function applyFilters() {
    const stateVal = document.getElementById('filter-state').value;
    const commVal = document.getElementById('filter-commodity').value;
    const searchVal = document.getElementById('search-market').value.toLowerCase();

    const filtered = priceData.filter(p => {
        const matchState = stateVal === 'all' || p.state === stateVal;
        const matchComm = commVal === 'all' || p.commodity === commVal;
        const matchSearch = p.market.toLowerCase().includes(searchVal) ||
            p.district.toLowerCase().includes(searchVal);
        return matchState && matchComm && matchSearch;
    });

    renderPricesTable(filtered);
    renderMandiPriceMarkers();
}

function renderPricesTable(data) {
    const body = document.getElementById('mandi-prices-body');
    body.innerHTML = '';

    if (data.length === 0) {
        body.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No matching market rates found. Try adjusting filters.</td></tr>';
        return;
    }

    data.forEach(p => {
        const row = `
            <tr>
                <td><strong>${p.state}</strong></td>
                <td>${p.district} <span style="font-size:0.8rem; color:var(--text-secondary);">(${p.market})</span></td>
                <td><span class="status-badge" style="background:rgba(16,185,129,0.1); color:var(--color-accent-light); border:1px solid rgba(16,185,129,0.2);">${p.commodity}</span></td>
                <td>${p.variety}</td>
                <td>₹ ${p.minPrice.toLocaleString('en-IN')}</td>
                <td>₹ ${p.maxPrice.toLocaleString('en-IN')}</td>
                <td class="price-high">₹ ${p.modalPrice.toLocaleString('en-IN')}</td>
                <td style="font-size:0.8rem; color:var(--text-secondary);">${p.lastUpdated}</td>
            </tr>
        `;
        body.innerHTML += row;
    });
}

// 5. Audio Acoustics & Recording Visualizer
function clearCanvas() {
    const canvas = document.getElementById('canvas-visualizer');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw flat line representing silence
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

async function toggleRecording() {
    const btn = document.getElementById('btn-record-audio');
    const label = document.getElementById('record-status-label');
    const timer = document.getElementById('record-timer-text');

    if (isRecording) {
        // Stop recording early
        stopAudioCapture();
        return;
    }

    // Request microphone access
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        btn.classList.add('recording');
        label.innerText = "Listening...";
        timer.innerText = "Analyzing acoustic environment (5s)...";

        // Start Web Audio Visualizer
        startVisualizer(stream);

        // Start MediaRecorder
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            // Package audio into a blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            stream.getTracks().forEach(track => track.stop());

            // Upload to classifier API
            await uploadAudioForClassification(audioBlob);
        };

        mediaRecorder.start();

        // Automatically stop recording after 5 seconds
        setTimeout(() => {
            if (isRecording) stopAudioCapture();
        }, 5000);

    } catch (err) {
        console.error("Microphone access denied or audio device failure: ", err);
        alert("Microphone permission is required to analyze bird sounds. Please grant permission or check your audio hardware settings.");
        isRecording = false;
        btn.classList.remove('recording');
        label.innerText = "Acoustic System Offline";
    }
}

function stopAudioCapture() {
    if (!isRecording) return;

    isRecording = false;
    document.getElementById('btn-record-audio').classList.remove('recording');
    document.getElementById('record-status-label').innerText = "Processing Sound...";
    document.getElementById('record-timer-text').innerText = "Running FFT spectral algorithms...";

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
}

function startVisualizer(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    source.connect(analyserNode);

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = document.getElementById('canvas-visualizer');
    const canvasCtx = canvas.getContext('2d');

    function draw() {
        if (!isRecording) return;

        animationFrameId = requestAnimationFrame(draw);
        analyserNode.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = 'rgba(11, 15, 25, 0.2)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#10b981';
        canvasCtx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }

    draw();
}

async function uploadAudioForClassification(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'capture.wav');

    try {
        const response = await fetch('http://localhost:8000/birds/classify', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server returned code ${response.status}`);
        }

        const data = await response.json();
        displayClassificationResult(data);

    } catch (e) {
        console.error("Acoustic analysis server endpoint call failed: ", e);
        document.getElementById('record-status-label').innerText = "Analysis Failed";
        document.getElementById('record-timer-text').innerText = "Connection lost or invalid format. Please try again.";
        clearCanvas();
    }
}

function displayClassificationResult(result) {
    currentClassification = result;

    // Clear audio lines
    clearCanvas();

    const label = document.getElementById('record-status-label');
    const timer = document.getElementById('record-timer-text');

    if (result.detected) {
        label.innerText = "Classification Match!";
        timer.innerText = `Identified: ${result.name}`;

        const card = document.getElementById('classification-result-card');
        card.classList.add('active');

        document.getElementById('bird-result-name').innerText = result.name;
        document.getElementById('bird-result-scientific').innerText = result.scientific_name;
        document.getElementById('bird-result-desc').innerText = result.description;
        document.getElementById('bird-result-confidence').innerText = `Match Confidence: ${(result.confidence * 100).toFixed(0)}%`;

        const badge = document.getElementById('bird-result-status');
        badge.innerText = result.status;
        badge.className = `status-badge ${result.endangered ? 'critical' : 'medium'}`;

        // Show Log Sighting Button
        document.getElementById('btn-log-sighting').style.display = 'inline-block';
    } else {
        label.innerText = "Ambient Environment / Unknown";
        timer.innerText = "No specific species matched the noise profile.";

        const card = document.getElementById('classification-result-card');
        card.classList.add('active');

        document.getElementById('bird-result-name').innerText = "Ambient Environment";
        document.getElementById('bird-result-scientific').innerText = "N/A";
        document.getElementById('bird-result-desc').innerText = result.description || "The captured frequency signature contains ambient wind, human voice, or background noise. Try shifting closer to the source.";
        document.getElementById('bird-result-confidence').innerText = "Match Confidence: 0%";

        const badge = document.getElementById('bird-result-status');
        badge.innerText = "N/A";
        badge.className = "status-badge medium";

        // Hide Sighting Logging
        document.getElementById('btn-log-sighting').style.display = 'none';
    }
}

// 6. Bird Sightings Map & Wild Count Analytics
function initBirdsMap() {
    if (birdsMap) {
        setTimeout(() => birdsMap.invalidateSize(), 100);
        return;
    }

    birdsMap = L.map('birds-sighting-map-container').setView(INDIA_CENTER, 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(birdsMap);

    renderBirdMarkers();
}

async function loadBirdSightings() {
    try {
        const response = await fetch('http://localhost:8000/birds/sightings');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        birdSightings = Array.isArray(data) ? data : [];

        if (activeTab === 'birds') renderBirdMarkers();
        loadBirdStatsTable();
        loadDashboardStats();
    } catch (e) {
        console.error("Error loading bird sightings: ", e);
        birdSightings = [];
    }
}

function renderBirdMarkers() {
    if (!birdsMap || !Array.isArray(birdSightings)) return;

    // In a real environment, we'd clear previous markers first.
    // For simplicity, we just rebuild.
    birdSightings.forEach(s => {
        const color = s.isEndangered ? '#ef4444' : '#10b981'; // Red for endangered, Teal/Green for common

        const marker = L.circleMarker([s.latitude, s.longitude], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(birdsMap);

        const dateObj = new Date(s.timestamp);
        const dateStr = dateObj.toLocaleDateString('en-IN') + ' ' + dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        const popupContent = `
            <div style="font-family: var(--font-body); padding: 5px;">
                <h4 style="margin-bottom: 2px; color:var(--text-primary);">${s.name}</h4>
                <p style="font-style: italic; font-size: 0.8rem; color:var(--color-accent-light); margin-bottom: 5px;">${s.scientificName}</p>
                <p><strong>Conservation Status:</strong> <span class="status-badge ${s.isEndangered ? 'critical' : 'medium'}">${s.status}</span></p>
                <p><strong>Detected on:</strong> ${dateStr}</p>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:5px;">Confidence: ${(s.confidence * 100).toFixed(0)}%</p>
            </div>
        `;
        marker.bindPopup(popupContent);
    });
}

async function loadBirdStatsTable() {
    try {
        const response = await fetch('http://localhost:8000/birds/stats');
        const stats = await response.json();

        const body = document.getElementById('bird-stats-table-body');
        body.innerHTML = '';

        if (stats.length === 0) {
            body.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">No sightings mapped yet. Use the acoustic mic to log bird sounds.</td></tr>';
            return;
        }

        stats.forEach(item => {
            const statusClass = item.status === 'Critically Endangered' ? 'critical' : 'medium';
            const row = `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td style="font-style: italic;">${item.scientificName}</td>
                    <td><span class="status-badge ${statusClass}">${item.status}</span></td>
                    <td><strong style="color:var(--text-primary); font-size:1.1rem;">${item.count}</strong> sightings</td>
                </tr>
            `;
            body.innerHTML += row;
        });
    } catch (e) {
        console.error("Error loading bird statistics table: ", e);
    }
}

// Action: Pins the currently recognized bird to the map using geolocation
function logSightingOnMap() {
    if (!currentClassification) return;

    // Request HTML5 location coordinates
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            // Success: Use user's real location coordinates
            (position) => {
                submitSightingPayload(
                    position.coords.latitude,
                    position.coords.longitude
                );
            },
            // Error/Denied: Generate a fallback location near central India with variance 
            // to make sure mapping functions successfully in offline/simulated platforms
            (error) => {
                console.warn("Geolocation access denied or failed. Pinned near central India default coordinates.");
                // Add a small random offset within Central India (to spread pins for presentation)
                const latOffset = (Math.random() - 0.5) * 4.5;
                const lngOffset = (Math.random() - 0.5) * 4.5;
                submitSightingPayload(
                    INDIA_CENTER[0] + latOffset,
                    INDIA_CENTER[1] + lngOffset
                );
            }
        );
    } else {
        // No browser geolocation support
        const latOffset = (Math.random() - 0.5) * 3;
        const lngOffset = (Math.random() - 0.5) * 3;
        submitSightingPayload(
            INDIA_CENTER[0] + latOffset,
            INDIA_CENTER[1] + lngOffset
        );
    }
}

async function submitSightingPayload(lat, lng) {
    const payload = {
        birdId: currentClassification.bird_id,
        name: currentClassification.name,
        scientificName: currentClassification.scientific_name,
        status: currentClassification.status,
        description: currentClassification.description,
        latitude: parseFloat(lat.toFixed(4)),
        longitude: parseFloat(lng.toFixed(4)),
        confidence: currentClassification.confidence,
        isEndangered: currentClassification.endangered
    };

    try {
        const response = await fetch('http://localhost:8000/birds/sightings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert(`Bird Sound Pinned! Successfully mapped: ${payload.name} at coordinates [${payload.latitude}, ${payload.longitude}].`);

            // Clear classification result box
            document.getElementById('classification-result-card').classList.remove('active');
            currentClassification = null;

            // Reload sightings list and maps
            await loadBirdSightings();
        } else {
            alert("Failed to submit sighting to GramSetu server.");
        }
    } catch (e) {
        console.error("Error submitting sighting to API:", e);
    }
}

// 7. Manual triggers to update the system databases from Python API endpoints
async function triggerManualSync() {
    const btn = document.getElementById('btn-sync-data');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synchronizing...';

    try {
        const response = await fetch('http://localhost:8000/sync/trigger', { method: 'POST' });
        const result = await response.json();

        if (response.ok) {
            alert("Data Synchronization Successful!\nUpdated agricultural commodity prices and mapped cattle outbreaks.");
            // Reload all local tables/maps
            await loadDashboardStats();
            await loadMandiPrices();
            await loadCattleDiseases();

            // Update map widgets if they are active
            if (activeTab === 'cattle' && cattleMap) {
                cattleMap.eachLayer((layer) => {
                    if (layer instanceof L.Circle) {
                        cattleMap.removeLayer(layer);
                    }
                });
                renderCattleMarkers();
            }
        } else {
            alert(`Synchronization Failed: ${result.message}`);
        }
    } catch (e) {
        console.error("Synchronizing trigger API failed: ", e);
        alert("Failed to trigger synchronization. GramSetu server is unreachable.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sync Latest Datasets';
    }
}

// 8. Bio Market Module State & Actions
let marketProducts = [];
let activeMarketSubView = 'marketplace';
let activeLang = 'en';
let activePurityCategory = 'milk';

function switchMarketSubView(viewId) {
    if (activeMarketSubView === viewId) return;

    document.querySelectorAll('.market-sub-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.subnav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`market-sub-${viewId}`).classList.add('active');
    document.getElementById(`btn-sub-${viewId}`).classList.add('active');

    activeMarketSubView = viewId;

    if (viewId === 'marketplace') {
        loadMarketProducts();
    }
}

function toggleAuthForm(formType) {
    if (formType === 'register') {
        document.getElementById('seller-login-form').style.display = 'none';
        document.getElementById('seller-register-form').style.display = 'block';
    } else {
        document.getElementById('seller-login-form').style.display = 'block';
        document.getElementById('seller-register-form').style.display = 'none';
    }
}

function updateSellerUI() {
    const userStr = sessionStorage.getItem('gramsetu_seller');
    const authSec = document.getElementById('seller-auth-section');
    const adSec = document.getElementById('seller-advertise-section');

    if (userStr) {
        const user = JSON.parse(userStr);
        document.getElementById('seller-login-form').style.display = 'none';
        document.getElementById('seller-register-form').style.display = 'none';

        const dashboard = document.getElementById('seller-dashboard-section');
        dashboard.style.display = 'block';
        document.getElementById('seller-welcome-msg').innerText = `Welcome, ${user.name}`;
        document.getElementById('seller-contact-msg').innerText = `Contact / Mandi Location: ${user.contact}`;

        document.getElementById('advertise-blocked-msg').style.display = 'none';
        document.getElementById('advertise-form').style.display = 'flex';
    } else {
        document.getElementById('seller-login-form').style.display = 'block';
        document.getElementById('seller-register-form').style.display = 'none';
        document.getElementById('seller-dashboard-section').style.display = 'none';

        document.getElementById('advertise-blocked-msg').style.display = 'block';
        document.getElementById('advertise-form').style.display = 'none';
    }
}

async function handleSellerRegister() {
    const u = document.getElementById('reg-username').value.trim();
    const p = document.getElementById('reg-password').value.trim();
    const n = document.getElementById('reg-name').value.trim();
    const c = document.getElementById('reg-contact').value.trim();

    if (!u || !p || !n || !c) {
        alert("Please fill in all registration fields.");
        return;
    }

    try {
        const response = await fetch('http://localhost:8000/market/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p, name: n, contact: c, role: 'SELLER' })
        });

        if (response.ok) {
            alert("Account registered successfully! Please log in.");
            toggleAuthForm('login');
            document.getElementById('login-username').value = u;
            document.getElementById('login-password').value = p;
        } else {
            const result = await response.json();
            alert(`Registration failed: ${result.error || 'Server error'}`);
        }
    } catch (e) {
        console.error("Register error:", e);
        alert("Error connecting to server.");
    }
}

async function handleSellerLogin() {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();

    if (!u || !p) {
        alert("Please enter both username and password.");
        return;
    }

    try {
        const response = await fetch('http://localhost:8000/market/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const result = await response.json();
        if (response.ok) {
            sessionStorage.setItem('gramsetu_seller', JSON.stringify(result));
            updateSellerUI();
            alert("Signed in successfully!");
        } else {
            alert(`Login failed: ${result.error || 'Invalid credentials'}`);
        }
    } catch (e) {
        console.error("Login error:", e);
        alert("Error connecting to server.");
    }
}

function handleSellerLogout() {
    sessionStorage.removeItem('gramsetu_seller');
    updateSellerUI();
    alert("Signed out successfully.");
}

async function submitBioProduct() {
    const userStr = sessionStorage.getItem('gramsetu_seller');
    if (!userStr) {
        alert("You must be logged in to post products.");
        return;
    }
    const user = JSON.parse(userStr);

    const title = document.getElementById('prod-title').value.trim();
    const cat = document.getElementById('prod-category').value;
    const unit = document.getElementById('prod-unit').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const qty = parseFloat(document.getElementById('prod-qty').value);
    const desc = document.getElementById('prod-desc').value.trim();

    if (!title || isNaN(price) || isNaN(qty) || !desc) {
        alert("Please fill in all fields with valid data.");
        return;
    }

    const payload = {
        title: title,
        category: cat,
        unit: unit,
        price: price,
        quantity: qty,
        description: desc,
        sellerName: user.name,
        sellerContact: user.contact
    };

    try {
        const response = await fetch('http://localhost:8000/market/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Bio advertisement posted successfully!");
            // Reset form
            document.getElementById('prod-title').value = '';
            document.getElementById('prod-price').value = '';
            document.getElementById('prod-qty').value = '';
            document.getElementById('prod-desc').value = '';

            // Switch back to marketplace and refresh
            switchMarketSubView('marketplace');
        } else {
            const result = await response.json();
            alert(`Failed to post product: ${result.error || 'Server error'}`);
        }
    } catch (e) {
        console.error("Post product error:", e);
        alert("Error connecting to server.");
    }
}

async function loadMarketProducts() {
    try {
        const response = await fetch('http://localhost:8000/market/products');
        marketProducts = await response.json();
        renderMarketProducts(marketProducts);
    } catch (e) {
        console.error("Error loading bio products:", e);
    }
}

function renderMarketProducts(products) {
    const grid = document.getElementById('market-product-grid');
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 4rem;"><i class="fa-solid fa-store-slash" style="font-size:3rem; margin-bottom:1rem; color:var(--text-secondary);"></i><p>No organic bio products listed yet. Be the first to list one!</p></div>';
        return;
    }

    const currentUserStr = sessionStorage.getItem('gramsetu_seller');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

    products.forEach(p => {
        let catIcon = 'fa-cow';
        let catColor = 'var(--color-accent-light)';
        if (p.category === 'Veggies') {
            catIcon = 'fa-carrot';
            catColor = '#fbbf24';
        } else if (p.category === 'Fruits') {
            catIcon = 'fa-apple-whole';
            catColor = '#f87171';
        } else if (p.category === 'Animal By-Product') {
            catIcon = 'fa-jar';
            catColor = '#a7f3d0';
        }

        // Show delete button if current logged in seller created this listing
        const canDelete = currentUser && currentUser.name === p.sellerName;
        const deleteButton = canDelete ?
            `<button class="btn-primary" style="background:var(--color-danger); padding:0.4rem 0.8rem; font-size:0.8rem; margin-top:0.5rem; color: white;" onclick="deleteBioProduct(${p.id})"><i class="fa-solid fa-trash"></i> Remove</button>` : '';

        const card = `
            <div class="card-glass" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                        <span class="status-badge" style="background:rgba(255,255,255,0.05); color:${catColor}; border:1px solid rgba(255,255,255,0.1);"><i class="fa-solid ${catIcon}"></i> ${p.category}</span>
                        <span style="font-size:0.75rem; color:var(--text-secondary);">${p.createdDate}</span>
                    </div>
                    <h3 class="card-title" style="color: var(--text-primary); margin-bottom: 0.5rem;">${p.title}</h3>
                    <p style="font-size: 1.4rem; font-weight: 700; color: var(--color-accent-light); margin-bottom: 0.75rem;">₹ ${p.price} <span style="font-size:0.85rem; color:var(--text-secondary); font-weight: normal;">/ ${p.unit}</span></p>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; margin-bottom: 1rem;">${p.description}</p>
                </div>
                
                <hr style="border-color: var(--border-glass); margin: 0.75rem 0;">
                
                <div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem;">
                        <p style="color: var(--text-primary);"><strong>Seller:</strong> ${p.sellerName}</p>
                        <p style="color: var(--text-secondary);"><strong>Contact:</strong> ${p.sellerContact}</p>
                        <p style="color: var(--color-gold);"><strong>Quantity Available:</strong> ${p.quantity} ${p.unit}(s)</p>
                    </div>
                    ${deleteButton}
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });
}

async function deleteBioProduct(id) {
    if (!confirm("Are you sure you want to remove this advertisement?")) return;

    try {
        const response = await fetch(`http://localhost:8000/market/products/${id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            alert("Advertisement removed successfully.");
            loadMarketProducts();
        } else {
            alert("Failed to delete listing.");
        }
    } catch (e) {
        console.error("Delete product error:", e);
        alert("Error connecting to server.");
    }
}

function filterMarketProducts() {
    const catVal = document.getElementById('market-filter-category').value;
    const searchVal = document.getElementById('market-search').value.toLowerCase();

    const filtered = marketProducts.filter(p => {
        const matchCat = catVal === 'all' || p.category === catVal;
        const matchSearch = p.title.toLowerCase().includes(searchVal) ||
            p.description.toLowerCase().includes(searchVal) ||
            p.sellerName.toLowerCase().includes(searchVal);
        return matchCat && matchSearch;
    });

    renderMarketProducts(filtered);
}

function switchLanguage(lang) {
    if (activeLang === lang) return;

    document.querySelectorAll('.lang-text').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`lang-${lang}`).classList.add('active');
    document.getElementById(`lang-btn-${lang}`).classList.add('active');

    activeLang = lang;
}

function switchPurityCategory() {
    const cat = document.getElementById('purity-category-select').value;
    document.querySelectorAll('.purity-test-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`purity-test-${cat}`).classList.add('active');
    activePurityCategory = cat;

    // Reset output card
    document.getElementById('purity-result-card').classList.remove('active');
    document.getElementById('purity-score-label').innerText = 'Bio Confidence Score: --';
    document.getElementById('purity-feedback-text').innerText = 'Check boxes above based on your home testing observations to verify purity.';
}

function calculatePurityScore() {
    const cat = activePurityCategory;
    let checkboxes = [];

    if (cat === 'milk') {
        checkboxes = [
            document.getElementById('milk-test-1').checked,
            document.getElementById('milk-test-2').checked,
            document.getElementById('milk-test-3').checked
        ];
    } else if (cat === 'veggies') {
        checkboxes = [
            document.getElementById('veggie-test-1').checked,
            document.getElementById('veggie-test-2').checked,
            document.getElementById('veggie-test-3').checked
        ];
    } else if (cat === 'grains') {
        checkboxes = [
            document.getElementById('grain-test-1').checked,
            document.getElementById('grain-test-2').checked
        ];
    }

    const checkedCount = checkboxes.filter(Boolean).length;
    const total = checkboxes.length;
    const percent = Math.round((checkedCount / total) * 100);

    const resultCard = document.getElementById('purity-result-card');
    const scoreLabel = document.getElementById('purity-score-label');
    const fbText = document.getElementById('purity-feedback-text');

    resultCard.classList.add('active');
    scoreLabel.innerText = `Bio Confidence Score: ${percent}%`;

    if (percent === 100) {
        resultCard.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        resultCard.style.background = 'rgba(16, 185, 129, 0.08)';
        fbText.innerHTML = '<strong style="color:var(--color-accent-light);"><i class="fa-solid fa-circle-check"></i> High Organic Probability!</strong> The product passes all standard home bio authenticity tests. It is highly likely to be pure, chemical-free, and pesticide-free.';
    } else if (percent >= 50) {
        resultCard.style.borderColor = 'rgba(251, 191, 36, 0.4)';
        resultCard.style.background = 'rgba(251, 191, 36, 0.08)';
        fbText.innerHTML = '<strong style="color:var(--color-gold);"><i class="fa-solid fa-triangle-exclamation"></i> Moderate Quality</strong>. The product passes some tests but fails others. There is a minor chance of dilution, chemical growth triggers, or mild processing additives.';
    } else {
        resultCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        resultCard.style.background = 'rgba(239, 68, 68, 0.08)';
        fbText.innerHTML = '<strong style="color:var(--color-danger);"><i class="fa-solid fa-radiation"></i> Quality Warning!</strong> Very low purity confidence. Home checks strongly indicate synthetic adulteration (soap/detergents), artificial chemical coloring, or heavy chemical ripening agents.';
    }
}

// 9. Fisheries Hub State & Actions
let fisheriesMap = null;
let activeFisheriesSubView = 'heatmap';
let fishSchools = [];
let breedingBans = [];
let historicalTrends = [];
let selectedFile = null;

function switchFisheriesSubView(viewId) {
    if (activeFisheriesSubView === viewId) return;

    document.querySelectorAll('.fisheries-sub-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.fisheries-subnav .subnav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`fisheries-sub-${viewId}`).classList.add('active');
    document.getElementById(`btn-fish-sub-${viewId}`).classList.add('active');

    activeFisheriesSubView = viewId;

    if (viewId === 'heatmap') {
        initFisheriesMap();
    } else if (viewId === 'trends') {
        setTimeout(renderHistoricalChart, 100);
    }
}

function initFisheriesMap() {
    if (fisheriesMap) {
        setTimeout(() => fisheriesMap.invalidateSize(), 100);
        return;
    }

    fisheriesMap = L.map('fisheries-map-container').setView([15.0, 75.0], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(fisheriesMap);

    renderFishSchools();
}

async function loadFisheriesData() {
    try {
        const [resMap, resBans, resTrends, resSchemes, resSightings] = await Promise.all([
            fetch('http://localhost:8000/fisheries/fish-map').then(r => r.json()),
            fetch('http://localhost:8000/fisheries/reproduction').then(r => r.json()),
            fetch('http://localhost:8000/fisheries/historical-trends').then(r => r.json()),
            fetch('http://localhost:8000/fisheries/schemes').then(r => r.json()),
            fetch('http://localhost:8000/fisheries/sightings').then(r => r.json())
        ]);

        fishSchools = resMap;
        breedingBans = resBans;
        historicalTrends = resTrends;

        renderFishSchools();
        renderBreedingCalendar('en');
        renderFisheriesSchemes(resSchemes);
        renderMarineSightings(resSightings);
    } catch (e) {
        console.error("Error loading fisheries database: ", e);
    }
}

function renderFishSchools() {
    if (!fisheriesMap || !fishSchools.length) return;

    fishSchools.forEach(s => {
        let color = '#3b82f6'; // Medium - Blue
        let radius = 25000;
        let badgeClass = 'medium';

        if (s.density >= 0.85) {
            color = '#ef4444'; // Red
            radius = 45000;
            badgeClass = 'critical';
        } else if (s.density >= 0.70) {
            color = '#fbbf24'; // Orange/Gold
            radius = 35000;
            badgeClass = 'high';
        }

        const circle = L.circle([s.latitude, s.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
            radius: radius
        }).addTo(fisheriesMap);

        const popup = `
            <div style="font-family: var(--font-body); padding: 5px; color:var(--text-primary);">
                <h4 style="margin-bottom: 5px; color:var(--text-primary);"><i class="fa-solid fa-fish"></i> ${s.species} School</h4>
                <p><strong>Location:</strong> ${s.location}</p>
                <p><strong>Estimated Concentration:</strong> <span class="status-badge ${badgeClass}">${Math.round(s.density * 100)}%</span></p>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:5px;">Coordinates: [${s.latitude}, ${s.longitude}]</p>
            </div>
        `;
        circle.bindPopup(popup);
    });
}

function renderBreedingCalendar(lang) {
    const body = document.getElementById('breeding-calendar-body');
    body.innerHTML = '';

    breedingBans.forEach(b => {
        const reason = b.reasons[lang] || b.reasons['en'];
        const row = `
            <tr>
                <td><strong style="color:var(--text-primary);">${b.species}</strong></td>
                <td><span class="status-badge critical" style="text-transform:none;">${b.season}</span></td>
                <td style="color:var(--text-primary); font-size:0.9rem; line-height:1.5; font-style:italic;">"${reason}"</td>
                <td><span style="font-weight:600; color:var(--color-danger);"><i class="fa-solid fa-ban"></i> STRICT FISHING BAN</span></td>
            </tr>
        `;
        body.innerHTML += row;
    });
}

function toggleCalendarLanguage() {
    const lang = document.getElementById('calendar-lang-select').value;
    renderBreedingCalendar(lang);
}

function renderHistoricalChart() {
    const container = document.getElementById('historical-svg-container');
    if (!container || !historicalTrends.length) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    const minYear = 2016;
    const maxYear = 2026;
    const minVal = 0;
    const maxVal = 100;

    const getX = (year) => paddingLeft + ((year - minYear) / (maxYear - minYear)) * graphWidth;
    const getY = (val) => paddingTop + graphHeight - (val / maxVal) * graphHeight;

    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow:visible;">`;

    // Gridlines & Y Axis markers
    for (let i = 0; i <= 4; i++) {
        const val = i * 25;
        const y = getY(val);
        svg += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(15,23,42,0.08)" stroke-width="1"/>`;
        svg += `<text x="${paddingLeft - 10}" y="${y + 4}" fill="var(--text-secondary)" font-size="10" text-anchor="end">${val}%</text>`;
    }

    // X Axis years
    historicalTrends.forEach(t => {
        const x = getX(t.year);
        svg += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + graphHeight}" stroke="rgba(15,23,42,0.04)" stroke-width="1"/>`;
        svg += `<text x="${x}" y="${paddingTop + graphHeight + 20}" fill="var(--text-secondary)" font-size="10" text-anchor="middle">${t.year}</text>`;
    });

    // Drawing paths for each fish type
    const speciesList = [
        { name: 'Sardines', color: '#10b981' },
        { name: 'Hilsa', color: '#fbbf24' },
        { name: 'Mackerel', color: '#f87171' },
        { name: 'Tuna', color: '#3b82f6' }
    ];

    speciesList.forEach(sp => {
        let pathD = '';
        historicalTrends.forEach((t, idx) => {
            const x = getX(t.year);
            const y = getY(t[sp.name]);
            if (idx === 0) {
                pathD += `M ${x} ${y}`;
            } else {
                pathD += ` L ${x} ${y}`;
            }
        });
        // Render line path
        svg += `<path d="${pathD}" fill="none" stroke="${sp.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

        // Render node circles
        historicalTrends.forEach(t => {
            const x = getX(t.year);
            const y = getY(t[sp.name]);
            svg += `<circle cx="${x}" cy="${y}" r="4" fill="${sp.color}" stroke="#0b0f19" stroke-width="1.5"/>`;
        });
    });

    svg += `</svg>`;
    container.innerHTML = svg;
}

function renderFisheriesSchemes(schemes) {
    const grid = document.getElementById('fisheries-schemes-grid');
    grid.innerHTML = '';

    schemes.forEach(s => {
        const isCentral = s.state === 'Central';
        const badgeClass = isCentral ? 'critical' : 'medium';
        const card = `
            <div class="card-glass" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                        <span class="status-badge ${badgeClass}">${s.state.toUpperCase()}</span>
                    </div>
                    <h3 class="card-title" style="color:var(--text-primary); margin-bottom:0.5rem;">${s.title}</h3>
                    <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.5;">${s.description}</p>
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });
}

function triggerFileInput() {
    document.getElementById('sight-file').click();
}

function handleFileSelect() {
    const fileInput = document.getElementById('sight-file');
    if (fileInput.files.length > 0) {
        selectedFile = fileInput.files[0];
        document.getElementById('dropzone-text').innerText = `Selected: ${selectedFile.name}`;
        document.getElementById('dropzone-icon').className = 'fa-solid fa-circle-check';
        document.getElementById('dropzone-icon').style.color = 'var(--color-accent-light)';
    }
}

async function submitMarineSighting() {
    const species = document.getElementById('sight-species').value;
    const lat = parseFloat(document.getElementById('sight-latitude').value);
    const lng = parseFloat(document.getElementById('sight-longitude').value);
    const notes = document.getElementById('sight-notes').value.trim();

    if (isNaN(lat) || isNaN(lng) || !notes || !selectedFile) {
        alert("Please fill in all coordinates, notes, and select an image file.");
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('species', species);
    formData.append('latitude', lat);
    formData.append('longitude', lng);
    formData.append('notes', notes);

    try {
        const response = await fetch('http://localhost:8000/fisheries/sightings', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            alert("Marine mammal sighting logged successfully!");
            // Reset uploader form
            document.getElementById('sight-latitude').value = '';
            document.getElementById('sight-longitude').value = '';
            document.getElementById('sight-notes').value = '';
            document.getElementById('sight-file').value = '';
            selectedFile = null;
            document.getElementById('dropzone-text').innerText = 'Click or Drag & Drop photo here';
            document.getElementById('dropzone-icon').className = 'fa-solid fa-images';
            document.getElementById('dropzone-icon').style.color = '';

            // Refresh sightings list
            const sightings = await fetch('http://localhost:8000/fisheries/sightings').then(r => r.json());
            renderMarineSightings(sightings);
        } else {
            alert("Failed to submit sighting. Please try again.");
        }
    } catch (e) {
        console.error("Error submitting sighting", e);
        alert("Connection error.");
    }
}

function renderMarineSightings(sightings) {
    const list = document.getElementById('sightings-gallery-list');
    list.innerHTML = '';
    if (sightings.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 2rem;">No sightings logged. Be the first to report!</p>';
        return;
    }

    sightings.forEach(s => {
        const date = new Date(s.timestamp);
        const dateStr = date.toLocaleDateString('en-IN') + ' ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        let imgTag = '';
        if (s.imageUrl) {
            imgTag = `<img src="${s.imageUrl}" alt="${s.species}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 0.75rem; border: 1px solid var(--border-glass);">`;
        }

        const item = `
            <div class="card-glass" style="padding: 1rem; background: rgba(255,255,255,0.02); margin-bottom: 0.5rem;">
                ${imgTag}
                <h4 style="color:var(--text-primary); font-family:var(--font-heading); margin-bottom: 0.25rem;">${s.species}</h4>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Logged on: ${dateStr}</p>
                <p style="font-size:0.85rem; line-height: 1.5; color:var(--text-primary); margin-bottom: 0.5rem;">"${s.notes}"</p>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--color-accent-light);">
                    <span>Co-ords: [${s.latitude}, ${s.longitude}]</span>
                </div>
            </div>
        `;
        list.innerHTML += item;
    });
}

window.addEventListener('resize', () => {
    if (activeTab === 'fisheries' && activeFisheriesSubView === 'trends') {
        renderHistoricalChart();
    }
    if (activeTab === 'weather' && climateTrendsData) {
        requestAnimationFrame(() => renderClimateTrendsChart(climateTrendsData));
    }
});

// 10. News Portal Module State & Actions
let newsArticles = [];
let activeNewsCategory = 'all';
let activeNewsTopic = 'all';

async function loadNews() {
    try {
        const response = await fetch('http://localhost:8000/news');
        newsArticles = await response.json();
        renderNews();
    } catch (e) {
        console.error("Error loading news: ", e);
    }
}

function renderNews() {
    const grid = document.getElementById('news-articles-grid');
    grid.innerHTML = '';

    const filtered = newsArticles.filter(a => {
        const matchCat = activeNewsCategory === 'all' || a.category.toLowerCase() === activeNewsCategory.toLowerCase();
        const matchTopic = activeNewsTopic === 'all' || a.topic === activeNewsTopic;
        return matchCat && matchTopic;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 4rem;"><i class="fa-solid fa-newspaper" style="font-size:3rem; margin-bottom:1rem; color:var(--text-secondary);"></i><p>No matching news articles found. Try adjusting filters.</p></div>';
        return;
    }

    filtered.forEach(a => {
        let tagColor = 'var(--text-secondary)';
        let tagBg = 'rgba(255,255,255,0.05)';
        if (a.topic === 'Modern Farming') {
            tagColor = '#06b6d4'; // Tech Teal
            tagBg = 'rgba(6, 182, 212, 0.1)';
        } else if (a.topic === 'Bio Farming') {
            tagColor = '#10b981'; // Emerald Green
            tagBg = 'rgba(16, 185, 129, 0.1)';
        } else if (a.topic === 'New Fishing Ways') {
            tagColor = '#0284c7'; // Marine Sky
            tagBg = 'rgba(2, 132, 199, 0.1)';
        } else if (a.topic === 'Oil Spills') {
            tagColor = '#ef4444'; // Crimson Hazard
            tagBg = 'rgba(239, 68, 68, 0.1)';
        } else if (a.topic === 'Climate Change') {
            tagColor = '#f97316'; // Solar Orange
            tagBg = 'rgba(249, 115, 22, 0.1)';
        }

        let outletBadge = '';
        if (a.outletType === 'Indian') {
            outletBadge = '<span class="status-badge" style="background: rgba(249, 115, 22, 0.1); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.2); font-size: 0.75rem;"><i class="fa-solid fa-flag"></i> Indian</span>';
        } else {
            outletBadge = '<span class="status-badge" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); font-size: 0.75rem;"><i class="fa-solid fa-globe"></i> Global</span>';
        }

        const card = `
            <div class="card-glass" style="display: flex; flex-direction: column; justify-content: space-between; padding: 1.5rem; transition: var(--transition-smooth); min-height: 250px;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                        <span class="status-badge" style="background:${tagBg}; color:${tagColor}; border:1px solid ${tagColor}33; font-weight:600;"><i class="fa-solid fa-hashtag"></i> ${a.topic}</span>
                        ${outletBadge}
                    </div>
                    <h3 class="card-title" style="color: var(--text-primary); font-size: 1.15rem; line-height: 1.4; margin-bottom: 0.75rem; font-family: var(--font-heading); font-weight:600;">${a.title}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5; margin-bottom: 1.25rem;">${a.summary}</p>
                </div>
                
                <div>
                    <hr style="border-color: var(--border-glass); margin: 0.75rem 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem;">
                        <span style="color: var(--text-secondary);">Source: <strong>${a.source}</strong></span>
                        <span style="color: var(--text-secondary);">${a.publishDate}</span>
                    </div>
                    <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display: block; text-align: center; padding: 0.5rem; font-size: 0.85rem; margin-top: 1rem; text-decoration: none;"><i class="fa-solid fa-up-right-from-square"></i> Read Full Article</a>
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });
}

function filterNewsCategory(cat) {
    activeNewsCategory = cat;

    document.getElementById('btn-news-cat-all').classList.remove('active');
    document.getElementById('btn-news-cat-agri').classList.remove('active');
    document.getElementById('btn-news-cat-fish').classList.remove('active');

    if (cat === 'all') {
        document.getElementById('btn-news-cat-all').classList.add('active');
    } else if (cat === 'agriculture') {
        document.getElementById('btn-news-cat-agri').classList.add('active');
    } else if (cat === 'fishery') {
        document.getElementById('btn-news-cat-fish').classList.add('active');
    }

    renderNews();
}

function filterNewsTopic() {
    activeNewsTopic = document.getElementById('news-topic-select').value;
    renderNews();
}

async function triggerManualNewsSync() {
    const btn = document.getElementById('btn-sync-news');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';

    try {
        const response = await fetch('http://localhost:8000/news/sync', { method: 'POST' });
        const result = await response.json();

        if (response.ok) {
            alert("News synchronization successful!");
            await loadNews();
        } else {
            alert(`Sync Failed: ${result.message}`);
        }
    } catch (e) {
        console.error("News sync call failed: ", e);
        alert("Failed to connect to server.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sync Latest News';
    }
}

// 11. Morphing Home Visualizer Logic
let currentMorphState = 'farm'; // 'farm' or 'sea'
let morphInterval = null;
let morphCanvas = null;
let morphCtx = null;
let morphParticles = [];

function initMorphVisualizer() {
    const imgFarm = document.getElementById('morph-img-farm');
    const imgSea = document.getElementById('morph-img-sea');
    const caption = document.getElementById('morph-caption');
    morphCanvas = document.getElementById('morph-canvas');

    if (!imgFarm || !imgSea || !caption || !morphCanvas) return;

    // Canvas setup
    morphCtx = morphCanvas.getContext('2d');
    resizeMorphCanvas();
    window.addEventListener('resize', resizeMorphCanvas);

    // Autoplay interval (toggles state every 6 seconds)
    if (morphInterval) clearInterval(morphInterval);
    morphInterval = setInterval(() => {
        triggerMorphParticles();

        if (currentMorphState === 'farm') {
            // Morph to Sea
            imgFarm.style.opacity = '0';
            imgFarm.style.transform = 'scale(1.1) translate(5px, 5px)';
            imgSea.style.opacity = '1';
            imgSea.style.transform = 'scale(1.02) translate(0px, 0px)';
            caption.innerHTML = '<i class="fa-solid fa-water"></i> Harvesting the bounty of the sea...';
            caption.style.color = '#0284c7'; // Marine Sky Blue
            currentMorphState = 'sea';

            // Dynamic theme transition: update background to sea!
            document.body.style.backgroundImage = "linear-gradient(rgba(241, 245, 249, 0.92), rgba(241, 245, 249, 0.95)), url('/uploads/sea_fishing_scene.jpg')";
        } else {
            // Morph to Farm
            imgSea.style.opacity = '0';
            imgSea.style.transform = 'scale(1.1) translate(-5px, -5px)';
            imgFarm.style.opacity = '1';
            imgFarm.style.transform = 'scale(1.02) translate(0px, 0px)';
            caption.innerHTML = '<i class="fa-solid fa-wheat-awn"></i> Sowing the seeds of the land...';
            caption.style.color = 'var(--color-accent)'; // Emerald Green
            currentMorphState = 'farm';

            // Dynamic theme transition: update background to farm!
            document.body.style.backgroundImage = "linear-gradient(rgba(241, 245, 249, 0.92), rgba(241, 245, 249, 0.95)), url('/uploads/farm_life_scene.png')";
        }
    }, 6000);

    animateMorphCanvas();
}

function resizeMorphCanvas() {
    if (!morphCanvas) return;
    morphCanvas.width = morphCanvas.parentElement.clientWidth;
    morphCanvas.height = morphCanvas.parentElement.clientHeight;
}

function triggerMorphParticles() {
    const count = 60;
    const colors = currentMorphState === 'farm' ? ['#0284c7', '#38bdf8', '#7dd3fc'] : ['#10b981', '#34d399', '#6ee7b7'];

    for (let i = 0; i < count; i++) {
        morphParticles.push({
            x: Math.random() * morphCanvas.width,
            y: morphCanvas.height + 10,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 4 - 2,
            radius: Math.random() * 6 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            life: 100
        });
    }
}

function animateMorphCanvas() {
    if (!morphCanvas || !morphCtx) return;

    requestAnimationFrame(animateMorphCanvas);
    morphCtx.clearRect(0, 0, morphCanvas.width, morphCanvas.height);

    for (let i = morphParticles.length - 1; i >= 0; i--) {
        const p = morphParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.01;
        p.life -= 1;

        morphCtx.save();
        morphCtx.globalAlpha = p.alpha;
        morphCtx.fillStyle = p.color;
        morphCtx.beginPath();
        morphCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        morphCtx.fill();
        morphCtx.restore();

        if (p.life <= 0 || p.alpha <= 0) {
            morphParticles.splice(i, 1);
        }
    }
}



// 13. Weather & Climate Updates Loader
let climateTrendsData = null;

async function loadWeather() {
    try {
        const resForecast = await fetch('http://localhost:8000/weather/forecast');
        const resTrends = await fetch('http://localhost:8000/weather/climate-trends');

        const forecasts = await resForecast.json();
        const trends = await resTrends.json();

        climateTrendsData = trends;   // cache globally for re-renders on resize / tab revisit

        renderWeatherForecasts(forecasts);

        // Defer chart render so the tab panel is fully visible and has real pixel dimensions
        requestAnimationFrame(() => {
            requestAnimationFrame(() => renderClimateTrendsChart(trends));
        });
    } catch (e) {
        console.error("Error loading weather data:", e);
    }
}

function renderClimateTrendsChart(trends) {
    const container = document.getElementById('climate-svg-container');
    if (!container || !trends || trends.length < 2) return;

    // getBoundingClientRect is the most reliable cross-browser way to get rendered size
    const rect = container.getBoundingClientRect();
    const width = rect.width > 0 ? Math.floor(rect.width) : (container.offsetWidth || 800);
    const height = rect.height > 0 ? Math.floor(rect.height) : (container.offsetHeight || 350);

    if (!width || !height) return;

    // Generous padding so axis labels fit INSIDE the SVG viewBox
    const paddingLeft = 72;
    const paddingRight = 72;
    const paddingTop = 24;
    const paddingBottom = 52;   // room for x-axis year labels

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    const years = trends.map(t => t.year);
    const minYear = Math.min(...years);   // 2000
    const maxYear = Math.max(...years);   // 2026

    // 1. Normalise rainfall deviation if backend sent raw mm
    trends.forEach(t => {
        if (t.annual_accumulated_rain_mm && (t.rainfall_deviation > 100 || t.rainfall_deviation < -100)) {
            t.rainfall_deviation = ((t.annual_accumulated_rain_mm - 650) / 650) * 100;
        }
    });

    // 2. Dynamic bounds with 15% breathing room
    const temps = trends.map(t => t.temp_anomaly);
    const rains = trends.map(t => t.rainfall_deviation);

    let minTemp = Math.min(...temps);
    let maxTemp = Math.max(...temps);
    let minRain = Math.min(...rains);
    let maxRain = Math.max(...rains);

    const tempPad = (maxTemp - minTemp) === 0 ? 0.5 : (maxTemp - minTemp) * 0.15;
    minTemp -= tempPad; maxTemp += tempPad;

    const rainPad = (maxRain - minRain) === 0 ? 5 : (maxRain - minRain) * 0.15;
    minRain -= rainPad; maxRain += rainPad;

    // 3. Scale helpers — clamp Y so dots never leave the plot area
    const getX = year => paddingLeft + ((year - minYear) / (maxYear - minYear || 1)) * graphWidth;
    const getYTemp = val => paddingTop + graphHeight - ((val - minTemp) / (maxTemp - minTemp)) * graphHeight;
    const getYRain = val => paddingTop + graphHeight - ((val - minRain) / (maxRain - minRain)) * graphHeight;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // 4. Build SVG — clipPath keeps lines inside the plot box
    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow:hidden; display:block;">`;
    svg += `<defs><clipPath id="plot-clip"><rect x="${paddingLeft}" y="${paddingTop}" width="${graphWidth}" height="${graphHeight}"/></clipPath></defs>`;

    // 5. Horizontal gridlines (6 bands) + dual Y-axis labels
    const GRID_STEPS = 6;
    for (let i = 0; i <= GRID_STEPS; i++) {
        const ratio = i / GRID_STEPS;
        const y = paddingTop + ratio * graphHeight;
        // gridline
        svg += `<line x1="${paddingLeft}" y1="${y}" x2="${paddingLeft + graphWidth}" y2="${y}" stroke="rgba(15,23,42,0.07)" stroke-width="1"/>`;
        // left axis: temp anomaly (°C)
        const tempVal = (maxTemp - ratio * (maxTemp - minTemp)).toFixed(2);
        svg += `<text x="${paddingLeft - 8}" y="${y + 4}" fill="#ef4444" font-size="10" text-anchor="end" font-family="sans-serif">${tempVal}°C</text>`;
        // right axis: rainfall deviation (%)
        const rainVal = (maxRain - ratio * (maxRain - minRain)).toFixed(1);
        svg += `<text x="${paddingLeft + graphWidth + 8}" y="${y + 4}" fill="#3b82f6" font-size="10" text-anchor="start" font-family="sans-serif">${rainVal}%</text>`;
    }

    // 6. Vertical gridlines + X-axis year labels every 5 years
    for (let yr = minYear; yr <= maxYear; yr++) {
        const x = getX(yr);
        const showLabel = (yr % 5 === 0) || yr === minYear || yr === maxYear;
        if (showLabel) {
            svg += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + graphHeight}" stroke="rgba(15,23,42,0.06)" stroke-width="1"/>`;
            svg += `<text x="${x}" y="${paddingTop + graphHeight + 18}" fill="var(--text-secondary)" font-size="10" text-anchor="middle" font-family="sans-serif">${yr}</text>`;
        }
    }

    // 7. Axis border lines
    svg += `<line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + graphHeight}" stroke="rgba(15,23,42,0.15)" stroke-width="1"/>`;
    svg += `<line x1="${paddingLeft}" y1="${paddingTop + graphHeight}" x2="${paddingLeft + graphWidth}" y2="${paddingTop + graphHeight}" stroke="rgba(15,23,42,0.15)" stroke-width="1"/>`;

    // 8. Build line paths (clipped)
    let pathTemp = '';
    let pathRain = '';
    trends.forEach((t, idx) => {
        const x = getX(t.year);
        const yTemp = clamp(getYTemp(t.temp_anomaly), paddingTop, paddingTop + graphHeight);
        const yRain = clamp(getYRain(t.rainfall_deviation), paddingTop, paddingTop + graphHeight);
        pathTemp += idx === 0 ? `M ${x} ${yTemp}` : ` L ${x} ${yTemp}`;
        pathRain += idx === 0 ? `M ${x} ${yRain}` : ` L ${x} ${yRain}`;
    });

    svg += `<g clip-path="url(#plot-clip)">`;
    svg += `<path d="${pathTemp}" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    svg += `<path d="${pathRain}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="5,4" stroke-linecap="round" stroke-linejoin="round"/>`;

    // 9. Data point dots (inside clip)
    trends.forEach(t => {
        const x = getX(t.year);
        const yTemp = clamp(getYTemp(t.temp_anomaly), paddingTop, paddingTop + graphHeight);
        const yRain = clamp(getYRain(t.rainfall_deviation), paddingTop, paddingTop + graphHeight);
        svg += `<circle cx="${x}" cy="${yTemp}" r="3" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>`;
        svg += `<circle cx="${x}" cy="${yRain}" r="3" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>`;
    });
    svg += `</g>`;

    // 10. Axis titles (inside viewBox, at safe positions)
    svg += `<text x="14" y="${paddingTop + graphHeight / 2}" fill="#ef4444" font-size="10" text-anchor="middle" transform="rotate(-90,14,${paddingTop + graphHeight / 2})" font-family="sans-serif">Temp Anomaly (°C)</text>`;
    svg += `<text x="${width - 10}" y="${paddingTop + graphHeight / 2}" fill="#3b82f6" font-size="10" text-anchor="middle" transform="rotate(90,${width - 10},${paddingTop + graphHeight / 2})" font-family="sans-serif">Rainfall Dev (%)</text>`;

    svg += `</svg>`;
    container.innerHTML = svg;
}
// 14. Floating Accessibility Speech Reader (TTS) Controls
let currentUtterance = null;

function toggleAccessMenu() {
    const box = document.getElementById('access-menu-box');
    if (!box) return;
    if (box.style.display === 'none' || box.style.display === '') {
        box.style.display = 'flex';
    } else {
        box.style.display = 'none';
    }
}

function stopSpeaking() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

function speakActivePage() {
    stopSpeaking();

    const activePanel = document.getElementById(`panel-${activeTab}`);
    if (!activePanel) return;

    const elements = activePanel.querySelectorAll('h2, h3, h4, p, li, td');
    let textToSpeak = '';

    elements.forEach(el => {
        let parent = el;
        let isVisible = true;
        while (parent && parent !== activePanel) {
            const computedStyle = window.getComputedStyle(parent);
            if (computedStyle.display === 'none' ||
                computedStyle.visibility === 'hidden' ||
                parent.style.display === 'none' ||
                (parent.classList.contains('farming-sub-panel') && !parent.classList.contains('active')) ||
                (parent.classList.contains('market-sub-panel') && !parent.classList.contains('active')) ||
                (parent.classList.contains('fisheries-sub-panel') && !parent.classList.contains('active'))) {
                isVisible = false;
                break;
            }
            parent = parent.parentElement;
        }
        if (isVisible && el.innerText.trim()) {
            textToSpeak += el.innerText.trim() + '. ';
        }
    });

    if (!textToSpeak) {
        textToSpeak = "Nothing to read on this page.";
    }

    currentUtterance = new SpeechSynthesisUtterance(textToSpeak);

    const selectEl = document.getElementById('header-language-select') || document.getElementById('access-language-select');
    const langCode = selectEl ? selectEl.value : 'en';
    const langMap = {
        'en': 'en-IN', 'hi': 'hi-IN', 'mr': 'mr-IN',
        'ta': 'ta-IN', 'ml': 'ml-IN', 'bn': 'bn-IN', 'te': 'te-IN'
    };
    currentUtterance.lang = langMap[langCode] || 'en-IN';
    currentUtterance.rate = 1.0;
    currentUtterance.pitch = 1.0;

    window.speechSynthesis.speak(currentUtterance);
}

// 15. Multilingual Translation Switcher Engine
const TRANSLATIONS = {
    'en': {
        'nav-btn-dashboard': '<i class="fa-solid fa-chart-line"></i> Dashboard',
        'nav-btn-farming': '<i class="fa-solid fa-tractor"></i> Farming',
        'btn-farm-sub-cattle': '<i class="fa-solid fa-cow"></i> Livestock Health',
        'btn-farm-sub-mandi': '<i class="fa-solid fa-wheat-awn"></i> Mandi Prices',
        'btn-farm-sub-market': '<i class="fa-solid fa-store"></i> Bio Market',
        'nav-btn-fisheries': '<i class="fa-solid fa-ship"></i> Fishery',
        'nav-btn-weather': '<i class="fa-solid fa-cloud-sun-rain"></i> Weather Update',
        'nav-btn-birds': '<i class="fa-solid fa-feather-pointed"></i> Bird Acoustic',
        'nav-btn-news': '<i class="fa-solid fa-newspaper"></i> News Portal',
        'nav-btn-sources': '<i class="fa-solid fa-circle-info"></i> Datasources',
        'lbl-hero-title': 'Empowering Rural India with Live Data',
        'lbl-hero-desc': 'GramSetu connects rural professionals to real-time market rates, livestock health alerts, organic bio-trading, and citizen-science conservation mapping.',
        'btn-sync-data': '<i class="fa-solid fa-rotate"></i> Sync Latest Datasets',
        'lbl-weather-title': '<i class="fa-solid fa-cloud-sun-rain"></i> Weather & Climate Change Updates',
        'lbl-weather-subtitle': 'Real-time monsoon monitoring, regional El Niño advisories, and long-term temperature anomaly tracking.',
        'lbl-elnino-title': '<i class="fa-solid fa-circle-exclamation" style="color: var(--color-danger);"></i> El Niño Advisory & Monsoon Impact',
        'lbl-elnino-desc': 'El Niño conditions are currently active. In India, El Niño is historically linked to weaker southwest monsoons, delayed wind arrival, and below-average rainfall (averaging a 10-15% deficit). This increases drought risks in Central and North-West India. Rural professionals are advised to prioritize water harvesting, utilize mulching to conserve soil moisture, and select drought-resistant crop varieties.',
        'lbl-regional-forecasts-title': '<i class="fa-solid fa-map-location"></i> Regional Forecasts & Monsoon Deficits',
        'lbl-climate-title': '<i class="fa-solid fa-chart-area"></i> Decadal Temperature Anomaly & Monsoon Deviation (2000 - 2026)',
        'lbl-climate-subtitle': 'Long-term temperature anomalies (relative to 20th century average) and corresponding rainfall deficits illustrating climate change footprints.',
        'lbl-coral-title': '<i class="fa-solid fa-shield-heart"></i> Coral Reef Protection Guide',
        'lbl-coral-intro': 'Coral reefs are the rain forests of the sea. They occupy less than 0.1% of the ocean but shelter over 25% of all marine life, serving as primary nurseries for sardines, mackerel, and snapper.',
        'lbl-coral-why-title': 'Why are Corals Important?',
        'lbl-coral-how-title': 'How to Protect Them?',
        'lbl-calc-title': '<i class="fa-solid fa-calculator"></i> Coastal Savings & Yield Calculator',
        'lbl-calc-desc': 'Calculate how much money a coastal community saves in shore defenses and gains in fishing profits by actively preserving local coral reefs.',
        'lbl-calc-reef-len': 'Protected Coral Reef Length (in km)',
        'lbl-calc-boats': 'Number of Community Fishing Boats',
        'lbl-calc-results-title': 'Estimated Annual Community Savings',
        'lbl-calc-defense': 'Coastal Defense Savings:',
        'lbl-calc-yield': 'Increased Fish Catch Value:',
        'lbl-calc-total': 'Total Economic Benefit:',
        'lbl-calc-note': '*Calculations are based on average seawall construction costs saved per km (approx ₹25L/km/yr) and catch replenishment values of ₹35,000 per boat/yr.',
        'lbl-access-lang': 'Translate Website Language',
        'lbl-access-tts': 'Screen Speech Reader (TTS)',
        'lbl-cattle-title': '<i class="fa-solid fa-cow"></i> Livestock Health & Vaccination Advisor',
        'lbl-cattle-desc': 'Explore active livestock outbreaks on the interactive heat-intensity map. Select an outbreak location to view immediate local veterinary guidance and immunization actions.',
        'lbl-cattle-advisory-title': '<i class="fa-solid fa-hand-holding-medical"></i> Vaccine Advisor',
        'lbl-cattle-advisory-prompt': 'Click on an active marker on the map to display district-specific vaccine needs and veterinarian guidelines.',
        'lbl-mandi-title': '<i class="fa-solid fa-wheat-awn"></i> Grain Market Rates (Agricultural Mandis)',
        'lbl-mandi-subtitle': 'Current mandi prices per quintal (100 kilograms) across Indian states, aggregated weekly directly from government databases.',
        'lbl-filter-state': 'State',
        'lbl-filter-commodity': 'Grain / Commodity',
        'lbl-market-title': '<i class="fa-solid fa-store"></i> Organic Bio-Product Marketplace',
        'lbl-market-subtitle': 'Register, login, and browse organic products directly from rural sellers. Explanations of "bio" and home chemical testing kits are available below.',
        'lbl-fisheries-title': '<i class="fa-solid fa-ship"></i> Fisheries Hub & Marine Ecosystem',
        'lbl-fisheries-desc': 'Explore coastal fish heatmap zones, breeding restriction calendars with multilingual conservation insights, ocean population charts, and marine mammal sightings.',
        'lbl-groundwater-title': '<i class="fa-solid fa-droplet"></i> Groundwater Depletion & Sewage Contamination Visualizer (2016 - 2026)',
        'lbl-groundwater-subtitle': 'Monitor water table drawdown (mbgl) and track the overlap of urban sewage mixing in agricultural aquifers.',
        'lbl-gw-year-label': 'Select Forecast/Historical Year:',
        'lbl-gw-map-title': 'Interactive Ground Water Aquifers Map',
        'lbl-groundwater-chart-title': 'Water Table Level Trend (Depth in mbgl)',
        'nav-btn-mesh': '<i class="fa-solid fa-circle-nodes"></i> Offline Mesh',
        'lbl-mesh-title': '<i class="fa-solid fa-circle-nodes"></i> Offline Mesh Network',
        'lbl-mesh-desc': 'Exchange alerts and short messages directly with nearby users via Bluetooth mesh technology. Operating entirely offline without cellular network coverage.',
        'lbl-mesh-send-title': '<i class="fa-solid fa-paper-plane"></i> Broadcast Message',
        'lbl-mesh-send-desc': 'Compose a short notification to broadcast over the local Bluetooth mesh network.',
        'lbl-mesh-sender-label': 'Your Sender ID / Handle',
        'lbl-mesh-urgency-label': 'Alert Urgency Level',
        'lbl-mesh-message-label': 'Broadcast Text (Max 140 Characters)',
        'lbl-mesh-broadcast-btn': '<i class="fa-solid fa-rss"></i> Broadcast Offline (Bluetooth)',
        'lbl-mesh-stream-title': '<i class="fa-solid fa-list-check"></i> Live Mesh Feed',
        'lbl-mesh-radar-title': 'Bluetooth Transceiver Active',
        'lbl-mesh-empty-text': 'No active mesh transmissions detected yet.',
        'lbl-mesh-bridge-status': 'Native Bridge Connection Status:',
        'nav-btn-feedback': '<i class="fa-solid fa-comments"></i> Feedback Hub',
        'lbl-feedback-title': '<i class="fa-solid fa-comments"></i> Feedback & Suggestions Hub',
        'lbl-feedback-desc': 'Help us improve GramSetu. Submit your recommendations, product reviews, complaints, or new ideas directly to our platform.',
        'lbl-feedback-form-title': '<i class="fa-solid fa-pen-to-square"></i> Share Your Thoughts',
        'lbl-feedback-form-desc': 'Select a category, rate your experience, and write your suggestions below.',
        'lbl-feedback-category-label': 'Feedback Category',
        'lbl-feedback-rating-label': 'Rating',
        'lbl-feedback-text-label': 'Message / Details',
        'btn-submit-feedback': '<i class="fa-solid fa-paper-plane"></i> Submit Feedback',
        'lbl-feedback-avg-rating': 'Average Rating',
        'lbl-feedback-total-posts': 'Total Submissions',
        'lbl-feedback-board-title': '<i class="fa-solid fa-users"></i> Community Suggestions Board',
        'lbl-feedback-empty-board': 'No feedback or suggestions submitted yet.'
    },
    'hi': {
        'nav-btn-dashboard': '<i class="fa-solid fa-chart-line"></i> डैशबोर्ड',
        'nav-btn-farming': '<i class="fa-solid fa-tractor"></i> खेती',
        'btn-farm-sub-cattle': '<i class="fa-solid fa-cow"></i> पशु स्वास्थ्य',
        'btn-farm-sub-mandi': '<i class="fa-solid fa-wheat-awn"></i> मंडी दरें',
        'btn-farm-sub-market': '<i class="fa-solid fa-store"></i> बायो बाजार',
        'nav-btn-fisheries': '<i class="fa-solid fa-ship"></i> मत्स्य पालन',
        'nav-btn-weather': '<i class="fa-solid fa-cloud-sun-rain"></i> मौसम अपडेट',
        'nav-btn-birds': '<i class="fa-solid fa-feather-pointed"></i> पक्षी ध्वनि',
        'nav-btn-news': '<i class="fa-solid fa-newspaper"></i> समाचार पोर्टल',
        'nav-btn-sources': '<i class="fa-solid fa-circle-info"></i> डेटा स्रोत',
        'lbl-hero-title': 'लाइव डेटा के साथ ग्रामीण भारत को सशक्त बनाना',
        'lbl-hero-desc': 'ग्रामसेतु ग्रामीण पेशेवरों को वास्तविक समय की बाजार दरों, पशुधन स्वास्थ्य अलर्ट, जैविक जैव-व्यापार और नागरिक-विज्ञान संरक्षण मानचित्रण से जोड़ता है।',
        'btn-sync-data': '<i class="fa-solid fa-rotate"></i> नवीनतम डेटा सिंक करें',
        'lbl-weather-title': '<i class="fa-solid fa-cloud-sun-rain"></i> मौसम और जलवायु परिवर्तन अपडेट',
        'lbl-weather-subtitle': 'वास्तविक समय मानसून निगरानी, क्षेत्रीय अल नीनो सलाह, और दीर्घकालिक तापमान विसंगति ट्रैकिंग।',
        'lbl-elnino-title': '<i class="fa-solid fa-circle-exclamation" style="color: var(--color-danger);"></i> अल नीनो सलाह और मानसून प्रभाव',
        'lbl-elnino-desc': 'अल नीनो स्थिति वर्तमान में सक्रिय है। भारत में, अल नीनो ऐतिहासिक रूप से कमजोर दक्षिण-पश्चिम मानसून, देरी से हवाओं के आगमन और औसत से कम वर्षा (औसत 10-15% की कमी) से जुड़ा हुआ है। इससे मध्य और उत्तर-पश्चिम भारत में सूखे का खतरा बढ़ जाता है। ग्रामीण पेशेवरों को जल संचयन को प्राथमिकता देने, मिट्टी की नमी को बनाए रखने के लिए मल्चिंग का उपयोग करने और सूखा-प्रतिरोधी फसल किस्मों का चयन करने की सलाह दी जाती है।',
        'lbl-regional-forecasts-title': '<i class="fa-solid fa-map-location"></i> क्षेत्रीय पूर्वानुमान और मानसून की कमी',
        'lbl-climate-title': '<i class="fa-solid fa-chart-area"></i> दशक तापमान विसंगति और मानसून विचलन (2000 - 2026)',
        'lbl-climate-subtitle': 'दीर्घकालिक तापमान विसंगतियां और संबंधित वर्षा घाटा जो जलवायु परिवर्तन के प्रभावों को दर्शाते हैं।',
        'lbl-coral-title': '<i class="fa-solid fa-shield-heart"></i> मूंगा चट्टान संरक्षण गाइड',
        'lbl-coral-intro': 'मूंगा चट्टानें समुद्र के वर्षावन हैं। वे महासागर के 0.1% से भी कम हिस्से पर कब्जा करती हैं लेकिन 25% से अधिक समुद्री जीवन को आश्रय देती हैं, जो सार्डिन, मैकेरल और स्नैपर के प्राथमिक नर्सरी के रूप में कार्य करती हैं।',
        'lbl-coral-why-title': 'मूंगा चट्टानें क्यों महत्वपूर्ण हैं?',
        'lbl-coral-how-title': 'उनकी रक्षा कैसे करें?',
        'lbl-calc-title': '<i class="fa-solid fa-calculator"></i> तटीय बचत और उपज कैलकुलेटर',
        'lbl-calc-desc': 'यह गणना करें कि एक तटीय समुदाय स्थानीय मूंगा चट्टानों को सक्रिय रूप से संरक्षित करके तट रक्षा में कितना पैसा बचाता है और मछली पकड़ने के मुनाफे में कितना लाभ कमाता है।',
        'lbl-calc-reef-len': 'संरक्षित मूंगा चट्टान की लंबाई (किमी में)',
        'lbl-calc-boats': 'सामुदायिक मछली पकड़ने की नौकाओं की संख्या',
        'lbl-calc-results-title': 'अनुमानित वार्षिक सामुदायिक बचत',
        'lbl-calc-defense': 'तटीय रक्षा बचत:',
        'lbl-calc-yield': 'बढ़ी हुई मछली पकड़ने का मूल्य:',
        'lbl-calc-total': 'कुल आर्थिक लाभ:',
        'lbl-calc-note': '*गणना प्रति किमी बचाए गए औसत सुरक्षा दीवार निर्माण लागत (लगभग ₹25 लाख/किमी/वर्ष) और प्रति नौका ₹35,000/वर्ष के पुनर्भरण मूल्यों पर आधारित है।',
        'lbl-access-lang': 'वेबसाइट भाषा बदलें',
        'lbl-access-tts': 'स्क्रीन स्पीच रीडर (टीटीएस)',
        'lbl-cattle-title': '<i class="fa-solid fa-cow"></i> पशु स्वास्थ्य और टीकाकरण सलाहकार',
        'lbl-cattle-desc': 'इंटरैक्टिव ताप-तीव्रता मानचित्र पर सक्रिय पशुधन प्रकोपों ​​का पता लगाएं। तत्काल स्थानीय पशु चिकित्सा मार्गदर्शन और प्रतिरक्षण कार्रवाई देखने के लिए एक प्रकोप स्थान का चयन करें।',
        'lbl-cattle-advisory-title': '<i class="fa-solid fa-hand-holding-medical"></i> वैक्सीन सलाहकार',
        'lbl-cattle-advisory-prompt': 'जिला-विशिष्ट वैक्सीन आवश्यकताओं और पशु चिकित्सक दिशानिर्देशों को प्रदर्शित करने के लिए मानचित्र पर एक सक्रिय मार्कर पर क्लिक करें।',
        'lbl-mandi-title': '<i class="fa-solid fa-wheat-awn"></i> अनाज बाजार दरें (कृषि मंडियां)',
        'lbl-mandi-subtitle': 'भारतीय राज्यों में प्रति क्विंटल (100 किलोग्राम) वर्तमान मंडी की कीमतें, सीधे सरकारी डेटाबेस से साप्ताहिक रूप से एकत्रित की जाती हैं।',
        'lbl-filter-state': 'राज्य',
        'lbl-filter-commodity': 'अनाज / वस्तु',
        'lbl-market-title': '<i class="fa-solid fa-store"></i> जैविक बायो-उत्पाद बाजार',
        'lbl-market-subtitle': 'ग्रामीण विक्रेताओं से सीधे जैविक उत्पादों को पंजीकृत करें, लॉगिन करें और ब्राउज़ करें। "बायो" और घरेलू रासायनिक परीक्षण किट की व्याख्या नीचे उपलब्ध है।',
        'lbl-fisheries-title': '<i class="fa-solid fa-ship"></i> मत्स्य पालन केंद्र और समुद्री पारिस्थितिकी तंत्र',
        'lbl-fisheries-desc': 'तटीय मछली ताप-मानचित्र क्षेत्रों, बहुभाषी संरक्षण अंतर्दृष्टि के साथ प्रजनन प्रतिबंध कैलेंडर, महासागर जनसंख्या चार्ट और समुद्री स्तनपायी देखे जाने की खोज करें।',
        'lbl-groundwater-title': '<i class="fa-solid fa-droplet"></i> भूजल रिक्तीकरण और सीवेज संदूषण विज़ुअलाइज़र (2016 - 2026)',
        'lbl-groundwater-subtitle': 'जल स्तर में कमी (mbgl) की निगरानी करें और कृषि जलभृतों में शहरी सीवेज मिश्रण के ओवरलैप को ट्रैक करें।',
        'lbl-gw-year-label': 'पूर्वानुमान/ऐतिहासिक वर्ष चुनें:',
        'lbl-gw-map-title': 'इंटरैक्टिव भूजल जलभृत मानचित्र',
        'lbl-groundwater-chart-title': 'जल स्तर का रुझान (mbgl में गहराई)',
        'nav-btn-mesh': '<i class="fa-solid fa-circle-nodes"></i> ऑफलाइन मेश',
        'lbl-mesh-title': '<i class="fa-solid fa-circle-nodes"></i> ऑफलाइन मेश नेटवर्क',
        'lbl-mesh-desc': 'ब्लूटूथ मेश तकनीक के माध्यम से आस-पास के उपयोगकर्ताओं के साथ सीधे अलर्ट और संक्षिप्त संदेशों का आदान-प्रदान करें। बिना सेलुलर नेटवर्क कवरेज के पूरी तरह से ऑफलाइन काम करता है।',
        'lbl-mesh-send-title': '<i class="fa-solid fa-paper-plane"></i> संदेश प्रसारित करें',
        'lbl-mesh-send-desc': 'स्थानीय ब्लूटूथ मेश नेटवर्क पर प्रसारित करने के लिए एक संक्षिप्त अधिसूचना लिखें।',
        'lbl-mesh-sender-label': 'आपकी प्रेषक आईडी / हैंडल',
        'lbl-mesh-urgency-label': 'अलर्ट तात्कालिकता स्तर',
        'lbl-mesh-message-label': 'प्रसारण पाठ (अधिकतम 140 वर्ण)',
        'lbl-mesh-broadcast-btn': '<i class="fa-solid fa-rss"></i> ऑफलाइन प्रसारण (ब्लूटूथ)',
        'lbl-mesh-stream-title': '<i class="fa-solid fa-list-check"></i> लाइव मेश फीड',
        'lbl-mesh-radar-title': 'ब्लूटूथ ट्रांसीवर सक्रिय',
        'lbl-mesh-empty-text': 'अभी तक कोई सक्रिय मेश प्रसारण नहीं मिला है।',
        'lbl-mesh-bridge-status': 'देशी ब्रिज कनेक्शन स्थिति:',
        'nav-btn-feedback': '<i class="fa-solid fa-comments"></i> \u092B\u0940\u0921\u092C\u0948\u0915 \u0939\u092C',
        'lbl-feedback-title': '<i class="fa-solid fa-comments"></i> \u092B\u0940\u0921\u092C\u0948\u0915 \u0914\u0930 \u0938\u0941\u091D\u093E\u0935 \u0939\u092C',
        'lbl-feedback-desc': '\u0917\u094D\u0930\u093E\u092E\u0938\u0947\u0924\u0941 \u0915\u094B \u092C\u0947\u0939\u0924\u0930 \u092C\u0928\u093E\u0928\u0947 \u092E\u0947\u0902 \u0939\u092E\u093E\u0930\u0940 \u092E\u0926\u0926 \u0915\u0930\u0947\u0902\u0964 \u0905\u092A\u0928\u0940 \u0938\u093F\u092B\u093E\u0930\u093F\u0936\u0947\u0902, \u0938\u092E\u0940\u0915\u094D\u0937\u093E\u090F\u0902, \u0936\u093F\u0915\u093E\u092F\u0924\u0947\u0902 \u092F\u093E \u0928\u090F \u0935\u093F\u091A\u093E\u0930 \u0938\u0940\u0927\u0947 \u0939\u092E\u093E\u0930\u0947 \u092A\u094D\u0932\u0947\u091F\u092B\u0949\u0930\u094D\u092E \u092A\u0930 \u092D\u0947\u091C\u0947\u0902\u0964',
        'lbl-feedback-form-title': '<i class="fa-solid fa-pen-to-square"></i> \u0905\u092a\u0928\u0947 \u0935\u093f\u091a\u093e\u0930 \u0938\u093e\u091d\u093e \u0915\u0930\u0947\u0902',
        'lbl-feedback-form-desc': '\u090f\u0915 \u0936\u094d\u0930\u094d\u0923\u0940 \u091a\u0941\u0928\u0947\u0902, \u0905\u092a\u0928\u0947 \u0905\u0928\u0941\u092d\u0935 \u0915\u094b \u0930\u0947\u091f \u0915\u0930\u0947\u0902 \u0914\u0930 \u0928\u0940\u091a\u0947 \u0905\u092a\u0928\u0947 \u0938\u0941\u091d\u093e\u0935 \u0932\u093f\u0916\u0947\u0902\u0964',
        'lbl-feedback-category-label': '\u092b\u0940\u0921\u092c\u0948\u0915 \u0936\u094d\u0930\u094d\u0923\u0940',
        'lbl-feedback-rating-label': '\u0930\u0947\u091f\u093f\u0902\u0917',
        'lbl-feedback-text-label': '\u0938\u0902\u0926\u0947\u0936 / \u0935\u093f\u0935\u0930\u0923',
        'btn-submit-feedback': '<i class="fa-solid fa-paper-plane"></i> \u092b\u0940\u0921\u092c\u0948\u0915 \u0938\u092c\u092e\u093f\u091f \u0915\u0930\u0947\u0902',
        'lbl-feedback-avg-rating': '\u0914\u0938\u0924 \u0930\u0947\u091f\u093f\u0902\u0917',
        'lbl-feedback-total-posts': '\u0915\u0941\u0932 \u0938\u092c\u092e\u093f\u0936\u0928',
        'lbl-feedback-board-title': '<i class="fa-solid fa-users"></i> \u0938\u092e\u0941\u0926\u093e\u092f \u0938\u0941\u091d\u093e\u0935 \u092c\u094b\u0930\u094d\u0921',
        'lbl-feedback-empty-board': '\u0905\u092d\u0940 \u0924\u0915 \u0915\u094b\u0908 \u092b\u0940\u0921\u092c\u0948\u0915 \u092f\u093e \u0938\u0941\u091d\u093e\u0935 \u0938\u092c\u092e\u093f\u091f \u0928\u0929\u0940\u0902 \u0915\u093f\u092f\u093e \u0917\u092f\u093e \u0939\u0948\u0964'
    },
    'mr': {
        'nav-btn-dashboard': '<i class="fa-solid fa-chart-line"></i> डॅशबोर्ड',
        'nav-btn-farming': '<i class="fa-solid fa-tractor"></i> शेती',
        'btn-farm-sub-cattle': '<i class="fa-solid fa-cow"></i> पशु आरोग्य',
        'btn-farm-sub-mandi': '<i class="fa-solid fa-wheat-awn"></i> बाजार भाव',
        'btn-farm-sub-market': '<i class="fa-solid fa-store"></i> बायो मार्केट',
        'nav-btn-fisheries': '<i class="fa-solid fa-ship"></i> मत्स्य व्यवसाय',
        'nav-btn-weather': '<i class="fa-solid fa-cloud-sun-rain"></i> हवामान अंदाज',
        'nav-btn-birds': '<i class="fa-solid fa-feather-pointed"></i> पक्षी आवाज',
        'nav-btn-news': '<i class="fa-solid fa-newspaper"></i> वृत्त पोर्टल',
        'nav-btn-sources': '<i class="fa-solid fa-circle-info"></i> डेटा स्रोत',
        'lbl-hero-title': 'थेट डेटासह ग्रामीण भारताचे सक्षमीकरण',
        'lbl-hero-desc': 'ग्रामसेतु ग्रामीण व्यावसायिकांना थेट बाजार दर, पशुधन आरोग्य इशारे, सेंद्रिय बायो-ट्रेडिंग आणि नागरिक-विज्ञान संवर्धन नकाशांशी जोडतो.',
        'btn-sync-data': '<i class="fa-solid fa-rotate"></i> नवीन डेटा सिंक करा',
        'lbl-weather-title': '<i class="fa-solid fa-cloud-sun-rain"></i> हवामान आणि बदल अपडेट्स',
        'lbl-weather-subtitle': 'थेट मान्सून देखरेख, प्रादेशिक अल निनो इशारे आणि तापमान विसंगतीचा मागोवा.',
        'lbl-elnino-title': '<i class="fa-solid fa-circle-exclamation" style="color: var(--color-danger);"></i> अल निनो सल्ला आणि मान्सून परिणाम',
        'lbl-elnino-desc': 'अल निनो परिस्थिती सध्या सक्रिय आहे. भारतात, अल निनोचा कमकुवत मान्सून आणि सरासरीपेक्षा कमी पाऊस (१०-१५% तूट) यांच्याशी संबंध आहे. यामुळे दुष्काळाचा धोका वाढतो. शेतकऱ्यांनी जलसंधारणाला प्राधान्य द्यावे.',
        'lbl-regional-forecasts-title': '<i class="fa-solid fa-map-location"></i> प्रादेशिक अंदाज आणि मान्सून तूट',
        'lbl-climate-title': '<i class="fa-solid fa-chart-area"></i> दशकातील तापमान विसंगती आणि मान्सून विचलन (2000 - 2026)',
        'lbl-climate-subtitle': 'दीर्घकालीन तापमान विसंगती आणि संबंधित पावसाची तूट जी हवामान बदलाचे पाऊलखुणा दर्शवते.',
        'lbl-coral-title': '<i class="fa-solid fa-shield-heart"></i> प्रवाळ खडक संरक्षण मार्गदर्शक',
        'lbl-coral-intro': 'प्रवाळ खडक हे समुद्रातील वर्षावन आहेत. ते समुद्राचा ०.१% पेक्षा कमी भाग व्यापतात परंतु २५% सागरी जीवांना आश्रय देतात.',
        'lbl-coral-why-title': 'प्रवाळ खडक का महत्त्वाचे आहेत?',
        'lbl-coral-how-title': 'त्यांचे रक्षण कसे करावे?',
        'lbl-calc-title': '<i class="fa-solid fa-calculator"></i> तटीय बचत आणि उत्पन्न कॅल्क्युलेटर',
        'lbl-calc-desc': 'सागरी प्रवाळांचे रक्षण करून तटीय समुदाय भिंत बांधणीत किती पैसे वाचवतो आणि मासेमारीतून किती नफा मिळवतो ते मोजा.',
        'lbl-calc-reef-len': 'संरक्षित प्रवाळ खडकाची लांबी (किमी मध्ये)',
        'lbl-calc-boats': 'बोटींची संख्या',
        'lbl-calc-results-title': 'अंदाजित वार्षिक सामुदायिक बचत',
        'lbl-calc-defense': 'तटीय संरक्षण बचत:',
        'lbl-calc-yield': 'वाढलेले मासेमारी मूल्य:',
        'lbl-calc-total': 'एकूण आर्थिक लाभ:',
        'lbl-calc-note': '*कॅल्क्युलेटर प्रति किमी वाचलेल्या सरासरी संरक्षण भिंत बांधणी खर्चावर आधारित आहे.',
        'lbl-access-lang': 'वेबसाइट भाषा बदला',
        'lbl-access-tts': 'स्क्रीन स्पीच रीडर (टीटीएस)',
        'lbl-cattle-title': '<i class="fa-solid fa-cow"></i> पशुधन आरोग्य आणि लसीकरण सल्लागार',
        'lbl-cattle-desc': 'परस्परसंवादी नकाशावर सक्रिय पशुधन प्रादुर्भाव तपासा. स्थानिक पशुवैद्यकीय मार्गदर्शन आणि लसीकरण कृती पाहण्यासाठी प्रादुर्भाव स्थान निवडा.',
        'lbl-cattle-advisory-title': '<i class="fa-solid fa-hand-holding-medical"></i> लस सल्लागार',
        'lbl-cattle-advisory-prompt': 'जिल्हा-विशिष्ट लस आवश्यकता आणि पशुवैद्यकीय मार्गदर्शक तत्त्वे पाहण्यासाठी नकाशावरील सक्रिय चिन्हावर क्लिक करा.',
        'lbl-mandi-title': '<i class="fa-solid fa-wheat-awn"></i> धान्य बाजार भाव (कृषी मंडई)',
        'lbl-mandi-subtitle': 'भारतीय राज्यांमधील प्रति क्विंटल (१०० किलो) चालू बाजार भाव, थेट सरकारी डेटाबेसमधून साप्ताहिक एकत्रित केले जातात.',
        'lbl-filter-state': 'राज्य',
        'lbl-filter-commodity': 'धान्य / माल',
        'lbl-market-title': '<i class="fa-solid fa-store"></i> सेंद्रिय बायो-उत्पादन बाजारपेठ',
        'lbl-market-subtitle': 'ग्रामीण विक्रेत्यांकडून थेट सेंद्रिय उत्पादने नोंदवा, लॉग इन करा आणि ब्राउझ करा. "बायो" चे स्पष्टीकरण आणि घरगुती चाचणी किट्स खाली उपलब्ध आहेत.',
        'lbl-fisheries-title': '<i class="fa-solid fa-ship"></i> मत्स्यव्यवसाय केंद्र आणि सागरी परिसंस्था',
        'lbl-fisheries-desc': 'सागरी माсеमारी नकाशे, प्रजननावरील बंदीचे कॅलेंडर, सागरी लोकसंख्या तक्ते आणि सागरी सस्तन प्राण्यांच्या नोंदी पहा.',
        'lbl-groundwater-title': '<i class="fa-solid fa-droplet"></i> भूजल पातळी घट आणि सांडपाणी दूषण विझ्युअलायझर (2016 - 2026)',
        'lbl-groundwater-subtitle': 'भूजल पातळीतील घट (mbgl) नियंत्रित करा आणि कृषी जलस्रोतांमध्ये शहरी सांडपाणी मिश्रणाचा मागोवा घ्या.',
        'lbl-gw-year-label': 'पूर्वानुमान/ऐतिहासिक वर्ष निवडा:',
        'lbl-gw-map-title': 'परस्परसंवादी भूजल जलस्रोत नकाशा',
        'lbl-groundwater-chart-title': 'भूजल पातळीचा कल (mbgl मध्ये खोली)',
        'nav-btn-mesh': '<i class="fa-solid fa-circle-nodes"></i> ऑफलाइन मेश',
        'lbl-mesh-title': '<i class="fa-solid fa-circle-nodes"></i> &#2310;&#2347;&#2354;&#2366;&#2311;&#2344; &#2350;&#2375;&#2358; &#2344;&#2375;&#2335;&#2354;&#2352;&#2381;&#2325;',
        'lbl-mesh-desc': 'ब्लूटूथ मेश तंत्रज्ञानाद्वारे जवळच्या वापरकर्त्यांशी थेट अलर्ट आणि लहान संदेशांची देवाणघेवाण करा। सेल्युलर नेटवर्क कव्हरेजशिवाय पूर्णपणे ऑफलाइन कार्य करते।',
        'lbl-mesh-send-title': '<i class="fa-solid fa-paper-plane"></i> संदेश प्रसारित करा',
        'lbl-mesh-send-desc': 'स्थानिक ब्लूटूथ मेश नेटवर्कवर प्रसारित करण्यासाठी एक लहान सूचना तयार करा।',
        'lbl-mesh-sender-label': 'तुमचा प्रेषक आयडी / नाव',
        'lbl-mesh-urgency-label': 'अलर्टची निकड पातळी',
        'lbl-mesh-message-label': 'प्रसारण मजकूर (जास्तीत जास्त १४० अक्षरे)',
        'lbl-mesh-broadcast-btn': '<i class="fa-solid fa-rss"></i> ऑफलाइन प्रसारण (ब्लूटूथ)',
        'lbl-mesh-stream-title': '<i class="fa-solid fa-list-check"></i> थेट मेश फीड',
        'lbl-mesh-radar-title': 'ब्लूटूथ ट्रान्ससीव्हर सक्रिय',
        'lbl-mesh-empty-text': 'अद्याप कोणतेही मेश प्रसारण आढळलेले नाही।',
        'lbl-mesh-bridge-status': 'नेटिव्ह ब्रिज कनेक्शन स्थिती:',
        'nav-btn-feedback': '<i class="fa-solid fa-comments"></i> \u0905\u092D\u093F\u092A\u094D\u0930\u093E\u092F \u0939\u092C',
        'lbl-feedback-title': '<i class="fa-solid fa-comments"></i> \u0905\u092D\u093F\u092A\u094D\u0930\u093E\u092F \u0906\u0923\u093F \u0938\u0942\u091A\u0928\u093E \u0939\u092C',
        'lbl-feedback-desc': '\u0917\u094D\u0930\u093E\u092E\u0938\u0947\u0924\u0942 \u0938\u0941\u0927\u093E\u0930\u0923\u094D\u092F\u093E\u0938 \u0906\u092E\u094D\u0939\u093E\u0932\u093E \u092E\u0926\u0924 \u0915\u0930\u093E. \u0924\u0941\u092E\u091A\u094D\u092F\u093E \u0936\u093F\u092B\u093E\u0930\u0938\u0940, \u092a\u0941\u0928\u0930\u093e\u0935\u0932\u094b\u0915\u0928\u0947, \u0924\u0915\u094d\u0930\u093e\u0930\u0940 \u0915\u093f\u0902\u0935\u093e \u0928\u0935\u0940\u0928 \u0915\u0932\u094d\u092a\u0928\u093e \u0925\u0947\u091f \u0906\u092e\u091a\u094d\u092f\u093e \u092a\u094d\u0932\u0945\u091f\u092b\u0949\u0930\u094D\u092e\u0935\u0930 \u0938\u092c\u092e\u093f\u091f \u0915\u0930\u093e.',
        'lbl-feedback-form-title': '<i class="fa-solid fa-pen-to-square"></i> \u0924\u0941\u092e\u091a\u0947 \u0935\u093f\u091a\u093e\u0930 \u0936\u0947\u0905\u0930 \u0915\u0930\u093e',
        'lbl-feedback-form-desc': '\u090f\u0915 \u0936\u094d\u0930\u0947\u0923\u0940 \u0928\u093f\u0935\u0921\u093e, \u0924\u0941\u092e\u091a\u094d\u092f\u093e \u0905\u0928\u0941\u092b\u0935\u093e\u0932\u093e \u0930\u0947\u091f \u0915\u0930\u093e \u0906\u0923\u093f \u0916\u093e\u0932\u0940 \u0924\u0941\u092e\u091a\u094d\u092f\u093e \u0938\u0942\u091a\u0928\u093e \u0932\u093f\u0939\u093e.',
        'lbl-feedback-category-label': '\u0905\u092d\u093f\u092a\u094d\u0930\u093e\u092f \u0936\u094d\u0930\u0947\u0923\u0940',
        'lbl-feedback-rating-label': '\u0930\u0947\u091f\u093f\u0902\u0917',
        'lbl-feedback-text-label': '\u0938\u0902\u0926\u0947\u0936 / \u0924\u092a\u0936\u0940\u0932',
        'btn-submit-feedback': '<i class="fa-solid fa-paper-plane"></i> \u0905\u092d\u093f\u092a\u094d\u0930\u093e\u092f \u0938\u092c\u092e\u093f\u091f \u0915\u0930\u093e',
        'lbl-feedback-avg-rating': '\u0938\u0930\u093e\u0938\u0930\u0940 \u0930\u0947\u091f\u093f\u0902\u0917',
        'lbl-feedback-total-posts': '\u090f\u0915\u0942\u0923 \u0938\u092c\u092e\u093f\u0936\u0928',
        'lbl-feedback-board-title': '<i class="fa-solid fa-users"></i> \u0938\u092e\u0941\u0926\u093e\u092f \u0938\u0942\u091a\u0928\u093e \u092c\u094b\u0930\u094d\u0921',
        'lbl-feedback-empty-board': '\u0905\u0926\u094d\u092f\u093e\u092a \u0915\u094b\u0923\u0924\u093e\u0939\u0940 \u0905\u092d\u093f\u092a\u094d\u0930\u093e\u092f \u0915\u093f\u0902\u0935\u093e \u0938\u0942\u091a\u0928\u093e \u0938\u092c\u092e\u093f\u091f \u0915\u0947\u0932\u0947\u0932\u0940 \u0928\u093e\u0939\u0940.'
    },
    'ta': {
        'nav-btn-dashboard': '<i class="fa-solid fa-chart-line"></i> முகப்பு',
        'nav-btn-farming': '<i class="fa-solid fa-tractor"></i> விவசாயம்',
        'btn-farm-sub-cattle': '<i class="fa-solid fa-cow"></i> காய்஥்நடை ஆரோக்கியம்',
        'btn-farm-sub-mandi': '<i class="fa-solid fa-wheat-awn"></i> ச஥்஥ை விஜூகள்',
        'btn-farm-sub-market': '<i class="fa-solid fa-store"></i> பயோ ச஥்஥ை',
        'btn-farm-sub-cattle': '<i class="fa-solid fa-cow"></i> கால்நடை ஆரோக்கியம்',
        'btn-farm-sub-mandi': '<i class="fa-solid fa-wheat-awn"></i> சந்தை விலைகள்',
        'btn-farm-sub-market': '<i class="fa-solid fa-store"></i> பயோ சந்தை',
        'nav-btn-fisheries': '<i class="fa-solid fa-ship"></i> மீன்வள மையம்',
        'nav-btn-weather': '<i class="fa-solid fa-cloud-sun-rain"></i> வானிலை தகவல்கள்',
        'nav-btn-birds': '<i class="fa-solid fa-feather-pointed"></i> பறவை ஒலி',
        'nav-btn-news': '<i class="fa-solid fa-newspaper"></i> செய்தி போர்டல்',
        'nav-btn-sources': '<i class="fa-solid fa-circle-info"></i> தரவு மூலங்கள்',
        'lbl-hero-title': 'நேரடி தரவுகளுடன் கிராமப்புற இந்தியாவை மேம்படுத்துதல்',
        'lbl-hero-desc': 'கிராம்சேது கிராமப்புற நிபுணர்களை நிகழ்நேர சந்தை விலைகள், சுகாதார எச்சரிக்கைகளுடன் இணைக்கிறது.',
        'btn-sync-data': '<i class="fa-solid fa-rotate"></i> தரவை ஒத்திசைக்கவும்',
        'lbl-weather-title': '<i class="fa-solid fa-cloud-sun-rain"></i> வானிலை மற்றும் காலநிலை மாற்ற அறிவிப்புகள்',
        'lbl-weather-subtitle': 'பருவமழை கண்காணிப்பு, எல் நினோ எச்சரிக்கைகள் மற்றும் நீண்ட கால வெப்பநிலை மாற்ற கண்காணிப்பு.',
        'lbl-elnino-title': '<i class="fa-solid fa-circle-exclamation" style="color: var(--color-danger);"></i> எல் நினோ எச்சரிக்கை மற்றும் பருவமழை தாக்கம்',
        'lbl-elnino-desc': 'எல் நினோ நிலைமைகள் தற்போது செயலில் உள்ளன. இது பருவமழை குறைவதற்கும் வறட்சி அபாயத்திற்கும் வழிவகுக்கும். விவசாயிகள் நீர் சேகரிப்புக்கு முன்னுரிமை வழங்க அறிவுறுத்தப்படுகிறார்கள்.',
        'lbl-regional-forecasts-title': '<i class="fa-solid fa-map-location"></i> பிராந்திய முன்னறிவிப்புகள் மற்றும் பருவமழை பற்றாக்குறை',
        'lbl-climate-title': '<i class="fa-solid fa-chart-area"></i> வெப்பநிலை மற்றும் பருவமழை மாறுபாடு வரைபடம் (2000 - 2026)',
        'lbl-climate-subtitle': 'நீண்ட கால வெப்பநிலை மாற்றங்கள் மற்றும் பருவமழை பற்றாக்குறை காலநிலை மாற்றத்தை விளக்குகின்றன.',
        'lbl-coral-title': '<i class="fa-solid fa-shield-heart"></i> பவளப்பாறை பாதுகாப்பு வழிகாட்டி',
        'lbl-coral-intro': 'பவளப்பாறைகள் கடலின் மழைக்காடுகள் ஆகும். இவை 25% கடல் உயிரினங்களுக்கு புகலிடம் அளிக்கின்றன.',
        'lbl-coral-why-title': 'பவளப்பாறைகள் ஏன் முக்கியமானவை?',
        'lbl-coral-how-title': 'அவற்றை எவ்வாறு பாதுகாப்பது?',
        'lbl-calc-title': '<i class="fa-solid fa-calculator"></i> கடலோர சேமிப்பு மற்றும் மகசூல் கணக்கீட்டாளர்',
        'lbl-calc-desc': 'பவளப்பாறைகளை பாதுகாப்பதன் மூலம் பாதுகாப்பு சுவர் அமைக்கும் செலவில் எவ்வளவு மிச்சமாகும் என்பதை கணக்கிடுங்கள்.',
        'lbl-calc-reef-len': 'பாதுகாக்கப்பட்ட பவளப்பாறை நீளம் (கி.மீ)',
        'lbl-calc-boats': 'மீன்பிடி படகுகளின் எண்ணிக்கை',
        'lbl-calc-results-title': 'மதிப்பிடப்பட்ட ஆண்டு சமூக சேமிப்பு',
        'lbl-calc-defense': 'கடலோர பாதுகாப்பு சேமிப்பு:',
        'lbl-calc-yield': 'அதிகரித்த மீன்பிடி மதிப்பு:',
        'lbl-calc-total': 'மொத்த பொருளாதார நன்மை:',
        'lbl-calc-note': '*கணக்கீடுகள் கடல் பாதுகாப்பு சுவர் கட்டுமான சேமிப்பை அடிப்படையாகக் கொண்டவை.',
        'lbl-access-lang': 'இணையதள மொழியை மொழிபெயர்க்க',
        'lbl-access-tts': 'திரை பேச்சு ரீடர் (டிடிஎஸ்)',
        'lbl-cattle-title': '<i class="fa-solid fa-cow"></i> கால்நடை ஆரோக்கியம் & தடுப்பூசி ஆலோசகர்',
        'lbl-cattle-desc': 'ஊடாடும் வரைபடத்தில் செயலில் உள்ள கால்நடை நோய்ப்பரவல்களைக் கண்டறியவும். உடனடி கால்நடை மருத்துவ வழிகாட்டுதல் மற்றும் தடுப்பூசி நடவடிக்கைகளைக் காண நோய் பாதித்த இடத்தைத் தேர்ந்தெடுக்கவும்.',
        'lbl-cattle-advisory-title': '<i class="fa-solid fa-hand-holding-medical"></i> தடுப்பூசி ஆலோசகர்',
        'lbl-cattle-advisory-prompt': 'மாவட்ட வாரியான தடுப்பூசி தேவைகள் மற்றும் கால்நடை மருத்துவர் வழிகாட்டுதல்களைக் காண வரைபடத்தில் உள்ள குறியீட்டை கிளிக் செய்யவும்.',
        'lbl-mandi-title': '<i class="fa-solid fa-wheat-awn"></i> தானிய சந்தை விலைகள் (விவசாய மண்டிகள்)',
        'lbl-mandi-subtitle': 'இந்திய மாநிலங்களில் ஒரு குவின்டாலுக்கான (100 கிலோ) தற்போதைய மண்டி விலைகள், நேரடியாக அரசு தரவுத்தளத்தில் இருந்து வாரந்தோறும் சேகரிக்கப்படுகின்றன.',
        'lbl-filter-state': 'மாநிலம்',
        'lbl-filter-commodity': 'தானியம் / பொருள்',
        'lbl-market-title': '<i class="fa-solid fa-store"></i> இயற்கை பயோ-தயாரிப்பு சந்தை',
        'lbl-market-subtitle': 'கிராமப்புற விற்பனையாளர்களிடமிருந்து நேரடியாக இயற்கை தயாரிப்புகளை பதிவு செய்யவும், உள்நுழையவும் மற்றும் உலாவவும். "பयो" விளக்கங்கள் மற்றும் வீட்டு சோதனை கருவிகள் கீழே உள்ளன.',
        'lbl-fisheries-title': '<i class="fa-solid fa-ship"></i> மீன்வள மையம் & கடல்சார் சுற்றுச்சூழல் அமைப்பு',
        'lbl-fisheries-desc': 'கடலோர மீன் வரைபடங்கள், மீன் இனப்பெருக்க தடை காலங்கள், கடல்சார் மக்கள் தொகை விளக்கப்படங்கள் மற்றும் கடல் பாலೂட்டிகளின் பதிவுகளை ஆராயுங்கள்.',
        'lbl-groundwater-title': '<i class="fa-solid fa-droplet"></i> நிலத்தடி நீர் குறைப்பு & கழிவுநீர் மாசு காட்சிப்படுத்தி (2016 - 2026)',
        'lbl-groundwater-subtitle': 'நிலத்தடி நீர் மட்டக் குறைவைக் கண்காணித்து, விவசாய நீர்நிலைகளில் நகர்ப்புற கழிவுநீர் கலப்பைக் கண்டறியவும்.',
        'lbl-gw-year-label': 'முன்கணிப்பு/வரலாற்று ஆண்டைத் தேர்ந்தெடுக்கவும்:',
        'lbl-gw-map-title': 'ஊடாடும் நிலத்தடி நீர்நிலைகள் வரைபடம்',
        'lbl-groundwater-chart-title': 'நிலத்தடி நீர் மட்டப் போக்கு (mbgl இல் ஆழம்)',
        'nav-btn-mesh': '<i class="fa-solid fa-circle-nodes"></i> ஆஃப்லைன் மெஷ்',
        'lbl-mesh-title': '<i class="fa-solid fa-circle-nodes"></i> ஆஃப்லைன் மெஷ் நெட்வொர்க்',
        'lbl-mesh-desc': 'புளூடூத் மெஷ் தொழில்நுட்பம் மூலம் அருகில் உள்ளவர்களுடன் நேரடியாக எச்சரிக்கைகள் மற்றும் குறுஞ்செய்திகளைப் பரிமாறவும்। இணையம் அல்லது மொபைல் சிக்னல் இல்லாமலே ஆஃப்லைனில் செயல்படும்।',
        'lbl-mesh-send-title': '<i class="fa-solid fa-paper-plane"></i> செய்தியை ஒளிபரப்பவும்',
        'lbl-mesh-send-desc': 'உள்ளூர் புளூடூத் மெஷ் நெட்வொர்க்கில் ஒளிபரப்ப ஒரு குறுஞ்செய்தியை எழுதவும்।',
        'lbl-mesh-sender-label': 'உங்கள் அனுப்புநர் ஐடி / பெயர்',
        'lbl-mesh-urgency-label': 'எச்சரிக்கை அவசர நிலை',
        'lbl-mesh-message-label': 'ஒளிபரப்பு உரை (அதிகபட்சம் 140 எழுத்துக்கள்)',
        'lbl-mesh-broadcast-btn': '<i class="fa-solid fa-rss"></i> ஆஃப்லைனில் ஒளிபரப்பவும் (புளூடூथ்)',
        'lbl-mesh-stream-title': '<i class="fa-solid fa-list-check"></i> நேரடி மெஷ் ஊட்டம்',
        'lbl-mesh-radar-title': 'புளூடூத் டிரான்சீவர் செயல்பாட்டில் உள்ளது',
        'lbl-mesh-empty-text': 'இதுவரை எந்த மெஷ் ஒளிபரப்பும் கண்டறியப்படவில்லை।',
        'lbl-mesh-bridge-status': 'நேரடி இணைப்பு நிலை:'
    },
    'ml': {
        'nav-btn-dashboard': '<i class="fa-solid fa-chart-line"></i> ഡാഷ്‌ബോർഡ്',
        'nav-btn-farming': '<i class="fa-solid fa-tractor"></i> കൃഷി',
        'btn-farm-sub-cattle': '<i class="fa-solid fa-cow"></i> കന്നുകാലി ആരോഗ്യം',
        'btn-farm-sub-mandi': '<i class="fa-solid fa-wheat-awn"></i> വിപണി വിലനിലവാരം',
        'btn-farm-sub-market': '<i class="fa-solid fa-store"></i> ബയോ മാർക്കറ്റ്',
        'nav-btn-fisheries': '<i class="fa-solid fa-ship"></i> ഫിഷറീസ് ഹബ്',
        'nav-btn-weather': '<i class="fa-solid fa-cloud-sun-rain"></i> കാലാവസ്ഥ വിവരങ്ങൾ',
        'nav-btn-birds': '<i class="fa-solid fa-feather-pointed"></i> പക്ഷി ശബ്ദം',
        'nav-btn-news': '<i class="fa-solid fa-newspaper"></i> വാർത്താ പോർട്ടൽ',
        'nav-btn-sources': '<i class="fa-solid fa-circle-info"></i> വിവര സ്രോതസ്സുകൾ',
        'lbl-hero-title': 'തത്സമയ വിവരങ്ങളിലൂടെ ഗ്രാമീണ ഭാരതത്തെ ശാക്തീകരിക്കുന്നു',
        'lbl-hero-desc': 'ഗ്രാമസേതു ഗ്രാമീണ പ്രൊഫഷണലുകളെ വിപണി വിലകൾ, അലേർട്ടുകൾ, ബയോ-വ്യാപാരം എന്നിവയുമായി ബന്ധിപ്പിക്കുന്നു.',
        'btn-sync-data': '<i class="fa-solid fa-rotate"></i> വിവരങ്ങൾ സമന്വയിപ്പിക്കുക',
        'lbl-weather-title': '<i class="fa-solid fa-cloud-sun-rain"></i> കാലാവസ്ഥയും വ്യതിയാന വിവരങ്ങളും',
        'lbl-weather-subtitle': 'തത്സമയ മൺസൂൺ നിരീക്ഷണം, എൽ നിനോ മുന്നറിയിപ്പുകൾ, ദീർഘകാല താപനില വ്യതിയാന ട്രാക്കിംഗ്.',
        'lbl-elnino-title': '<i class="fa-solid fa-circle-exclamation" style="color: var(--color-danger);"></i> എல் നിനോ മുന്നറിയിപ്പും മൺസൂൺ സ്വാധീനവും',
        'lbl-elnino-desc': 'എல் നിനോ പ്രതിഭാസം സജീവമാണ്. ഇത് മൺസൂൺ കുറയുന്നതിനും വരൾച്ചയ്ക്കും കാരണമായേക്കാം. കർഷകർ ജലസംരക്ഷണത്തിന് പ്രാധാന്യം നൽകണം.',
        'lbl-regional-forecasts-title': '<i class="fa-solid fa-map-location"></i> പ്രാദേശിക കാലാവസ്ഥാ പ്രവചനവും മൺസൂൺ കുറവും',
        'lbl-climate-title': '<i class="fa-solid fa-chart-area"></i> താപനില വ്യതിയാനത്തിന്റെയും മൺസൂൺ കുറവിന്റെയും ചാർട്ട് (2000 - 2026)',
        'lbl-climate-subtitle': 'ദീർഘകാല താപനില വ്യതിയാനങ്ങളും മഴയുടെ കുറവും കാലാവസ്ഥാ വ്യതിയാനത്തിന്റെ ലക്ഷണങ്ങൾ കാണിക്കുന്നു.',
        'lbl-coral-title': '<i class="fa-solid fa-shield-heart"></i> പവിഴപ്പുറ്റുകളുടെ സംരക്ഷണ സഹായി',
        'lbl-coral-intro': 'പവിഴപ്പുറ്റുകൾ കടലിലെ മഴക്കാടുകളാണ്. അവ 25 ശതമാനത്തിലധികം കടൽ ജീവികൾക്ക് സംരക്ഷണം നൽകുന്നു.',
        'lbl-coral-why-title': 'എന്തുകൊണ്ട് പവിഴപ്പുറ്റുകൾ പ്രധാനമാണ്?',
        'lbl-coral-how-title': 'അവയെ എങ്ങനെ സംരക്ഷിക്കാം?',
        'lbl-calc-title': '<i class="fa-solid fa-calculator"></i> തീരദേശ സമ്പാദ്യ ഇളവ് കാൽക്കുലേറ്റർ',
        'lbl-calc-desc': 'പവിഴപ്പുറ്റുകളെ സംരക്ഷിക്കുന്നതിലൂടെ തീരദേശ സമൂഹത്തിന് എത്ര രൂപ ലാഭിക്കാം എന്ന് കണക്കാക്കുക.',
        'lbl-calc-reef-len': 'സംരക്ഷിത പവിഴപ്പുറ്റിന്റെ നീളം (കിമീ)',
        'lbl-calc-boats': 'ബോട്ടുകളുടെ എണ്ണം',
        'lbl-calc-results-title': 'തീരദേശ സമൂഹത്തിന്റെ വാർഷിക ലാഭം',
        'lbl-calc-defense': 'തീരദേശ സംരക്ഷണ ഇനത്തിലെ ലാഭം:',
        'lbl-calc-yield': 'മത്സ്യ ലഭ്യതയിലെ മൂല്യ വർദ്ധനവ്:',
        'lbl-calc-total': 'ആകെ സാമ്പത്തിക നേട്ടം:',
        'lbl-calc-note': '*കണക്കുകൂട്ടലുകൾ ശരാശരി കടൽഭിത്തി നിർമ്മാണ ലാഭത്തെ അടിസ്ഥാനമാക്കിയുള്ളതാണ്.',
        'lbl-access-lang': 'വെബ്സൈറ്റ് ഭാഷ വിവർത്തനം ചെയ്യുക',
        'lbl-access-tts': 'സ്ക്രീൻ സ്പീച്ച് റീഡർ (ടിടിഎസ്)',
        'lbl-cattle-title': '<i class="fa-solid fa-cow"></i> കന്നുകാലി ആരോഗ്യവും പ്രതിരോധ കുത്തിവയ്പ്പ് ഉപദേശകനും',
        'lbl-cattle-desc': 'ഗ്രാഫിക് ഭൂപടത്തിൽ സജീവ കന്നുകാലി രോഗബാധകൾ കണ്ടെത്തുക. പ്രാദേശിക വെറ്ററിനറി നിർദ്ദേശങ്ങളും വാക്സിനേഷൻ നടപടികളും കാണുന്നതിന് ഭൂപടത്തിൽ ക്ലിക്ക് ചെയ്യുക.',
        'lbl-cattle-advisory-title': '<i class="fa-solid fa-hand-holding-medical"></i> വാക്സിൻ ഉപദേശകൻ',
        'lbl-cattle-advisory-prompt': 'ജില്ലാ അടിസ്ഥാനത്തിലുള്ള വാക്സിൻ ആവശ്യങ്ങളും നിർദ്ദേശങ്ങളും കാണുന്നതിന് ഭൂപടത്തിലെ അടയാളത്തിൽ ക്ലിക്ക് ചെയ്യുക.',
        'lbl-mandi-title': '<i class="fa-solid fa-wheat-awn"></i> ധാന്യ വിപണി വിലനിലവാരം (കാർഷിക മണ്ടികൾ)',
        'lbl-mandi-subtitle': 'വിവിധ ഇന്ത്യൻ സംസ്ഥാനങ്ങളിലെ പ്രതി ക്വിന്റൽ (100 കിലോഗ്രാം) വിപണി വിലനിലവാരം, ഔദ്യോഗിക സർക്കാർ വിവരശേഖരത്തിൽ നിന്നും പ്രതിവാരം ലഭ്യമാക്കുന്നത്.',
        'lbl-filter-state': 'സംസ്ഥാനം',
        'lbl-filter-commodity': 'ധാന്യം / ഉൽപ്പന്നം',
        'lbl-market-title': '<i class="fa-solid fa-store"></i> ജൈવ ബയോ-വിപണി',
        'lbl-market-subtitle': 'ഗ്രാമീണ കർഷകരിൽ നിന്ന് നേരിട്ട് ജൈવ ഉൽപ്പന്നങ്ങൾ വാങ്ങാനും വിൽക്കാനുമുള്ള മാർക്കറ്റ്. പരിശോധന മാർഗ്ഗങ്ങളും താഴെ കൊടുത്തിരിക്കുന്നു.',
        'lbl-fisheries-title': '<i class="fa-solid fa-ship"></i> ഫിഷറീസ് ഹബ്ബും സമുദ്ര ആവാസവ്യവസ്ഥയും',
        'lbl-fisheries-desc': 'തീരദേശ മത്സ്യ ലഭ്യത ഭൂപടങ്ങൾ, പ്രജനന നിരോധന കലണ്ടർ, സമുദ്ര ജീവികളുടെ എണ്ണത്തിലുള്ള മാറ്റങ്ങൾ എന്നിവ കണ്ടെത്തുക.',
        'lbl-groundwater-title': '<i class="fa-solid fa-droplet"></i> ഭൂഗർഭജല ചൂഷണവും മലിനജല കലർച്ചയും കാണിക്കുന്ന മാപ്പ് (2016 - 2026)',
        'lbl-groundwater-subtitle': 'ഭൂഗർഭ ജലനിരപ്പിലെ കുറവും (mbgl) കാർഷിക ജലാശയങ്ങളിൽ നഗര മലിനജലം കലരുന്നത് ട്രാക്ക് ചെയ്യാനും സഹായിക്കുന്നു.',
        'lbl-gw-year-label': 'വർഷം തിരഞ്ഞെടുക്കുക:',
        'lbl-sewage-toggle-label': 'മലിനജല കലർച്ചയുടെ മാപ്പ് കാണിക്കുക',
        'lbl-gw-map-title': 'ഇന്ററാക്ടീവ് ഭൂഗർഭജല ഭൂപടം',
        'lbl-groundwater-chart-title': 'ഭૂഗർഭ ജലനിരപ്പിലെ വ്യതിയാനം (mbgl ആഴത്തിൽ)'
        ,
        'nav-btn-mesh': '<i class="fa-solid fa-circle-nodes"></i> \u0D13\u0D2B\u0D4D\u200C\u0D32\u0D48\u0D7B \u0D2E\u0D46\u0D37\u0D4D',
        'lbl-mesh-title': '<i class="fa-solid fa-circle-nodes"></i> \u0D13\u0D2B\u0D4D\u200C\u0D32\u0D48\u0D7B \u0D2E\u0D46\u0D37\u0D4D \u0D28\u0D46\u0D31\u0D4D\u0D31\u0D4D\u200C\u0D35\u0D7C\u0D15\u0D4D\u0D15\u0D4D',
        'lbl-mesh-desc': '\u0D2C\u0D4D\u0D32\u0D42\u0D1F\u0D42\u0D24\u0D4D\u0D24\u0D4D \u0D2E\u0D46\u0D37\u0D4D \u0D38\u0D3E\u0D19\u0D4D\u0D15\u0D47\u0D24\u0D3F\u0D15\u0D35\u0D3F\u0D26\u0D4D\u0D2F \u0D35\u0D34\u0D3F \u0D05\u0D1F\u0D41\u0D24\u0D4D\u0D24\u0D41\u0D33\u0D4D\u0D33 \u0D09\u0D2A\u0D2F\u0D4B\u0D15\u0D4D\u0D24\u0D3E\u0D15\u0D4D\u0D15\u0D33\u0D41\u0D2E\u0D3E\u0D2F\u0D3F \u0D28\u0D47\u0D30\u0D3F\u0D1F\u0D4D\u0D1F\u0D4D \u0D05\u0D32\u0D47\u0D7C\u0D1F\u0D4D\u0D1F\u0D41\u0D15\u0D33\u0D41\u0D02 \u0D39\u0D4D\u0D30\u0D38\u0D4D\u0D35 \u0D38\u0D28\u0D4D\u0D26\u0D47\u0D36\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D02 \u0D15\u0D48\u0D2E\u0D3E\u0D31\u0D41\u0D15. \u0D38\u0D46\u0D32\u0D4D\u0D32\u0D41\u0D32\u0D3E\u0D7C \u0D28\u0D46\u0D31\u0D4D\u0D31\u0D4D\u200C\u0D35\u0D7C\u0D15\u0D4D\u0D15\u0D4D \u0D15\u0D35\u0D31\u0D47\u0D1C\u0D4D \u0D07\u0D32\u0D4D\u0D32\u0D3E\u0D24\u0D46 \u0D2A\u0D42\u0D7C\u0D23\u0D4D\u0D23\u0D2E\u0D3E\u0D2F\u0D41\u0D02 \u0D13\u0D2B\u0D4D\u200C\u0D32\u0D48\u0D28\u0D3E\u0D2F\u0D3F \u0D2A\u0D4D\u0D30\u0D35\u0D7C\u0D24\u0D4D\u0D24\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D41.',
        'lbl-mesh-send-title': '<i class="fa-solid fa-paper-plane"></i> \u0D38\u0D28\u0D4D\u0D26\u0D47\u0D36\u0D02 \u0D2A\u0D4D\u0D30\u0D15\u0D4D\u0D37\u0D47\u0D2A\u0D23\u0D02 \u0D1A\u0D46\u0D2F\u0D4D\u0D2F\u0D41\u0D15',
        'lbl-mesh-send-desc': '\u0D2A\u0D4D\u0D30\u0D3E\u0D26\u0D47\u0D36\u0D3F\u0D15 \u0D2C\u0D4D\u0D32\u0D42\u0D1F\u0D42\u0D24\u0D4D\u0D24\u0D4D \u0D2E\u0D46\u0D37\u0D4D \u0D28\u0D46\u0D31\u0D4D\u0D31\u0D4D\u200C\u0D35\u0D7C\u0D15\u0D4D\u0D15\u0D3F\u0D32\u0D42\u0D1F\u0D46 \u0D2A\u0D4D\u0D30\u0D15\u0D4D\u0D37\u0D47\u0D2A\u0D23\u0D02 \u0D1A\u0D46\u0D2F\u0D4D\u0D2F\u0D3E\u0D7B \u0D12\u0D30\u0D41 \u0D39\u0D4D\u0D30\u0D38\u0D4D\u0D35 \u0D05\u0D31\u0D3F\u0D2F\u0D3F\u0D2A\u0D4D\u0D2A\u0D4D \u0D24\u0D2F\u0D4D\u0D2F\u0D3E\u0D31\u0D3E\u0D15\u0D4D\u0D15\u0D41\u0D15.',
        'lbl-mesh-sender-label': '\u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D05\u0D2F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D2F\u0D3E\u0D33\u0D41\u0D1F\u0D46 \u0D10\u0D21\u0D3F / \u0D2A\u0D47\u0D30\u0D4D',
        'lbl-mesh-urgency-label': '\u0D05\u0D32\u0D47\u0D7C\u0D1F\u0D4D\u0D1F\u0D3F\u0D28\u0D4D\u0D31\u0D46 \u0D05\u0D1F\u0D3F\u0D2F\u0D28\u0D4D\u0D24\u0D3F\u0D30 \u0D18\u0D1F\u0D4D\u0D1F\u0D02',
        'lbl-mesh-message-label': '\u0D2A\u0D4D\u0D30\u0D15\u0D4D\u0D37\u0D47\u0D2A\u0D23\u0D02 \u0D1A\u0D46\u0D2F\u0D4D\u0D2F\u0D47\u0D23\u0D4D\u0D1F \u0D38\u0D28\u0D4D\u0D26\u0D47\u0D36\u0D02 (\u0D2A\u0D30\u0D2E\u0D3E\u0D35\u0D27\u0D3F 140 \u0D05\u0D15\u0D4D\u0D37\u0D30\u0D19\u0D4D\u0D19\u0D7E)',
        'lbl-mesh-broadcast-btn': '<i class="fa-solid fa-rss"></i> \u0D13\u0D2B\u0D4D\u200C\u0D32\u0D48\u0D7B \u0D2A\u0D4D\u0D30\u0D15\u0D4D\u0D37\u0D47\u0D2A\u0D23\u0D02 (\u0D2C\u0D4D\u0D32\u0D42\u0D1F\u0D42\u0D24\u0D4D\u0D24\u0D4D)',
        'lbl-mesh-stream-title': '<i class="fa-solid fa-list-check"></i> \u0D24\u0D24\u0D4D\u0D38\u0D2E\u0D2F \u0D2E\u0D46\u0D37\u0D4D \u0D2B\u0D40\u0D21\u0D4D',
        'lbl-mesh-radar-title': '\u0D2C\u0D4D\u0D32\u0D42\u0D1F\u0D42\u0D24\u0D4D\u0D24\u0D4D \u0D1F\u0D4D\u0D30\u0D3E\u0D7B\u0D38\u0D40\u0D35\u0D7C \u0D38\u0D1C\u0D40\u0D35\u0D02',
        'lbl-mesh-empty-text': '\u0D07\u0D24\u0D41\u0D35\u0D30\u0D46 \u0D2E\u0D46\u0D37\u0D4D \u0D2A\u0D4D\u0D30\u0D15\u0D4D\u0D37\u0D47\u0D2A\u0D23\u0D19\u0D4D\u0D19\u0D33\u0D4A\u0D28\u0D4D\u0D28\u0D41\u0D02 \u0D15\u0D23\u0D4D\u0D1F\u0D46\u0D24\u0D4D\u0D24\u0D3F\u0D2F\u0D3F\u0D1F\u0D4D\u0D1F\u0D3F\u0D32\u0D4D\u0D32.',
        'lbl-mesh-bridge-status': '\u0D28\u0D47\u0D31\u0D4D\u0D31\u0D40\u0D35\u0D4D \u0D2C\u0D4D\u0D30\u0D3F\u0D21\u0D4D\u0D1C\u0D4D \u0D15\u0D23\u0D15\u0D4D\u0D37\u0D7B \u0D28\u0D3F\u0D32:',
        'nav-btn-feedback': '<i class="fa-solid fa-comments"></i> \u0D05\u0D2D\u0D3F\u0D2A\u0D4D\u0D30\u0D3E\u0D2F \u0D15\u0D47\u0D28\u0D4D\u0D26\u0D4D\u0D30\u0D02',
        'lbl-feedback-title': '<i class="fa-solid fa-comments"></i> \u0D05\u0D2D\u0D3F\u0D2A\u0D4D\u0D30\u0D3E\u0D2F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D02 \u0D28\u0D3F\u0D7C\u0D26\u0D4D\u0D26\u0D47\u0D36\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D02',
        'lbl-feedback-desc': '\u0D17\u0D4D\u0D30\u0D3E\u0D02\u0D38\u0D47\u0D24\u0D41 \u0D2E\u0D46\u0D1a\u0D4D\u0D1a\u0D2a\u0D4D\u0D2a\u0D46\u0D1F\u0D41\u0D24\u0D4D\u0D24\u0D3E\u0D7B \u0D1E\u0D19\u0D4D\u0D19\u0D33\u0D46 \u0D38\u0D39\u0D3E\u0D2F\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D15. \u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D36\u0D41\u0D2A\u0D3E\u0D7C\u0D36\u0D15\u0D7E, \u0D05\u0D35\u0D32\u0D4B\u0D15\u0D28\u0D19\u0D4D\u0D19\u0D7E, \u0D2A\u0D30\u0D3E\u0D24\u0D3F\u0D15\u0D7E \u0D05\u0D32\u0D4D\u0D32\u0D46\u0D19\u0D4D\u0D15\u0D3F\u0D7D \u0D2A\u0D41\u0D24\u0D3F\u0D2F \u0D06\u0D36\u0D2F\u0D19\u0D4D\u0D19\u0D7E \u0D28\u0D47\u0D30\u0D3F\u0D1F\u0D4D\u0D1F\u0D4D \u0D38\u0D2E\u0D7C\u0D2A\u0D4D\u0D2A\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D15.',
        'lbl-feedback-form-title': '<i class="fa-solid fa-pen-to-square"></i> \u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D1A\u0D3F\u0D28\u0D4D\u0D24\u0D15\u0D7E \u0D2A\u0D19\u0D4D\u0D15\u0D41\u0D35\u0D46\u0D15\u0D4D\u0D15\u0D41\u0D15',
        'lbl-feedback-form-desc': '\u0D12\u0D30\u0D41 \u0D35\u0D3F\u0D2D\u0D3E\u0D17\u0D02 \u0D24\u0D3F\u0D30\u0D1E\u0D4D\u0D1E\u0D46\u0D1F\u0D41\u0D15\u0D4D\u0D15\u0D41\u0D15, \u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D05\u0D28\u0D41\u0D2D\u0D35\u0D24\u0D4D\u0D24\u0D3F\u0D28\u0D4D \u0D31\u0D47\u0D31\u0D4D\u0D31\u0D3F\u0D02\u0D17\u0D4D \u0D28\u0D7D\u0D15\u0D41\u0D15, \u0D24\u0D3E\u0D34\u0D46 \u0D28\u0D3F\u0D7C\u0D26\u0D4D\u0D26\u0D47\u0D36\u0D19\u0D4D\u0D19\u0D7E \u0D0E\u0D34\u0D41\u0D24\u0D41\u0D15.',
        'lbl-feedback-category-label': '\u0D05\u0D2D\u0D3F\u0D2A\u0D4D\u0D30\u0D3E\u0D2F \u0D35\u0D3F\u0D2D\u0D3E\u0D17\u0D02',
        'lbl-feedback-rating-label': '\u0D31\u0D47\u0D31\u0D4D\u0D31\u0D3F\u0D02\u0D17\u0D4D',
        'lbl-feedback-text-label': '\u0D38\u0D28\u0D4D\u0D26\u0D47\u0D36\u0D02 / \u0D35\u0D3F\u0D36\u0D26\u0D3E\u0D02\u0D36\u0D19\u0D4D\u0D19\u0D7E',
        'btn-submit-feedback': '<i class="fa-solid fa-paper-plane"></i> \u0D05\u0D2D\u0D3F\u0D2A\u0D4D\u0D30\u0D3E\u0D2F\u0D02 \u0D38\u0D2E\u0D7C\u0D2A\u0D4D\u0D2A\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D15',
        'lbl-feedback-avg-rating': '\u0D36\u0D30\u0D3E\u0D36\u0D30\u0D3F \u0D31\u0D47\u0D31\u0D4D\u0D31\u0D3F\u0D02\u0D17\u0D4D',
        'lbl-feedback-total-posts': '\u0D06\u0D15\u0D46 \u0D38\u0D2E\u0D7C\u0D2A\u0D4D\u0D2A\u0D23\u0D19\u0D4D\u0D19\u0D7E',
        'lbl-feedback-board-title': '<i class="fa-solid fa-users"></i> \u0D15\u0D2E\u0D4D\u0D2E\u0D4D\u0D2F\u0D42\u0D23\u0D3F\u0D31\u0D4D\u0D31\u0D3F \u0D28\u0D3F\u0D7C\u0D26\u0D4D\u0D26\u0D47\u0D36 \u0D2C\u0D4B\u0D7C\u0D21\u0D4D',
        'lbl-feedback-empty-board': '\u0D07\u0D24\u0D41\u0D35\u0D30\u0D46 \u0D05\u0D2D\u0D3F\u0D2A\u0D4D\u0D30\u0D3E\u0D2F\u0D19\u0D4D\u0D19\u0D33\u0D4B \u0D28\u0D3F\u0D7C\u0D26\u0D4D\u0D26\u0D47\u0D36\u0D19\u0D4D\u0D19\u0D33\u0D4B \u0D38\u0D2E\u0D7C\u0D2A\u0D4D\u0D2A\u0D3F\u0D1A\u0D4D\u0D1A\u0D3F\u0D1F\u0D4D\u0D1F\u0D3F\u0D32\u0D4D\u0D32.'
    },
    'bn': {
        'nav-btn-dashboard': '<i class="fa-solid fa-chart-line"></i> ড্যাশবোর্ড',
        'nav-btn-farming': '<i class="fa-solid fa-tractor"></i> কৃষি',
        'btn-farm-sub-cattle': '<i class="fa-solid fa-cow"></i> গবাদি পশু স্বাস্থ্য',
        'btn-farm-sub-mandi': '<i class="fa-solid fa-wheat-awn"></i> বাজার দর',
        'btn-farm-sub-market': '<i class="fa-solid fa-store"></i> বায়ো বাজার',
        'nav-btn-fisheries': '<i class="fa-solid fa-ship"></i> মৎস্য হাব',
        'nav-btn-weather': '<i class="fa-solid fa-cloud-sun-rain"></i> আবহাওয়া আপডেট',
        'nav-btn-birds': '<i class="fa-solid fa-feather-pointed"></i> পাখি শব্দ',
        'nav-btn-news': '<i class="fa-solid fa-newspaper"></i> সংবাদ পোর্টাল',
        'nav-btn-sources': '<i class="fa-solid fa-circle-info"></i> তথ্য উৎস',
        'lbl-hero-title': 'লাইভ তথ্যের সাথে গ্রামীণ ভারতের ক্ষমতায়ন',
        'lbl-hero-desc': 'গ্রামসেতু গ্রামীণ পেশাদারদের রিয়েল-টাইম বাজার দর, স্বাস্থ্য সতর্কতার সাথে সংযুক্ত করে।',
        'btn-sync-data': '<i class="fa-solid fa-rotate"></i> তথ্য সিঙ্ক করুন',
        'lbl-weather-title': '<i class="fa-solid fa-cloud-sun-rain"></i> আবহাওয়া ও জলবায়ু পরিবর্তন আপডেট',
        'lbl-weather-subtitle': 'বর্ষা পর্যবেক্ষণ, এল নিনো সতর্কতা এবং দীর্ঘমেয়াদী তাপমাত্রা পরিবর্তন ট্র্যাকিং।',
        'lbl-elnino-title': '<i class="fa-solid fa-circle-exclamation" style="color: var(--color-danger);"></i> এল নিনো সতর্কতা এবং বর্ষার প্রভাব',
        'lbl-elnino-desc': 'এল নিনো বর্তমানে সক্রিয় রয়েছে। এটি বর্ষা ঘাটতি এবং খরার ঝুঁকি বাড়াতে পারে। কৃষকদের জল সাশ্রয়ে মনোযোগ দিতে পরামর্শ দেওয়া হচ্ছে।',
        'lbl-regional-forecasts-title': '<i class="fa-solid fa-map-location"></i> আঞ্চলিক আবহাওয়ার পূর্বাভাস ও বর্ষার ঘাটতি',
        'lbl-climate-title': '<i class="fa-solid fa-chart-area"></i> তাপমাত্রার তারতম্য ও বর্ষা ঘাটতি চার্ট (২০০০ - ২০২৬)',
        'lbl-climate-subtitle': 'দীর্ঘমেয়াদী তাপমাত্রা বৃদ্ধি এবং বর্ষা ঘাটতি জলবায়ু পরিবর্তনের প্রমাণ বহন করে।',
        'lbl-coral-title': '<i class="fa-solid fa-shield-heart"></i> প্রবাল প্রাচীর সংরক্ষণ নির্দেশিকা',
        'lbl-coral-intro': 'প্রবাল প্রাচীর হল সমুদ্রের রেইনফরেস্ট। এগুলি ২৫% এরও বেশি সামুদ্রিক জীবকে আশ্রয় দেয়।',
        'lbl-coral-why-title': 'প্রবাল প্রাচীর কেন গুরুত্বপূর্ণ?',
        'lbl-coral-how-title': 'এদের কিভাবে রক্ষা করবেন?',
        'lbl-calc-title': '<i class="fa-solid fa-calculator"></i> উপকূলীয় অর্থনৈতিক সুবিধা ক্যালকুলেটর',
        'lbl-calc-desc': 'প্রবাল প্রাচীর রক্ষা করে উপকূলবর্তী এলাকায় বাঁধ নির্মাণের কত খরচ বাঁচানো সম্ভব তা হিসাব করুন।',
        'lbl-calc-reef-len': 'সুরক্ষিত প্রবাল প্রাচীরের দৈর্ঘ্য (কিমি)',
        'lbl-calc-boats': 'নৌকার সংখ্যা',
        'lbl-calc-results-title': 'উপকূলীয় অঞ্চলের বার্ষিক মোট অর্থনৈতিক লাভ',
        'lbl-calc-defense': 'উপকূল রক্ষা বাবদ সাশ্রয়:',
        'lbl-calc-yield': 'মাছ ধরার বাড়তি অর্থনৈতিক মূল্য:',
        'lbl-calc-total': 'মোট অর্থনৈতিক সুবিধা:',
        'lbl-calc-note': '*হিসাবটি বাঁধ নির্মাণের গড় সাশ্রয়কৃত ব্যয়ের ওপর ভিত্তি করে করা।',
        'lbl-access-lang': 'ওয়েবসাইটের ভাষা পরিবর্তন করুন',
        'lbl-access-tts': 'স্ক্রীন স্পীচ রিডার (টিটিএস)',
        'lbl-cattle-title': '<i class="fa-solid fa-cow"></i> গবাদি পশু স্বাস্থ্য ও টিকাদান পরামর্শদাতা',
        'lbl-cattle-desc': 'মানচিত্রে সক্রিয় গবাদি পশুর রোগ সংক্রমণ ট্র্যাক করুন। তাত্ক্ষণিক স্থানীয় পশুচিকিত্সা নির্দেশিকা এবং টিকাদানের পদক্ষেপ দেখতে মানচিত্রে অবস্থান নির্বাচন করুন।',
        'lbl-cattle-advisory-title': '<i class="fa-solid fa-hand-holding-medical"></i> টিকা পরামর্শদাতা',
        'lbl-cattle-advisory-prompt': 'জেলা-ভিত্তিক টিকার প্রয়োজনীয়তা এবং পশুচিকিত্সকের নির্দেশিকা দেখতে মানচিত্রের সক্রিয় মার্কারের ওপর ক্লিক করুন।',
        'lbl-mandi-title': '<i class="fa-solid fa-wheat-awn"></i> খাদ্যশস্য বাজার মূল্য (কৃষি মান্ডি)',
        'lbl-mandi-subtitle': 'ভারতের বিভিন্ন রাজ্যের প্রতি কুইন্টাল (১০০ কেজি) বর্তমান মান্ডি দর, সরাসরি সরকারি ডাটাবেস থেকে সাপ্তাহিক সংগৃহীত।',
        'lbl-filter-state': 'রাজ্য',
        'lbl-filter-commodity': 'খাদ্যশস্য / পণ্য',
        'lbl-market-title': '<i class="fa-solid fa-store"></i> জৈব বায়ো-পণ্য বাজার',
        'lbl-market-subtitle': 'গ্রামীণ বিক্রেতাদের কাছ থেকে সরাসরি জৈব পণ্য নিবন্ধন করুন, লগইন করুন এবং ব্রাউজ করুন। জৈব চাষের ব্যাখ্যা ও পরীক্ষা পদ্ধতি নিচে উপলব্ধ।',
        'lbl-fisheries-title': '<i class="fa-solid fa-ship"></i> মৎস্য কেন্দ্র ও সামুদ্রিক বাস্তুতন্ত্র',
        'lbl-fisheries-desc': 'উপকূলীয় মাছের উপস্থিতি মানচিত্র, প্রজনন নিষেধাজ্ঞা ক্যালেন্ডার, সামুদ্রিক মাছের জনসংখ্যা এবং অন্যান্য বিবরণ দেখুন।',
        'lbl-groundwater-title': '<i class="fa-solid fa-droplet"></i> ভূগর্ভস্থ জল হ্রাস এবং পয়ঃনিষ্কাশন দূষণ ভিজ্যুয়ালাইজার (2016 - 2026)',
        'lbl-groundwater-subtitle': 'ভূগর্ভস্থ জলের স্তর হ্রাস (mbgl) নিরীক্ষণ করুন এবং কৃষি জলাশয়ে পয়ঃনিষ্কাশন মিশ্রণের ওভারল্যাপ ট্র্যাক করুন।',
        'lbl-gw-year-label': 'পূর্বাভাস/ঐতিহাসিক বছর নির্বাচন করুন:',
        'lbl-gw-map-title': 'ইন্টারেক্টিভ ভূগর্ভস্থ জলাশয় মানচিত্র',
        'lbl-groundwater-chart-title': 'ভূগর্ভস্থ জলের স্তরের ধারা (mbgl এ গভীরতা)',
        'nav-btn-mesh': '<i class="fa-solid fa-circle-nodes"></i> অফলাইন মেশ',
        'lbl-mesh-title': '<i class="fa-solid fa-circle-nodes"></i> অফলাইন মেশ নেটওয়ার্ক',
        'lbl-mesh-desc': 'ব্লুটুথ মেশ প্রযুক্তির মাধ্যমে আশেপাশের ব্যবহারকারীদের সাথে সরাসরি সতর্কতা এবং সংক্ষিপ্ত বার্তা আদান-প্রদান করুন। মোবাইল নেটওয়ার্ক ছাড়াই সম্পূর্ণরূপে অফলাইনে কাজ করে।',
        'lbl-mesh-send-title': '<i class="fa-solid fa-paper-plane"></i> বার্তা সম্প্রচার করুন',
        'lbl-mesh-send-desc': 'স্থানীয় ব্লুটুথ মেশ নেটওয়ার্কে সম্প্রচার করতে একটি সংক্ষিপ্ত বিজ্ঞপ্তি লিখুন।',
        'lbl-mesh-sender-label': 'আপনার প্রেরক আইডি / নাম',
        'lbl-mesh-urgency-label': 'সতর্কতা জরুরিতা স্তর',
        'lbl-mesh-message-label': 'সম্প্রচার পাঠ্য (সর্বোচ্চ ১৪০ অক্ষর)',
        'lbl-mesh-broadcast-btn': '<i class="fa-solid fa-rss"></i> অফলাইন সম্প্রচার (ব্লুটুথ)',
        'lbl-mesh-stream-title': '<i class="fa-solid fa-list-check"></i> লাইভ মেশ ফিড',
        'lbl-mesh-radar-title': 'ব্লুটুথ ট্রান্সসিভার সক্রিয়',
        'lbl-mesh-empty-text': 'এখনো কোনো মেশ সম্প্রচার সনাক্ত করা যায়নি।',
        'lbl-mesh-bridge-status': 'নেটিভ ব্রিজ সংযোগ অবস্থা:'
    },
    'te': {
        'nav-btn-dashboard': '<i class="fa-solid fa-chart-line"></i> డాష్‌బోర్డ్',
        'nav-btn-farming': '<i class="fa-solid fa-tractor"></i> వ్యవసాయం',
        'btn-farm-sub-cattle': '<i class="fa-solid fa-cow"></i> పశువుల ఆరోగ్యం',
        'btn-farm-sub-mandi': '<i class="fa-solid fa-wheat-awn"></i> మండి ధరలు',
        'btn-farm-sub-market': '<i class="fa-solid fa-store"></i> బయో మార్కెట్',
        'nav-btn-fisheries': '<i class="fa-solid fa-ship"></i> మత్స్య సంపద',
        'nav-btn-weather': '<i class="fa-solid fa-cloud-sun-rain"></i> వాతావరణ సమాచారం',
        'nav-btn-birds': '<i class="fa-solid fa-feather-pointed"></i> పక్షుల ధ్వనులు',
        'nav-btn-news': '<i class="fa-solid fa-newspaper"></i> వార్తా పోర్టల్',
        'nav-btn-sources': '<i class="fa-solid fa-circle-info"></i> సమాచార వనరులు',
        'lbl-hero-title': 'లైవ్ డేటాతో గ్రామీణ భారతదేశానికి సాధికారత',
        'lbl-hero-desc': 'గ్రామసేతు గ్రామీణ నిపుణులను నిజ-సమయ మార్కెట్ ధరలు, పశువుల ఆరోగ్య హెచ్చరికలు, సేంద్రీయ బయో-ట్రేడింగ్ మరియు పౌర-శాస్త్ర పరిరక్షణ మ్యాపింగ్‌తో అనుసంధానిస్తుంది.',
        'btn-sync-data': '<i class="fa-solid fa-rotate"></i> తాజా డేటాను సింక్ చేయండి',
        'lbl-weather-title': '<i class="fa-solid fa-cloud-sun-rain"></i> వాతావరణం & వాతావరణ మార్పుల అప్‌డేట్స్',
        'lbl-weather-subtitle': 'నిజ-సమయ రుతుపవనాల పర్యవేక్షణ, ప్రాంతీయ ఎల్ నినో సలహాలు మరియు దీర్ఘకాలిక ఉష్ణోగ్రత వైరుధ్యాల గుర్తింపు.',
        'lbl-elnino-title': '<i class="fa-solid fa-circle-exclamation" style="color: var(--color-danger);"></i> ఎల్ నినో సలహా & రుతుపవనాల ప్రభావం',
        'lbl-elnino-desc': 'ఎల్ నినో పరిస్థితులు ప్రస్తుతం క్రియాశీలంగా ఉన్నాయి. భారతదేశంలో, ఇది బలహీనమైన నైరుతి రుతుపవనాలకు, ఆలస్యంగా వచ్చే గాలికి మరియు సగటు కంటే తక్కువ వర్షపాతానికి (సగటున 10-15% లోటు) దారితీస్తుంది. ఇది మధ్య మరియు వాయువ్య భారతదేశంలో కరువు ప్రమాదాలను పెంచుతుంది. నీటి సంరక్షణకు ప్రాధాన్యత ఇవ్వాలని, నేల తేమను కాపాడటానికి రక్షక కవచాలను ఉపయోగించాలని మరియు కరువును తట్టుకునే పంట రకాలను ఎంచుకోవాలని సూచించబడింది.',
        'lbl-regional-forecasts-title': '<i class="fa-solid fa-map-location"></i> ప్రాంతీయ వాతావరణ అంచనాలు & రుతుపవనాల లోటు',
        'lbl-climate-title': '<i class="fa-solid fa-chart-area"></i> దశాబ్దపు ఉష్ణోగ్రత వైవిధ్యం & రుతుపవనాల విచలనం (2000 - 2026)',
        'lbl-climate-subtitle': 'దీర్ఘకాలిక ఉష్ణోగ్రత వైవిధ్యాలు మరియు దానికి సంబంధించిన వర్షపాత లోటు వాతావరణ మార్పుల ప్రభావాన్ని సూచిస్తుంది.',
        'lbl-coral-title': '<i class="fa-solid fa-shield-heart"></i> పగడపు దిబ్బల పరిరక్షణ మార్గదర్శి',
        'lbl-coral-intro': 'పగడపు దిబ్బలు సముద్రపు వర్షారణ్యాలు. ఇవి సముద్రంలో 0.1% కంటే తక్కువ భాగాన్ని మాత్రమే ఆక్రమించినప్పటికీ, 25% పైగా సముద్ర జీవులకు ఆశ్రయం కల్పిస్తాయి, సర్డినెస్, మాకేరెల్ మరియు స్నాపర్ వంటి చేపలకు ప్రాథమిక నర్సరీలుగా పనిచేస్తాయి.',
        'lbl-coral-why-title': 'పగడపు దిబ్బలు ఎందుకు ముఖ్యమైనవి?',
        'lbl-coral-how-title': 'వాటిని ఎలా రక్షించాలి?',
        'lbl-calc-title': '<i class="fa-solid fa-calculator"></i> తీరప్రాంత ఆదా & దిగుబడి కాలిక్యులేటర్',
        'lbl-calc-desc': 'స్థానికంగా ఉన్న పగడపు దిబ్బలను రక్షించడం ద్వారా తీరప్రాంత రక్షణలో ఎంత డబ్బు ఆదా అవుతుందో మరియు చేపల వేట ద్వారా ఎంత లాభం పెరుగుతుందో లెక్కించండి.',
        'lbl-calc-reef-len': 'రక్షిత పగడపు దిబ్బల పొడవు (కిలోమీటర్లలో)',
        'lbl-calc-boats': 'కమ్యూనిటీ ఫిషింగ్ బోట్ల సంఖ్య',
        'lbl-calc-results-title': 'అంచనా వేయబడిన వార్షిక కమ్యూనిటీ ఆదా',
        'lbl-calc-defense': 'తీరప్రాంత రక్షణ ఆదా:',
        'lbl-calc-yield': 'పెరిగిన చేపల వేట విలువ:',
        'lbl-calc-total': 'మొత్తం ఆర్థిక ప్రయోజనం:',
        'lbl-calc-note': '*లెక్కింపులు కిలోమీటరుకు సగటున ఆదా చేయబడిన సముద్ర రక్షణ గోడ నిర్మాణ ఖర్చుల (సుమారు ₹25L/km/yr) మరియు ఒక బోటుకు సంవత్సరానికి ₹35,000 చేపల వేట విలువ ఆధారంగా లెక్కించబడ్డాయి.',
        'lbl-access-lang': 'వెబ్‌సైట్ భాషను అనువదించండి',
        'lbl-access-tts': 'స్క్రీన్ స్పీచ్ రీడర్ (TTS)',
        'lbl-cattle-title': '<i class="fa-solid fa-cow"></i> పశువుల ఆరోగ్యం & వ్యాక్సినేషన్ సలహాదారు',
        'lbl-cattle-desc': 'ఇంటరాక్టివ్ హీట్-ఇంటెన్సిటీ మ్యాప్‌లో క్రియాశీలంగా ఉన్న పశువుల వ్యాధుల వ్యాప్తిని పరిశీలించండి. తక్షణ స్థానిక పశువైద్య మార్గదర్శకత్వం మరియు టీకా చర్యలను చూడటానికి ఒక వ్యాప్తి ప్రాంతాన్ని ఎంచుకోండి.',
        'lbl-cattle-advisory-title': '<i class="fa-solid fa-hand-holding-medical"></i> వ్యాక్సిన్ సలహాదారు',
        'lbl-cattle-advisory-prompt': 'జిల్లా-నిర్దిష్ట వ్యాక్సిన్ అవసరాలు మరియు పశువైద్య మార్గదర్శకాలను ప్రదర్శించడానికి మ్యాప్‌లో క్రియాశీలంగా ఉన్న మార్కర్‌పై క్లిక్ చేయండి.',
        'lbl-mandi-title': '<i class="fa-solid fa-wheat-awn"></i> ధాన్య మార్కెట్ ధరలు (వ్యవసాయ మండీలు)',
        'lbl-mandi-subtitle': 'భారతీయ రాష్ట్రాల్లో ప్రతి క్వింటాల్ (100 కిలోగ్రాములు) ప్రస్తుత మండి ధరలు, నేరుగా ప్రభుత్వ డేటాబేస్ నుండి వారానికోసారి సేకరించబడతాయి.',
        'lbl-filter-state': 'రాష్ట్రం',
        'lbl-filter-commodity': 'ధాన్యము / వస్తువు',
        'lbl-market-title': '<i class="fa-solid fa-store"></i> సేంద్రీయ బయో-ఉత్పత్తుల మార్కెట్',
        'lbl-market-subtitle': 'నమోదు చేసుకోండి, లాగిన్ అవ్వండి మరియు గ్రామీణ విక్రేతల నుండి నేరుగా సేంద్రీయ ఉత్పత్తులను బ్రౌజ్ చేయండి. బయో వివరణలు మరియు గృహ రసాయన పరీక్షల కిట్లు క్రింద అందుబాటులో ఉన్నాయి.',
        'lbl-fisheries-title': '<i class="fa-solid fa-ship"></i> మత్స్య సంపద కేంద్రం & సముద్ర పర్యావరణ వ్యవస్థ',
        'lbl-fisheries-desc': 'తీరప్రాంత చేపల హీట్‌మ్యాప్ జోన్‌లు, బహుభాషా పరిరక్షణ అంతర్దృష్టులతో సంతానోత్పత్తి నియంత్రణ క్యాలెండర్లు, సముద్ర జనాభా చార్టులు మరియు సముద్ర క్షీరదాల వీక్షణలను అన్వేషించండి.',
        'lbl-groundwater-title': '<i class="fa-solid fa-droplet"></i> భూగర్భ జలాల క్షీణత & మురుగునీటి కాలుష్య విజువలైజర్ (2016 - 2026)',
        'lbl-groundwater-subtitle': 'భూగర్భ జలాల తగ్గుదలను పర్యవేక్షించండి మరియు వ్యవసాయ భూగర్భ జలాల్లో పట్టణ మురుగునీటి కలయికను ట్రాక్ చేయండి.',
        'lbl-gw-year-label': 'అంచనా/చారిత్రక సంవత్సరాన్ని ఎంచుకోండి:',
        'lbl-sewage-toggle-label': 'మురుగునీటి కాలుష్య ఓవర్లేను చూపించు',
        'lbl-gw-map-title': 'ఇంటరాక్టివ్ భూగర్భ జలాల మ్యాప్',
        'lbl-groundwater-chart-title': 'భూగర్భ జల మట్టం సరళి (మీటర్లలో లోతు)',
        'nav-btn-mesh': '<i class="fa-solid fa-circle-nodes"></i> ఆఫ్-లైన్ మెష్',
        'lbl-mesh-title': '<i class="fa-solid fa-circle-nodes"></i> ఆఫ్-లైన్ మెష్ నెట్‌వర్క్',
        'lbl-mesh-desc': 'బ్లూటూత్ మెష్ టెక్నాలజీ ద్వారా సమీప వినియోగదారులతో నేరుగా హెచ్చరికలు మరియు చిన్న సందేశాలను మార్పిడి చేసుకోండి. సెల్యులార్ నెట్‌వర్క్ కవరేజ్ లేకుండా పూర్తిగా ఆఫ్-లైన్ లో పనిచేస్తుంది.',
        'lbl-mesh-send-title': '<i class="fa-solid fa-paper-plane"></i> సందేశాన్ని ప్రసారం చేయండి',
        'lbl-mesh-send-desc': 'స్థానిక బ్లూటూత్ మెష్ నెట్‌వర్క్ లో ప్రసారం చేయడానికి ఒక చిన్న నోటిఫికేషన్ రాయండి.',
        'lbl-mesh-sender-label': 'మీ పంపినవారి ఐడి / పేరు',
        'lbl-mesh-urgency-label': 'హెచ్చరిక అత్యవసర స్థాయి',
        'lbl-mesh-message-label': 'ప్రసార వచనం (గరిష్టంగా 140 అక్షరాలు)',
        'lbl-mesh-broadcast-btn': '<i class="fa-solid fa-rss"></i> ఆఫ్-లైన్ ప్రసారం (బ్లూటూత్)',
        'lbl-mesh-stream-title': '<i class="fa-solid fa-list-check"></i> లైవ్ మెష్ ఫీడ్',
        'lbl-mesh-radar-title': 'బ్లూటూత్ ట్రాన్స్ సీవర్ సక్రియంగా ఉంది',
        'lbl-mesh-empty-text': 'ఇంకా ఎటువంటి మెష్ ప్రసారాలు కనుగొనబడలేదు.',
        'lbl-mesh-bridge-status': 'నేటివ్ బ్రిడ్జ్ కనెక్షన్ స్థితి:'
    }
};;

function translateUI(lang) {
    activeLang = lang;
    if (!TRANSLATIONS[lang]) return;

    // Sync dropdown select values
    const hSelect = document.getElementById('header-language-select');
    if (hSelect) hSelect.value = lang;
    const aSelect = document.getElementById('access-language-select');
    if (aSelect) aSelect.value = lang;

    const dict = TRANSLATIONS[lang];
    Object.keys(dict).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = dict[id];
        }
    });

    // Also re-render chart to update language specific labels
    if (activeTab === 'weather') {
        renderGroundwaterChart();
    }
}

// 13.5 Groundwater Depletion & Sewage Contamination Module
async function loadGroundwaterData() {
    try {
        const response = await fetch('http://localhost:8000/weather/groundwater');
        groundwaterData = await response.json();
    } catch (e) {
        console.warn("Could not fetch groundwater data from API.", e);
        groundwaterData = [];
    }

    // Draw default chart (National Average)
    renderGroundwaterChart();
}

function initGroundwaterMap() {
    if (groundwaterMap) {
        setTimeout(() => groundwaterMap.invalidateSize(), 100);
        return;
    }

    groundwaterMap = L.map('groundwater-map').setView(INDIA_CENTER, 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(groundwaterMap);

    renderGroundwaterMarkers();
}

let groundwaterMarkersList = [];
let sewageMarkersList = [];

function renderGroundwaterMarkers() {
    if (!groundwaterMap) return;

    // Clear existing markers
    groundwaterMarkersList.forEach(m => groundwaterMap.removeLayer(m));
    sewageMarkersList.forEach(m => groundwaterMap.removeLayer(m));
    groundwaterMarkersList = [];
    sewageMarkersList = [];

    const yearData = groundwaterData.filter(d => d.year === activeGroundwaterYear);

    yearData.forEach(d => {
        // Aquifer color code: Green <15m, Orange 15-30m, Red >30m
        let color = '#10b981'; // Green
        if (d.waterTableDepth > 30) {
            color = '#ef4444'; // Red
        } else if (d.waterTableDepth >= 15) {
            color = '#fbbf24'; // Orange
        }

        // Radius increases with depletion depth
        const radius = 12000 + (d.waterTableDepth * 2000);

        const aquiferMarker = L.circle([d.latitude, d.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
            radius: radius
        }).addTo(groundwaterMap);

        const popupContent = `
            <div style="font-family: var(--font-body); padding: 5px;">
                <h4 style="margin-bottom: 2px; color:var(--text-primary);">${d.district} (${d.state})</h4>
                <p><strong>Year:</strong> ${d.year}</p>
                <p><strong>Aquifer Depth:</strong> ${d.waterTableDepth.toFixed(1)} mbgl</p>
                <p><strong>Sewage Mixing Ratio:</strong> ${d.sewageContamination.toFixed(0)}%</p>
                <p><strong>Depletion Rate:</strong> ${d.depletionRate.toFixed(2)} m/yr</p>
                <button class="btn-primary" style="margin-top: 10px; padding: 4px 8px; font-size: 0.75rem;" onclick="selectDistrictForChart('${d.district}')">View 10-Yr Trend Chart</button>
            </div>
        `;
        aquiferMarker.bindPopup(popupContent);

        aquiferMarker.on('click', () => {
            selectDistrictForChart(d.district);
        });

        groundwaterMarkersList.push(aquiferMarker);

        // Sewage overlay if toggled on
        if (isSewageOverlayVisible) {
            // Draw overlap dashed circle in purple/magenta
            const sewageRadius = 10000 + (d.sewageContamination * 250);
            const sewageMarker = L.circle([d.latitude, d.longitude], {
                color: '#a855f7',
                fillColor: '#a855f7',
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '5, 5',
                radius: sewageRadius
            }).addTo(groundwaterMap);

            sewageMarker.bindPopup(popupContent);
            sewageMarker.on('click', () => {
                selectDistrictForChart(d.district);
            });
            sewageMarkersList.push(sewageMarker);
        }
    });
}

function selectDistrictForChart(district) {
    selectedGroundwaterDistrict = district;
    renderGroundwaterChart();
}

function updateGroundwaterYear(year) {
    activeGroundwaterYear = parseInt(year);
    const display = document.getElementById('gw-year-display');
    if (display) display.innerText = year;
    renderGroundwaterMarkers();
}

function toggleSewageOverlay(visible) {
    isSewageOverlayVisible = visible;
    renderGroundwaterMarkers();
}

function renderGroundwaterChart() {
    const container = document.getElementById('groundwater-svg-container');
    const titleEl = document.getElementById('lbl-gw-chart-district');
    if (!container) return;

    if (!groundwaterData || groundwaterData.length === 0) {
        container.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); font-size:0.9rem;">No groundwater dataset loaded.</div>';
        if (titleEl) titleEl.innerText = "";
        return;
    }

    // Determine dataset for chart (specific district or national average)
    let points = [];
    const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

    const localLabels = {
        'en': { natAvg: "National Average (All Districts)", dist: "District: " },
        'hi': { natAvg: "राष्ट्रीय औसत (सभी जिले)", dist: "जिला: " },
        'mr': { natAvg: "राष्ट्रीय सरासरी (सर्व जिल्हे)", dist: "जिल्हा: " },
        'kn': { natAvg: "ರಾಷ್ಟ್ರೀಯ ಸರಾಸರಿ (ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು)", dist: "ಜಿಲ್ಲೆ: " },
        'ta': { natAvg: "தேசிய சராசரி (அனைத்து மாவட்டங்களும்)", dist: "மாவட்டம்: " },
        'ml': { natAvg: "ദേശീയ ശരാശരി (എല്ലാ ജില്ലകളും)", dist: "ജില്ല: " },
        'bn': { natAvg: "জাতীয় গড় (সমস্ত জেলা)", dist: "জেলা: " },
        'gu': { natAvg: "રાષ્ટ્રીય સરેરાશ (તમામ જિલ્લાઓ)", dist: "જિલ્લો: " }
    };

    const labels = localLabels[activeLang] || localLabels['en'];

    if (selectedGroundwaterDistrict) {
        if (titleEl) titleEl.innerText = `${labels.dist}${selectedGroundwaterDistrict}`;

        const districtData = groundwaterData.filter(d => d.district === selectedGroundwaterDistrict);
        years.forEach(y => {
            const rec = districtData.find(d => d.year === y);
            if (rec) {
                points.push({ year: y, depth: rec.waterTableDepth });
            }
        });
    } else {
        if (titleEl) titleEl.innerText = labels.natAvg;

        years.forEach(y => {
            const yearRecs = groundwaterData.filter(d => d.year === y);
            if (yearRecs.length > 0) {
                const sum = yearRecs.reduce((acc, curr) => acc + curr.waterTableDepth, 0);
                points.push({ year: y, depth: sum / yearRecs.length });
            } else {
                points.push({ year: y, depth: 15 + (y - 2016) * 1.0 });
            }
        });
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    const paddingLeft = 50;
    const paddingRight = 30;
    const paddingTop = 20;
    const paddingBottom = 40;

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    const minYear = 2016;
    const maxYear = 2026;

    // We want the chart to display from 0 to 50 mbgl
    const minDepth = 0;
    const maxDepth = 50;

    const getX = (year) => paddingLeft + ((year - minYear) / (maxYear - minYear)) * graphWidth;
    const getY = (val) => paddingTop + ((val - minDepth) / (maxDepth - minDepth)) * graphHeight;

    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow:visible;">`;

    // Gridlines and Y-axis labels
    for (let i = 0; i <= 5; i++) {
        const ratio = i / 5;
        const val = minDepth + ratio * (maxDepth - minDepth);
        const y = getY(val);

        svg += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
        svg += `<text x="${paddingLeft - 10}" y="${y + 4}" fill="var(--text-secondary)" font-size="10" text-anchor="end">${val.toFixed(0)}m</text>`;
    }

    // X-axis labels
    years.forEach(year => {
        const x = getX(year);
        svg += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + graphHeight}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
        svg += `<text x="${x}" y="${paddingTop + graphHeight + 20}" fill="var(--text-secondary)" font-size="10" text-anchor="middle">${year}</text>`;
    });

    // Draw the trend line
    let pathD = '';
    points.forEach((p, idx) => {
        const x = getX(p.year);
        const y = getY(p.depth);
        if (idx === 0) {
            pathD += `M ${x} ${y}`;
        } else {
            pathD += ` L ${x} ${y}`;
        }
    });

    svg += `<path d="${pathD}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

    // Draw data points
    points.forEach(p => {
        const x = getX(p.year);
        const y = getY(p.depth);

        const isCurrent = p.year === activeGroundwaterYear;
        const radius = isCurrent ? 7 : 4;
        const color = isCurrent ? '#ef4444' : '#10b981';
        const strokeColor = isCurrent ? '#ffffff' : '#ffffff';

        svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" stroke="${strokeColor}" stroke-width="1.5" style="cursor:pointer;" onclick="updateGroundwaterYear(${p.year})">
            <title>Year ${p.year}: ${p.depth.toFixed(1)} mbgl</title>
        </circle>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
}

// 15. Feedback & Suggestion System Logic
let feedbackRating = 5; // Default rating to 5 stars

function setFeedbackRating(val) {
    feedbackRating = val;
    const stars = document.querySelectorAll('.feedback-stars-selector i');
    stars.forEach((star, idx) => {
        if (idx < val) {
            star.style.color = '#fbbf24'; // Active gold star
        } else {
            star.style.color = '#4b5563'; // Inactive gray star
        }
    });
}

function initFeedbackTab() {
    setFeedbackRating(5); // Reset to 5 stars on tab load
    const contentText = document.getElementById('feedback-content');
    if (contentText) contentText.value = ''; // Reset text
    fetchFeedback();
}

function fetchFeedback() {
    fetch('http://localhost:8000/feedback')
        .then(res => res.json())
        .then(data => {
            renderFeedbackFeed(data);
        })
        .catch(err => console.log('Error fetching feedback:', err));
}

function submitFeedback() {
    const categorySelect = document.getElementById('feedback-category');
    const contentText = document.getElementById('feedback-content');
    const senderInput = document.getElementById('mesh-sender-name');

    if (!contentText || !categorySelect) return;

    const content = contentText.value.trim();
    if (!content) {
        alert('Please enter your feedback text.');
        return;
    }

    const senderHandle = senderInput ? senderInput.value.trim() : 'Anonymous';
    const category = categorySelect.value;
    const rating = feedbackRating;

    const payload = {
        category,
        senderHandle,
        rating,
        content
    };

    const submitBtn = document.getElementById('btn-submit-feedback');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    }

    fetch('http://localhost:8000/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(res => {
            if (!res.ok) throw new Error('Submission failed');
            return res.json();
        })
        .then(data => {
            contentText.value = '';
            setFeedbackRating(5);
            alert('Thank you! Your feedback has been posted successfully.');
            fetchFeedback();
        })
        .catch(err => {
            console.error('Error submitting feedback:', err);
            alert('Failed to submit feedback. Please check your connection.');
        })
        .finally(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Feedback';
                const activeDict = TRANSLATIONS[activeLang];
                if (activeDict && activeDict['btn-submit-feedback']) {
                    submitBtn.innerHTML = activeDict['btn-submit-feedback'];
                }
            }
        });
}

function renderFeedbackFeed(feedbackList) {
    const listEl = document.getElementById('feedback-board-list');
    const emptyEl = document.getElementById('feedback-empty-placeholder');
    if (!listEl) return;

    const totalCount = feedbackList.length;
    let avgRating = 0;
    if (totalCount > 0) {
        const sum = feedbackList.reduce((acc, f) => acc + (f.rating || 0), 0);
        avgRating = sum / totalCount;
    }

    const countEl = document.getElementById('feedback-stat-count');
    if (countEl) countEl.innerText = totalCount;

    const avgNumEl = document.getElementById('feedback-stat-rating-num');
    if (avgNumEl) avgNumEl.innerText = avgRating.toFixed(1);

    const avgStarsEl = document.getElementById('feedback-stat-rating-stars');
    if (avgStarsEl) {
        let starsHtml = '';
        const fullStars = Math.floor(avgRating);
        const halfStar = (avgRating % 1) >= 0.5;
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                starsHtml += '<i class="fa-solid fa-star"></i>';
            } else if (i === fullStars + 1 && halfStar) {
                starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
            } else {
                starsHtml += '<i class="fa-regular fa-star"></i>';
            }
        }
        avgStarsEl.innerHTML = starsHtml;
    }

    if (totalCount === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        listEl.innerHTML = '';
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    let html = '';
    feedbackList.forEach(f => {
        let catClass = f.category || 'recommendation';
        let catLabel = catClass.charAt(0).toUpperCase() + catClass.slice(1);

        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= (f.rating || 0)) {
                starsHtml += '<i class="fa-solid fa-star" style="color: #fbbf24;"></i>';
            } else {
                starsHtml += '<i class="fa-regular fa-star" style="color: #4b5563;"></i>';
            }
        }

        html += `
            <div class="feedback-msg-card ${catClass}" style="margin-bottom: 0.75rem; padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <strong style="color: var(--text-primary); font-size: 0.9rem;">${f.senderHandle || 'Anonymous'}</strong>
                        <span class="feedback-cat-badge ${catClass}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 20px; font-weight: 700; text-transform: uppercase;">${catClass}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="display: flex; gap: 0.1rem; font-size: 0.75rem;">
                            ${starsHtml}
                        </div>
                        <span style="font-size: 0.7rem; color: var(--text-secondary);">${f.timestamp}</span>
                    </div>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; word-break: break-word;">${f.content}</div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}



// ============================================================
//  B-MESSAGING  (BLE Mesh Network)
// ============================================================

// ── State ──────────────────────────────────────────────────
const meshState = {
    myDeviceName: 'This Device',
    peers: [],           // { id, name, rssi, lastSeen, online }
    messages: {},        // keyed by peer id ('' = broadcast)
    activePeer: '',      // '' means broadcast
    urgency: 'info',
    isBroadcastMode: true,
    initialized: false,
    simulatorInterval: null,
    allMessages: [],     // flat log for broadcast view
};

const MESH_DEMO_PEERS = [
    { id: 'GramSetu-AI', name: 'GramSetu AI', rssi: -10, online: true }
];

const MESH_DEMO_MSGS = [];

function meshAddPeer() {
    const input = document.getElementById('mesh-peer-search');
    const val = input.value.trim();
    if (!val) return;
    
    // Check if peer exists
    let peer = meshState.peers.find(p => p.name.toLowerCase() === val.toLowerCase());
    if (!peer) {
        // Create new peer
        peer = { id: val, name: val, rssi: -50, online: true };
        meshState.peers.unshift(peer);
    }
    
    input.value = '';
    meshSelectPeer(peer.id);
}

// ── Init ───────────────────────────────────────────────────
function initMeshTab() {
    if (meshState.initialized) return;
    meshState.initialized = true;

    // Resolve device name from Android bridge or generate one
    if (window.Android && typeof window.Android.getDeviceName === 'function') {
        meshState.myDeviceName = window.Android.getDeviceName();
    } else {
        const uid = Math.random().toString(36).substring(2, 6).toUpperCase();
        meshState.myDeviceName = `GS-${uid}`;
    }
    document.getElementById('mesh-my-device-name').textContent = meshState.myDeviceName;

    // Populate demo peers after scan delay
    setTimeout(() => {
        meshState.peers = JSON.parse(JSON.stringify(MESH_DEMO_PEERS));
        meshRenderPeerList();
        meshUpdatePeerCount();
        document.getElementById('mesh-ble-label').textContent = `${meshState.peers.filter(p => p.online).length} Peers Found`;

        // Add demo messages to broadcast view
        MESH_DEMO_MSGS.forEach(m => meshAppendInboundMessage(m.sender, m.text, m.urgency, m.ts, ''));
    }, 1800);

    // Simulate BLE scan updates every 30s
    meshState.simulatorInterval = setInterval(() => {
        if (activeTab !== 'mesh') return;
        meshSimulateScanUpdate();
    }, 30000);

    // Register global inbound bridge (called by Android native BLE scanner)
    window.receiveMeshMessage = function(sender, text, urgency, timestamp, recipient) {
        meshAppendInboundMessage(sender, text, urgency, timestamp, recipient);
    };
}

// ── Peer List ──────────────────────────────────────────────
function meshRenderPeerList(filter = '') {
    const list = document.getElementById('mesh-peers-list');
    const peers = meshState.peers.filter(p =>
        !filter || p.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (peers.length === 0) {
        list.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-secondary); font-size:0.88rem;">
            <i class="fa-solid fa-magnifying-glass" style="font-size:1.4rem; opacity:0.4; display:block; margin-bottom:0.5rem;"></i>
            No peers found
        </div>`;
        return;
    }

    list.innerHTML = peers.map(p => {
        const isActive = meshState.activePeer === p.id;
        const signal = p.rssi > -65 ? 3 : p.rssi > -75 ? 2 : 1;
        const signalBars = Array(3).fill(0).map((_, i) =>
            `<span style="width:3px; height:${6+i*4}px; border-radius:2px; background:${i < signal ? '#3b82f6' : 'rgba(0,0,0,0.15)'}; display:inline-block;"></span>`
        ).join('');
        const initials = p.name.substring(0, 2).toUpperCase();
        const hasUnread = (meshState.messages[p.id] || []).some(m => m.unread);

        return `<div class="mesh-peer-item" data-peer-id="${p.id}"
            onclick="meshSelectPeer('${p.id}')"
            style="display:flex; align-items:center; gap:0.65rem; padding:0.65rem 0.75rem; border-radius:10px; cursor:pointer; transition:all 0.2s;
                   background:${isActive ? 'rgba(59,130,246,0.12)' : 'transparent'};
                   border:1px solid ${isActive ? 'rgba(59,130,246,0.3)' : 'transparent'};">
            <div style="position:relative; flex-shrink:0;">
                <div style="width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.8rem; font-weight:700;">
                    ${initials}
                </div>
                <span style="position:absolute; bottom:-2px; right:-2px; width:10px; height:10px; border-radius:50%; background:${p.online ? '#10b981' : '#94a3b8'}; border:2px solid white;"></span>
            </div>
            <div style="flex:1; min-width:0;">
                <div style="font-size:0.88rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                <div style="font-size:0.72rem; color:var(--text-secondary);">${p.online ? 'Online' : 'Last seen recently'} · ${p.rssi} dBm</div>
            </div>
            <div style="display:flex; align-items:flex-end; gap:1px; flex-shrink:0;">${signalBars}</div>
            ${hasUnread ? '<span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;flex-shrink:0;"></span>' : ''}
        </div>`;
    }).join('');
}

// Removed meshFilterPeers as it is no longer used

function meshUpdatePeerCount() {
    const online = meshState.peers.filter(p => p.online).length;
    document.getElementById('mesh-peer-count').textContent =
        `${meshState.peers.length} peers detected · ${online} online`;
}

// ── Peer Selection ─────────────────────────────────────────
function meshSelectPeer(peerId) {
    meshState.activePeer = peerId;
    meshState.isBroadcastMode = false;
    document.getElementById('btn-mesh-broadcast-toggle').style.background = 'linear-gradient(135deg,#475569,#334155)';
    document.getElementById('btn-mesh-broadcast-toggle').innerHTML = '<i class="fa-solid fa-user"></i> Direct Mode';

    const peer = meshState.peers.find(p => p.id === peerId);
    if (peer) {
        const initials = peer.name.substring(0, 2).toUpperCase();
        document.getElementById('mesh-chat-avatar').innerHTML = `<span style="font-size:0.9rem;">${initials}</span>`;
        document.getElementById('mesh-chat-avatar').style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
        document.getElementById('mesh-chat-title').textContent = peer.name;
        document.getElementById('mesh-chat-subtitle').textContent = `Direct BLE message · ${peer.online ? 'Online' : 'Offline'} · Signal: ${peer.rssi} dBm`;
    }

    meshRenderPeerList();
    meshRenderChatMessages(peerId);
}

function meshToggleBroadcastMode() {
    meshState.activePeer = '';
    meshState.isBroadcastMode = true;
    document.getElementById('btn-mesh-broadcast-toggle').style.background = 'linear-gradient(135deg,#7c3aed,#4f46e5)';
    document.getElementById('btn-mesh-broadcast-toggle').innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Broadcast Mode';
    document.getElementById('mesh-chat-avatar').innerHTML = '<i class="fa-solid fa-tower-broadcast"></i>';
    document.getElementById('mesh-chat-avatar').style.background = 'linear-gradient(135deg,#3b82f6,#8b5cf6)';
    document.getElementById('mesh-chat-title').textContent = 'All Peers (Broadcast)';
    document.getElementById('mesh-chat-subtitle').textContent = 'Messages delivered to all nearby BLE devices';
    meshRenderPeerList();
    meshRenderChatMessages('');
}

// ── Messages ───────────────────────────────────────────────
function meshRenderChatMessages(peerId) {
    const area = document.getElementById('mesh-messages-area');
    const msgs = peerId === ''
        ? meshState.allMessages
        : (meshState.messages[peerId] || []);

    const systemMsg = `<div class="mesh-system-msg" style="text-align:center; margin-bottom:0.5rem;">
        <span style="background:rgba(59,130,246,0.1); color:#3b82f6; font-size:0.78rem; padding:0.3rem 0.9rem; border-radius:20px; font-weight:600;">
            <i class="fa-brands fa-bluetooth-b"></i> B-Messaging BLE Mesh initialized. Range: ~100m
        </span>
    </div>`;

    if (msgs.length === 0) {
        area.innerHTML = systemMsg + `<div style="text-align:center; padding:2rem; color:var(--text-secondary); font-size:0.88rem; opacity:0.6;">
            <i class="fa-regular fa-comment-dots" style="font-size:2rem; display:block; margin-bottom:0.5rem;"></i>
            No messages yet. Start the conversation.
        </div>`;
        return;
    }

    area.innerHTML = systemMsg + msgs.map(m => meshBuildMessageBubble(m)).join('');
    area.scrollTop = area.scrollHeight;
}

function meshBuildMessageBubble(m) {
    const isMe = m.sender === meshState.myDeviceName;
    const urgencyConfig = {
        info:      { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: 'fa-circle-info', label: 'Info' },
        warning:   { color: '#d97706', bg: 'rgba(251,191,36,0.10)', icon: 'fa-triangle-exclamation', label: 'Warning' },
        emergency: { color: '#dc2626', bg: 'rgba(220,38,38,0.10)', icon: 'fa-siren-on', label: 'Emergency' },
    };
    const u = urgencyConfig[m.urgency] || urgencyConfig.info;

    if (isMe) {
        return `<div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.2rem;">
            <div style="max-width:72%; background:linear-gradient(135deg,#3b82f6,#6366f1); color:#fff; padding:0.65rem 0.9rem; border-radius:16px 4px 16px 16px; font-size:0.9rem; line-height:1.5; box-shadow:0 2px 8px rgba(59,130,246,0.25);">
                ${m.text}
                ${m.urgency !== 'info' ? `<div style="margin-top:0.35rem; font-size:0.72rem; opacity:0.85;"><i class="fa-solid ${u.icon}"></i> ${u.label}</div>` : ''}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">${m.ts} · You · <i class="fa-solid fa-check-double" style="color:#3b82f6;"></i></div>
        </div>`;
    } else {
        const initials = (m.sender || '?').substring(0, 2).toUpperCase();
        return `<div style="display:flex; flex-direction:column; align-items:flex-start; gap:0.2rem;">
            <div style="display:flex; align-items:flex-end; gap:0.5rem;">
                <div style="width:30px; height:30px; border-radius:8px; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.7rem; font-weight:700; flex-shrink:0;">${initials}</div>
                <div style="max-width:72%; background:${m.urgency === 'emergency' ? 'rgba(220,38,38,0.08)' : 'var(--bg-secondary)'}; border:1px solid ${u.color}22; padding:0.65rem 0.9rem; border-radius:4px 16px 16px 16px; font-size:0.9rem; line-height:1.5; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                    <div style="font-size:0.72rem; font-weight:700; color:${u.color}; margin-bottom:0.25rem;"><i class="fa-solid ${u.icon}"></i> ${m.sender}</div>
                    <div style="color:var(--text-primary);">${m.text}</div>
                </div>
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary); padding-left:38px;">${m.ts}</div>
        </div>`;
    }
}

function meshAppendInboundMessage(sender, text, urgency, ts, recipient) {
    const msg = { sender, text, urgency, ts: ts || meshNow(), unread: true };
    meshState.allMessages.push(msg);
    if (!meshState.messages[sender]) meshState.messages[sender] = [];
    meshState.messages[sender].push(msg);

    // Auto-add sender to peers list if not exists
    if (sender !== meshState.myDeviceName && !meshState.peers.find(p => p.id === sender)) {
        meshState.peers.unshift({ id: sender, name: sender, rssi: -50, online: true });
        meshRenderPeerList();
    }

    // If we're viewing this conversation, render live
    const viewingThis = (meshState.activePeer === '' && !recipient) ||
                        (meshState.activePeer === sender);
    if (viewingThis && activeTab === 'mesh') {
        const area = document.getElementById('mesh-messages-area');
        const bubble = document.createElement('div');
        bubble.innerHTML = meshBuildMessageBubble(msg);
        area.appendChild(bubble.firstElementChild);
        area.scrollTop = area.scrollHeight;
    }
    meshUpdatePeerCount();
}

// ── Send ───────────────────────────────────────────────────
function meshSendMessage() {
    const input = document.getElementById('mesh-compose-input');
    const text = input.value.trim();
    if (!text) return;

    const recipient = meshState.isBroadcastMode ? '' : meshState.activePeer;
    const msg = {
        sender: meshState.myDeviceName,
        text,
        urgency: meshState.urgency,
        ts: meshNow(),
        unread: false,
    };

    meshState.allMessages.push(msg);
    if (recipient) {
        if (!meshState.messages[recipient]) meshState.messages[recipient] = [];
        meshState.messages[recipient].push(msg);
    }

    // Bridge to native Android BLE layer
    if (window.Android && typeof window.Android.broadcastMeshMessage === 'function') {
        window.Android.broadcastMeshMessage(text, meshState.urgency, recipient);
    }

    if (recipient === 'GramSetu-AI') {
        fetch('http://localhost:8000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        }).then(res => res.json()).then(data => {
            meshAppendInboundMessage('GramSetu-AI', data.response || data.error || 'Unknown error', 'info', meshNow(), meshState.myDeviceName);
        }).catch(err => {
            meshAppendInboundMessage('GramSetu-AI', 'Error connecting to AI service.', 'warning', meshNow(), meshState.myDeviceName);
        });
    }

    // Render bubble
    const area = document.getElementById('mesh-messages-area');
    const bubble = document.createElement('div');
    bubble.innerHTML = meshBuildMessageBubble(msg);
    area.appendChild(bubble.firstElementChild);
    area.scrollTop = area.scrollHeight;

    // Clear input
    input.value = '';
    input.style.height = '44px';

    // Animate send button
    const btn = document.getElementById('btn-mesh-send');
    btn.style.transform = 'scale(0.85)';
    setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);
}

function meshHandleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        meshSendMessage();
    }
}

// ── Urgency ────────────────────────────────────────────────
function meshSetUrgency(level) {
    meshState.urgency = level;
    document.querySelectorAll('.mesh-urgency-btn').forEach(btn => {
        const isActive = btn.dataset.urgency === level;
        btn.style.opacity = isActive ? '1' : '0.55';
        btn.style.fontWeight = isActive ? '700' : '600';
    });

    const composeArea = document.getElementById('mesh-compose-input');
    const urgencyBorderMap = { info: '#3b82f6', warning: '#d97706', emergency: '#dc2626' };
    composeArea.style.borderColor = urgencyBorderMap[level];
    composeArea.style.boxShadow = `0 0 8px ${urgencyBorderMap[level]}40`;
}

// ── Helpers ────────────────────────────────────────────────
function meshNow() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function meshSimulateScanUpdate() {
    const rssiNoise = Math.floor(Math.random() * 6) - 3;
    meshState.peers.forEach(p => { p.rssi = Math.max(-95, Math.min(-45, p.rssi + rssiNoise)); });
    meshRenderPeerList();
    meshUpdatePeerCount();
}
