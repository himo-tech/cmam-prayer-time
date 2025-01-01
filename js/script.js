// Global variables
let prayerTimes = null;
let currentDate = new Date();
const currentYear = new Date().getFullYear().toString();
const iqamahTime = {fajr: 20, zuhr: 15, asr: 15, maghrib: 5, isha: 10};

/*--Utiles Functions--*/

// Function to safely set text content of an element
function safeSetTextContent(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`Element with id "${id}" not found`);
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
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/*---------------*/

// Get CSV file from google drive
function loadCSVFromURL(url) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true, // Set to true if your CSV has headers
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject('Error parsing CSV: ' + error);
        }
      });
    });
}

// Function to load and parse CSV data
async function loadCSVData() {
    const fileName = `https://raw.githubusercontent.com/himo-tech/cmam-prayer-time/refs/heads/main/prayer-time/${currentYear}-prayer-time.csv`;
    try {
        const data = await loadCSVFromURL(fileName);
        console.log('CSV data:', data);
        const prayerTimes = {};
        for (let i = 0; i < data.length; i++) {
            if (data[i]) {
                const date = data[i].date;
                prayerTimes[date] = {
                    fajr: data[i].fajr,
                    zuhr: data[i].zuhr,
                    asr: data[i].asr,
                    maghrib: data[i].maghrib,
                    isha: data[i].isha
                };
            }
        }
        return prayerTimes;
    } catch (error) {
        console.error('Error loading or parsing CSV:', error);
        return null;
    }
}

