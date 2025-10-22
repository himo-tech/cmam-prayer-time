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
                   // isha: addMinutes(data[i].isha, 4)
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
    //} else if (prayerTimeMinutes > 1170 && prayerTimeMinutes < 1260 && iqamahTimeMinutes <= 1260) {
    //    return '21:00';
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
    const minimumIqamahTime = timeToMinutes('13:15');  // 750 minutes

    if (iqamahTimeMinutes < minimumIqamahTime) {
        return '13:00';
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
/**
 * Updates the real-time clock, current date display, and prayer timer countdown.
 * It also manages highlighting of the current or next prayer card.
 * This function is designed to be called repeatedly (e.g., every second).
 */
function updateClockAndTimer() {
    const now = new Date(); // Get the current date and time
    const currentTimeFormatted = now.toTimeString().slice(0, 8); // Format current time as HH:MM:SS
    // Convert current time to total minutes from midnight for easier numerical comparison
    const currentTimeMinutes = timeToMinutes(currentTimeFormatted.slice(0, 5));

    // Display the current time on the webpage
    safeSetTextContent('clock', currentTimeFormatted);

    // --- Handle Date Change ---
    // Check if the current date has rolled over to a new day
    if (now.getDate() !== currentDate.getDate()) {
        currentDate = now; // Update the global currentDate
        initializeApp();    // Re-initialize the app to load prayer times for the new day
        return;             // Exit the function early to prevent calculations with stale data
    } else {
        // If it's still the same day, just update the French date display
        const frenchDate = formatDateInFrench(now);
        safeSetTextContent('date', frenchDate);
    }

    // --- Check if Prayer Times Data is Loaded ---
    // If prayerTimes global variable is not yet populated (e.g., on initial load or CSV error),
    // display a loading message and exit.
    if (!prayerTimes) {
        safeSetTextContent('timer', 'Chargement des horaires...');
        return;
    }

    // --- Reset all prayer cards to clear any existing highlights ---
    resetPrayerCards();

    // --- Determine Current and Next Prayer (Adhan Times) ---
    let currentPrayer = null; // Represents the prayer whose Adhan has already passed
    let nextPrayer = null;    // Represents the next prayer whose Adhan is upcoming
    const prayerNames = Object.keys(prayerTimes); // Get prayer names in their defined order (e.g., Fajr, Zuhr...)

    let nextAdhanFound = false; // Flag to track if the next upcoming Adhan has been identified

    // Iterate through all prayer times to find the current and next prayer
    for (let i = 0; i < prayerNames.length; i++) {
        const name = prayerNames[i];
        const adhanTime = prayerTimes[name]; // Adhan time string (e.g., "05:00")
        const adhanTimeMinutes = timeToMinutes(adhanTime); // Adhan time in minutes from midnight

        if (currentTimeMinutes < adhanTimeMinutes) {
            // This 'name' is the first prayer whose Adhan time is *still in the future*.
            // So, this is our 'nextPrayer'.
            nextPrayer = { name: name, time: adhanTime };
            nextAdhanFound = true;

            // The 'currentPrayer' is the one immediately before this 'nextPrayer', if it exists.
            if (i > 0) {
                const prevName = prayerNames[i - 1];
                const prevTime = prayerTimes[prevName];
                // IMPORTANT FIX: Use getIqamahTime to get the CORRECT Iqamah time for currentPrayer,
                // accounting for Zuhr/Isha specific rules.
                const prevIqamahTime = getIqamahTime(prevName, prevTime, iqamahTime[prevName.toLowerCase()]);
                currentPrayer = { name: prevName, time: prevTime, iqamahTime: prevIqamahTime };
            }
            break; // We've found our next prayer, no need to check further prayers in the loop
        }
    }

    // --- Handle Edge Case: We are past all Adhans for today (after Isha) ---
    // If no 'nextAdhanFound' means the current time is past the Adhan of the last prayer (Isha)
    if (!nextAdhanFound) {
        // The 'currentPrayer' is the last one in the list (Isha)
        const lastPrayerName = prayerNames[prayerNames.length - 1];
        const lastPrayerTime = prayerTimes[lastPrayerName];
        // IMPORTANT FIX: Use getIqamahTime for Isha's Iqamah calculation
        const lastPrayerIqamahTime = getIqamahTime(lastPrayerName, lastPrayerTime, iqamahTime[lastPrayerName.toLowerCase()]);
        currentPrayer = { name: lastPrayerName, time: lastPrayerTime, iqamahTime: lastPrayerIqamahTime };

        // The 'nextPrayer' in this case is Fajr of the *next* calendar day.
        // We set it to today's Fajr initially; the timer calculation will correctly adjust its date.
        nextPrayer = { name: prayerNames[0], time: prayerTimes[prayerNames[0]] };
    }

    // --- Highlight the appropriate prayer card based on current state ---
    // Check if the current time is before the Iqamah of the current prayer,
    // OR if we are within the "Salat active" window (30 mins after Iqamah).
    // This defines when the 'currentPrayer' card should remain highlighted.
    if (currentPrayer && (currentTimeMinutes < timeToMinutes(currentPrayer.iqamahTime) ||
                         (now - new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...currentPrayer.iqamahTime.split(':'))) <= 30 * 60 * 1000) ) {
        highlightPrayerCard(currentPrayer.name);
    } else {
        // Otherwise, highlight the next upcoming prayer (e.g., if before Fajr,
        // or after the 30-min window for the previous prayer has closed).
        highlightPrayerCard(nextPrayer.name);
    }


    // --- Calculate and display the timer text ---
    let timerText = '';
    // Flag to check if the current time is before the very first prayer (Fajr) of the day
    const isBeforeFirstPrayer = currentTimeMinutes < timeToMinutes(prayerTimes[prayerNames[0]]);

    if (currentPrayer) {
        // Create a Date object for the exact moment of the current prayer's Iqamah
        // This is safe because currentPrayer.iqamahTime now holds the correctly adjusted time
        const iqamahMoment = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...currentPrayer.iqamahTime.split(':'));
        const timeSinceIqamah = now - iqamahMoment; // Difference in milliseconds (positive if past Iqamah)

        if (currentTimeMinutes < timeToMinutes(currentPrayer.iqamahTime)) {
            // Scenario 1: Current time is BEFORE the Iqamah of the current prayer
            const timeToIqamah = iqamahMoment - now; // Time remaining till Iqamah (in milliseconds)
            const minutesToIqamah = Math.floor(timeToIqamah / 60000);
            const secondsToIqamah = Math.floor((timeToIqamah % 60000) / 1000);
            timerText = `L'Iqamah est dans: ${minutesToIqamah.toString().padStart(2, '0')}:${secondsToIqamah.toString().padStart(2, '0')}`;
        } else if (timeSinceIqamah <= 30 * 60 * 1000 || (currentPrayer.name === 'isha' && !isBeforeFirstPrayer)) {
            // Scenario 2: Current time is within 30 minutes AFTER the Iqamah of the current prayer,
            // OR if it's Isha prayer and we are still before midnight (Isha often has a longer "active" window)
            // This indicates the prayer is likely being performed or has just concluded.
            timerText = `Salat ${currentPrayer.name.toUpperCase()}`;
        } else {
            // Scenario 3: Current time is MORE than 30 minutes AFTER the Iqamah of the current prayer
            // (or it's Isha and we've crossed midnight).
            // We now count down to the NEXT prayer's ADHAN.

            // Create a Date object for the exact moment of the next prayer's Adhan.
            // Initially, this is set for today's date.
            const nextPrayerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...nextPrayer.time.split(':'));

            // Crucial check: If the next prayer time (which might be Fajr of tomorrow) is
            // numerically earlier than the current 'now' time, it means it belongs to the next day.
            if (nextPrayerTime < now) {
                nextPrayerTime.setDate(nextPrayerTime.getDate() + 1); // Advance the date by one day
            }

            const timeToNextPrayer = nextPrayerTime - now; // Time remaining till next Adhan (in milliseconds)
            const hoursToNextPrayer = Math.floor(timeToNextPrayer / 3600000);
            const minutesToNextPrayer = Math.floor((timeToNextPrayer % 3600000) / 60000);
            const secondsToNextPrayer = Math.floor((timeToNextPrayer % 60000) / 1000);
            timerText = `Prochaine prière: ${nextPrayer.name.toUpperCase()} dans ${hoursToNextPrayer.toString().padStart(2, '0')}:${minutesToNextPrayer.toString().padStart(2, '0')}:${secondsToNextPrayer.toString().padStart(2, '0')}`;
        }
    } else {
        // Scenario 4: No 'currentPrayer' identified. This means we are before the very first prayer
        // (Fajr) of the day. We only have a 'nextPrayer' (which is Fajr).
        // Count down directly to the next prayer (Fajr) Adhan.
        const nextPrayerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...nextPrayer.time.split(':'));
        const timeToNextPrayer = nextPrayerTime - now;
        const hoursToNextPrayer = Math.floor(timeToNextPrayer / 3600000);
        const minutesToNextPrayer = Math.floor((timeToNextPrayer % 3600000) / 60000);
        const secondsToNextPrayer = Math.floor((timeToNextPrayer % 60000) / 1000);
        timerText = `Prochaine prière: ${nextPrayer.name.toUpperCase()} dans ${hoursToNextPrayer.toString().padStart(2, '0')}:${minutesToNextPrayer.toString().padStart(2, '0')}:${secondsToNextPrayer.toString().padStart(2, '0')}`;
    }

    // Display the calculated timer text on the webpage
    safeSetTextContent('timer', timerText);
}



