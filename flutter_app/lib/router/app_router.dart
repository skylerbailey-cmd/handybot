import 'package:go_router/go_router.dart';

import '../screens/ask_screen.dart';
import '../screens/history_screen.dart';
import '../screens/home_screen.dart';
import '../screens/homes_screen.dart';
import '../screens/inventory_edit_screen.dart';
import '../screens/inventory_screen.dart';
import '../screens/issue_screen.dart';
import '../screens/manual_repair_screen.dart';
import '../screens/new_issue_screen.dart';
import '../screens/new_reminder_screen.dart';
import '../screens/reminder_edit_screen.dart';
import '../screens/reminders_screen.dart';
import '../screens/settings_screen.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    GoRoute(path: '/new', builder: (_, __) => const NewIssueScreen()),
    GoRoute(
      path: '/issue/:id',
      builder: (context, state) =>
          IssueScreen(issueId: state.pathParameters['id']!),
    ),
    GoRoute(path: '/ask', builder: (_, __) => const AskScreen()),
    GoRoute(path: '/inventory', builder: (_, __) => const InventoryScreen()),
    GoRoute(
      path: '/inventory-edit',
      builder: (context, state) => InventoryEditScreen(
        itemId: state.uri.queryParameters['id'],
      ),
    ),
    GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
    GoRoute(
      path: '/manual-repair',
      builder: (_, __) => const ManualRepairScreen(),
    ),
    GoRoute(path: '/homes', builder: (_, __) => const HomesScreen()),
    GoRoute(
      path: '/reminders',
      builder: (context, state) => RemindersScreen(
        highlight: state.uri.queryParameters['highlight'],
      ),
    ),
    GoRoute(
      path: '/reminder/new',
      builder: (context, state) => NewReminderScreen(
        templateId: state.uri.queryParameters['templateId'],
      ),
    ),
    GoRoute(
      path: '/reminder/:id',
      builder: (context, state) =>
          ReminderEditScreen(reminderId: state.pathParameters['id']!),
    ),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
  ],
);
