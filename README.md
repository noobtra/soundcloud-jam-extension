# SoundCloud Jam

A Chrome extension that brings Spotify Jam-like listening sessions to SoundCloud. Create a jam, share the invite link, and listen together in sync — when the host plays a track, everyone hears it.

## Features

- **Create & join jams** via invite codes or shareable links
- **Force sync playback** — host plays a track, all members auto-play it
- **Live user list** with avatars, usernames, and now-playing info
- **Auto-join links** — share `https://soundcloud.com?jam=CODE` and the extension handles the rest
- **SoundCloud profile detection** — automatically picks up your logged-in identity
- **Single-tab pinning** — only the tab you started the jam in is active, no conflicts with other SC tabs
- **Auto-leave** — closing or navigating away from the jam tab cleanly exits the session

## How It Works

The extension hooks into SoundCloud's internal webpack modules to detect and control playback. A background service worker manages the WebSocket connection to the [jam server](https://github.com/noobtra/soundcloud-jam-server), routing track changes and play commands between session members.

```
SoundCloud Page (MAIN world)
        ↕ window.postMessage
Content Script Bridge (ISOLATED world)
        ↕ chrome.runtime messaging
Background Service Worker ← WebSocket → Jam Server
        ↕ chrome.runtime messaging
Popup UI (React)
```

## Tech Stack

- **WXT** — extension framework
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Chrome Manifest V3**

## Project Structure

```
src/
├── entrypoints/
│   ├── background.ts              # Service worker — WS, state, tab management
│   ├── soundcloud.content.ts      # ISOLATED bridge — user scraping, auto-join
│   ├── soundcloud-main.content.ts # MAIN world — webpack hooking, playback control
│   └── popup/                     # React popup UI
├── components/                    # UI components
├── hooks/                         # React hooks
└── lib/
    ├── protocol/                  # Shared types, message builders, constants
    ├── messaging/                 # Internal extension message types
    ├── state/                     # JamState store with persistence
    └── websocket/                 # WebSocket client with reconnect + queue
```

## Setup

### Prerequisites

- Node.js 18+
- The [SoundCloud Jam Server](https://github.com/noobtra/soundcloud-jam-server) running

### Install & Build

```bash
npm install
npm run build
```

### Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3` directory

### Development

```bash
npm run dev
```

WXT will watch for changes and hot-reload the extension.

## Server

This extension connects to a WebSocket server that coordinates jam sessions. See the server repo:

**[soundcloud-jam-server](https://github.com/noobtra/soundcloud-jam-server)**

By default the extension connects to `ws://127.0.0.1:9005/ws`. Update `src/lib/protocol/constants.ts` to point to your server.

## License

MIT
