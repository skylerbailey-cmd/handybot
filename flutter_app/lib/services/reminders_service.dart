import 'dart:convert';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest_all.dart' as tzdata;

import '../models/models.dart';
import 'homes_service.dart';

const _dayMs = 24 * 60 * 60 * 1000;
const _channelId = 'maintenance';
const _channelName = 'Maintenance reminders';

/// Reminder scheduling + storage. Ported from lib/reminders.ts.
class RemindersService {
  RemindersService._();
  static final instance = RemindersService._();

  final _notif = FlutterLocalNotificationsPlugin();
  bool _configured = false;
  bool _tzInitialized = false;

  String _key() => '${HomesService.instance.storagePrefix()}reminders';

  /// Idempotent one-time setup for the notification plugin + Android channel.
  Future<void> ensureConfigured() async {
    if (_configured) return;
    if (!_tzInitialized) {
      tzdata.initializeTimeZones();
      _tzInitialized = true;
    }
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _notif.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );
    final androidImpl = _notif.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidImpl != null) {
      await androidImpl.createNotificationChannel(
        const AndroidNotificationChannel(
          _channelId,
          _channelName,
          importance: Importance.defaultImportance,
        ),
      );
    }
    _configured = true;
  }

  Future<bool> requestPermissions() async {
    await ensureConfigured();
    final ios = _notif.resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin>();
    if (ios != null) {
      final ok = await ios.requestPermissions(alert: true, badge: false, sound: true);
      return ok ?? false;
    }
    final android = _notif.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (android != null) {
      final ok = await android.requestNotificationsPermission();
      return ok ?? true;
    }
    return true;
  }

  // --- Storage -----------------------------------------------------------

  Future<List<Reminder>> loadReminders() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key());
      if (raw == null) return [];
      final parsed = jsonDecode(raw);
      if (parsed is! List) return [];
      return parsed
          .whereType<Map>()
          .map((e) => Reminder.fromJson(e.cast<String, dynamic>()))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _save(List<Reminder> reminders) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key(),
      jsonEncode(reminders.map((r) => r.toJson()).toList()),
    );
  }

  Future<Reminder?> get(String id) async {
    for (final r in await loadReminders()) {
      if (r.id == id) return r;
    }
    return null;
  }

  Future<void> _upsert(Reminder reminder) async {
    final all = await loadReminders();
    final idx = all.indexWhere((r) => r.id == reminder.id);
    if (idx >= 0) {
      all[idx] = reminder;
    } else {
      all.insert(0, reminder);
    }
    all.sort((a, b) {
      if (a.enabled != b.enabled) return a.enabled ? -1 : 1;
      return a.nextDue.compareTo(b.nextDue);
    });
    await _save(all);
  }

  // --- Scheduling --------------------------------------------------------

  Future<int?> _schedule(Reminder reminder) async {
    await ensureConfigured();
    final when = DateTime.fromMillisecondsSinceEpoch(reminder.nextDue);
    final at = when.isBefore(DateTime.now().add(const Duration(seconds: 60)))
        ? DateTime.now().add(const Duration(seconds: 60))
        : when;
    final notifId = DateTime.now().millisecondsSinceEpoch & 0x7fffffff;
    try {
      await _notif.zonedSchedule(
        notifId,
        '${reminder.icon}  ${reminder.title}',
        reminder.description?.isNotEmpty == true
            ? reminder.description
            : 'Time to take care of this home-maintenance task.',
        tz.TZDateTime.from(at, tz.local),
        NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            importance: Importance.defaultImportance,
            priority: Priority.defaultPriority,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        payload: reminder.id,
      );
      return notifId;
    } catch (_) {
      return null;
    }
  }

  Future<void> _cancel(int? id) async {
    if (id == null) return;
    try {
      await _notif.cancel(id);
    } catch (_) {/* ignore */}
  }

  // --- High-level API ----------------------------------------------------

  Future<Reminder> createFromTemplate(
    MaintenanceTemplate template,
    DateTime startDate,
  ) async {
    await ensureConfigured();
    await requestPermissions();
    final base = Reminder(
      id: generateId(),
      templateId: template.id,
      title: template.title,
      description: template.description,
      icon: template.icon,
      category: template.category,
      frequencyDays: template.frequencyDays,
      nextDue: startDate.millisecondsSinceEpoch,
      enabled: true,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    final notifId = await _schedule(base);
    final reminder = base.copyWith(notificationId: notifId);
    await _upsert(reminder);
    return reminder;
  }

  Future<Reminder> createFromSuggestion({
    required SuggestedReminder suggestion,
    required DateTime startDate,
    String? category,
    String? sourceIssueId,
  }) async {
    await ensureConfigured();
    await requestPermissions();
    final base = Reminder(
      id: generateId(),
      title: suggestion.title,
      description: suggestion.description,
      icon: suggestion.icon.isNotEmpty ? suggestion.icon : '🛠',
      category: category ?? ReminderCategory.general,
      frequencyDays: suggestion.frequencyDays,
      nextDue: startDate.millisecondsSinceEpoch,
      enabled: true,
      sourceIssueId: sourceIssueId,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    final notifId = await _schedule(base);
    final reminder = base.copyWith(notificationId: notifId);
    await _upsert(reminder);
    return reminder;
  }

  Future<Reminder> createCustom({
    required String title,
    String? description,
    String? icon,
    String? category,
    required int frequencyDays,
    required DateTime startDate,
    String? sourceIssueId,
  }) async {
    await ensureConfigured();
    await requestPermissions();
    final base = Reminder(
      id: generateId(),
      title: title.trim(),
      description: description?.trim().isNotEmpty == true
          ? description!.trim()
          : null,
      icon: (icon ?? '').trim().isNotEmpty ? icon!.trim() : '🛠',
      category: category ?? ReminderCategory.general,
      frequencyDays: frequencyDays,
      nextDue: startDate.millisecondsSinceEpoch,
      enabled: true,
      sourceIssueId: sourceIssueId,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    final notifId = await _schedule(base);
    final reminder = base.copyWith(notificationId: notifId);
    await _upsert(reminder);
    return reminder;
  }

  Future<Reminder?> setEnabled(String reminderId, bool enabled) async {
    final reminder = await get(reminderId);
    if (reminder == null) return null;

    if (!enabled) {
      await _cancel(reminder.notificationId);
      final updated = reminder.copyWith(enabled: false);
      await _upsert(updated);
      return updated;
    }

    int nextDue = reminder.nextDue;
    final now = DateTime.now().millisecondsSinceEpoch;
    if (nextDue <= now) {
      final step = reminder.frequencyDays * _dayMs;
      while (nextDue <= now) {
        nextDue += step;
      }
    }
    final withSched = reminder.copyWith(enabled: true, nextDue: nextDue);
    final notifId = await _schedule(withSched);
    final updated = withSched.copyWith(notificationId: notifId);
    await _upsert(updated);
    return updated;
  }

  Future<Reminder?> reschedule(String reminderId, DateTime newStart) async {
    final reminder = await get(reminderId);
    if (reminder == null) return null;
    await _cancel(reminder.notificationId);
    final updated =
        reminder.copyWith(nextDue: newStart.millisecondsSinceEpoch);
    final notifId = reminder.enabled ? await _schedule(updated) : null;
    final out = updated.copyWith(notificationId: notifId);
    await _upsert(out);
    return out;
  }

  Future<void> delete(String reminderId) async {
    final reminder = await get(reminderId);
    if (reminder == null) return;
    await _cancel(reminder.notificationId);
    final all = (await loadReminders()).where((r) => r.id != reminderId).toList();
    await _save(all);
  }

  Future<Reminder?> markDone(String reminderId) async {
    final reminder = await get(reminderId);
    if (reminder == null) return null;
    await _cancel(reminder.notificationId);
    final nextDue = DateTime.now().millisecondsSinceEpoch +
        reminder.frequencyDays * _dayMs;
    final updated = reminder.copyWith(nextDue: nextDue);
    final notifId = reminder.enabled ? await _schedule(updated) : null;
    final out = updated.copyWith(notificationId: notifId);
    await _upsert(out);
    return out;
  }

  Future<Reminder?> snooze(String reminderId, {int days = 1}) async {
    final reminder = await get(reminderId);
    if (reminder == null) return null;
    await _cancel(reminder.notificationId);
    final nextDue = DateTime.now().millisecondsSinceEpoch + days * _dayMs;
    final updated = reminder.copyWith(nextDue: nextDue);
    final notifId = reminder.enabled ? await _schedule(updated) : null;
    final out = updated.copyWith(notificationId: notifId);
    await _upsert(out);
    return out;
  }

  Future<Reminder?> update({
    required String reminderId,
    String? title,
    String? description,
    String? icon,
    int? frequencyDays,
    int? nextDue,
  }) async {
    final current = await get(reminderId);
    if (current == null) return null;
    final schedulingChanged =
        (frequencyDays != null && frequencyDays != current.frequencyDays) ||
            (nextDue != null && nextDue != current.nextDue);

    if (schedulingChanged) {
      await _cancel(current.notificationId);
    }

    final updated = current.copyWith(
      title: title?.trim() ?? current.title,
      description: description != null
          ? (description.trim().isEmpty ? null : description.trim())
          : current.description,
      icon: (icon ?? '').trim().isNotEmpty ? icon!.trim() : current.icon,
      frequencyDays: frequencyDays ?? current.frequencyDays,
      nextDue: nextDue ?? current.nextDue,
    );

    int? notifId;
    if (updated.enabled && schedulingChanged) {
      notifId = await _schedule(updated);
    } else if (!schedulingChanged) {
      notifId = current.notificationId;
    }
    final out = updated.copyWith(notificationId: notifId);
    await _upsert(out);
    return out;
  }

  Future<bool> scheduleTestNotification({int delaySeconds = 5}) async {
    await ensureConfigured();
    final granted = await requestPermissions();
    if (!granted) return false;
    try {
      final when =
          DateTime.now().add(Duration(seconds: delaySeconds < 2 ? 2 : delaySeconds));
      await _notif.zonedSchedule(
        0,
        '🔔 HandyBot test notification',
        'Notifications are working. Tap to open Reminders.',
        tz.TZDateTime.from(when, tz.local),
        const NotificationDetails(
          android: AndroidNotificationDetails(_channelId, _channelName),
          iOS: DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Formatters (ported from lib/reminders.ts)
// ---------------------------------------------------------------------------

String formatDueDate(Reminder reminder) {
  final ms = reminder.nextDue - DateTime.now().millisecondsSinceEpoch;
  final days = (ms / _dayMs).round();
  if (days < 0) return '${days.abs()}d overdue';
  if (days == 0) return 'Due today';
  if (days == 1) return 'Due tomorrow';
  if (days < 30) return 'Due in $days days';
  final months = (days / 30).round();
  if (months == 1) return 'Due in ~1 month';
  return 'Due in ~$months months';
}

String formatFrequency(int days) {
  if (days <= 7) return 'Weekly';
  if (days <= 14) return 'Every 2 weeks';
  if (days <= 31) return 'Monthly';
  if (days <= 95) return 'Every 3 months';
  if (days <= 190) return 'Every 6 months';
  if (days <= 380) return 'Yearly';
  return 'Every ${(days / 30).round()} months';
}
