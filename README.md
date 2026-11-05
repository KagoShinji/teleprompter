# Cue — Teleprompter Studio

A mobile-first Next.js recording studio with an adjustable teleprompter and browser-based video capture.

## Get started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Camera and microphone access works on localhost and on deployed HTTPS origins. Grant both permissions when prompted.

## Features

- Responsive layout designed for phone and desktop screens
- Edit-in-place teleprompter with adjustable text size and scroll speed
- Portrait (9:16) and landscape (16:9) camera framing with matching video output
- The live preview includes the teleprompter, while saved recordings use a separate clean camera feed without prompt text
- Portrait capture requests a native portrait camera aspect ratio and preserves the full source image if the device cannot provide it
- Live camera preview, front-camera mirror, fullscreen recording controls, recording timer, retake, and local download
- A persistent mobile recording dock keeps camera and take controls reachable while scrolling
- Media is captured by the browser and is not uploaded by this app
- Optional Firebase app and Storage initialization for future cloud saves

## Firebase

`.env.local` is prefilled with the Firebase web app configuration provided for this project. `lib/firebase.ts` initializes the Firebase app and Storage only when all values are present. Analytics support is available through `getFirebaseAnalytics()` for client-side use. No Firebase configuration is needed to run the local recording experience.

## Recording notes

The browser's `MediaRecorder` API and supported container/codec vary by device. The app selects a supported recording format where possible. Recordings remain in memory until downloaded or the page is closed.
