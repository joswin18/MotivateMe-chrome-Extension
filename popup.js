function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    chrome.storage.local.set({ darkMode: document.body.classList.contains('dark-mode') });
}

function loadDarkModePreference() {
    chrome.storage.local.get('darkMode', (result) => {
        if (result.darkMode) {
            document.body.classList.add('dark-mode');
            document.getElementById('darkModeToggle').checked = true;
        }
    });
}

const FALLBACK_QUOTES = [
    { content: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { content: "Life is what happens to you while you're busy making other plans.", author: "John Lennon" },
    { content: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" }
];

let currentQuote = null;
let apiFailCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    loadSettings();
    generateQuote(true); // Force initial API fetch

    // Event listeners for main functionality
    document.getElementById('generate').addEventListener('click', () => generateQuote(true));
    document.getElementById('favorite').addEventListener('click', saveQuote);
    document.getElementById('share').addEventListener('click', shareQuote);

    // Settings related event listeners
    document.getElementById('settings').addEventListener('click', toggleSettings);
    document.getElementById('viewFavorites').addEventListener('click', showFavorites);
    document.getElementById('closeFavorites').addEventListener('click', () => {
        document.getElementById('favorites-view').classList.add('hidden');
        toggleSettings(); // This will show either main view or settings view
    });
    document.getElementById('clearData').addEventListener('click', clearAllData);

    // Add event listener for dark mode toggle
    document.getElementById('darkModeToggle').addEventListener('change', toggleDarkMode);

    // Load dark mode preference
    loadDarkModePreference();

    // Load settings when the extension opens
    loadSettings();
});

async function generateQuote(forceApiFetch = false) {
    const quoteElement = document.getElementById('quote');
    const authorElement = document.getElementById('author');
    const errorElement = document.getElementById('error');

    try {
        quoteElement.textContent = 'Loading...';
        authorElement.textContent = '';
        errorElement.style.display = 'none';

        let quotes = null;

        // If forced API fetch or no cached quotes, fetch from API
        if (forceApiFetch) {
            console.log('Forcing API fetch...');
            quotes = await fetchQuotesFromAPI();
        } else {
            // Try to get cached quotes first
            const cached = await chrome.storage.local.get('cachedQuotes');
            quotes = cached.cachedQuotes;

            if (!quotes || !quotes.length) {
                console.log('Fetching quotes from API...');
                quotes = await fetchQuotesFromAPI();
            } else {
                // Check if cache is older than 24 hours
                const lastUpdate = (await chrome.storage.local.get('lastCacheUpdate')).lastCacheUpdate;
                if (lastUpdate && (new Date().getTime() - lastUpdate > 24 * 60 * 60 * 1000)) {
                    console.log('Cache is older than 24 hours. Refreshing...');
                    quotes = await fetchQuotesFromAPI();
                }
            }
        }

        // Check if API fetch was successful
        if (!quotes || !quotes.length) {
            throw new Error('No quotes available.');
        }

        // Select a random quote
        const randomIndex = Math.floor(Math.random() * quotes.length);
        currentQuote = quotes[randomIndex];

        // Update the quote and author
        quoteElement.textContent = `"${currentQuote.q}"`;
        authorElement.textContent = currentQuote.a || 'Unknown';

        // Reset API fail count if a successful quote is retrieved
        apiFailCount = 0;

        // Cache the quotes if fetched from API
        if (forceApiFetch || !cached.cachedQuotes) {
            await chrome.storage.local.set({ 
                cachedQuotes: quotes,
                lastCacheUpdate: new Date().getTime()
            });
        }

    } catch (error) {
        console.error('Error:', error);
        apiFailCount++;

        if (apiFailCount > 3) {
            console.log('Using fallback quotes due to repeated API failures');
            quotes = FALLBACK_QUOTES;
            const randomIndex = Math.floor(Math.random() * quotes.length);
            currentQuote = quotes[randomIndex];
            quoteElement.textContent = `"${currentQuote.content}"`;
            authorElement.textContent = currentQuote.author || 'Unknown';
        } else {
            errorElement.textContent = `Failed to fetch quote. Please try again. (Attempt ${apiFailCount}/3)`;
            errorElement.style.display = 'block';
        }
    }
}

// Fetch quotes from the API
async function fetchQuotesFromAPI() {
    try {
        const response = await fetch('https://zenquotes.io/api/random');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const quotes = await response.json();
        return quotes;
    } catch (error) {
        console.error('Failed to fetch from API:', error);
        return [];
    }
}

