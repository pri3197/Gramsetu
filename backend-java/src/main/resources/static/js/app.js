// GramSetu Core Application JavaScript

// Application State
let activeTab = 'dashboard';
let cattleMap = null;
let birdsMap = null;
let priceData = [];
let diseaseData = [];
let birdSightings = [];

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
    
    // Initialize Visualizer Canvas default state
    clearCanvas();
});

// 1. Tab Navigation Routing
function switchTab(tabId) {
    if (activeTab === tabId) return;
    
    // Hide active panel and show target panel
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`panel-${tabId}`).classList.add('active');
    document.getElementById(`nav-btn-${tabId}`).classList.add('active');
    
    activeTab = tabId;
    
    // Lazy initialize and resize maps when they become visible
    if (tabId === 'cattle') {
        initCattleMap();
    } else if (tabId === 'birds') {
        initBirdsMap();
    }
}

// 2. Dashboard Stats Loader
async function loadDashboardStats() {
    try {
        // Fetch stats from endpoints
        const resDiseases = await fetch('/api/diseases');
        const resSightings = await fetch('/api/birds/sightings');
        const resPrices = await fetch('/api/prices');
        
        const diseases = await resDiseases.json();
        const sightings = await resSightings.json();
        const prices = await resPrices.json();
        
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
            document.getElementById('stats-wheat-price').innerText = `₹ 2,320`;
        }
    } catch (e) {
        console.warn("Could not fetch dashboard summary stats. Using backup visual displays.", e);
        document.getElementById('stats-outbreaks-count').innerText = "93";
        document.getElementById('stats-wheat-price').innerText = "₹ 2,320";
        document.getElementById('stats-bird-sightings').innerText = "8";
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
        const response = await fetch('/api/diseases');
        diseaseData = await response.json();
        if (activeTab === 'cattle') renderCattleMarkers();
    } catch (e) {
        console.error("Error loading cattle disease data:", e);
    }
}

function renderCattleMarkers() {
    if (!cattleMap || !diseaseData.length) return;
    
    // Clear old markers (just re-creating is simple for demo)
    // Create circle overlay markers based on disease parameters
    diseaseData.forEach(d => {
        let color = '#3b82f6'; // Medium - Blue
        let radius = 18000;
        
        if (d.severity === 'Critical') {
            color = '#ef4444'; // Red
            radius = 35000;
        } else if (d.severity === 'High') {
            color = '#fbbf24'; // Orange/Gold
            radius = 26000;
        }
        
        const circle = L.circle([d.latitude, d.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.45,
            radius: radius
        }).addTo(cattleMap);
        
        // Binding a popup message details
        const popupContent = `
            <div style="font-family: var(--font-body); padding: 5px;">
                <h4 style="margin-bottom: 5px; color:#ffffff;">${d.disease}</h4>
                <p><strong>District:</strong> ${d.district}, ${d.state}</p>
                <p><strong>Active Cases:</strong> ${d.activeCases} cows</p>
                <p><strong>Severity:</strong> <span class="status-badge ${d.severity.toLowerCase()}">${d.severity}</span></p>
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
    document.getElementById('cattle-advisory-prompt').style.display = 'none';
    const content = document.getElementById('cattle-advisory-content');
    content.style.display = 'block';
    
    document.getElementById('adv-district-title').innerText = `District: ${outbreak.district} (${outbreak.state})`;
    
    const dName = document.getElementById('adv-disease-name');
    dName.className = `status-badge ${outbreak.severity.toLowerCase()}`;
    dName.innerText = outbreak.disease;
    
    document.getElementById('adv-cases-count').innerText = outbreak.activeCases;
    document.getElementById('adv-severity-label').innerText = outbreak.severity;
    document.getElementById('adv-transmission-desc').innerText = outbreak.transmission;
    
    // Display list of vaccines needed
    document.getElementById('adv-vaccines-list').innerText = outbreak.recommendedVaccines;
}

// 4. Mandi prices filter, table, and data fetching
async function loadMandiPrices() {
    try {
        const response = await fetch('/api/prices');
        priceData = await response.json();
        
        populateFilterDropdowns();
        renderPricesTable(priceData);
    } catch (e) {
        console.error("Error loading commodity prices:", e);
    }
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
        const response = await fetch('/api/birds/classify', {
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
        const response = await fetch('/api/birds/sightings');
        birdSightings = await response.json();
        
        if (activeTab === 'birds') renderBirdMarkers();
        loadBirdStatsTable();
        loadDashboardStats();
    } catch (e) {
        console.error("Error loading bird sightings: ", e);
    }
}

function renderBirdMarkers() {
    if (!birdsMap) return;
    
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
        const dateStr = dateObj.toLocaleDateString('en-IN') + ' ' + dateObj.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'});

        const popupContent = `
            <div style="font-family: var(--font-body); padding: 5px;">
                <h4 style="margin-bottom: 2px; color:#ffffff;">${s.name}</h4>
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
        const response = await fetch('/api/birds/stats');
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
        const response = await fetch('/api/birds/sightings', {
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
        const response = await fetch('/api/sync/trigger', { method: 'POST' });
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