// Function to determine Iqamah time for Isha
function ishaIqamahTime(currentPrayerTime, currentIqamahTime) {
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

// Function to determine Iqamah time for zuhr
function zuhrIqamahTime(currentPrayerTime, currentIqamahTime) {
    const iqamahTimeMinutes = timeToMinutes(currentIqamahTime);
    const minimumIqamahTime = timeToMinutes('12:30');  // 735 minutes

    if (iqamahTimeMinutes < minimumIqamahTime) {
        return '12:15';
    } else {
        return currentIqamahTime;
    }
}

// function to get Iqamah time
function getIqamahTime (salatName, time, iqamahTime) {
    if (salatName.toLowerCase() === 'isha') {
        return ishaIqamahTime(time, addMinutes(time, iqamahTime))
    } else if (salatName.toLowerCase() === 'zuhr') {
        return zuhrIqamahTime(time, addMinutes(time, iqamahTime))
    } else {
        return addMinutes(time, iqamahTime)
    }
}


// Create prayer cards
function createPrayerCards() {
    if (!prayerTimes) return;
    const prayerCardsContainer = document.getElementById('prayer-cards');
    if (!prayerCardsContainer) {
        console.warn('Prayer cards container not found');
        return;
    }
    prayerCardsContainer.innerHTML = ''; // Clear existing cards
    for (const [name, time] of Object.entries(prayerTimes)) {
        const iqamah = getIqamahTime(name, time, iqamahTime[name])
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

// Highlight a prayer card
function highlightPrayerCard(id) {
    const card = document.getElementById(id);
    card.classList.add('highlighted');
}

// Reset prayer cards classes
function resetPrayerCards() {
    const cards = document.getElementsByClassName('prayer-card')
    for(let i=0; i<cards.length; i++){
        const card = cards[i];
        card.className = 'prayer-card';
    };
}


//format in french
function formatDateInFrench(date) {
    const daysInFrench = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const monthsInFrench = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    const dayOfWeek = daysInFrench[date.getDay()];
    const dayOfMonth = date.getDate().toString().padStart(2, '0');
    const month = monthsInFrench[date.getMonth()];
    const year = date.getFullYear();

    return `${dayOfWeek} ${dayOfMonth} ${month} ${year}`;
}

// Update clock and timer
function updateClockAndTimer() {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);  // Include seconds
    safeSetTextContent('clock', currentTime);

    // Check if it's a new day
    if (now.getDate() !== currentDate.getDate()) {
        currentDate = now;
        initializeApp(); // Reload prayer times for the new day
    } else {
        // Update the French date display
        const frenchDate = formatDateInFrench(now);
        safeSetTextContent('date', frenchDate);
    }

    if (!prayerTimes) return;

    // Find the current and next prayer times
    let currentPrayer = null;
    let nextPrayer = null;
    const prayerNames = Object.keys(prayerTimes);
    
    for (let i = 0; i < prayerNames.length; i++) {
        const name = prayerNames[i];
        const time = prayerTimes[name];
        const prayerIqamahTime = addMinutes(time, iqamahTime[name.toLowerCase()]);
        
        if (currentTime.slice(0, 5) >= time && (i === prayerNames.length - 1 || currentTime.slice(0, 5) < prayerTimes[prayerNames[i+1]])) {
            currentPrayer = { name, time, iqamahTime: prayerIqamahTime };
            nextPrayer = i === prayerNames.length - 1 ? { name: prayerNames[0], time: prayerTimes[prayerNames[0]] } : { name: prayerNames[i+1], time: prayerTimes[prayerNames[i+1]] };
            break;
        }
    }

    if (!currentPrayer) {
        // If no current prayer found, it means we're before the first prayer of the day
        nextPrayer = { name: prayerNames[0], time: prayerTimes[prayerNames[0]] };
        resetPrayerCards();
        highlightPrayerCard(nextPrayer.name);
    } else {
        resetPrayerCards();
        highlightPrayerCard(currentPrayer.name);
    }

    let timerText = '';
    const isPastMidnight = currentTime.slice(0, 5) < prayerTimes[prayerNames[0]];

    if (currentPrayer) {
        const iqamahMoment = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...currentPrayer.iqamahTime.split(':'));
        const timeSinceIqamah = now - iqamahMoment;

        if (currentTime.slice(0, 5) < currentPrayer.iqamahTime) {
            // Before Iqamah
            const timeToIqamah = iqamahMoment - now;
            const minutesToIqamah = Math.floor(timeToIqamah / 60000);
            const secondsToIqamah = Math.floor((timeToIqamah % 60000) / 1000);
            timerText = `L'Iqamah est dans: ${minutesToIqamah.toString().padStart(2, '0')}:${secondsToIqamah.toString().padStart(2, '0')}`;
        } else if (timeSinceIqamah <= 30 * 60 * 1000 || (currentPrayer.name === 'isha' && !isPastMidnight)) {
            // Within 30 minutes after Iqamah or Isha before midnight
            timerText = `Salat ${currentPrayer.name.toUpperCase()}`;
        } else if (currentPrayer.name !== 'isha' || isPastMidnight) {
            // More than 30 minutes after Iqamah (except for Isha) or past midnight
            const nextPrayerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...nextPrayer.time.split(':'));
            if (nextPrayerTime < now) nextPrayerTime.setDate(nextPrayerTime.getDate() + 1);
            const timeToNextPrayer = nextPrayerTime - now;
            const hoursToNextPrayer = Math.floor(timeToNextPrayer / 3600000);
            const minutesToNextPrayer = Math.floor((timeToNextPrayer % 3600000) / 60000);
            const secondsToNextPrayer = Math.floor((timeToNextPrayer % 60000) / 1000);
            timerText = `Prochaine prière: ${nextPrayer.name.toUpperCase()} dans ${hoursToNextPrayer.toString().padStart(2, '0')}:${minutesToNextPrayer.toString().padStart(2, '0')}:${secondsToNextPrayer.toString().padStart(2, '0')}`;
            resetPrayerCards();
            highlightPrayerCard(nextPrayer.name);
        }
    } else {
        // Before the first prayer of the day
        const nextPrayerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...nextPrayer.time.split(':'));
        const timeToNextPrayer = nextPrayerTime - now;
        const hoursToNextPrayer = Math.floor(timeToNextPrayer / 3600000);
        const minutesToNextPrayer = Math.floor((timeToNextPrayer % 3600000) / 60000);
        const secondsToNextPrayer = Math.floor((timeToNextPrayer % 60000) / 1000);
        timerText = `Prochaine prière: ${nextPrayer.name.toUpperCase()} dans ${hoursToNextPrayer.toString().padStart(2, '0')}:${minutesToNextPrayer.toString().padStart(2, '0')}:${secondsToNextPrayer.toString().padStart(2, '0')}`;
        resetPrayerCards();
        highlightPrayerCard(nextPrayer.name);
    }

    safeSetTextContent('timer', timerText);
}

// Initialize the application
async function initializeApp() {
    try {
        const prayerTimesData = await loadCSVData();
        const today = currentDate.toISOString().split('T')[0].split('-').reverse().join('-');
        if (prayerTimesData) {
            prayerTimes = prayerTimesData[today];
            if (!prayerTimes) {
                throw new Error('Prayer times not found for today');
            }
            createPrayerCards();
            updateClockAndTimer();
            
            // Update the date display
            const frenchDate = formatDateInFrench(currentDate);
            safeSetTextContent('date', frenchDate);
        }
    } catch (error) {
        console.error('Failed to initialize app:', error);
        safeSetTextContent('error-message', 'Failed to load prayer times. Please try again later.');
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    // Update every second
    setInterval(updateClockAndTimer, 1000);
});
