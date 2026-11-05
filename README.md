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
- Portrait and landscape camera orientation requests; the device's actual camera aspect ratio and full frame are preserved
- The live preview adds a teleprompter overlay, while saved recordings record the original camera/microphone stream directly without prompt text or canvas re-encoding
- If a device/browser cannot provide the requested orientation, the preview fits the original camera frame without zoom or crop and shows a warning
- Live camera preview, front-camera mirror, fullscreen recording controls, recording timer, retake, and local download
- A persistent mobile recording dock keeps camera and take controls reachable while scrolling
- Media is captured by the browser and is not uploaded by this app
- Optional Firebase app and Storage initialization for future cloud saves

## Firebase

`.env.local` is prefilled with the Firebase web app configuration provided for this project. `lib/firebase.ts` initializes the Firebase app and Storage only when all values are present. Analytics support is available through `getFirebaseAnalytics()` for client-side use. No Firebase configuration is needed to run the local recording experience.

## Recording notes

The browser's `MediaRecorder` API and supported container/codec vary by device. The app selects a supported recording format where possible. Recordings remain in memory until downloaded or the page is closed.
