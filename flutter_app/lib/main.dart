import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'router/app_router.dart';
import 'services/homes_service.dart';
import 'services/reminders_service.dart';
import 'services/subscription_service.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarIconBrightness: Brightness.dark,
      statusBarColor: Colors.transparent,
    ),
  );

  // One-time setup: multi-home migration + notification channel + subscription
  // hydration. All best-effort — failures fall back to safe defaults.
  await HomesService.instance.ensureMultiHomeSetup();
  await SubscriptionService.instance.hydrate();
  try {
    await RemindersService.instance.ensureConfigured();
  } catch (_) {/* will re-prompt when Reminders opens */}

  runApp(const HandyBotApp());
}

class HandyBotApp extends StatelessWidget {
  const HandyBotApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'HandyBot',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: appRouter,
    );
  }
}
