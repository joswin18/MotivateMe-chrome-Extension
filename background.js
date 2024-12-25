chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "dailyQuote") {
    const settings = await chrome.storage.local.get("settings");
    if (settings.settings?.notifications) {
      try {
        // Try to get cached quotes
        const cached = await chrome.storage.local.get("cachedQuotes");
        let quotes = cached.cachedQuotes;

        if (!quotes || !quotes.length) {
          const response = await fetch("https://type.fit/api/quotes");
          if (!response.ok) throw new Error("Failed to fetch quotes");
          quotes = await response.json();
          await chrome.storage.local.set({ cachedQuotes: quotes });
        }

        const randomIndex = Math.floor(Math.random() * quotes.length);
        const quote = quotes[randomIndex];

        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "Daily Motivation",
          message: `"${quote.text}" - ${quote.author || "Unknown"}`,
          priority: 2,
        });
      } catch (error) {
        console.error("Error in alarm handler:", error);
      }
    }
  }
});

// Handle installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // Set default settings
    await chrome.storage.local.set({
      settings: {
        notifications: true,
        notificationTime: "09:00",
      },
    });

    // Set up initial alarm
    const [hours, minutes] = "09:00".split(":");
    chrome.alarms.create("dailyQuote", {
      when: getNextNotificationTime(hours, minutes),
      periodInMinutes: 24 * 60,
    });
  }
});

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