async function saveQuote() {
    if (!currentQuote) {
        showMessage('No quote to save!', 'warning');
        return;
    }

    try {
        const result = await chrome.storage.local.get('favorites');
        const favorites = result.favorites || [];

        const quoteToSave = {
            q: currentQuote.q || currentQuote.content,
            a: currentQuote.a || currentQuote.author || 'Unknown'
        };

        if (!favorites.some(q => q.q === quoteToSave.q && q.a === quoteToSave.a)) {
            favorites.push(quoteToSave);
            await chrome.storage.local.set({ favorites });
            
            showMessage('Quote saved to favorites!', 'success');
        } else {
            showMessage('Quote already in favorites!', 'warning');
        }
    } catch (error) {
        console.error('Error saving quote:', error);
        showMessage('Failed to save quote', 'error');
    }
}

async function shareQuote() {
    if (!currentQuote) return;

    const text = `"${currentQuote.q}" - ${currentQuote.a || 'Unknown'}`;
    
    try {
        await navigator.clipboard.writeText(text);
        showMessage('Quote copied to clipboard!', 'success');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showMessage('Failed to copy quote', 'error');
    }
}

function showMessage(message, type = 'error') {
    const errorElement = document.getElementById('error');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    switch (type) {
        case 'success':
            errorElement.style.color = '#27ae60';
            break;
        case 'warning':
            errorElement.style.color = '#f39c12';
            break;
        case 'error':
            errorElement.style.color = '#e74c3c';
            break;
    }

    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 2000);
}

function toggleSettings() {
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    const favoritesView = document.getElementById('favorites-view');
    const settingsToggle = document.getElementById('settings');
    
    if (favoritesView.classList.contains('hidden')) {
        // We're either in main view or settings view
        if (settingsView.classList.contains('hidden')) {
            // We're in main view, switch to settings
            mainView.classList.add('hidden');
            settingsView.classList.remove('hidden');
            settingsToggle.textContent = '🏠';
        } else {
            // We're in settings view, switch to main
            settingsView.classList.add('hidden');
            mainView.classList.remove('hidden');
            settingsToggle.textContent = '⚙️';
        }
    } else {
        // We're in favorites view, switch to settings
        favoritesView.classList.add('hidden');
        settingsView.classList.remove('hidden');
        settingsToggle.textContent = '🏠';
    }
}


async function loadSettings() {
    const settings = await chrome.storage.local.get('settings');
    if (settings.settings) {
        document.getElementById('enableNotifications').checked = settings.settings.notifications;
        document.getElementById('notificationTime').value = settings.settings.notificationTime;
    }
    loadDarkModePreference();
}

async function updateNotificationSettings() {
    const notifications = document.getElementById('enableNotifications').checked;
    const notificationTime = document.getElementById('notificationTime').value;

    await chrome.storage.local.set({
        settings: { notifications, notificationTime }
    });

    // Update alarm
    if (notifications) {
        const [hours, minutes] = notificationTime.split(':');
        chrome.alarms.create('dailyQuote', {
            when: getNextNotificationTime(hours, minutes),
            periodInMinutes: 24 * 60
        });
    } else {
        chrome.alarms.clear('dailyQuote');
    }
}

function getNextNotificationTime(hours, minutes) {
    const now = new Date();
    const notification = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        parseInt(hours),
        parseInt(minutes)
    );

    if (notification < now) {
        notification.setDate(notification.getDate() + 1);
    }

    return notification.getTime();
}

async function showFavorites() {
    const favoritesView = document.getElementById('favorites-view');
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    
    // Add search input
    const searchContainer = document.createElement('div');
    searchContainer.innerHTML = `
        <input type="text" id="searchInput" placeholder="Search favorites...">
        <button id="searchButton">Search</button>
    `;
    favoritesView.insertBefore(searchContainer, favoritesView.firstChild);

    // Add event listener for search button
    document.getElementById('searchButton').addEventListener('click', searchFavorites);

    // Add event listener for input to search as you type
    document.getElementById('searchInput').addEventListener('input', searchFavorites);

    searchFavorites(); // Initial search to show all favorites or "No quotes saved" message

    favoritesView.classList.remove('hidden');
    mainView.classList.add('hidden');
    settingsView.classList.add('hidden');
}

async function removeFavorite(event) {
    const index = event.target.dataset.index;
    const result = await chrome.storage.local.get('favorites');
    const favorites = result.favorites || [];
    
    favorites.splice(index, 1);
    await chrome.storage.local.set({ favorites });
    
    searchFavorites(); // Update the list after removing a favorite
}

async function clearAllData() {
    if (confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
        await chrome.storage.local.clear();
        showMessage('All data cleared!', 'success');
        loadSettings();
        generateQuote(true);
    }
}


