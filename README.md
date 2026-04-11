# HandyBot

An AI handyman in your pocket. Take a photo of something broken in your house, and Claude walks you through how to fix it — step by step. Each repair gets its own workspace where you can keep uploading more photos and talking to HandyBot as the work progresses.

HandyBot is built with **Expo + React Native**, so it runs on iOS, Android, and the web from a single codebase.

## Features

- **Photo-first diagnosis.** Snap a picture with your camera or pick from your library; Claude's vision model identifies the issue and gives you a plain-English fix.
- **Each repair is a project.** Claude doesn't just reply with prose — it generates a structured repair plan with a difficulty rating, time estimate, tools list, materials list, safety notes, and a numbered step-by-step checklist.
- **Interactive walkthrough.** Work through the repair one step at a time: see the current step front-and-center, tap "Mark complete & continue" to advance, jump backward to revisit, and watch your progress fill in live.
- **DIY savings tracking.** Every plan includes an estimated labor cost of hiring a pro. While you're working, the plan shows "Save ~$180"; when you finish all the steps, it celebrates with "You saved $180 fixing this yourself." The home screen also tallies lifetime savings across all resolved repairs.
- **Risk detection.** Claude flags specific hazards (electrical ⚡, plumbing 🚰, gas 🔥, structural 🏗, height 🪜, chemical ⚗, fire 🔥, sharps 🔪) with a severity level and a category-specific "Call a licensed [electrician/plumber/…]" recommendation when warranted. The warning is advisory — you can still work through the steps, but the hazard is impossible to miss.
- **Ongoing vs Completed on the home screen.** Active repairs stay at the top under **Ongoing**, finished repairs slide into **Completed** with a cumulative savings total so you can see the money you've kept in your pocket.
- **Claude can propose plan updates mid-repair.** When you send a follow-up photo or message, Claude can attach a structured plan-update suggestion (new steps, tools, materials, safety notes, or a revised difficulty/time/savings estimate). You get an inline "Add to plan" / "Not now" card — accepting preserves all your existing progress and just appends the new items.
- **Regenerate plan.** Not happy with the first plan? Tap **Regenerate plan** from the plan tab or overflow menu and HandyBot will build a fresh plan from your original photo.
- **Dead-simple settings.** Sign out or delete everything — that's it.
- **Local-first.** Issue metadata lives in `AsyncStorage`, photos are saved to the app's documents directory. No backend required for the MVP.

## How a repair works

1. Tap **New repair** and photograph the problem.
2. HandyBot analyzes the photo and generates a full **repair plan** via Claude tool use (structured JSON output): title, difficulty, total time, tools, materials, safety notes, and steps.
3. The **Plan tab** opens with an interactive step-by-step walkthrough. The current step is displayed in a large card with its instructions and time estimate; a progress bar and indicator dots show exactly where you are.
4. As you work, tap **Mark complete & continue** to advance. The chat tab is always one tap away for follow-up photos and questions, and Claude has the full plan in its system prompt so it can reference step numbers.

## Stack

- **Expo SDK 51** + React Native 0.74 + expo-router 3
- **Claude Sonnet 4.6** via the Anthropic Messages API (direct `fetch`)
- `expo-image-picker` + `expo-image-manipulator` for camera/library + resize
- `@react-native-async-storage/async-storage` for issue metadata
- `expo-file-system` for persisting images on-device
- TypeScript everywhere

## Getting started

1. **Install dependencies.**

   ```bash
   npm install
   ```

2. **Add your Anthropic API key.** Copy `.env.example` to `.env` and paste your key:

   ```bash
   cp .env.example .env
   # edit .env and set EXPO_PUBLIC_ANTHROPIC_API_KEY
   ```

   Get a key at https://console.anthropic.com/.

3. **Run the app.**

   ```bash
   # iOS simulator (needs Xcode on a Mac)
   npm run ios

   # Android emulator (needs Android Studio)
   npm run android

   # Or run on your real device via Expo Go:
   npm run start
   # then scan the QR code with the Expo Go app
   ```

## How it works

- The user taps **New repair**, which opens the camera / photo library via `expo-image-picker`.
- The picked image is resized to 1280 px on the long edge with `expo-image-manipulator`, then copied into `FileSystem.documentDirectory/handybot/` so it persists.
- `lib/claude.ts` reads the image as base64, posts it to `https://api.anthropic.com/v1/messages` with a handyman-tuned system prompt, and returns the text response.
- For the first message in a new issue, the model emits a one-line `TITLE: ...` header that the app strips and uses as the issue title on the home screen.
- Issue metadata (messages, file URIs, timestamps) is stored in `AsyncStorage`; images live as JPEGs on the filesystem.

## Project layout

```
app/                      # expo-router screens
  _layout.tsx             # Stack navigator + theming
  index.tsx               # Home — list of repairs
  new.tsx                 # Upload a photo, create a new issue
  issue/[id].tsx          # Issue workspace (chat thread)
  settings.tsx            # Sign out / delete account
components/
  IssueCard.tsx           # Home-screen issue row
  MessageBubble.tsx       # Chat bubble with optional image
  ImagePickerButton.tsx   # Camera/library sheet + preview
  TypingIndicator.tsx     # Animated "..." while Claude thinks
  PrimaryButton.tsx       # Shared button styles
lib/
  claude.ts               # fetch-based Claude Messages API client
  image.ts                # expo-image-picker + manipulator + FS helpers
  storage.ts              # AsyncStorage wrappers + file cleanup
  theme.ts                # colors, spacing, radii
  types.ts                # Shared types
```

## Important: API key security

This MVP uses `EXPO_PUBLIC_ANTHROPIC_API_KEY`, which Expo bundles **into the client JavaScript**. That is only acceptable for local development. If you ship this app to the App Store or Play Store with a production key in the bundle, **anyone can extract it**.

For a real launch you must:

1. Stand up a tiny backend (Cloudflare Worker, Vercel function, Fly.io service — anything) that holds the Anthropic key as a server-side secret.
2. Change `lib/claude.ts` so `sendChat` POSTs to your backend instead of directly to `api.anthropic.com`.
3. Add a bit of per-user auth or rate limiting on that proxy so random strangers can't drain your key.

The rest of the app doesn't need to change — `sendChat` is the only place that knows about the network.

## Notes and limitations

- `AsyncStorage` is fine for a few hundred issues of text; images are stored as JPEG files on disk, not inside AsyncStorage, so you won't hit the 6 MB per-key limit easily.
- The "account" is just a locally-generated ID. There is no real authentication.
- HandyBot is not a licensed tradesperson — it will flag safety-critical work but always double-check before tackling anything electrical, gas, or structural.
- Web builds work via `npm run web`, but camera capture is limited in the browser — for the full experience, run on a real phone.
