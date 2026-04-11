# HandyBot

An AI handyman in your pocket. Take a photo of something broken in your house, and Claude walks you through how to fix it — step by step. Each repair gets its own workspace where you can keep uploading more photos and talking to HandyBot as the work progresses.

## Features

- **Photo-first diagnosis.** Snap a picture of the problem; Claude's vision model identifies the issue and gives you a plain-English fix.
- **One workspace per repair.** Each issue has its own chat thread so the model can track context and progress over time.
- **Follow-up photos.** Upload another picture mid-repair and keep the conversation going.
- **Dead-simple settings.** Sign out or delete everything, that's it.
- **Local-first.** No backend database — your repairs live in your browser's storage.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- `@anthropic-ai/sdk` with Claude Sonnet 4.6 (vision)
- `localStorage` for issue persistence

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add your Anthropic API key:

   ```bash
   cp .env.example .env.local
   # then edit .env.local and paste your key
   ```

   Get an API key at https://console.anthropic.com/.

3. Run the dev server:

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser. On mobile, add it to your home screen for a native-feeling experience.

## How it works

- The client uploads an image (resized client-side to keep storage small) and posts the conversation history to `/api/chat`.
- The API route calls Claude with a handyman-tuned system prompt and returns the text response.
- For the first message in a new issue, the model emits a one-line `TITLE: ...` header that the app strips out and uses as the issue title on the home page.
- Everything — issues, messages, images — is stored in `localStorage`. There is no backend database.

## Project layout

```
app/
  api/chat/route.ts      # Claude API endpoint (vision + text)
  issues/new/page.tsx    # Upload a photo, create a new issue
  issues/[id]/page.tsx   # Issue workspace (chat thread)
  settings/page.tsx      # Sign out / delete account
  page.tsx               # Home — list of issues
components/
  Chat.tsx               # Chat thread with image attachments
  ImageUpload.tsx        # Camera/file picker with resizing
  IssueCard.tsx          # Home-page issue card
  Nav.tsx                # Top nav
lib/
  image.ts               # Client-side image resizing helpers
  storage.ts             # localStorage wrappers
  types.ts               # Shared types
```

## Notes and limitations

- `localStorage` holds roughly 5–10 MB per origin. Images are automatically resized down to ~1024 px on the long edge and JPEG-compressed, but a heavy user will still hit the cap. For a real launch, swap the storage layer for a proper database + object store.
- The "account" is just a locally-generated ID. There is no real authentication.
- HandyBot is not a licensed tradesperson — it will flag safety-critical work but always double-check before tackling anything electrical, gas, or structural.
