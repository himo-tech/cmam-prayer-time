// Global variables
let prayerTimes = null;
let currentDate = new Date(); // Machine local time
const currentYear = currentDate.getFullYear().toString();
const iqamahTime = {fajr: 20, zuhr: 15, asr: 15, maghrib: 5, isha: 10};

// Flag to prevent multiple simultaneous retry attempts
let isRetrying = false;

/*-- Utilities Functions --*/

// Function to safely set text content of an element
function safeSetTextContent(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}

// Function to add minutes to a time string
function addMinutes(timeStr, minutes) {
    if (!timeStr) return '';
    const [hours, mins] = timeStr.split(':').map(Number);
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hours, mins + minutes);
    return date.toTimeString().slice(0, 5);
}

// Helper function to convert time string to minutes
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/*---------------*/

// Improved Loader using Fetch to properly handle 404 errors
async function loadCSVFromURL(url) {
    // We use fetch first because PapaParse's 'download' mode doesn't report 404s well
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`File not found (Status: ${response.status})`);
    }
    const csvData = await response.text();
    
    return new Promise((resolve, reject) => {
        Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (error) => reject(error)
        });
    });
}

// Function to load and parse CSV data
async function loadCSVData() {
    // We add a timestamp (?t=) to the URL to force the browser to bypass its cache
    const fileName = `https://raw.githubusercontent.com/himo-tech/cmam-prayer-time/refs/heads/main/prayer-time/${currentYear}-prayer-time.csv?t=${Date.now()}`;
    try {
        const data = await loadCSVFromURL(fileName);
        const mappedPrayerTimes = {};
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].date) {
                const date = data[i].date;
                mappedPrayerTimes[date] = {
                    fajr: data[i].fajr,
                    zuhr: data[i].zuhr,
                    asr: data[i].asr,
                    maghrib: data[i].maghrib,
                    isha: data[i].isha
                };
            }
        }
        return mappedPrayerTimes;
    } catch (error) {
        console.error('CSV Loading Error:', error.message);
        return null;
    }
}

// Iqamah logic for Isha
function ishaIqamahTime(currentPrayerTime, currentIqamahTime) {
    // Special period inclusive: 2026-02-17 → 2026-03-20
    const today = new Date();
    const start = new Date(2026, 1, 17); // Feb 17, 2026 (month is 0-based)
    const end = new Date(2026, 2, 20);   // Mar 20, 2026

    const inSpecialPeriod = today >= start && today <= end;
    if (inSpecialPeriod) {
        const day = today.getDay(); // Sunday = 0, Saturday = 6
        const forcedIqamah = (day === 0 || day === 6) ? '20:45' : '21:00';
        return forcedIqamah;
    }

    // Original logic for the rest of the year
    const prayerTimeMinutes = timeToMinutes(currentPrayerTime);
    const iqamahTimeMinutes = timeToMinutes(currentIqamahTime);

    if (prayerTimeMinutes < 1170 && iqamahTimeMinutes <= 1170) {
        return '19:30';
    } else if (prayerTimeMinutes < 1290 && iqamahTimeMinutes > 1290) {
        return '21:30';
    } else if (prayerTimeMinutes >= 1290) {
        return currentPrayerTime;
    } else {
        return currentIqamahTime;
    }
}

// Iqamah logic for Zuhr
function zuhrIqamahTime(currentPrayerTime, currentIqamahTime) {
    const iqamahTimeMinutes = timeToMinutes(currentIqamahTime);
    const minimumIqamahTime = timeToMinutes('13:15');
    return (iqamahTimeMinutes < minimumIqamahTime) ? '12:30' : currentIqamahTime;
}

// Global Iqamah Selector
function getIqamahTime (salatName, time, iqamahTimeValue) {
    if (salatName.toLowerCase() === 'isha') return ishaIqamahTime(time, addMinutes(time, iqamahTimeValue));
    if (salatName.toLowerCase() === 'zuhr') return zuhrIqamahTime(time, addMinutes(time, iqamahTimeValue));
    return addMinutes(time, iqamahTimeValue);
}

// Create the visual UI cards
function createPrayerCards() {
    if (!prayerTimes) return;
    const prayerCardsContainer = document.getElementById('prayer-cards');
    if (!prayerCardsContainer) return;
    
    prayerCardsContainer.innerHTML = ''; 
    for (const [name, time] of Object.entries(prayerTimes)) {
        const iqamah = getIqamahTime(name, time, iqamahTime[name.toLowerCase()]);
        const card = document.createElement('div');
        card.className = 'prayer-card';
        card.id = name;
        card.innerHTML = `
            <div class="prayer-name">${name.toUpperCase()}</div>
            <div class="prayer-time">Adhan: ${time}</div>
            <div class="prayer-time">Iqamah: ${iqamah}</div>
        `;
        prayerCardsContainer.appendChild(card);
    }
}

function highlightPrayerCard(id) {
    const card = document.getElementById(id);
    if (card) card.classList.add('highlighted');
}

function resetPrayerCards() {
    const cards = document.getElementsByClassName('prayer-card');
    for(let i=0; i<cards.length; i++) {
        cards[i].className = 'prayer-card';
    }
}