// function updateClockAndTimer() {
//     const now = new Date();
//     const currentTime = now.toTimeString().slice(0, 8);  // Include seconds
//     safeSetTextContent('clock', currentTime);

//     // Check if it's a new day
//     if (now.getDate() !== currentDate.getDate()) {
//         currentDate = now;
//         initializeApp(); // Reload prayer times for the new day
//     } else {
//         // Update the French date display
//         const frenchDate = formatDateInFrench(now);
//         safeSetTextContent('date', frenchDate);
//     }

//     if (!prayerTimes) return;

//     // Find the current and next prayer times
//     let currentPrayer = null;
//     let nextPrayer = null;
//     const prayerNames = Object.keys(prayerTimes);
    
//     for (let i = 0; i < prayerNames.length; i++) {
//         const name = prayerNames[i];
//         const time = prayerTimes[name];
//         const prayerIqamahTime = addMinutes(time, iqamahTime[name.toLowerCase()]);
        
//         if (currentTime.slice(0, 5) >= time && (i === prayerNames.length - 1 || currentTime.slice(0, 5) < prayerTimes[prayerNames[i+1]])) {
//             currentPrayer = { name, time, iqamahTime: prayerIqamahTime };
//             nextPrayer = i === prayerNames.length - 1 ? { name: prayerNames[0], time: prayerTimes[prayerNames[0]] } : { name: prayerNames[i+1], time: prayerTimes[prayerNames[i+1]] };
//             break;
//         }
//     }

