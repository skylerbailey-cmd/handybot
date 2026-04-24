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
- **Recurring maintenance reminders with push notifications.** A dedicated Reminders screen ships with 20+ research-backed home-maintenance tasks (HVAC filters, gutter cleaning, smoke alarm tests, water heater flushes, etc.) plus per-category groupings. Flip any of them on and HandyBot schedules a local notification via `expo-notifications` — iOS and Android both get a native push when the reminder is due. Claude also attaches context-specific `suggested_reminders` to every plan; once you complete the last step of a repair, a "Keep it fixed" card appears offering one-tap enable for the relevant follow-ups (e.g. after a filter swap, Claude suggests "Change HVAC air filter every 3 months").
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

2. **Set up environment.** Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key:

   ```bash
   cp .env.example .env
   # edit .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
   ```

   The Anthropic API key lives server-side as a Supabase Edge Function secret — see deployment instructions in `lib/claude.ts`.

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

## Landing Page Website

The `index.html`, `css/`, and `js/` directories contain a static landing page for HandyBot. It showcases all the app features with interactive mockups.

```
index.html        # Landing page
css/styles.css    # Styles (brand color: #ea580c)
js/main.js        # Interactivity and animations
images/           # Image assets
```

To preview the website locally:

```bash
python3 -m http.server 8000
# or
npx serve .
```

## API key security

All Claude API calls are proxied through a Supabase Edge Function (`supabase/functions/claude-proxy/`). The Anthropic API key is stored as a server-side secret and is **never** shipped in the client bundle. The proxy handles authentication, tier-based quotas, rate limiting, and kids-safe mode enforcement.

To set or rotate the key:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy claude-proxy
```

## Notes and limitations

- `AsyncStorage` is fine for a few hundred issues of text; images are stored as JPEG files on disk, not inside AsyncStorage, so you won't hit the 6 MB per-key limit easily.
- The "account" is just a locally-generated ID. There is no real authentication.
- HandyBot is not a licensed tradesperson — it will flag safety-critical work but always double-check before tackling anything electrical, gas, or structural.
- Web builds work via `npm run web`, but camera capture is limited in the browser — for the full experience, run on a real phone.

## Contact

support@grnd-lab.com