function formatDateInFrench(date) {
    const daysInFrench = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const monthsInFrench = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${daysInFrench[date.getDay()]} ${date.getDate().toString().padStart(2, '0')} ${monthsInFrench[date.getMonth()]} ${date.getFullYear()}`;
}

// Main Initialization Function
async function initializeApp() {
    try {
        const prayerTimesData = await loadCSVData();
        
        // Match the DD-MM-YYYY format in your CSV
        const day = String(currentDate.getDate()).padStart(2, '0');
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const year = currentDate.getFullYear();
        const todayKey = `${day}-${month}-${year}`;

        if (prayerTimesData && prayerTimesData[todayKey]) {
            prayerTimes = prayerTimesData[todayKey];
            
            // Apply Isha offset if needed
            if (prayerTimes.isha) {
                prayerTimes.isha = addMinutes(prayerTimes.isha, 4);
            }
            
            createPrayerCards();
            safeSetTextContent('date', formatDateInFrench(currentDate));
            safeSetTextContent('error-message', ''); // Clear errors
        } else {
            throw new Error("Date key not found: " + todayKey);
        }
    } catch (error) {
        console.error('Initialization failed:', error.message);
        prayerTimes = null; // Keeps logic in "retry" mode
    }
}

// Clock Loop: Runs every 1 second
function updateClockAndTimer() {
    const now = new Date(); 
    const currentTimeFormatted = now.toTimeString().slice(0, 8);
    const currentTimeMinutes = timeToMinutes(currentTimeFormatted.slice(0, 5));

    safeSetTextContent('clock', currentTimeFormatted);

    // --- RETRY LOGIC IF DATA IS MISSING ---
    if (!prayerTimes) {
        safeSetTextContent('timer', 'Reconnexion aux horaires...');
        if (!isRetrying) {
            isRetrying = true;
            console.log("Scheduling retry in 60 seconds...");
            setTimeout(async () => {
                await initializeApp();
                isRetrying = false; // Reset lock after attempt
            }, 60000);
        }
        return;
    }

    // Handle Date Rollover (New Day)
    if (now.getDate() !== currentDate.getDate()) {
        currentDate = now;
        initializeApp();
        return;
    } else {
        safeSetTextContent('date', formatDateInFrench(now));
    }

    resetPrayerCards();

    // --- PRAYER CALCULATIONS ---
    let currentPrayer = null;
    let nextPrayer = null;
    const prayerNames = Object.keys(prayerTimes);
    let nextAdhanFound = false;

    for (let i = 0; i < prayerNames.length; i++) {
        const name = prayerNames[i];
        const adhanTime = prayerTimes[name];
        const adhanTimeMinutes = timeToMinutes(adhanTime);

        if (currentTimeMinutes < adhanTimeMinutes) {
            nextPrayer = { name: name, time: adhanTime };
            nextAdhanFound = true;
            if (i > 0) {
                const prevName = prayerNames[i - 1];
                const prevTime = prayerTimes[prevName];
                const prevIqamahTime = getIqamahTime(prevName, prevTime, iqamahTime[prevName.toLowerCase()]);
                currentPrayer = { name: prevName, time: prevTime, iqamahTime: prevIqamahTime };
            }
            break;
        }
    }

    if (!nextAdhanFound) {
        const lastPrayerName = prayerNames[prayerNames.length - 1];
        const lastPrayerTime = prayerTimes[lastPrayerName];
        const lastIqamah = getIqamahTime(lastPrayerName, lastPrayerTime, iqamahTime[lastPrayerName.toLowerCase()]);
        currentPrayer = { name: lastPrayerName, time: lastPrayerTime, iqamahTime: lastIqamah };
        nextPrayer = { name: prayerNames[0], time: prayerTimes[prayerNames[0]] };
    }

    // --- HIGHLIGHTING ---
    if (currentPrayer && (currentTimeMinutes < timeToMinutes(currentPrayer.iqamahTime) ||
        (now - new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...currentPrayer.iqamahTime.split(':'))) <= 30 * 60 * 1000)) {
        highlightPrayerCard(currentPrayer.name);
    } else {
        highlightPrayerCard(nextPrayer.name);
    }

    // --- TIMER DISPLAY ---
    let timerText = '';
    const isBeforeFirstPrayer = currentTimeMinutes < timeToMinutes(prayerTimes[prayerNames[0]]);

    if (currentPrayer) {
        const iqamahMoment = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...currentPrayer.iqamahTime.split(':'));
        const timeSinceIqamah = now - iqamahMoment;

        if (currentTimeMinutes < timeToMinutes(currentPrayer.iqamahTime)) {
            const timeToIqamah = iqamahMoment - now;
            const mins = Math.floor(timeToIqamah / 60000);
            const secs = Math.floor((timeToIqamah % 60000) / 1000);
            timerText = `Iqamah ${currentPrayer.name.toUpperCase()}: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else if (timeSinceIqamah <= 30 * 60 * 1000 || (currentPrayer.name === 'isha' && !isBeforeFirstPrayer)) {
            timerText = `Salat ${currentPrayer.name.toUpperCase()}`;
        } else {
            const nextAdhan = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...nextPrayer.time.split(':'));
            if (nextAdhan < now) nextAdhan.setDate(nextAdhan.getDate() + 1);
            const diff = nextAdhan - now;
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            timerText = `Prochaine: ${nextPrayer.name.toUpperCase()} dans ${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    } else {
        const nextAdhan = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...nextPrayer.time.split(':'));
        const diff = nextAdhan - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        timerText = `Prochaine: ${nextPrayer.name.toUpperCase()} dans ${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    safeSetTextContent('timer', timerText);
}

// Entry Point
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setInterval(updateClockAndTimer, 1000);
});