//     if (!currentPrayer) {
//         // If no current prayer found, it means we're before the first prayer of the day
//         nextPrayer = { name: prayerNames[0], time: prayerTimes[prayerNames[0]] };
//         resetPrayerCards();
//         highlightPrayerCard(nextPrayer.name);
//     } else {
//         resetPrayerCards();
//         highlightPrayerCard(currentPrayer.name);
//     }

//     let timerText = '';
//     const isPastMidnight = currentTime.slice(0, 5) < prayerTimes[prayerNames[0]];

//     if (currentPrayer) {
//         const iqamahMoment = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...currentPrayer.iqamahTime.split(':'));
//         const timeSinceIqamah = now - iqamahMoment;

//         if (currentTime.slice(0, 5) < currentPrayer.iqamahTime) {
//             // Before Iqamah
//             const timeToIqamah = iqamahMoment - now;
//             const minutesToIqamah = Math.floor(timeToIqamah / 60000);
//             const secondsToIqamah = Math.floor((timeToIqamah % 60000) / 1000);
//             timerText = `L'Iqamah est dans: ${minutesToIqamah.toString().padStart(2, '0')}:${secondsToIqamah.toString().padStart(2, '0')}`;
//         } else if (timeSinceIqamah <= 30 * 60 * 1000 || (currentPrayer.name === 'isha' && !isPastMidnight)) {
//             // Within 30 minutes after Iqamah or Isha before midnight
//             timerText = `Salat ${currentPrayer.name.toUpperCase()}`;
//         } else if (currentPrayer.name !== 'isha' || isPastMidnight) {
//             // More than 30 minutes after Iqamah (except for Isha) or past midnight
//             const nextPrayerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...nextPrayer.time.split(':'));
//             if (nextPrayerTime < now) nextPrayerTime.setDate(nextPrayerTime.getDate() + 1);
//             const timeToNextPrayer = nextPrayerTime - now;
//             const hoursToNextPrayer = Math.floor(timeToNextPrayer / 3600000);
//             const minutesToNextPrayer = Math.floor((timeToNextPrayer % 3600000) / 60000);
//             const secondsToNextPrayer = Math.floor((timeToNextPrayer % 60000) / 1000);
//             timerText = `Prochaine prière: ${nextPrayer.name.toUpperCase()} dans ${hoursToNextPrayer.toString().padStart(2, '0')}:${minutesToNextPrayer.toString().padStart(2, '0')}:${secondsToNextPrayer.toString().padStart(2, '0')}`;
//             resetPrayerCards();
//             highlightPrayerCard(nextPrayer.name);
//         }
//     } else {
//         // Before the first prayer of the day
//         const nextPrayerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ...nextPrayer.time.split(':'));
//         const timeToNextPrayer = nextPrayerTime - now;
//         const hoursToNextPrayer = Math.floor(timeToNextPrayer / 3600000);
//         const minutesToNextPrayer = Math.floor((timeToNextPrayer % 3600000) / 60000);
//         const secondsToNextPrayer = Math.floor((timeToNextPrayer % 60000) / 1000);
//         timerText = `Prochaine prière: ${nextPrayer.name.toUpperCase()} dans ${hoursToNextPrayer.toString().padStart(2, '0')}:${minutesToNextPrayer.toString().padStart(2, '0')}:${secondsToNextPrayer.toString().padStart(2, '0')}`;
//         resetPrayerCards();
//         highlightPrayerCard(nextPrayer.name);
//     }

//     safeSetTextContent('timer', timerText);
// }

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
            if (prayerTimes && prayerTimes.isha) {
                prayerTimes.isha = addMinutes(prayerTimes.isha, 4);
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
