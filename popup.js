const FALLBACK_QUOTES = [
    { content: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { content: "Life is what happens to you while you're busy making other plans.", author: "John Lennon" },
    { content: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" }
];


let currentQuote = null;
let apiFailCount = 0;
const quoteElement = document.getElementById('quote');
const authorElement = document.getElementById('author');
const errorElement = document.getElementById('error');
const searchBox=document.querySelector(`input[type="search"]`)

// save data in local
function saveToLocal(data,key)
{
    if(Storage)
    {
      localStorage.setItem(`${key}`,JSON.stringify(data))
    }
    else{
        console.error("the storage is either not available or fullfilled")
    }
}


//get data from localstorage
function getFromLocal()
{
    let parseJsonData=JSON.parse(localStorage.getItem("QuoutesTosearch"))
    return parseJsonData
}

//debounce function for delay
function debounce(delay)
{
let timerid;
return (e) =>{
    clearTimeout(timerid)
    timerid=setTimeout(() =>searchQuote(e),delay)
}
}
let rateLimitQuoteCall=debounce(1000)

//a function to fetch data in bulk run only once as extension is opened for first time
function fetchBulkdata()
{   
    let savedDataForSearch=getFromLocal()
    if(savedDataForSearch===null)
    {
        fetch('https://zenquotes.io/api/quotes').then(
            (res) => res.json()  
        ).then(
            (data) =>
                {   const bulkQuotes=data
                    saveToLocal(bulkQuotes,"QuoutesTosearch")
                } 
        ).catch(
            (e) => console.error("error is something",e)
        ).finally(
            () => console.log("either the promise is resolved or rejectd")
        )
    }
    else{
        console.log("the data is exists no fetch more");
    }
}

//simple search function 
function searchQuote(e)
{ 
 let bulkQuotes=getFromLocal()
 let searchResults=bulkQuotes.filter((quote) =>  quote["q"].includes(`${e.target.value}`))
 console.log("the search data are somethings tath we",searchResults);
 
 if(searchResults.length>0)
 {
     quoteElement.textContent = `"${searchResults[0].q}"`;
     authorElement.textContent = searchResults[0].a || 'Unknown';
     //updating currentQuote to the search results for workign share or local
     currentQuote=searchResults[0]
 }
 else
 {
    quoteElement.textContent=`sorry no result are found`
    authorElement.textContent = `server`;
 }
}

//again generating random quotes as input has unfocused - function
searchBox.addEventListener('blur',() => {
  searchBox.value=""
  generateQuote(true)
})

//a function to call return funtion from debounce for searching function exectuion after a delay
searchBox.addEventListener('input',rateLimitQuoteCall)


document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    loadSettings();
    fetchBulkdata() //as content loads calls api for large data set
    generateQuote(true); // Force initial API fetch

    // Event listeners for main functionality
    document.getElementById('generate').addEventListener('click',() =>generateQuote(true),false)
    document.getElementById('favorite').addEventListener('click', saveQuote);
    document.getElementById('share').addEventListener('click', shareQuote);

    // Settings related event listeners
    document.getElementById('settings').addEventListener('click', toggleSettings);
    document.getElementById('closeSettings').addEventListener('click', hideSettings);
    document.getElementById('viewFavorites').addEventListener('click', showFavorites);
    document.getElementById('closeFavorites').addEventListener('click', hideSettings);
    document.getElementById('clearData').addEventListener('click', clearAllData);
    // Load settings when the extension opens
    loadSettings();
});
searchBox.addEventListener('input',rateLimitQuoteCall)


async function generateQuote(forceApiFetch = false) {
    try {
        quoteElement.textContent = 'Loading...';
        authorElement.textContent = '';
        errorElement.style.display = 'none';

        let quotes = null;

        // If forced API fetch or no cached quotes, fetch from API
        if (forceApiFetch) {
            console.log('Forcing API fetch...');
            quotes = await fetchQuotesFromAPI();
            console.log(quotes);
            console.log("the quotesarea",quotes);
            
        } else {
            // Try to get cached quotes first
            const cached = await chrome.storage.local.get('cachedQuotes');
            quotes = cached.cachedQuotes;
            console.log("the cache ids omsthing",cached);
            

            if (!quotes || !quotes.length) {
                console.log('Fetching quotes from API...');
                quotes = await fetchQuotesFromAPI();
                console.log(quotes);
                
            } else {
                // Check if cache is older than 24 hours
                const lastUpdate = (await chrome.storage.local.get('lastCacheUpdate')).lastCacheUpdate;
                if (lastUpdate && (new Date().getTime() - lastUpdate > 24 * 60 * 60 * 1000)) {
                    console.log('Cache is older than 24 hours. Refreshing...');
                    quotes = await fetchQuotesFromAPI();
                    console.log("test");
                    
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
    
    if (settingsView.classList.contains('hidden')) {
        mainView.classList.add('hidden');
        settingsView.classList.remove('hidden');
    } else {
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
    }
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
                "${quote.q}" - ${quote.a || 'Unknown'}
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
        generateQuote(true);
    }
}

