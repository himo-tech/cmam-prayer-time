// Global variables
let prayerTimes = null;
let currentDate = new Date();
const currentYear = new Date().getFullYear().toString();

// Function to safely set text content of an element
function safeSetTextContent(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`Element with id "${id}" not found`);
    }
}

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
    const fileName = 'https://raw.githubusercontent.com/himo-tech/cmam-prayer-time/3d7bdf57cd42ac3c75882f0adc1b024bd63843e9/2024-prayer-time.csv';
    try {
        const data = await loadCSVFromURL(fileName);
        console.log('CSV data:', data);
        const prayerTimes = {};
        for (let i = 0; i < data.length; i++) {
            if (data) {
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

// Function to add minutes to a time string
function addMinutes(timeStr, minutes) {
    if (!timeStr) return '';
    const [hours, mins] = timeStr.split(':').map(Number);
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hours, mins + minutes);
    return date.toTimeString().slice(0, 5);
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
        const iqamah = addMinutes(time, 10);
        const card = document.createElement('div');
        card.className = 'prayer-card';
        card.innerHTML = `
            <div class="prayer-name">${name}</div>
            <div>Adhan: ${time}</div>
            <div>Iqamah: ${iqamah}</div>
        `;
        prayerCardsContainer.appendChild(card);
    }
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

    // Find the next prayer time
    let nextPrayer = null;
    let isLastPrayer = false;
    for (const [name, time] of Object.entries(prayerTimes)) {
        if (time > currentTime.slice(0, 5)) {
            nextPrayer = { name, time };
            break;
        }
    }
    if (!nextPrayer) {
        nextPrayer = { name: 'FAJR', time: prayerTimes.FAJR };
        isLastPrayer = true;
    }

    const iqamahTime = addMinutes(nextPrayer.time, 10);
    let timeDiff;
    if (isLastPrayer) {
        // For the last prayer, calculate time until midnight
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        timeDiff = midnight - now;
    } else {
        timeDiff = new Date(`${currentDate.toISOString().split('T')[0]}T${iqamahTime}:00`) - now;
    }
    
    const hours = Math.floor(timeDiff / 3600000);
    const minutes = Math.floor((timeDiff % 3600000) / 60000);
    const seconds = Math.floor((timeDiff % 60000) / 1000);

    safeSetTextContent('timer', `Prochaine prière: ${nextPrayer.name} dans ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

    // Highlight current prayer card
    const cards = document.getElementsByClassName('prayer-card');
    for (let i = 0; i < cards.length; i++) {
        const cardName = cards[i].querySelector('.prayer-name').textContent;
        const cardTime = prayerTimes[cardName];
        const cardIqamah = addMinutes(cardTime, 10);
        let isHighlighted;
        
        if (cardName === 'ISHA') {
            // For Isha, highlight until midnight
            isHighlighted = now >= new Date(`${currentDate.toISOString().split('T')[0]}T${cardTime}:00`);
        } else {
            // For other prayers, highlight within 30 minutes of Iqamah
            isHighlighted = now >= new Date(`${currentDate.toISOString().split('T')[0]}T${cardTime}:00`) &&
                            now <= new Date(`${currentDate.toISOString().split('T')[0]}T${addMinutes(cardIqamah, 30)}:00`);
        }
        
        if (isHighlighted) {
            cards[i].classList.add('highlighted');
        } else {
            cards[i].classList.remove('highlighted');
        }
    }
}

// Initialize the application
async function initializeApp() {
    try {
        const prayerTimesData = await loadCSVData();
        const today = currentDate.toISOString().split('T')[0].split('-').reverse().join('-');
        if (!!prayerTimesData) {
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