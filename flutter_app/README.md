# HandyBot — Flutter port

This directory contains a Flutter port of the HandyBot app (originally built
with Expo / React Native — still living at the repo root). The Expo version
is untouched; both can coexist while the Flutter port is tested and brought
to feature parity.

## Status

All 14 screens, 19 widgets, and the full service layer (Claude API client,
image picker, reminders + local notifications, SharedPreferences-backed
storage, multi-home scoping, paid-tier subscription toggle) are ported. The
Supabase cloud-sync layer is scaffolded via `supabase_flutter` but the
remote-sync helpers (`cloud/*.ts` in the TS source) are left as a TODO hook
inside `StorageService.saveIssues` — they can be added without touching the
rest of the app.

## Layout

```
flutter_app/
├── pubspec.yaml
├── analysis_options.yaml
├── .env.example            API keys for --dart-define (do not commit real keys)
└── lib/
    ├── main.dart           App bootstrap (multi-home migration, notif setup)
    ├── models/
    │   └── models.dart     All TS interfaces ported to Dart with JSON
    ├── theme/
    │   └── app_theme.dart  Color tokens + ThemeData + formatMoney/Duration
    ├── services/
    │   ├── claude_service.dart   Anthropic HTTP client (plan / chat /
    │   │                         verify / manual verify / ask / analyze)
    │   ├── claude_prompts.dart   System prompts (verbatim)
    │   ├── claude_tools.dart     Tool-use JSON schemas
    │   ├── storage_service.dart      Issue + user persistence
    │   ├── subscription_service.dart Paid/free tier toggle
    │   ├── homes_service.dart        Multi-home CRUD + storage-prefix
    │   ├── image_service.dart        Camera/library + resize + persist
    │   ├── reminders_service.dart    Schedule + CRUD via flutter_local_notifications
    │   ├── reminder_templates.dart   20 built-in maintenance templates
    │   └── home_data_service.dart    Ask log + home inventory CRUD
    ├── widgets/
    │   ├── primary_button.dart, difficulty_badge.dart, segmented_tabs.dart,
    │   │   checklist_row.dart, message_bubble.dart, typing_indicator.dart,
    │   │   image_picker_button.dart
    │   ├── issue_card.dart, plan_view.dart, risk_card.dart,
    │   │   verification_card.dart, plan_proposal_card.dart,
    │   │   interactive_stepper.dart, step_help_modal.dart
    │   └── reminder_row.dart, template_row.dart, reminder_form.dart,
    │       upcoming_reminders_card.dart, suggested_reminders_card.dart
    ├── router/
    │   └── app_router.dart  go_router config for all 14 routes
    └── screens/
        ├── home_screen.dart, new_issue_screen.dart, issue_screen.dart
        ├── ask_screen.dart, manual_repair_screen.dart
        ├── reminders_screen.dart, new_reminder_screen.dart,
        │   reminder_edit_screen.dart
        ├── homes_screen.dart
        ├── history_screen.dart
        ├── inventory_screen.dart, inventory_edit_screen.dart
        └── settings_screen.dart
```

## Running it

```bash
cd flutter_app
flutter pub get

# Dev run (replace with your own keys):
flutter run \
  --dart-define=ANTHROPIC_API_KEY=sk-ant-... \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=sb_publishable_...
```

The Anthropic API key is required; the Supabase keys are only needed for
future cloud-sync work. As with the Expo version, shipping the Anthropic
key inside the app bundle is only acceptable for development — for a
production build, route Claude calls through your own backend.

### Platform setup

This port uses the `image_picker`, `flutter_local_notifications`, and
`supabase_flutter` plugins. First-time platform setup:

- **iOS** (`ios/Runner/Info.plist`): add `NSCameraUsageDescription` and
  `NSPhotoLibraryUsageDescription` matching the Expo strings in the original
  `app.json`.
- **Android** (`android/app/src/main/AndroidManifest.xml`): declare
  `CAMERA`, `POST_NOTIFICATIONS`, and the scheduled-notification permission
  `SCHEDULE_EXACT_ALARM` if you want exact triggers.

The iOS and Android project directories are not committed yet — generate
them with `flutter create .` from inside `flutter_app/` and commit the
platform folders when you're ready to build.

## Mapping back to the Expo source

| Original file (`/`)                 | Flutter equivalent                               |
| ----------------------------------- | ------------------------------------------------ |
| `lib/types.ts`                      | `lib/models/models.dart`                         |
| `lib/theme.ts`                      | `lib/theme/app_theme.dart`                       |
| `lib/claude.ts`                     | `lib/services/claude_service.dart` (+ prompts / tools) |
| `lib/storage.ts`                    | `lib/services/storage_service.dart`              |
| `lib/homes.ts`                      | `lib/services/homes_service.dart`                |
| `lib/image.ts`                      | `lib/services/image_service.dart`                |
| `lib/reminders.ts`                  | `lib/services/reminders_service.dart`            |
| `lib/reminderTemplates.ts`          | `lib/services/reminder_templates.dart`           |
| `lib/homeData.ts`                   | `lib/services/home_data_service.dart`            |
| `lib/subscription.ts`               | `lib/services/subscription_service.dart`         |
| `lib/cloud/*.ts`                    | (TODO — stub in StorageService)                  |
| `app/_layout.tsx`                   | `lib/main.dart` + `lib/router/app_router.dart`   |
| `app/*.tsx` (14 screens)            | `lib/screens/*_screen.dart`                      |
| `components/*.tsx` (19 components)  | `lib/widgets/*.dart`                             |

## Known gaps vs. the Expo version

1. **Cloud sync.** `supabase_flutter` is in `pubspec.yaml` but the per-entity
   sync helpers (`issuesRemote.ts`, `photosRemote.ts`, etc.) are not yet
   ported. The `StorageService.saveIssues` has a TODO comment where the
   Supabase push should land.
2. **Deep-link-from-notification cold start.** `main.dart` configures the
   plugin but does not yet route on payload. The `/reminders?highlight=<id>`
   route is ready; wiring the cold-start deep link takes a follow-up PR.
3. **Platform folders.** `ios/` and `android/` directories are not committed.
   Run `flutter create .` inside `flutter_app/` once to materialize them.

Everything else — Claude plan generation, vision, tool-use proposals, the
step-by-step walkthrough with "don't mess this up" warnings, verification,
reminder scheduling with `flutter_local_notifications`, multi-home, the
Ask HandyBot Q&A, the home inventory with AI-analysis, the lifetime savings
tracker — is functionally equivalent to the TypeScript source.
