chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('Alarm triggered:', alarm.name);
    if (alarm.name === 'dailyQuote') {
        const settings = await chrome.storage.local.get('settings');
        console.log('Current settings:', settings);
        if (settings.settings?.notifications) {
            try {
                const quote = await fetchRandomQuote();
                if (quote) {
                    console.log('Fetched quote:', quote);
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/logo.png',
                        title: 'Daily Motivation',
                        message: `"${quote.q}" - ${quote.a || 'Unknown'}`,
                        priority: 2
                    }, (notificationId) => {
                        console.log('Notification created with ID:', notificationId);
                    });
                } else {
                    console.error('Failed to fetch a quote');
                }
            } catch (error) {
                console.error('Error in alarm handler:', error);
            }
        } else {
            console.log('Notifications are disabled in settings');
        }
    }
});

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed or updated:', details.reason);
    if (details.reason === 'install') {
        await chrome.storage.local.set({
            settings: {
                notifications: true,
                notificationTime: '09:00'
            }
        });
        console.log('Default settings set');
        updateAlarm();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    if (message.action === 'updateAlarm') {
        updateAlarm();
    }
});

async function fetchRandomQuote() {
    try {
        const response = await fetch('https://zenquotes.io/api/random');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const quotes = await response.json();
        return quotes[0];
    } catch (error) {
        console.error('Failed to fetch quote:', error);
        return null;
    }
}

async function updateAlarm() {
    const settings = await chrome.storage.local.get('settings');
    console.log('Updating alarm with settings:', settings);
    if (settings.settings?.notifications) {
        const [hours, minutes] = settings.settings.notificationTime.split(':');
        const when = getNextNotificationTime(hours, minutes);
        chrome.alarms.create('dailyQuote', {
            when: when,
            periodInMinutes: 24 * 60
        }, () => {
            console.log('Alarm created for:', new Date(when));
        });
    } else {
        chrome.alarms.clear('dailyQuote', (wasCleared) => {
            console.log('Alarm cleared:', wasCleared);
        });
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

    if (notification <= now) {
        notification.setDate(notification.getDate() + 1);
    }

    return notification.getTime();
}

