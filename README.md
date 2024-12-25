# Motivate Me Chrome Extension

A Chrome extension that provides daily motivation and inspiration through quotes. Features include daily notifications, favorite quotes management, and quote sharing.

## Features

- 🎯 Random motivational quotes
- 💖 Save favorite quotes
- 🔔 Daily notifications
- 📤 Share quotes
- 💾 Offline support with quote caching
- ⚙️ Customizable notification settings
- 🎨 Modern, responsive UI


### API Used

The extension uses the [Type.fit Quotes API](https://zenquotes.io/api/quotes) for fetching motivational quotes.

### Local Storage

The extension uses Chrome's storage API to store:
- Cached quotes for offline use
- Favorite quotes
- User settings
- Notification preferences

## Troubleshooting

1. If quotes aren't loading:
   - Check your internet connection
   - Verify the API is accessible
   - Check the console for errors

2. If notifications aren't working:
   - Ensure notifications are enabled in Chrome
   - Check if the correct permissions are in manifest.json
   - Verify notification settings in the extension

3. If the extension doesn't load:
   - Verify all required files are present
   - Check the console for loading errors
   - Ensure manifest.json is properly formatted

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
