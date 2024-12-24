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
    generateQuote();

    // Event listeners for main functionality
    document.getElementById('generate').addEventListener('click', generateQuote);
    document.getElementById('favorite').addEventListener('click', saveQuote);
    document.getElementById('share').addEventListener('click', shareQuote);

    // Settings view handlers
    document.getElementById('settings').addEventListener('click', showSettings);
    document.getElementById('closeSettings').addEventListener('click', hideSettings);
    document.getElementById('viewFavorites').addEventListener('click', showFavorites);
    document.getElementById('closeFavorites').addEventListener('click', hideSettings);
    document.getElementById('clearData').addEventListener('click', clearAllData);

    // Settings change handlers
    document.getElementById('enableNotifications').addEventListener('change', updateNotificationSettings);
    document.getElementById('notificationTime').addEventListener('change', updateNotificationSettings);
});

async function generateQuote() {
    const quoteElement = document.getElementById('quote');
    const authorElement = document.getElementById('author');
    const errorElement = document.getElementById('error');

    try {
        quoteElement.textContent = 'Loading...';
        authorElement.textContent = '';
        errorElement.style.display = 'none';

        // Try to get cached quotes first
        const cached = await chrome.storage.local.get('cachedQuotes');
        let quotes = cached.cachedQuotes;

        if (!quotes || !quotes.length) {
            console.log('Fetching quotes from API...');
            // Fetch multiple quotes at once for caching
            const response = await fetch('https://zenquotes.io/api/random');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
            }
            quotes = await response.json();
            console.log('Quotes fetched successfully:', quotes);

            // Cache the quotes
            await chrome.storage.local.set({ 
                cachedQuotes: quotes,
                lastCacheUpdate: new Date().getTime()
            });
        }

        // Check if cache is older than 24 hours
        const lastUpdate = (await chrome.storage.local.get('lastCacheUpdate')).lastCacheUpdate;
        if (lastUpdate && (new Date().getTime() - lastUpdate > 24 * 60 * 60 * 1000)) {
            // Refresh cache in background
            fetch('https://zenquotes.io/api/random')
                .then(response => response.json())
                .then(async newQuotes => {
                    await chrome.storage.local.set({ 
                        cachedQuotes: newQuotes,
                        lastCacheUpdate: new Date().getTime()
                    });
                })
                .catch(console.error);
        }

        if (apiFailCount > 3) {
            throw new Error('API failed multiple times, using fallback quotes');
        }

        const randomIndex = Math.floor(Math.random() * quotes.length);
        currentQuote = quotes[randomIndex];

        quoteElement.textContent = `"${currentQuote.q}"`;
        authorElement.textContent = currentQuote.a || 'Unknown';

    } catch (error) {
        console.error('Error:', error);
        apiFailCount++;
        
        if (apiFailCount > 3) {
            console.log('Using fallback quotes due to repeated API failures');
            quotes = FALLBACK_QUOTES;
        } else {
            errorElement.textContent = `Failed to fetch quote. Please try again. (Attempt ${apiFailCount}/3)`;
            errorElement.style.display = 'block';
            return;
        }
    }

    
}

async function saveQuote() {
    if (!currentQuote) return;

    try {
        const result = await chrome.storage.local.get('favorites');
        const favorites = result.favorites || [];

        if (!favorites.some(q => q._id === currentQuote._id)) {
            favorites.push(currentQuote);
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

    const text = `"${currentQuote.content}" - ${currentQuote.author || 'Unknown'}`;
    
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

// Settings functions
function showSettings() {
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('favorites-view').classList.add('hidden');
    document.getElementById('settings-view').classList.remove('hidden');
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

async function showFavorites() {
    const result = await chrome.storage.local.get('favorites');
    const favorites = result.favorites || [];
    const favoritesList = document.getElementById('favoritesList');
    
    favoritesList.innerHTML = '';
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<p>No favorite quotes yet!</p>';
    } else {
        favorites.forEach((quote, index) => {
            const div = document.createElement('div');
            div.className = 'favorite-item';
            div.innerHTML = `
                "${quote.text}" - ${quote.author || 'Unknown'}
                <span class="remove-favorite" data-index="${index}">❌</span>
            `;
            favoritesList.appendChild(div);
        });
    }

    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('settings-view').classList.add('hidden');
    document.getElementById('favorites-view').classList.remove('hidden');

    // Add event listeners for remove buttons
    const removeButtons = document.querySelectorAll('.remove-favorite');
    removeButtons.forEach(button => {
        button.addEventListener('click', removeFavorite);
    });
}

async function removeFavorite(event) {
    const index = event.target.dataset.index;
    const result = await chrome.storage.local.get('favorites');
    const favorites = result.favorites || [];
    
    favorites.splice(index, 1);
    await chrome.storage.local.set({ favorites });
    
    showFavorites();
}

async function clearAllData() {
    if (confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
        await chrome.storage.local.clear();
        showMessage('All data cleared!', 'success');
        loadSettings();
    }
}