async function searchFavorites() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const favoritesList = document.getElementById('favoritesList');
    const result = await chrome.storage.local.get('favorites');
    const favorites = result.favorites || [];

    favoritesList.innerHTML = '';

    if (favorites.length === 0) {
        favoritesList.innerHTML = '<p>No quotes saved</p>';
        return;
    }

    const filteredFavorites = favorites.filter(quote => 
        quote.q.toLowerCase().includes(searchTerm) || 
        quote.a.toLowerCase().includes(searchTerm)
    );

    if (filteredFavorites.length === 0) {
        favoritesList.innerHTML = '<p>No matching quotes found</p>';
    } else {
        filteredFavorites.forEach((quote, index) => {
            const div = document.createElement('div');
            div.className = 'favorite-item';
            div.innerHTML = `
                "${quote.q}" - ${quote.a || 'Unknown'}
                <span class="remove-favorite" data-index="${index}">❌</span>
            `;
            favoritesList.appendChild(div);
        });
    }

    // Add event listeners for remove buttons
    const removeButtons = document.querySelectorAll('.remove-favorite');
    removeButtons.forEach(button => {
        button.addEventListener('click', removeFavorite);
    });
}

function hideSettings() {
    document.getElementById('settings-view').classList.add('hidden');
    document.getElementById('favorites-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');
}



async function loadSettings() {
    const settings = await chrome.storage.local.get('settings');
    if (settings.settings) {
        document.getElementById('enableNotifications').checked = settings.settings.notifications;
        document.getElementById('notificationTime').value = settings.settings.notificationTime;
    }
}

async function updateNotificationSettings() {
    const notifications = document.getElementById('enableNotifications').checked;
    const notificationTime = document.getElementById('notificationTime').value;

    await chrome.storage.local.set({
        settings: { notifications, notificationTime }
    });

    // Update alarm
    if (notifications) {
        const [hours, minutes] = notificationTime.split(':');
        chrome.alarms.create('dailyQuote', {
            when: getNextNotificationTime(hours, minutes),
            periodInMinutes: 24 * 60
        });
    } else {
        chrome.alarms.clear('dailyQuote');
    }
}

function getNextNotificationTime(hours, minutes) {
    const now = new Date();
    const notification = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        parseInt(hours),
        parseInt(minutes)
    );

    if (notification < now) {
        notification.setDate(notification.getDate() + 1);
    }

    return notification.getTime();
}

// ... (previous code remains unchanged)

async function showFavorites() {
    const favoritesView = document.getElementById('favorites-view');
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    
    favoritesView.classList.remove('hidden');
    mainView.classList.add('hidden');
    settingsView.classList.add('hidden');

    const searchInput = document.getElementById('searchInput');
    const favoritesList = document.getElementById('favoritesList');
    
    searchInput.value = '';
    favoritesList.innerHTML = '';

    const result = await chrome.storage.local.get('favorites');
    const favorites = result.favorites || [];

    if (favorites.length === 0) {
        favoritesList.innerHTML = '<p>No quotes saved</p>';
    } else {
        displayFavorites(favorites);
    }

    searchInput.addEventListener('input', handleSearchInput);
    searchInput.focus();
}

function displayFavorites(favorites) {
    const favoritesList = document.getElementById('favoritesList');
    favoritesList.innerHTML = '';

    favorites.forEach((quote, index) => {
        const div = document.createElement('div');
        div.className = 'favorite-item';
        div.innerHTML = `
            <p class="quote-text">"${quote.q}"</p>
            <p class="quote-author">- ${quote.a || 'Unknown'}</p>
            <button class="remove-favorite" data-index="${index}">Remove</button>
        `;
        favoritesList.appendChild(div);
    });

    const removeButtons = favoritesList.querySelectorAll('.remove-favorite');
    removeButtons.forEach(button => {
        button.addEventListener('click', removeFavorite);
    });
}

async function handleSearchInput(event) {
    const searchTerm = event.target.value.toLowerCase();
    const result = await chrome.storage.local.get('favorites');
    const favorites = result.favorites || [];

    const filteredFavorites = favorites.filter(quote => 
        quote.q.toLowerCase().includes(searchTerm) || 
        quote.a.toLowerCase().includes(searchTerm)
    );

    if (filteredFavorites.length === 0) {
        document.getElementById('favoritesList').innerHTML = '<p>No matching quotes found</p>';
    } else {
        displayFavorites(filteredFavorites);
    }
}

async function removeFavorite(event) {
    const index = parseInt(event.target.dataset.index);
    const result = await chrome.storage.local.get('favorites');
    const favorites = result.favorites || [];
    
    favorites.splice(index, 1);
    await chrome.storage.local.set({ favorites });
    
    const searchInput = document.getElementById('searchInput');
    handleSearchInput({ target: searchInput });
}

// ... (rest of the code remains unchanged)


async function clearAllData() {
    if (confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
        await chrome.storage.local.clear();
        showMessage('All data cleared!', 'success');
        loadSettings();
        generateQuote(true);
    }
}

